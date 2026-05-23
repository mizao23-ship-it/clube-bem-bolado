-- ══════════════════════════════════════════════════════════════════
-- 033 — Adiciona 'indicacao' ao CHECK constraint de announcements.tipo
-- ══════════════════════════════════════════════════════════════════

-- Remove o constraint antigo e recria incluindo o novo tipo
ALTER TABLE announcements
  DROP CONSTRAINT IF EXISTS announcements_tipo_check;

ALTER TABLE announcements
  ADD CONSTRAINT announcements_tipo_check
  CHECK (tipo IN ('imagem', 'video_youtube', 'texto', 'indicacao'));
