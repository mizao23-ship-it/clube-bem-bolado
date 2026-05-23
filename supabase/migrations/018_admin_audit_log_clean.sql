CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  executado_por uuid        REFERENCES public.team_members(id) ON DELETE SET NULL,
  acao          text        NOT NULL,
  entidade      text,
  entidade_id   text,
  descricao     text,
  metadata      jsonb,
  ip_address    text,
  criado_em     timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS admin_audit_log_executado_por_idx ON public.admin_audit_log (executado_por);
CREATE INDEX IF NOT EXISTS admin_audit_log_acao_idx ON public.admin_audit_log (acao);
CREATE INDEX IF NOT EXISTS admin_audit_log_entidade_idx ON public.admin_audit_log (entidade, entidade_id);
CREATE INDEX IF NOT EXISTS admin_audit_log_criado_em_idx ON public.admin_audit_log (criado_em DESC);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_audit_log_read" ON public.admin_audit_log;
CREATE POLICY "admin_audit_log_read"
  ON public.admin_audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members
      WHERE auth_id = auth.uid() AND active = true
    )
  );

DROP POLICY IF EXISTS "admin_audit_log_no_insert" ON public.admin_audit_log;
CREATE POLICY "admin_audit_log_no_insert"
  ON public.admin_audit_log FOR INSERT
  WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.admin_audit_log_immutable()
RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  RAISE EXCEPTION 'admin_audit_log is immutable';
END;
$fn$;

DROP TRIGGER IF EXISTS trg_admin_audit_log_no_update ON public.admin_audit_log;
CREATE TRIGGER trg_admin_audit_log_no_update
  BEFORE UPDATE ON public.admin_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.admin_audit_log_immutable();

DROP TRIGGER IF EXISTS trg_admin_audit_log_no_delete ON public.admin_audit_log;
CREATE TRIGGER trg_admin_audit_log_no_delete
  BEFORE DELETE ON public.admin_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.admin_audit_log_immutable();

CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_acao        text,
  p_entidade    text    DEFAULT NULL,
  p_entidade_id text    DEFAULT NULL,
  p_descricao   text    DEFAULT NULL,
  p_metadata    jsonb   DEFAULT NULL,
  p_ip_address  text    DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_team_member_id uuid;
BEGIN
  SELECT id INTO v_team_member_id
  FROM public.team_members
  WHERE auth_id = auth.uid() AND active = true
  LIMIT 1;

  INSERT INTO public.admin_audit_log (
    executado_por, acao, entidade, entidade_id, descricao, metadata, ip_address
  ) VALUES (
    v_team_member_id, p_acao, p_entidade, p_entidade_id, p_descricao, p_metadata, p_ip_address
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.log_admin_action FROM public;
GRANT EXECUTE ON FUNCTION public.log_admin_action TO authenticated;
