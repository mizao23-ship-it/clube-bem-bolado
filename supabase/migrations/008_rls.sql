-- ════════════════════════════════════════
-- 008 — Row Level Security
-- ════════════════════════════════════════

-- ── helpers ──
-- Verifica se o usuário logado é um admin/operador ativo
create or replace function public.is_team_member()
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.team_members
    where auth_id = auth.uid() and active = true
  );
$$;

-- ── public.users ──
alter table public.users enable row level security;

-- Membro lê e atualiza apenas o próprio perfil
create policy "membro: lê próprio perfil"
  on public.users for select
  using (auth.uid() = auth_id);

create policy "membro: atualiza próprio perfil"
  on public.users for update
  using (auth.uid() = auth_id)
  with check (auth.uid() = auth_id);

-- Admin/operador lê todos os perfis
create policy "admin: lê todos os usuários"
  on public.users for select
  using (public.is_team_member());

-- Admin/operador insere e atualiza qualquer usuário
create policy "admin: insere usuários"
  on public.users for insert
  with check (public.is_team_member());

create policy "admin: atualiza usuários"
  on public.users for update
  using (public.is_team_member());

-- O próprio sistema insere no cadastro (auth trigger)
create policy "sistema: insere no cadastro"
  on public.users for insert
  with check (auth.uid() = auth_id);

-- ── public.participations ──
alter table public.participations enable row level security;

-- Membro gerencia apenas as próprias participações
create policy "membro: gerencia próprias participações"
  on public.participations for all
  using (
    user_id = (
      select id from public.users where auth_id = auth.uid()
    )
  );

-- Admin lê todas as participações
create policy "admin: lê todas as participações"
  on public.participations for select
  using (public.is_team_member());

-- ── public.experiences ──
alter table public.experiences enable row level security;

create policy "autenticado: lê experiences ativas"
  on public.experiences for select
  using (auth.role() = 'authenticated' and active = true);

create policy "admin: gerencia experiences"
  on public.experiences for all
  using (public.is_team_member());

-- ── public.sorteios ──
alter table public.sorteios enable row level security;

create policy "autenticado: lê sorteios"
  on public.sorteios for select
  using (auth.role() = 'authenticated');

create policy "admin: gerencia sorteios"
  on public.sorteios for all
  using (public.is_team_member());

-- ── public.parceiros ──
alter table public.parceiros enable row level security;

create policy "autenticado: lê parceiros ativos"
  on public.parceiros for select
  using (auth.role() = 'authenticated' and active = true);

create policy "admin: gerencia parceiros"
  on public.parceiros for all
  using (public.is_team_member());

-- ── public.team_members ──
alter table public.team_members enable row level security;

create policy "membro da equipe: lê próprio perfil"
  on public.team_members for select
  using (auth.uid() = auth_id);

create policy "admin: gerencia equipe"
  on public.team_members for all
  using (
    exists (
      select 1 from public.team_members tm
      where tm.auth_id = auth.uid()
        and tm.active = true
        and tm.role = 'admin'
    )
  );
