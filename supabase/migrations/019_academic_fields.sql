-- ════════════════════════════════════════
-- 019 — Campos academicos em users + atualiza register_member
-- ════════════════════════════════════════

-- 1. Adiciona colunas na tabela users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS faculdade text,
  ADD COLUMN IF NOT EXISTS curso     text,
  ADD COLUMN IF NOT EXISTS semestre  text;

-- 2. Atualiza register_member para aceitar e salvar os novos campos
CREATE OR REPLACE FUNCTION public.register_member(
  p_auth_id       uuid,
  p_nome          text,
  p_email         text,
  p_telefone      text  DEFAULT NULL,
  p_ref_code      text  DEFAULT NULL,
  p_referral_code text  DEFAULT NULL,
  p_faculdade     text  DEFAULT NULL,
  p_curso         text  DEFAULT NULL,
  p_semestre      text  DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_referred_by  uuid := NULL;
  v_ref_code     text := p_ref_code;
  v_new_id       uuid;
BEGIN
  -- 1. Gera ref_code se nao fornecido
  IF v_ref_code IS NULL OR v_ref_code = '' THEN
    v_ref_code := upper(regexp_replace(split_part(p_nome, ' ', 1), '[^A-Z]', '', 'g'));
    v_ref_code := substring(v_ref_code FROM 1 FOR 6)
               || lpad(floor(random() * 900 + 100)::text, 3, '0');
  END IF;

  -- 2. Resolve referred_by a partir do codigo de indicacao
  IF p_referral_code IS NOT NULL AND p_referral_code <> '' THEN
    SELECT id INTO v_referred_by
      FROM public.users
     WHERE ref_code = upper(p_referral_code)
     LIMIT 1;

    IF v_referred_by IS NULL THEN
      RETURN json_build_object('error', 'Codigo de indicacao invalido.');
    END IF;
  END IF;

  -- 3. Garante unicidade do ref_code
  WHILE EXISTS (SELECT 1 FROM public.users WHERE ref_code = v_ref_code) LOOP
    v_ref_code := substring(v_ref_code FROM 1 FOR length(v_ref_code) - 3)
               || lpad(floor(random() * 900 + 100)::text, 3, '0');
  END LOOP;

  -- 4. Insere o perfil com campos academicos
  INSERT INTO public.users (
    auth_id, nome, email, telefone, ref_code, referred_by,
    faculdade, curso, semestre
  )
  VALUES (
    p_auth_id, p_nome, p_email, p_telefone, v_ref_code, v_referred_by,
    p_faculdade, p_curso, p_semestre
  )
  RETURNING id INTO v_new_id;

  -- 5. Retorna id + ref_code para o front chamar sync-newvalue e sync-rdstation
  RETURN json_build_object('id', v_new_id, 'ref_code', v_ref_code);
END;
$fn$;

COMMENT ON FUNCTION public.register_member IS
  'Cria perfil em public.users. Retorna {id, ref_code}. Aceita faculdade, curso e semestre.';
