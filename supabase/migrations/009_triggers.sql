-- ════════════════════════════════════════
-- 009 — Triggers
-- ════════════════════════════════════════

-- ── 1. Incrementa indicados quando um novo membro é cadastrado
--       com referred_by preenchido ──
create or replace function public.increment_indicados()
returns trigger language plpgsql security definer as $$
begin
  if NEW.referred_by is not null then
    update public.users
    set indicados = indicados + 1
    where id = NEW.referred_by;
  end if;
  return NEW;
end;
$$;

create trigger on_user_referred
  after insert on public.users
  for each row
  execute procedure public.increment_indicados();

-- ── 2. Decrementa indicados se o membro for deletado e tinha um referrer ──
create or replace function public.decrement_indicados()
returns trigger language plpgsql security definer as $$
begin
  if OLD.referred_by is not null then
    update public.users
    set indicados = greatest(indicados - 1, 0)
    where id = OLD.referred_by;
  end if;
  return OLD;
end;
$$;

create trigger on_user_deleted
  before delete on public.users
  for each row
  execute procedure public.decrement_indicados();
