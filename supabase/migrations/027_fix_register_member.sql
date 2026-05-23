-- ══════════════════════════════════════════════════════════════════
-- 027 — Fix register_member: unifica assinaturas conflitantes
--
-- PROBLEMA: migrations 014 e 019 criaram versões com assinaturas
-- diferentes, gerando sobrecarga de função no PostgreSQL:
--   • 014: (..., p_created_by_admin boolean, p_ip_address text)
--   • 019: (..., p_faculdade text, p_curso text, p_semestre text)
--
-- O frontend envia os 9 parâmetros das duas versões combinados.
-- O PostgreSQL não encontra nenhuma função que aceite todos →
-- profileError ativado → auth user criado sem perfil (usuário órfão).
--
-- FIX: drop das versões antigas + nova função unificada com todos
-- os parâmetros necessários pelo frontend atual.
-- ══════════════════════════════════════════════════════════════════

-- Drop de todas as versões anteriores (cada assinatura diferente é
-- uma função distinta no PostgreSQL)
DROP FUNCTION IF EXISTS public.register_member(uuid, text, text, text, text, boolean, text);
DROP FUNCTION IF EXISTS public.register_member(uuid, text, text, text, text, text);
DROP FUNCTION IF EXISTS public.register_member(uuid, text, text, text, text, text, text, text);
DROP FUNCTION IF EXISTS public.register_member(uuid, text, text, text, text, text, text, text, text);

-- Função unificada: aceita todos os parâmetros que o frontend envia
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
  v_ref_code   text;
  v_new_id     uuid;
BEGIN

  -- ── 1. Valida código de indicação ───────────────────────────
  IF p_referral_code IS NULL OR trim(p_referral_code) = '' THEN
    RETURN json_build_object('error', 'Código de indicação é obrigatório.');
  END IF;

  SELECT * INTO v_referrer
  FROM public.users
  WHERE ref_code = upper(trim(p_referral_code))
  LIMIT 1;

  IF NOT FOUND THEN
    -- Registra tentativa inválida no log de referrals
    INSERT INTO public.referral_logs(action, referral_code, ip_address)
    VALUES ('invalid_attempt', upper(trim(p_referral_code)), p_ip_address);

    RETURN json_build_object('error', 'Código de indicação inválido.');
  END IF;

  -- ── 2. Gera ref_code único para o novo membro ────────────────
  v_ref_code := public.generate_referral_code();

  -- ── 3. Insere o novo membro ──────────────────────────────────
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

  -- ── 4. Registra cadastro bem-sucedido no log de referrals ────
  INSERT INTO public.referral_logs(action, referral_code, user_id, ip_address)
  VALUES ('signup', upper(trim(p_referral_code)), v_new_id, p_ip_address);

  -- ── 5. Retorna id + ref_code para o frontend ─────────────────
  RETURN json_build_object('id', v_new_id, 'ref_code', v_ref_code);

END;
$$;

REVOKE ALL ON FUNCTION public.register_member FROM public;
GRANT EXECUTE ON FUNCTION public.register_member TO anon, authenticated;
