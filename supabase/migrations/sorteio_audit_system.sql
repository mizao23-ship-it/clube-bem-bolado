-- ============================================================
-- SORTEIO AUDIT SYSTEM MIGRATION
-- Run this in Supabase SQL Editor (step by step if needed)
-- ============================================================

-- ── 1. sorteio_inscricoes ─────────────────────────────────
-- Tabela de inscrições com dados de auditoria (canal, ip, user_agent)
CREATE TABLE IF NOT EXISTS public.sorteio_inscricoes (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  experience_id text        NOT NULL REFERENCES public.experiences(id) ON DELETE CASCADE,
  user_id       uuid        NOT NULL REFERENCES public.users(id)       ON DELETE CASCADE,
  inscrito_em   timestamptz NOT NULL DEFAULT now(),
  ip_inscricao  inet,
  user_agent    text,
  canal         text        DEFAULT 'app' CHECK (canal IN ('app','backoffice','api')),
  UNIQUE (experience_id, user_id)
);

ALTER TABLE public.sorteio_inscricoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "si_self_select" ON public.sorteio_inscricoes
  FOR SELECT USING (
    user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "si_self_insert" ON public.sorteio_inscricoes
  FOR INSERT WITH CHECK (
    user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
  );

-- ── 2. Extend sorteios with audit columns ─────────────────
ALTER TABLE public.sorteios
  ADD COLUMN IF NOT EXISTS executado_por         uuid REFERENCES public.team_members(id),
  ADD COLUMN IF NOT EXISTS executado_em          timestamptz,
  ADD COLUMN IF NOT EXISTS total_inscritos       int,
  ADD COLUMN IF NOT EXISTS seed_randomico        text,
  ADD COLUMN IF NOT EXISTS algoritmo_versao      text,
  ADD COLUMN IF NOT EXISTS hash_lista_inscritos  text,
  ADD COLUMN IF NOT EXISTS hash_resultado        text,
  ADD COLUMN IF NOT EXISTS observacoes           text;

-- ── 3. sorteio_ganhadores ─────────────────────────────────
-- Substitui sorteio_winners. Um registro por ganhador, com ciclo de status.
CREATE TABLE IF NOT EXISTS public.sorteio_ganhadores (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  sorteio_id    int         NOT NULL REFERENCES public.sorteios(id) ON DELETE CASCADE,
  user_id       uuid        NOT NULL REFERENCES public.users(id)    ON DELETE CASCADE,
  posicao       int         NOT NULL DEFAULT 1,
  status        text        NOT NULL DEFAULT 'pendente'
                CHECK (status IN ('pendente','notificado','confirmado','expirado','recusado')),
  notificado_em timestamptz,
  confirmado_em timestamptz,
  expirado_em   timestamptz,
  seen_at       timestamptz, -- compatibilidade com lógica atual do modal
  UNIQUE (sorteio_id, user_id),
  UNIQUE (sorteio_id, posicao)
);

ALTER TABLE public.sorteio_ganhadores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sg_self_select" ON public.sorteio_ganhadores
  FOR SELECT USING (
    user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "sg_admin_all" ON public.sorteio_ganhadores
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.team_members WHERE auth_id = auth.uid())
  );

-- ── 4. sorteio_audit_log ──────────────────────────────────
-- Log imutável: append-only, sem UPDATE, sem DELETE.
CREATE TABLE IF NOT EXISTS public.sorteio_audit_log (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  sorteio_id    int         REFERENCES public.sorteios(id),
  ganhador_id   uuid        REFERENCES public.sorteio_ganhadores(id),
  user_id       uuid        REFERENCES public.users(id),
  acao          text        NOT NULL
                CHECK (acao IN (
                  'sorteio_executado','ganhador_notificado',
                  'ganhador_confirmou','ganhador_recusou',
                  'prazo_expirado','sorteio_anulado'
                )),
  executado_por uuid        REFERENCES public.team_members(id),
  ip            inet,
  user_agent    text,
  metadata      jsonb,
  criado_em     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sorteio_audit_log ENABLE ROW LEVEL SECURITY;

-- Admin pode ler
CREATE POLICY "sal_admin_read" ON public.sorteio_audit_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.team_members WHERE auth_id = auth.uid())
  );

-- INSERT apenas via SECURITY DEFINER — nenhuma política permite diretamente
CREATE POLICY "sal_deny_direct_insert" ON public.sorteio_audit_log
  FOR INSERT WITH CHECK (false);

