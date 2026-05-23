-- ============================================================
-- REFERRAL SYSTEM — fonte de referência (versão corrigida)
-- A migration numerada 014_referral_system.sql é a que deve
-- ser aplicada em produção (idempotente e com comentários).
-- ============================================================

-- ── 1. Colunas em users ──────────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS referral_used    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_by_admin boolean NOT NULL DEFAULT false;

-- ── 2. referral_logs ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.referral_logs (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  action         text        NOT NULL CHECK (action IN ('signup','invalid_attempt','code_used','rate_limited')),
  referral_code  text,
  user_id        uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  ip_address     text,
  created_at     timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.referral_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "referral_logs_deny_all" ON public.referral_logs;
CREATE POLICY "referral_logs_deny_all" ON public.referral_logs
  FOR ALL USING (false);

-- ── 3. rate_limit_attempts ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rate_limit_attempts (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  email        text        NOT NULL,
  attempted_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_email_time
  ON public.rate_limit_attempts(email, attempted_at);

ALTER TABLE public.rate_limit_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rate_limit_deny_all" ON public.rate_limit_attempts;
CREATE POLICY "rate_limit_deny_all" ON public.rate_limit_attempts
  FOR ALL USING (false);

-- ── 4. generate_referral_code() ──────────────────────────────
-- Formato: CLB + 8 chars aleatórios (A-Z, 0-9) — único, não-sequencial
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars text    := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  code  text;
  taken boolean;
BEGIN
  LOOP
    code := 'CLB';
    FOR i IN 1..8 LOOP
      code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    SELECT EXISTS(SELECT 1 FROM public.users WHERE ref_code = code) INTO taken;
    EXIT WHEN NOT taken;
  END LOOP;
  RETURN code;
END;
$$;

-- ── 5. Migra dados existentes ─────────────────────────────────
-- 5a. Usuários sem referred_by são usuários seed
UPDATE public.users
SET created_by_admin = true
WHERE created_by_admin = false
  AND referred_by IS NULL;

-- 5b. Gera código CLB para quem não tem
UPDATE public.users
SET ref_code = public.generate_referral_code()
WHERE ref_code IS NULL OR ref_code = '';

-- 5c. Marca referral_used = true para quem já teve código usado
--     FIX: comparação UUID × UUID (r.referred_by = u.id)
UPDATE public.users u
SET referral_used = true
WHERE EXISTS (
  SELECT 1 FROM public.users r WHERE r.referred_by = u.id
);

-- 5d. Recalcula indicados com contagem real
--     FIX: comparação UUID × UUID (r.referred_by = u.id)
UPDATE public.users u
SET indicados = (
  SELECT COUNT(*) FROM public.users r WHERE r.referred_by = u.id
)::int;

-- ── 6. register_member RPC ────────────────────────────────────
-- CORREÇÕES vs. versão original com bugs:
--   • referred_by = v_referrer.id  (era: upper(trim(p_referral_code)) → erro de tipo)
--   • Removido UPDATE indicados+1  (era duplicado com trigger 009_triggers.sql)
CREATE OR REPLACE FUNCTION public.register_member(
  p_auth_id          uuid    DEFAULT NULL,
  p_nome             text    DEFAULT NULL,
  p_email            text    DEFAULT NULL,
  p_telefone         text    DEFAULT NULL,
  p_referral_code    text    DEFAULT NULL,
  p_created_by_admin boolean DEFAULT false,
  p_ip_address       text    DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer      public.users%ROWTYPE;
  v_new_code      text;
  v_new_user_id   uuid;
  v_attempt_count int;
BEGIN

  -- Admin bypass — sem código necessário
  IF p_created_by_admin THEN
    v_new_code    := public.generate_referral_code();
    v_new_user_id := gen_random_uuid();

    INSERT INTO public.users (
      id, auth_id, nome, email, telefone, ref_code,
      referred_by, status, referral_used, created_by_admin, indicados
    ) VALUES (
      v_new_user_id, p_auth_id, p_nome, p_email, p_telefone, v_new_code,
      NULL, 'ativo', false, true, 0
    );

    RETURN json_build_object('id', v_new_user_id, 'ref_code', v_new_code);
  END IF;

  -- Código obrigatório para cadastro normal
  IF p_referral_code IS NULL OR trim(p_referral_code) = '' THEN
    RETURN json_build_object('error', 'Código de indicação é obrigatório.');
  END IF;

  -- Rate limit: 5 tentativas por e-mail por minuto
  SELECT COUNT(*) INTO v_attempt_count
  FROM public.rate_limit_attempts
  WHERE email        = lower(trim(p_email))
    AND attempted_at > now() - interval '1 minute';

  IF v_attempt_count >= 5 THEN
    INSERT INTO public.referral_logs(action, referral_code, ip_address)
    VALUES ('rate_limited', upper(trim(p_referral_code)), p_ip_address);

    RETURN json_build_object('error', 'Muitas tentativas. Aguarde um momento e tente novamente.');
  END IF;

  -- Valida o código (deve existir e não ter sido usado)
  SELECT * INTO v_referrer
  FROM public.users
  WHERE ref_code     = upper(trim(p_referral_code))
    AND referral_used = false;

  IF NOT FOUND THEN
    INSERT INTO public.rate_limit_attempts(email)
    VALUES (lower(trim(p_email)));

    INSERT INTO public.referral_logs(action, referral_code, ip_address)
    VALUES ('invalid_attempt', upper(trim(p_referral_code)), p_ip_address);

    RETURN json_build_object('error', 'Código inválido ou indisponível.');
  END IF;

  -- Cria novo membro
  v_new_code    := public.generate_referral_code();
  v_new_user_id := gen_random_uuid();

  INSERT INTO public.users (
    id, auth_id, nome, email, telefone, ref_code,
    referred_by, status, referral_used, created_by_admin, indicados
  ) VALUES (
    v_new_user_id, p_auth_id, p_nome, p_email, p_telefone, v_new_code,
    v_referrer.id,  -- ✅ UUID (CORRIGIDO: era upper(trim(p_referral_code)))
    'ativo', false, false, 0
    -- trigger on_user_referred incrementa indicados do referrer automaticamente
  );

  -- Marca convite como usado (trigger cuida do indicados — não duplicar aqui)
  UPDATE public.users
  SET referral_used = true
  WHERE id = v_referrer.id;

  INSERT INTO public.referral_logs(action, referral_code, user_id, ip_address)
  VALUES ('signup', upper(trim(p_referral_code)), v_new_user_id, p_ip_address);

  RETURN json_build_object('id', v_new_user_id, 'ref_code', v_new_code);

END;
$$;

-- ── 7. Permissões ─────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.register_member FROM public;
GRANT EXECUTE ON FUNCTION public.register_member TO anon, authenticated;

-- ── 8. Limpeza periódica de rate_limit (opcional — pg_cron) ──
-- DELETE FROM public.rate_limit_attempts WHERE attempted_at < now() - interval '1 hour';
