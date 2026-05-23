-- ══════════════════════════════════════════════════════════════════
-- 031 — Corrige limite de convite em register_member
--
-- PROBLEMA (regressão da 028): a migration 028 tornou register_member
-- idempotente mas removeu acidentalmente:
--   1. AND referral_used = false  — chave que bloqueia uso repetido
--   2. UPDATE referral_used = true — que marcava o convite como usado
--
-- Resultado: o mesmo link/código podia ser usado N vezes.
-- Fix: restaura as duas verificações mantendo o comportamento idempotente.
-- ══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.register_member(
  p_auth_id       uuid,
  p_nome          text,
  p_email         text,
  p_telefone      text    DEFAULT NULL,
  p_referral_code text    DEFAULT NULL,
  p_faculdade     text    DEFAULT NULL,
  p_curso         text    DEFAULT NULL,
  p_semestre      text    DEFAULT NULL,
  p_ip_address    text    DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer   public.users%ROWTYPE;
  v_existing   public.users%ROWTYPE;
  v_ref_code   text;
  v_new_id     uuid;
BEGIN

  -- ── 0. Idempotency: e-mail já cadastrado? ───────────────────────
  SELECT * INTO v_existing
  FROM public.users
  WHERE lower(trim(email)) = lower(trim(p_email))
  LIMIT 1;

  IF FOUND THEN
    -- Atualiza auth_id para apontar para o novo auth user (novo browser)
    -- e retorna o perfil existente sem alterar ref_code
    UPDATE public.users
    SET auth_id = p_auth_id
    WHERE id = v_existing.id;

    RETURN json_build_object(
      'id',            v_existing.id,
      'ref_code',      v_existing.ref_code,
      'already_exists', true
    );
  END IF;

  -- ── 1. Código de indicação obrigatório ──────────────────────────
  IF p_referral_code IS NULL OR trim(p_referral_code) = '' THEN
    RETURN json_build_object('error', 'Código de indicação é obrigatório.');
  END IF;

  -- ── 2. Valida código: deve existir E ainda não ter sido usado ────
  SELECT * INTO v_referrer
  FROM public.users
  WHERE ref_code = upper(trim(p_referral_code))
  LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO public.referral_logs(action, referral_code, ip_address)
    VALUES ('invalid_attempt', upper(trim(p_referral_code)), p_ip_address);

    RETURN json_build_object('error', 'Código de indicação inválido.');
  END IF;

  IF v_referrer.referral_used THEN
    INSERT INTO public.referral_logs(action, referral_code, ip_address)
    VALUES ('already_used', upper(trim(p_referral_code)), p_ip_address);

    RETURN json_build_object('error', 'Este código de indicação já foi utilizado.');
  END IF;

  -- ── 3. Gera ref_code único para o novo membro ───────────────────
  v_ref_code := public.generate_referral_code();

  -- ── 4. Insere o novo membro ─────────────────────────────────────
  INSERT INTO public.users (
    auth_id, nome, email, telefone, ref_code, referred_by,
    faculdade, curso, semestre
  )
  VALUES (
    p_auth_id,
    p_nome,
    lower(trim(p_email)),
    p_telefone,
    v_ref_code,
    v_referrer.id,
    p_faculdade,
    p_curso,
    p_semestre
  )
  RETURNING id INTO v_new_id;

  -- ── 5. Marca convite do indicador como usado ────────────────────
  -- (o trigger on_user_referred de 009 cuida de incrementar indicados)
  UPDATE public.users
  SET referral_used = true
  WHERE id = v_referrer.id;

  -- ── 6. Registra no log de referrals ────────────────────────────
  INSERT INTO public.referral_logs(action, referral_code, user_id, ip_address)
  VALUES ('signup', upper(trim(p_referral_code)), v_new_id, p_ip_address);

  -- ── 7. Retorna id + ref_code ────────────────────────────────────
  RETURN json_build_object('id', v_new_id, 'ref_code', v_ref_code);

END;
$$;

REVOKE ALL ON FUNCTION public.register_member FROM public;
GRANT EXECUTE ON FUNCTION public.register_member TO anon, authenticated;
