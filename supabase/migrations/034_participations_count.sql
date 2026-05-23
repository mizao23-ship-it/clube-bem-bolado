-- 034: Coluna denormalizada de contagem de participações por experiência
-- + trigger automático que mantém o número sempre atualizado

-- 1. Adiciona a coluna
ALTER TABLE experiences
  ADD COLUMN IF NOT EXISTS participations_count INT NOT NULL DEFAULT 0;

-- 2. Backfill: preenche contagens já existentes
UPDATE experiences e
SET participations_count = (
  SELECT COUNT(*)::INT
  FROM participations p
  WHERE p.experience_id = e.id
);

-- 3. Função do trigger
CREATE OR REPLACE FUNCTION fn_update_participations_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE experiences
    SET participations_count = participations_count + 1
    WHERE id = NEW.experience_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE experiences
    SET participations_count = GREATEST(participations_count - 1, 0)
    WHERE id = OLD.experience_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Cria o trigger (AFTER INSERT OR DELETE)
DROP TRIGGER IF EXISTS trg_participations_count ON participations;
CREATE TRIGGER trg_participations_count
AFTER INSERT OR DELETE ON participations
FOR EACH ROW EXECUTE FUNCTION fn_update_participations_count();
