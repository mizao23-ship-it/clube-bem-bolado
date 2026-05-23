-- ════════════════════════════════════════
-- 036 — Função check_is_admin()
-- Retorna true se o usuário logado é team_member ativo
-- Usada no AdminLogin para verificar permissão
-- ════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.team_members
    WHERE auth_id = auth.uid()
      AND active = true
      AND role IN ('admin', 'operador')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_is_admin() FROM public;
GRANT EXECUTE ON FUNCTION public.check_is_admin() TO authenticated;

COMMENT ON FUNCTION public.check_is_admin IS
  'Retorna true se o usuário autenticado é team_member ativo (admin ou operador).';
