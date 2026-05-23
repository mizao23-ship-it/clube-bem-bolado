-- ════════════════════════════════════════
-- 003 — Tabela experiences
-- ════════════════════════════════════════
create table public.experiences (
  id          text        primary key,  -- slug: "exp_weeknd"
  name        text        not null,
  category    text        not null
                check (category in (
                  'shows','cultura','tecnologia',
                  'carreira','esportes','arte',
                  'negocios','lifestyle','viagem','bem_estar'
                )),
  description text,
  img_url     text,
  active      boolean     not null default true,
  created_at  timestamptz not null default now()
);
