-- ════════════════════════════════════════════════════════════
-- 014 — Referral System (corrigido)
-- Corrige dois bugs críticos do referral_system.sql não-numerado:
--
--   BUG 1 (CRÍTICO): referred_by recebia o TEXT do código de
--     indicação em vez do UUID do referrer → erro de tipo no PG.
--     Fix: usar v_referrer.id (uuid) no INSERT.
--
--   BUG 2 (ALTO): indicados era incrementado 2× por cadastro
--     porque a RPC fazia UPDATE indicados+1 E o trigger
--     on_user_referred (009) também fazia indicados+1.
--     Fix: remover o UPDATE da RPC; deixar apenas o trigger.
--
--   BUG 3 (ALTO): sync histórico usava `r.referred_by = u.ref_code`
--     (uuid = text) → comparação silenciosa sem resultado correto.
--     Fix: usar `r.referred_by = u.id`.
--
-- Esta migration é idempotente — segura para re-executar.
-- ════════════════════════════════════════════════════════════

-- ── 1. Colunas adicionais em users ──────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS referral_used    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_by_admin boolean NOT NULL DEFAULT false;

-- ── 2. Tabela referral_logs ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.referral_logs (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  action         text        NOT NULL
                             CHECK (action IN ('signup','invalid_attempt','code_used','rate_limited')),
  referral_code  text,
  user_id        uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  ip_address     text,
  created_at     timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.referral_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "referral_logs_deny_all" ON public.referral_logs;
CREATE POLICY "referral_logs_deny_all" ON public.referral_logs
  FOR ALL USING (false);

-- ── 3. Tabela rate_limit_attempts ────────────────────────────
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

-- ── 4. Função generate_referral_code() ──────────────────────
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

-- ── 5. Sincroniza dados históricos ───────────────────────────

-- 5a. Marca usuários existentes sem referred_by como created_by_admin
--     (são os usuários seed / cadastrados antes do sistema de convites)
UPDATE public.users
SET created_by_admin = true
WHERE created_by_admin = false
  AND referred_by IS NULL;

-- 5b. Garante que todos os usuários têm ref_code preenchido
UPDATE public.users
SET ref_code = public.generate_referral_code()
WHERE ref_code IS NULL OR ref_code = '';

-- 5c. Marca referral_used = true para quem já teve seu código usado
--     FIX: comparação UUID × UUID (antes era UUID × TEXT — não funcionava)
UPDATE public.users u
SET referral_used = true
WHERE EXISTS (
  SELECT 1 FROM public.users r WHERE r.referred_by = u.id
);

-- 5d. Recalcula indicados com a contagem real — corrige qualquer drift
--     FIX: comparação UUID × UUID (antes era UUID × TEXT — não funcionava)
UPDATE public.users u
SET indicados = (
  SELECT COUNT(*) FROM public.users r WHERE r.referred_by = u.id
)::int;

-- ── 6. register_member RPC — versão corrigida ────────────────
--
-- CORREÇÕES vs. referral_system.sql original:
--   • referred_by = v_referrer.id  ← UUID correto  (era: upper(trim(p_referral_code)))
--   • Removido UPDATE indicados+1  ← evita duplo incremento com trigger 009
--   • referral_used = true ainda atualizado aqui (o trigger não faz isso)
--
-- Drop todas versões anteriores antes de recriar
DROP FUNCTION IF EXISTS public.register_member(uuid,text,text,text,text) CASCADE;
DROP FUNCTION IF EXISTS public.register_member(uuid,text,text,text,text,text) CASCADE;
DROP FUNCTION IF EXISTS public.register_member(uuid,text,text,text,text,boolean,text) CASCADE;
DROP FUNCTION IF EXISTS public.register_member(uuid,text,text,text,text,text,text,text,text) CASCADE;

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

  -- ── Admin bypass — sem código de indicação necessário ────────
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

  -- ── Código de indicação é obrigatório para membros normais ────
  IF p_referral_code IS NULL OR trim(p_referral_code) = '' THEN
    RETURN json_build_object('error', 'Código de indicação é obrigatório.');
  END IF;

  -- ── Rate limit: 5 tentativas por e-mail por minuto ────────────
  SELECT COUNT(*) INTO v_attempt_count
  FROM public.rate_limit_attempts
  WHERE email        = lower(trim(p_email))
    AND attempted_at > now() - interval '1 minute';

  IF v_attempt_count >= 5 THEN
    INSERT INTO public.referral_logs(action, referral_code, ip_address)
    VALUES ('rate_limited', upper(trim(p_referral_code)), p_ip_address);

    RETURN json_build_object('error', 'Muitas tentativas. Aguarde um momento e tente novamente.');
  END IF;

  -- ── Valida o código de indicação ──────────────────────────────
  -- Busca o referrer pelo código; rejeita se já foi usado (1 convite por pessoa)
  SELECT * INTO v_referrer
  FROM public.users
  WHERE ref_code     = upper(trim(p_referral_code))
    AND referral_used = false;

  IF NOT FOUND THEN
    -- Registra tentativa falha para rate limiting
    INSERT INTO public.rate_limit_attempts(email)
    VALUES (lower(trim(p_email)));

    -- Mensagem genérica — não revela se o código existe ou está esgotado
    INSERT INTO public.referral_logs(action, referral_code, ip_address)
    VALUES ('invalid_attempt', upper(trim(p_referral_code)), p_ip_address);

    RETURN json_build_object('error', 'Código inválido ou indisponível.');
  END IF;

  -- ── Cria o novo membro ────────────────────────────────────────
  v_new_code    := public.generate_referral_code();
  v_new_user_id := gen_random_uuid();

  INSERT INTO public.users (
    id, auth_id, nome, email, telefone, ref_code,
    referred_by, status, referral_used, created_by_admin, indicados
  ) VALUES (
    v_new_user_id, p_auth_id, p_nome, p_email, p_telefone, v_new_code,
    v_referrer.id,   -- ✅ UUID correto (BUG CORRIGIDO: era upper(trim(p_referral_code)))
    'ativo', false, false, 0
    -- indicados = 0; o trigger on_user_referred (009) incrementa o referrer automaticamente
  );

  -- ── Marca o convite do indicador como usado ───────────────────
  -- NÃO incrementa indicados aqui — o trigger on_user_referred já cuida disso
  -- (BUG CORRIGIDO: havia UPDATE indicados+1 aqui causando duplo incremento)
  UPDATE public.users
  SET referral_used = true
  WHERE id = v_referrer.id;

  -- ── Registra evento de cadastro bem-sucedido ─────────────────
  INSERT INTO public.referral_logs(action, referral_code, user_id, ip_address)
  VALUES ('signup', upper(trim(p_referral_code)), v_new_user_id, p_ip_address);

  RETURN json_build_object('id', v_new_user_id, 'ref_code', v_new_code);

END;
$$;

-- ── 7. Garante permissões corretas ───────────────────────────