-- Trigger imutável: bloqueia UPDATE e DELETE para qualquer role
CREATE OR REPLACE FUNCTION public.fn_audit_log_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'sorteio_audit_log é append-only: UPDATE e DELETE não são permitidos';
END;
$$;

DROP TRIGGER IF EXISTS tg_audit_log_immutable ON public.sorteio_audit_log;
CREATE TRIGGER tg_audit_log_immutable
  BEFORE UPDATE OR DELETE ON public.sorteio_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log_immutable();

-- ── 5. Backfill sorteio_inscricoes from participations ────
INSERT INTO public.sorteio_inscricoes (experience_id, user_id, inscrito_em, canal)
SELECT p.experience_id, p.user_id,
       COALESCE(p.registered_at, now()), 'app'
FROM public.participations p
WHERE NOT EXISTS (
  SELECT 1 FROM public.sorteio_inscricoes si
  WHERE si.experience_id = p.experience_id AND si.user_id = p.user_id
);

-- SKIP (fresh install): -- ── 6. Migrate sorteio_winners → sorteio_ganhadores ───────
-- INSERT INTO public.sorteio_ganhadores
--   (sorteio_id, user_id, posicao, status, notificado_em, seen_at)
-- SELECT
--   sw.sorteio_id,
--   sw.user_id,
--   1,
--   CASE WHEN sw.seen_at IS NOT NULL THEN 'confirmado' ELSE 'notificado' END,
--   sw.resultado_at,
--   sw.seen_at
-- FROM public.sorteio_winners sw
-- WHERE NOT EXISTS (
--   SELECT 1 FROM public.sorteio_ganhadores sg
--   WHERE sg.sorteio_id = sw.sorteio_id AND sg.user_id = sw.user_id
-- )
-- ON CONFLICT DO NOTHING;
-- 
-- ── 7. executar_sorteio RPC ───────────────────────────────
-- Realiza o sorteio server-side, grava auditoria completa.
-- Chama esta RPC no lugar do insert manual em sorteio_winners.
CREATE OR REPLACE FUNCTION public.executar_sorteio(
  p_sorteio_id    int,
  p_executado_por uuid DEFAULT NULL,
  p_observacoes   text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sorteio          public.sorteios%ROWTYPE;
  v_inscritos        uuid[];
  v_ganhadores       uuid[];
  v_seed             text;
  v_hash_lista       text;
  v_hash_resultado   text;
  v_total            int;
  v_n                int;
  i                  int;
BEGIN
  -- Busca e valida sorteio
  SELECT * INTO v_sorteio FROM public.sorteios WHERE id = p_sorteio_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Sorteio não encontrado.');
  END IF;
  IF v_sorteio.status = 'encerrado' THEN
    RETURN json_build_object('error', 'Este sorteio já foi realizado.');
  END IF;

  -- Lista de inscritos ordenada (base determinística para hash)
  SELECT ARRAY(
    SELECT user_id FROM public.participations
    WHERE experience_id = v_sorteio.experience_id
    ORDER BY user_id
  ) INTO v_inscritos;

  v_total := COALESCE(array_length(v_inscritos, 1), 0);
  IF v_total = 0 THEN
    RETURN json_build_object('error', 'Nenhum inscrito nesta experiência.');
  END IF;

  v_n := LEAST(COALESCE(v_sorteio.n_ganhadores, 1), v_total);

  -- Seed e hashes de auditoria
  v_seed       := gen_random_uuid()::text;
  v_hash_lista := encode(sha256(array_to_string(v_inscritos, ',')::bytea), 'hex');

  -- Sorteio: shuffle e pega os N primeiros
  SELECT ARRAY(
    SELECT unnest(v_inscritos) ORDER BY random() LIMIT v_n
  ) INTO v_ganhadores;

  -- Hash do resultado (ganhadores em ordem alfabética para determinismo)
  v_hash_resultado := encode(
    sha256(array_to_string(ARRAY(SELECT unnest(v_ganhadores) ORDER BY 1), ',')::bytea),
    'hex'
  );

  -- Atualiza sorteio com dados de auditoria
  UPDATE public.sorteios SET
    status               = 'encerrado',
    executado_por        = p_executado_por,
    executado_em         = now(),
    total_inscritos      = v_total,
    seed_randomico       = v_seed,
    algoritmo_versao     = 'v1.0',
    hash_lista_inscritos = v_hash_lista,
    hash_resultado       = v_hash_resultado,
    observacoes          = p_observacoes,
    ganhador_id          = v_ganhadores[1]
  WHERE id = p_sorteio_id;

  -- Insere cada ganhador em sorteio_ganhadores
  FOR i IN 1..array_length(v_ganhadores, 1) LOOP
    INSERT INTO public.sorteio_ganhadores
      (sorteio_id, user_id, posicao, status, notificado_em, expirado_em)
    VALUES
      (p_sorteio_id, v_ganhadores[i], i, 'notificado', now(), now() + interval '72 hours')
    ON CONFLICT DO NOTHING;

    -- Compatibilidade: desabilitado (fresh install, tabela não existe)
    -- INSERT INTO public.sorteio_winners (sorteio_id, user_id)
    -- VALUES (p_sorteio_id, v_ganhadores[i])
    -- ON CONFLICT DO NOTHING;
  END LOOP;

  -- Log de auditoria
  INSERT INTO public.sorteio_audit_log
    (sorteio_id, acao, executado_por, metadata)
  VALUES (
    p_sorteio_id,
    'sorteio_executado',
    p_executado_por,
    jsonb_build_object(
      'total_inscritos', v_total,
      'num_ganhadores',  v_n,
      'seed',            v_seed,
      'algoritmo',       'v1.0',
      'hash_lista',      v_hash_lista,
      'hash_resultado',  v_hash_resultado
    )
  );

  RETURN json_build_object(
    'sorteio_id',      p_sorteio_id,
    'ganhadores',      v_ganhadores,
    'total_inscritos', v_total,
    'hash_lista',      v_hash_lista,
    'hash_resultado',  v_hash_resultado
  );
END;
$$;

-- ── 8. confirmar_premio RPC ───────────────────────────────
-- Chamado pelo usuário ao ver o modal de ganhador.
CREATE OR REPLACE FUNCTION public.confirmar_premio(
  p_ganhador_id uuid,
  p_user_id     uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_g public.sorteio_ganhadores%ROWTYPE;
BEGIN
  SELECT * INTO v_g
  FROM public.sorteio_ganhadores
  WHERE id = p_ganhador_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Não encontrado ou sem permissão.');
  END IF;

  IF v_g.status NOT IN ('pendente', 'notificado') THEN
    RETURN json_build_object('error', 'Prêmio já processado (status: ' || v_g.status || ').');
  END IF;

  IF v_g.expirado_em IS NOT NULL AND v_g.expirado_em < now() THEN
    UPDATE public.sorteio_ganhadores SET status = 'expirado' WHERE id = p_ganhador_id;
    INSERT INTO public.sorteio_audit_log (sorteio_id, ganhador_id, user_id, acao)
    VALUES (v_g.sorteio_id, p_ganhador_id, p_user_id, 'prazo_expirado');
    RETURN json_build_object('error', 'O prazo para confirmação expirou.');
  END IF;

  UPDATE public.sorteio_ganhadores
  SET status        = 'confirmado',
      confirmado_em = now(),
      seen_at       = COALESCE(seen_at, now())
  WHERE id = p_ganhador_id;

  INSERT INTO public.sorteio_audit_log (sorteio_id, ganhador_id, user_id, acao)
  VALUES (v_g.sorteio_id, p_ganhador_id, p_user_id, 'ganhador_confirmou');

  RETURN json_build_object('ok', true);
END;
$$;

-- ── 9. expirar_premios_vencidos ───────────────────────────
-- Rodar periodicamente via pg_cron ou Edge Function cron.
-- Exemplo pg_cron: SELECT cron.schedule('expirar-premios', '0 * * * *', 'SELECT expirar_premios_vencidos()');
CREATE OR REPLACE FUNCTION public.expirar_premios_vencidos()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_count int;
BEGIN
  WITH expired AS (
    UPDATE public.sorteio_ganhadores
    SET status = 'expirado'
    WHERE status = 'notificado'
      AND expirado_em IS NOT NULL
      AND expirado_em < now()
    RETURNING id, sorteio_id, user_id
  )
  INSERT INTO public.sorteio_audit_log (sorteio_id, ganhador_id, user_id, acao)
  SELECT sorteio_id, id, user_id, 'prazo_expirado' FROM expired;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
