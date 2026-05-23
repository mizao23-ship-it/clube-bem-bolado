-- Visibilidade pós-sorteio
-- oculto_em: preenchido manualmente por admin para ocultar do portal
-- A lógica de 7 dias após sorteio encerrado é aplicada no frontend
ALTER TABLE public.experiences
  ADD COLUMN IF NOT EXISTS oculto_em timestamptz DEFAULT NULL;
