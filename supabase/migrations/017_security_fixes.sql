-- ════════════════════════════════════════════════════════════
-- 017 — Security Fixes (pós-pentest)
--
-- VULN 1 (CRÍTICO): membro pode manipular campos sensíveis
--   A policy "membro: atualiza próprio perfil" usava UPDATE
--   irrestrito — um membro podia fazer PATCH direto e alterar
--   indicados, referral_used, status, ref_code, etc.
--   Fix: substituir UPDATE direto por RPC update_profile()
--
-- VULN 2 (ALTO): ghost users sem auth_id real
--   register_member aceitava p_auth_id=null ou qualquer UUID,
--   criando usuários sem conta de autenticação real.
--   Fix: validar que p_auth_id == auth.uid() quando não é admin.
-- ════════════════════════════════════════════════════════════

-- ── VULN 1: Remove UPDATE direto do membro ───────────────────
DROP POLICY IF EXISTS "membro: atualiza próprio perfil" ON public.users;

-- RPC segura para atualização de perfil — só campos seguros
CREATE OR REPLACE FUNCTION public.update_profile(
  p_nome     text DEFAULT NULL,
  p_telefone text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.users
  SET
    nome     = COALESCE(NULLIF(trim(p_nome), ''),    nome),
    telefone = COALESCE(NULLIF(trim(p_telefone), ''), telefone)
  WHERE auth_id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.update_profile(text,text) FROM public;
GRANT EXECUTE ON FUNCTION public.update_profile(text,text) TO authenticated;

-- ── VULN 2: register_member valida auth_id ───────────────────
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

  -- ── VULN 2 FIX: p_auth_id deve corresponder ao auth.uid() ──
  -- Impede criação de ghost users com auth_id falso ou null
  IF p_auth_id IS NULL OR p_auth_id != auth.uid() THEN
    RETURN json_build_object('error', 'Autenticação inválida.');
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
    v_referrer.id, 'ativo', false, false, 0
  );

  -- Marca convite como usado (trigger cuida do indicados)
  UPDATE public.users
  SET referral_used = true
  WHERE id = v_referrer.id;

  INSERT INTO public.referral_logs(action, referral_code, user_id, ip_address)
  VALUES ('signup', upper(trim(p_referral_code)), v_new_user_id, p_ip_address);

  RETURN json_build_object('id', v_new_user_id, 'ref_code', v_new_code);
END;
$$;

