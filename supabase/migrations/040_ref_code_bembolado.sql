-- ══════════════════════════════════════════════════════════════════
-- 040 — Nova engine de ref_code: BB + 4 chars
--
-- Substitui o formato antigo "CLB + 8 chars" (legado clubiee) por:
--   "BB" + 4 caracteres alfanuméricos, sem ambíguos (0, O, 1, I)
--
-- Pool de 32 chars × 4 posições = ~1M combinações.
-- Códigos existentes continuam válidos (a coluna aceita qualquer string).
-- Apenas novos cadastros recebem o formato BB.
-- ══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  -- Pool sem ambíguos: removidos 0, O, 1, I
  chars text    := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code  text;
  taken boolean;
BEGIN
  LOOP
    code := 'BB';
    FOR i IN 1..4 LOOP
      code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    SELECT EXISTS(SELECT 1 FROM public.users WHERE ref_code = code) INTO taken;
    EXIT WHEN NOT taken;
  END LOOP;
  RETURN code;
END;
$$;
