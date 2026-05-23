-- ════════════════════════════════════════
-- 020 — Termo de adesão + aceite na participação
-- ════════════════════════════════════════

-- 1. Campo termo_adesao na experiência
ALTER TABLE public.experiences
  ADD COLUMN IF NOT EXISTS termo_adesao text;

-- 2. Timestamp de aceite do termo na participação
ALTER TABLE public.participations
  ADD COLUMN IF NOT EXISTS aceito_termo_em timestamptz;
