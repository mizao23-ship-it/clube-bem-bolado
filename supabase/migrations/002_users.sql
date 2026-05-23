-- ════════════════════════════════════════
-- 002 — Tabela public.users
-- Ponte entre auth.users (Supabase Auth) e
-- o perfil do membro no clube.
-- ════════════════════════════════════════
create table public.users (
  id           uuid        primary key default gen_random_uuid(),
  auth_id      uuid        unique references auth.users(id) on delete cascade,
  nome         text        not null,
  email        text        not null unique,
  telefone     text,
  ref_code     text        not null unique,
  referred_by  uuid        references public.users(id) on delete set null,
  indicados    int         not null default 0,
  status       text        not null default 'ativo'
                             check (status in ('ativo', 'inativo')),
  nv_user_id   text,
  nv_synced_at timestamptz,
  created_at   timestamptz not null default now()
);

comment on column public.users.auth_id     is 'FK para auth.users — ponte com o sistema de autenticação Supabase';
comment on column public.users.ref_code    is 'Código único de indicação gerado no front (ex: MARIA427)';
comment on column public.users.referred_by is 'ID do membro que indicou este usuário';
comment on column public.users.nv_user_id  is 'ID retornado pela New Value API após sync';
