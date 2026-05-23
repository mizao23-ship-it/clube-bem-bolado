-- ════════════════════════════════════════
-- 038 — Colunas extras em experiences e sorteios
-- Adicionadas originalmente via dashboard, sem migration.
-- ════════════════════════════════════════

-- experiences: datas, limite e vínculo com sorteio
ALTER TABLE public.experiences
  ADD COLUMN IF NOT EXISTS start_date        date,
  ADD COLUMN IF NOT EXISTS end_date          date,
  ADD COLUMN IF NOT EXISTS limit_participants int;

-- sorteios: vínculo com experience e data do sorteio
ALTER TABLE public.sorteios
  ADD COLUMN IF NOT EXISTS experience_id text REFERENCES public.experiences(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS draw_date     date;
