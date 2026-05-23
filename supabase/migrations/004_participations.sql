-- ════════════════════════════════════════
-- 004 — Tabela participations
-- ════════════════════════════════════════
create table public.participations (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references public.users(id) on delete cascade,
  experience_id  text        not null references public.experiences(id) on delete cascade,
  registered_at  timestamptz not null default now(),
  unique (user_id, experience_id)
);

comment on table public.participations is 'Inscrições de membros em experiências/eventos';
