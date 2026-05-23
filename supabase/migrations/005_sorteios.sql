-- ════════════════════════════════════════
-- 005 — Tabela sorteios
-- ════════════════════════════════════════
create table public.sorteios (
  id           serial      primary key,
  premio       text        not null,
  descricao    text,
  encerramento date,
  status       text        not null default 'ativo'
                 check (status in ('ativo', 'encerrado')),
  elegivel     text        not null default 'todos'
                 check (elegivel in ('todos', 'indicou', 'manual')),
  n_ganhadores int         not null default 1,
  ganhador_id  uuid        references public.users(id) on delete set null,
  created_at   timestamptz not null default now()
);
