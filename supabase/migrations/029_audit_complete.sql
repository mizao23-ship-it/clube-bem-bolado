-- ══════════════════════════════════════════════════════════════════════
-- 029 — Auditoria completa
--   • auth_logs            — logins/logouts de membros e admins
--   • member_profile_logs  — alterações de perfil de membros
--   • participations       — adiciona ip_address + user_agent
--   • referral_logs        — suporta action = 'link_click'
--   • RPCs públicas e autenticadas para cada tipo de evento
-- ══════════════════════════════════════════════════════════════════════

-- ── 1. auth_logs ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.auth_logs (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid        REFERENCES public.users(id)        ON DELETE SET NULL,
  team_id     uuid        REFERENCES public.team_members(id) ON DELETE SET NULL,
  evento      text        NOT NULL,
  -- Membros:  login | logout | cadastro | login_falhou | senha_redefinida
  -- Admins:   admin_login | admin_logout | admin_login_falhou
  ip_address  text,
  user_agent  text,
  metadata    jsonb,
  criado_em   timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS auth_logs_user_id_idx   ON public.auth_logs (user_id);
CREATE INDEX IF NOT EXISTS auth_logs_team_id_idx   ON public.auth_logs (team_id);
CREATE INDEX IF NOT EXISTS auth_logs_evento_idx    ON public.auth_logs (evento);
CREATE INDEX IF NOT EXISTS auth_logs_criado_em_idx ON public.auth_logs (criado_em DESC);

ALTER TABLE public.auth_logs ENABLE ROW LEVEL SECURITY;

-- Admins podem ler todos os logs de auth
CREATE POLICY "auth_logs_admin_read" ON public.auth_logs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.team_members WHERE auth_id = auth.uid() AND active = true
  ));

-- Inserção apenas via RPC (nenhuma policy de INSERT → bloqueado diretamente)
CREATE POLICY "auth_logs_no_direct_insert" ON public.auth_logs FOR INSERT
  WITH CHECK (false);

-- Imutável — bloqueia UPDATE e DELETE
CREATE OR REPLACE FUNCTION public.auth_logs_immutable()
RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  RAISE EXCEPTION 'auth_logs é append-only: UPDATE e DELETE não são permitidos';
END;
$fn$;

DROP TRIGGER IF EXISTS tg_auth_logs_no_update ON public.auth_logs;
CREATE TRIGGER tg_auth_logs_no_update
  BEFORE UPDATE ON public.auth_logs
  FOR EACH ROW EXECUTE FUNCTION public.auth_logs_immutable();

DROP TRIGGER IF EXISTS tg_auth_logs_no_delete ON public.auth_logs;
CREATE TRIGGER tg_auth_logs_no_delete
  BEFORE DELETE ON public.auth_logs
  FOR EACH ROW EXECUTE FUNCTION public.auth_logs_immutable();

-- ── 2. member_profile_logs ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.member_profile_logs (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  antes       jsonb       NOT NULL,
  depois      jsonb       NOT NULL,
  ip_address  text,
  user_agent  text,
  criado_em   timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS member_profile_logs_user_id_idx   ON public.member_profile_logs (user_id);
CREATE INDEX IF NOT EXISTS member_profile_logs_criado_em_idx ON public.member_profile_logs (criado_em DESC);

ALTER TABLE public.member_profile_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "member_profile_logs_admin_read" ON public.member_profile_logs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.team_members WHERE auth_id = auth.uid() AND active = true
  ));

CREATE POLICY "member_profile_logs_no_direct_insert" ON public.member_profile_logs FOR INSERT
  WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.member_profile_logs_immutable()
RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  RAISE EXCEPTION 'member_profile_logs é append-only';
END;
$fn$;

DROP TRIGGER IF EXISTS tg_member_profile_logs_no_update ON public.member_profile_logs;
CREATE TRIGGER tg_member_profile_logs_no_update
  BEFORE UPDATE ON public.member_profile_logs
  FOR EACH ROW EXECUTE FUNCTION public.member_profile_logs_immutable();

DROP TRIGGER IF EXISTS tg_member_profile_logs_no_delete ON public.member_profile_logs;
CREATE TRIGGER tg_member_profile_logs_no_delete
  BEFORE DELETE ON public.member_profile_logs
  FOR EACH ROW EXECUTE FUNCTION public.member_profile_logs_immutable();

-- ── 3. participations — adiciona ip e user_agent ──────────────────────
ALTER TABLE public.participations ADD COLUMN IF NOT EXISTS ip_address text;
ALTER TABLE public.participations ADD COLUMN IF NOT EXISTS user_agent text;

