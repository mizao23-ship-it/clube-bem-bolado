-- ════════════════════════════════════════════════════════════
-- 018 — Admin Audit Log
--
-- Tabela de log imutável para ações administrativas no backoffice.
-- Registra: criação/edição de experiências, execução de sorteios,
-- gestão de usuários, equipe, etc.
--
-- Append-only: triggers bloqueiam UPDATE e DELETE.
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  executado_por uuid        REFERENCES public.team_members(id) ON DELETE SET NULL,
  acao          text        NOT NULL,
  -- ex: 'experiencia_criada', 'experiencia_editada', 'experiencia_removida',
  --     'sorteio_criado', 'sorteio_editado',
  --     'usuario_editado', 'usuario_desativado', 'usuario_sincronizado',
  --     'membro_equipe_adicionado', 'membro_equipe_removido',
  --     'admin_login'
  entidade      text,       -- 'experience' | 'sorteio' | 'user' | 'team_member'
  entidade_id   text,       -- UUID/ID da entidade afetada
  descricao     text,       -- Descrição legível por humanos
  metadata      jsonb,      -- Dados extras (valores antes/depois, IPs, etc.)
  ip_address    text,
  criado_em     timestamptz DEFAULT now() NOT NULL
);

-- Índices para busca rápida
CREATE INDEX IF NOT EXISTS admin_audit_log_executado_por_idx ON public.admin_audit_log (executado_por);
CREATE INDEX IF NOT EXISTS admin_audit_log_acao_idx          ON public.admin_audit_log (acao);
CREATE INDEX IF NOT EXISTS admin_audit_log_entidade_idx      ON public.admin_audit_log (entidade, entidade_id);
CREATE INDEX IF NOT EXISTS admin_audit_log_criado_em_idx     ON public.admin_audit_log (criado_em DESC);

-- ── Imutabilidade: bloqueia UPDATE e DELETE ───────────────
CREATE OR REPLACE FUNCTION public.admin_audit_log_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'admin_audit_log é imutável — UPDATE e DELETE não são permitidos.';
END;
$$;

DROP TRIGGER IF EXISTS trg_admin_audit_log_no_update ON public.admin_audit_log;
CREATE TRIGGER trg_admin_audit_log_no_update
  BEFORE UPDATE ON public.admin_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.admin_audit_log_immutable();

DROP TRIGGER IF EXISTS trg_admin_audit_log_no_delete ON public.admin_audit_log;
CREATE TRIGGER trg_admin_audit_log_no_delete
  BEFORE DELETE ON public.admin_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.admin_audit_log_immutable();

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Admins podem ler tudo
DROP POLICY IF EXISTS "admin_audit_log: admin lê tudo" ON public.admin_audit_log;
CREATE POLICY "admin_audit_log: admin lê tudo"
  ON public.admin_audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members
      WHERE auth_id = auth.uid() AND active = true
    )
  );

-- Somente SECURITY DEFINER pode inserir (via RPC abaixo)
DROP POLICY IF EXISTS "admin_audit_log: nenhum insert direto" ON public.admin_audit_log;
CREATE POLICY "admin_audit_log: nenhum insert direto"
  ON public.admin_audit_log FOR INSERT
  WITH CHECK (false);

-- ── RPC: log_admin_action ─────────────────────────────────────
-- Chamada pelo backend (edge functions, triggers) para registrar ações admin
CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_acao        text,
  p_entidade    text    DEFAULT NULL,
  p_entidade_id text    DEFAULT NULL,
  p_descricao   text    DEFAULT NULL,
  p_metadata    jsonb   DEFAULT NULL,
  p_ip_address  text    DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_member_id uuid;
BEGIN
  -- Resolve team_member pelo auth.uid()
  SELECT id INTO v_team_member_id
  FROM public.team_members
  WHERE auth_id = auth.uid() AND active = true
  LIMIT 1;

  INSERT INTO public.admin_audit_log (
    executado_por, acao, entidade, entidade_id,
    descricao, metadata, ip_address
  ) VALUES (
    v_team_member_id, p_acao, p_entidade, p_entidade_id,
    p_descricao, p_metadata, p_ip_address
  );
END;
$$;

REVOKE ALL ON FUNCTION public.log_admin_action FROM public;
GRANT EXECUTE ON FUNCTION public.log_admin_action TO authenticated;
