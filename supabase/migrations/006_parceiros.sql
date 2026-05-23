-- ════════════════════════════════════════
-- 006 — Tabela parceiros
-- ════════════════════════════════════════
create table public.parceiros (
  id            serial  primary key,
  nome          text    not null,
  categoria     text    not null
                  check (categoria in (
                    'alimentacao','educacao','saude','lazer','moda'
                  )),
  emoji         text,
  desconto      text,
  descricao     text,
  autologin_url text,
  active        boolean not null default true
);
