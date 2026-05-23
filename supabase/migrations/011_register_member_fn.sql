-- ════════════════════════════════════════
-- 011 — Função register_member (SECURITY DEFINER)
-- Chamada pelo front logo após supabase.auth.signUp().
-- Roda com privilégios de owner → bypassa RLS.
-- ════════════════════════════════════════

create or replace function public.register_member(
  p_auth_id      uuid,
  p_nome         text,
  p_email        text,
  p_telefone     text     default null,
  p_ref_code     text     default null,
  p_referral_code text    default null   -- código de quem indicou (lookup)
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referred_by  uuid    := null;
  v_ref_code     text    := p_ref_code;
  v_new_id       uuid;
begin
  -- 1. Gera ref_code se não fornecido
  if v_ref_code is null or v_ref_code = '' then
    v_ref_code := upper(regexp_replace(split_part(p_nome, ' ', 1), '[^A-Z]', '', 'g'));
    v_ref_code := substring(v_ref_code from 1 for 6)
               || lpad(floor(random() * 900 + 100)::text, 3, '0');
  end if;

  -- 2. Resolve referred_by a partir do código de indicação
  if p_referral_code is not null and p_referral_code <> '' then
    select id into v_referred_by
      from public.users
     where ref_code = upper(p_referral_code)
     limit 1;
  end if;

  -- 3. Garante unicidade do ref_code (sufixo extra em caso de colisão)
  while exists (select 1 from public.users where ref_code = v_ref_code) loop
    v_ref_code := substring(v_ref_code from 1 for length(v_ref_code) - 3)
               || lpad(floor(random() * 900 + 100)::text, 3, '0');
  end loop;

  -- 4. Insere o perfil
  insert into public.users (auth_id, nome, email, telefone, ref_code, referred_by)
  values (p_auth_id, p_nome, p_email, p_telefone, v_ref_code, v_referred_by)
  returning id into v_new_id;

  return v_new_id;
end;
$$;

-- Revoga acesso público e permite apenas usuários autenticados + anon
-- (anon precisa chamar logo após o signUp, antes da sessão existir)
revoke all on function public.register_member from public;
grant execute on function public.register_member to anon, authenticated;

comment on function public.register_member is
  'Cria perfil em public.users após supabase.auth.signUp(). SECURITY DEFINER bypassa RLS — a validação é feita internamente.';
