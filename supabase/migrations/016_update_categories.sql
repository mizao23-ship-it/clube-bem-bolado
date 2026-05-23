-- ════════════════════════════════════════════════════════════
-- 016 — Atualiza categorias de experiências
--
-- De: cultura | tech | carreira | esportes | arte | networking | lazer
-- Para: shows | cultura | tecnologia | carreira | esportes | arte |
--        negocios | lifestyle | viagem | bem_estar
--
-- Migrações de dados:
--   tech       → tecnologia
--   networking → negocios
--   lazer      → lifestyle
-- ════════════════════════════════════════════════════════════

-- ── 1. Remove o CHECK constraint antigo ──────────────────────
ALTER TABLE public.experiences
  DROP CONSTRAINT IF EXISTS experiences_category_check;

-- ── 2. Migra os dados existentes ─────────────────────────────
UPDATE public.experiences SET category = 'tecnologia' WHERE category = 'tech';
UPDATE public.experiences SET category = 'negocios'   WHERE category = 'networking';
UPDATE public.experiences SET category = 'lifestyle'  WHERE category = 'lazer';

-- ── 3. Adiciona o novo CHECK constraint ──────────────────────
ALTER TABLE public.experiences
  ADD CONSTRAINT experiences_category_check
  CHECK (category IN (
    'shows',
    'cultura',
    'tecnologia',
    'carreira',
    'esportes',
    'arte',
    'negocios',
    'lifestyle',
    'viagem',
    'bem_estar'
  ));
