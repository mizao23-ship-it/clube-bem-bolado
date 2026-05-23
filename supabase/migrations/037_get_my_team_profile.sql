-- ════════════════════════════════════════
-- 037 — Função get_my_team_profile()
-- Retorna o perfil do team_member logado.
-- Usada pelo AuthContext para popular isAdmin.
-- ════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_my_team_profile()
RETURNS public.team_members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member public.team_members%ROWTYPE;
BEGIN
  SELECT * INTO v_member
  FROM public.team_members
  WHERE auth_id = auth.uid()
    AND active = true
  LIMIT 1;

  RETURN v_member;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_team_profile() FROM public;
GRANT EXECUTE ON FUNCTION public.get_my_team_profile() TO authenticated;

COMMENT ON FUNCTION public.get_my_team_profile IS
  'Retorna o perfil do team_member ativo do usuário logado. Usada pelo AuthContext.';
