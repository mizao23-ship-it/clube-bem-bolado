-- ══════════════════════════════════════════
-- 026 — update_profile com campos acadêmicos
-- ══════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.update_profile(
  p_nome      text DEFAULT NULL,
  p_telefone  text DEFAULT NULL,
  p_faculdade text DEFAULT NULL,
  p_curso     text DEFAULT NULL,
  p_semestre  text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.users
  SET
    nome      = COALESCE(NULLIF(trim(p_nome),      ''), nome),
    telefone  = COALESCE(NULLIF(trim(p_telefone),  ''), telefone),
    faculdade = CASE WHEN p_faculdade IS NOT NULL THEN NULLIF(trim(p_faculdade), '') ELSE faculdade END,
    curso     = CASE WHEN p_curso     IS NOT NULL THEN NULLIF(trim(p_curso),     '') ELSE curso     END,
    semestre  = CASE WHEN p_semestre  IS NOT NULL THEN NULLIF(trim(p_semestre),  '') ELSE semestre  END
  WHERE auth_id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.update_profile FROM public;
GRANT EXECUTE ON FUNCTION public.update_profile TO authenticated;
