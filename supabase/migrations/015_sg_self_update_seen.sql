-- ════════════════════════════════════════════════════════
-- 015 — RLS: membro pode marcar próprio prêmio como visto
--
-- Bug: sorteio_ganhadores só tinha policy SELECT para membros.
-- O UPDATE de seen_at no handleDismissWinner silenciosamente
-- falhava (0 rows afetadas, sem erro) → modal voltava a cada login.
-- Fix: adiciona policy UPDATE restrita ao próprio user_id.
-- ════════════════════════════════════════════════════════

CREATE POLICY "sg_self_update_seen"
  ON public.sorteio_ganhadores FOR UPDATE
  USING (
    user_id = (
      SELECT id FROM public.users
      WHERE auth_id = auth.uid()
      LIMIT 1
    )
  )
  WITH CHECK (
    user_id = (
      SELECT id FROM public.users
      WHERE auth_id = auth.uid()
      LIMIT 1
    )
  );
