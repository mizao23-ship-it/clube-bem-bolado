-- Garante que um membro não pode ter participações duplicadas na mesma experiência
ALTER TABLE public.participations
  ADD CONSTRAINT participations_user_experience_unique
  UNIQUE (user_id, experience_id);
