-- ════════════════════════════════════════
-- 013 — Fixes: colunas, RLS e funções
-- ════════════════════════════════════════

-- ── 1. Colunas coupon para usuários (iFood) ──
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS coupon_seen_at     timestamptz,
  ADD COLUMN IF NOT EXISTS coupon_redeemed_at timestamptz;

-- ── 2. Coluna must_change_password para team_members ──
ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

-- ── 3. Função is_admin() — SECURITY DEFINER para bypass de RLS ──
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE auth_id = auth.uid() AND active = true AND role = 'admin'
  );
$$;

-- ── 4. Corrige recursão infinita em team_members ──
-- A policy anterior "admin: gerencia equipe" fazia SELECT em team_members
-- dentro de uma policy de team_members → recursão infinita → HTTP 500.
-- Substituímos por is_admin() que é SECURITY DEFINER.
DROP POLICY IF EXISTS "admin: gerencia equipe" ON public.team_members;
CREATE POLICY "admin: gerencia equipe"
  ON public.team_members FOR ALL
  USING (public.is_admin());

-- ── 5. Corrige recursão em sorteio_ganhadores ──
-- sg_admin_all fazia SELECT direto em team_members → herdava a recursão.
DROP POLICY IF EXISTS "sg_admin_all" ON public.sorteio_ganhadores;
CREATE POLICY "sg_admin_all"
  ON public.sorteio_ganhadores FOR ALL
  USING (public.is_team_member());
