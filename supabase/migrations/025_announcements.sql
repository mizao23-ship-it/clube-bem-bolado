-- ══════════════════════════════════════════
-- 025: Sistema de Anúncios dinâmicos
-- ══════════════════════════════════════════

-- Enum-like check constraints via text
CREATE TABLE IF NOT EXISTS public.announcements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome            text NOT NULL,                          -- nome interno (admin)
  tipo            text NOT NULL DEFAULT 'imagem'          -- imagem | video_youtube | texto
                  CHECK (tipo IN ('imagem','video_youtube','texto')),
  titulo          text NOT NULL,
  descricao       text,
  midia_url       text,                                   -- image URL (storage) or YouTube URL
  cta_label       text NOT NULL DEFAULT 'Entendido!',
  cta_url         text,                                   -- link ao clicar (opcional)
  cta_url_mobile  text,                                   -- link alternativo no mobile
  veiculacao      text NOT NULL DEFAULT 'uma_vez'
                  CHECK (veiculacao IN ('uma_vez','por_sessao','sempre','a_cada_N_dias')),
  veiculacao_dias int,                                    -- só para a_cada_N_dias
  publico_alvo    text NOT NULL DEFAULT 'todos'
                  CHECK (publico_alvo IN ('todos','por_curso')),
  cursos_alvo     text[],                                 -- array de nomes de curso
  ativo           boolean NOT NULL DEFAULT false,
  prioridade      int NOT NULL DEFAULT 0,
  data_inicio     date,
  data_fim        date,
  created_by      uuid REFERENCES public.team_members(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.announcement_views (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id   uuid NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  visto_em          timestamptz NOT NULL DEFAULT now(),
  clicou_em         timestamptz,
  dispensado_em     timestamptz,
  UNIQUE (announcement_id, user_id)
);

-- RLS
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ann_admin_all" ON public.announcements
  FOR ALL USING (public.is_team_member());

CREATE POLICY "ann_member_select" ON public.announcements
  FOR SELECT USING (ativo = true);

CREATE POLICY "av_self" ON public.announcement_views
  FOR ALL USING (
    user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "av_admin_read" ON public.announcement_views
  FOR SELECT USING (public.is_team_member());

-- ── RPC: busca anúncios ativos para o membro logado ──
CREATE OR REPLACE FUNCTION public.get_active_announcements()
RETURNS TABLE (
  id              text,
  tipo            text,
  titulo          text,
  descricao       text,
  midia_url       text,
  cta_label       text,
  cta_url         text,
  cta_url_mobile  text,
  veiculacao      text,
  veiculacao_dias int,
  prioridade      int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_curso   text;
BEGIN
  SELECT u.id, u.curso INTO v_user_id, v_curso
  FROM public.users u WHERE u.auth_id = auth.uid() LIMIT 1;

  RETURN QUERY
  SELECT
    a.id::text, a.tipo, a.titulo, a.descricao, a.midia_url,
    a.cta_label, a.cta_url, a.cta_url_mobile,
    a.veiculacao, a.veiculacao_dias, a.prioridade
  FROM public.announcements a
  WHERE a.ativo = true
    AND (a.data_inicio IS NULL OR a.data_inicio <= CURRENT_DATE)
    AND (a.data_fim    IS NULL OR a.data_fim    >= CURRENT_DATE)
    AND (
      a.publico_alvo = 'todos'
      OR (a.publico_alvo = 'por_curso' AND v_curso = ANY(a.cursos_alvo))
    )
    AND (
      a.veiculacao = 'sempre'
      OR a.veiculacao = 'por_sessao'
      OR (a.veiculacao = 'uma_vez' AND NOT EXISTS (
        SELECT 1 FROM public.announcement_views av
        WHERE av.announcement_id = a.id AND av.user_id = v_user_id
          AND av.dispensado_em IS NOT NULL
      ))
      OR (a.veiculacao = 'a_cada_N_dias' AND NOT EXISTS (
        SELECT 1 FROM public.announcement_views av
        WHERE av.announcement_id = a.id AND av.user_id = v_user_id
          AND av.dispensado_em > NOW() - (a.veiculacao_dias || ' days')::interval
      ))
    )
  ORDER BY a.prioridade DESC, a.created_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_active_announcements FROM public;
GRANT EXECUTE ON FUNCTION public.get_active_announcements TO authenticated;

-- ── RPC: dispensar anúncio ──
CREATE OR REPLACE FUNCTION public.dismiss_announcement(
  p_announcement_id text,
  p_clicked         boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;

  INSERT INTO public.announcement_views (announcement_id, user_id, visto_em, clicou_em, dispensado_em)
  VALUES (
    p_announcement_id::uuid,
    v_user_id,
    NOW(),
    CASE WHEN p_clicked THEN NOW() ELSE NULL END,
    NOW()
  )
  ON CONFLICT (announcement_id, user_id) DO UPDATE
  SET dispensado_em = NOW(),
      clicou_em     = CASE WHEN p_clicked THEN NOW() ELSE announcement_views.clicou_em END;
END;
$$;

REVOKE ALL ON FUNCTION public.dismiss_announcement FROM public;
GRANT EXECUTE ON FUNCTION public.dismiss_announcement TO authenticated;

-- ── Seed: iFood como primeiro anúncio ──
INSERT INTO public.announcements (
  id, nome, tipo, titulo, descricao, midia_url,
  cta_label, cta_url, cta_url_mobile,
  veiculacao, publico_alvo, ativo, prioridade
) VALUES (
  'a1b2c3d4-0000-0000-0000-000000000001'::uuid,
  'iFood — 2 meses grátis (onboarding)',
  'imagem',
  'Presente especial pra você 🎁',
  'Como membro Clube Bem Bolado, você ganhou 2 meses grátis no iFood! Seu cupom será enviado via WhatsApp em breve.',
  NULL,
  'Entendido!',
  NULL,
  'https://app.ifood.com.br/F4X4/clubeciee',
  'uma_vez',
  'todos',
  true,
  100
) ON CONFLICT (id) DO NOTHING;

-- Migrar membros que já dispensaram o banner (coupon_redeemed_at preenchido)
INSERT INTO public.announcement_views (announcement_id, user_id, visto_em, clicou_em, dispensado_em)
SELECT
  'a1b2c3d4-0000-0000-0000-000000000001'::uuid,
  id,
  coupon_redeemed_at,
  coupon_redeemed_at,
  coupon_redeemed_at
FROM public.users
WHERE coupon_redeemed_at IS NOT NULL
ON CONFLICT (announcement_id, user_id) DO NOTHING;