-- ── 4. referral_logs — suporta link_click ────────────────────────────
-- Remove constraint existente e recria com 'link_click' incluído
ALTER TABLE public.referral_logs
  DROP CONSTRAINT IF EXISTS referral_logs_action_check;

ALTER TABLE public.referral_logs
  ADD CONSTRAINT referral_logs_action_check
  CHECK (action IN ('signup','invalid_attempt','code_used','rate_limited','link_click'));

-- ── 5. RPC: log_member_auth — para membros autenticados ──────────────
CREATE OR REPLACE FUNCTION public.log_member_auth(
  p_evento     text,
  p_ip         text  DEFAULT NULL,
  p_ua         text  DEFAULT NULL,
  p_metadata   jsonb DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;

  INSERT INTO public.auth_logs (user_id, evento, ip_address, user_agent, metadata)
  VALUES (v_user_id, p_evento, p_ip, p_ua, p_metadata);
END;
$fn$;

REVOKE ALL ON FUNCTION public.log_member_auth FROM public;
GRANT EXECUTE ON FUNCTION public.log_member_auth TO authenticated;

-- ── 6. RPC: log_auth_event_public — para eventos sem sessão ──────────
--    Usado em: login_falhou (membro), admin_login_falhou, link_click
CREATE OR REPLACE FUNCTION public.log_auth_event_public(
  p_evento     text,
  p_email      text  DEFAULT NULL,
  p_ip         text  DEFAULT NULL,
  p_ua         text  DEFAULT NULL,
  p_metadata   jsonb DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_user_id uuid;
  v_team_id uuid;
BEGIN
  -- Tenta identificar o usuário pelo e-mail (best-effort, pode ser NULL)
  SELECT id INTO v_user_id FROM public.users WHERE email = lower(trim(p_email)) LIMIT 1;
  SELECT id INTO v_team_id FROM public.team_members WHERE email = lower(trim(p_email)) LIMIT 1;

  INSERT INTO public.auth_logs (user_id, team_id, evento, ip_address, user_agent, metadata)
  VALUES (v_user_id, v_team_id, p_evento, p_ip, p_ua, p_metadata);
END;
$fn$;

REVOKE ALL ON FUNCTION public.log_auth_event_public FROM public;
GRANT EXECUTE ON FUNCTION public.log_auth_event_public TO anon;
GRANT EXECUTE ON FUNCTION public.log_auth_event_public TO authenticated;

-- ── 7. RPC: log_admin_auth — para admins autenticados ────────────────
CREATE OR REPLACE FUNCTION public.log_admin_auth(
  p_evento     text,
  p_ip         text  DEFAULT NULL,
  p_ua         text  DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_team_id uuid;
BEGIN
  SELECT id INTO v_team_id FROM public.team_members WHERE auth_id = auth.uid() LIMIT 1;

  INSERT INTO public.auth_logs (team_id, evento, ip_address, user_agent)
  VALUES (v_team_id, p_evento, p_ip, p_ua);
END;
$fn$;

REVOKE ALL ON FUNCTION public.log_admin_auth FROM public;
GRANT EXECUTE ON FUNCTION public.log_admin_auth TO authenticated;

-- ── 8. RPC: log_member_profile_change ────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_member_profile_change(
  p_antes     jsonb,
  p_depois    jsonb,
  p_ip        text  DEFAULT NULL,
  p_ua        text  DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;

  INSERT INTO public.member_profile_logs (user_id, antes, depois, ip_address, user_agent)
  VALUES (v_user_id, p_antes, p_depois, p_ip, p_ua);
END;
$fn$;

REVOKE ALL ON FUNCTION public.log_member_profile_change FROM public;
GRANT EXECUTE ON FUNCTION public.log_member_profile_change TO authenticated;

-- ── 9. RPC: log_link_click — anon pode chamar ────────────────────────
CREATE OR REPLACE FUNCTION public.log_link_click(
  p_referral_code text,
  p_ip            text DEFAULT NULL,
  p_ua            text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  -- Só registra se o código existe (evita spam com códigos inválidos)
  IF EXISTS (SELECT 1 FROM public.users WHERE ref_code = upper(trim(p_referral_code))) THEN
    INSERT INTO public.referral_logs (action, referral_code, ip_address)
    VALUES ('link_click', upper(trim(p_referral_code)), p_ip);
  END IF;
END;
$fn$;

REVOKE ALL ON FUNCTION public.log_link_click FROM public;
GRANT EXECUTE ON FUNCTION public.log_link_click TO anon;
GRANT EXECUTE ON FUNCTION public.log_link_click TO authenticated;
