-- 035: Super Destaque — campo booleano em experiences
-- Todas as experiências existentes ficam false por padrão (retrocompatível)

ALTER TABLE experiences
  ADD COLUMN IF NOT EXISTS super_destaque BOOLEAN NOT NULL DEFAULT false;
