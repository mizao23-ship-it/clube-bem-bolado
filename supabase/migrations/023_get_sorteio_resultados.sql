-- RPC pública (SECURITY DEFINER) para retornar resultados de todos os sorteios encerrados
-- Bypassa RLS de sorteio_ganhadores (que é self-only) para exibir vencedores no portal do membro
CREATE OR REPLACE FUNCTION public.get_sorteio_resultados()
RETURNS TABLE (
  experience_id  text,
  premio         text,
  draw_date      date,
  winner_nome    text,
  winner_user_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.experience_id::text,
    s.premio,
    s.draw_date,
    u.nome,
    sg.user_id
  FROM public.sorteio_ganhadores sg
  JOIN public.sorteios s ON s.id = sg.sorteio_id
  JOIN public.users    u ON u.id = sg.user_id
  WHERE sg.posicao = 1
    AND s.status   = 'encerrado'
    AND s.experience_id IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.get_sorteio_resultados FROM public;
GRANT EXECUTE ON FUNCTION public.get_sorteio_resultados TO authenticated;
