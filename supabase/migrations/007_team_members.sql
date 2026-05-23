-- ════════════════════════════════════════
-- 007 — Tabela team_members
-- Usuários com acesso ao backoffice admin.
-- ════════════════════════════════════════
create table public.team_members (
  id          uuid        primary key default gen_random_uuid(),
  auth_id     uuid        unique references auth.users(id) on delete cascade,
  nome        text        not null,
  email       text        not null unique,
  role        text        not null default 'operador'
                check (role in ('admin', 'operador')),
  active      boolean     not null default true,
  last_seen   timestamptz,
  created_at  timestamptz not null default now()
);

comment on column public.team_members.auth_id is 'FK para auth.users — permite login via Supabase Auth';
comment on column public.team_members.role    is 'admin: acesso total | operador: acesso limitado';
