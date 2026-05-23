-- ════════════════════════════════════════
-- 010 — Seed de experiences e parceiros
-- Dados extraídos dos HTMLs de referência
-- ════════════════════════════════════════

-- ── Experiences ──
insert into public.experiences (id, name, category, description) values
  ('exp_weeknd',      'Show The Weeknd',          'cultura',    '2 ingressos · After Hours Til Dawn · Allianz Parque SP'),
  ('exp_techsummit',  'Tech Summit SP',            'tech',       'Conferência de tecnologia com 40+ palestras'),
  ('exp_startup',     'Startup Weekend',           'tech',       'Hackathon de 54h para lançar seu produto'),
  ('exp_teatro',      'Peça Teatro Municipal',     'arte',       'Apresentação exclusiva no Teatro Municipal de SP'),
  ('exp_museu',       'Museu do Amanhã RJ',        'cultura',    'Visita guiada exclusiva para membros'),
  ('exp_crossfit',    'CrossFit Open',             'esportes',   'Competição aberta de CrossFit — vagas limitadas'),
  ('exp_maratona',    'Maratona de SP',            'esportes',   'Inscrição para a Maratona Internacional de São Paulo'),
  ('exp_workshop',    'Workshop UX Design',        'carreira',   'Workshop intensivo de UX com especialistas'),
  ('exp_mentoria',    'Mentoria Carreiras Tech',   'carreira',   'Sessão de mentoria 1:1 com líderes de tech'),
  ('exp_networking',  'Happy Hour Networking',     'networking', 'Encontro mensal de profissionais do mercado'),
  ('exp_investimento','Painel de Investimentos',   'carreira',   'Talk com gestores e especialistas em finanças'),
  ('exp_cinema',      'Pré-estreia Exclusiva',     'lazer',      'Sessão privada de pré-estreia para membros'),
  ('exp_gastronomia', 'Jantar Degustação',         'lazer',      'Menu degustação 6 tempos em restaurante premiado'),
  ('exp_surfcamp',    'Surf Camp Guarujá',         'esportes',   'Final de semana de surf com aulas e hospedagem'),
  ('exp_expo',        'Exposição Arte Moderna',    'arte',       'Visita guiada à exposição temporária no MASP')
on conflict (id) do nothing;

-- ── Parceiros ──
insert into public.parceiros (nome, categoria, emoji, desconto, descricao) values
  ('Burger King',    'alimentacao', '🍔', '20% off',       'Válido nos apps e lojas físicas'),
  ('iFood',          'alimentacao', '🛵', 'R$ 30 off',     '3 cupons de R$ 10 por mês'),
  ('Outback',        'alimentacao', '🥩', '15% off',       'Jantares e almoços, exceto feriados'),
  ('Wizard',         'educacao',    '🎓', '40% off',       'Matrícula e mensalidades de idiomas'),
  ('Coursera',       'educacao',    '💻', '50% off',       'Plano Plus anual para membros Clube Bem Bolado'),
  ('Descomplica',    'educacao',    '📚', '30% off',       'Pré-vestibular e graduação online'),
  ('Dr. Consulta',   'saude',       '🏥', 'R$ 50 off',     'Consultas médicas e exames laboratoriais'),
  ('Gympass',        'saude',       '💪', 'Plano Basic',   'Acesso a academias parceiras em todo Brasil'),
  ('Óticas Carol',   'saude',       '👓', '25% off',       'Armações, lentes e óculos de sol'),
  ('Cinemark',       'lazer',       '🎬', '2 por 1',       'Segundas e terças, sessões 2D e 3D'),
  ('CVC',            'lazer',       '✈️', '10% off',       'Pacotes de viagem nacionais e internacionais'),
  ('Ingresso.com',   'lazer',       '🎟️', '15% off',      'Shows, teatros e eventos culturais'),
  ('Renner',         'moda',        '👗', '20% off',       'Roupas, calçados e acessórios'),
  ('Zara',           'moda',        '🛍️', '10% off',      'Compras acima de R$ 300'),
  ('Netshoes',       'moda',        '👟', '25% off',       'Tênis, roupas e acessórios esportivos')
on conflict do nothing;

-- ── Sorteios iniciais ──
insert into public.sorteios (premio, descricao, encerramento, status, elegivel, n_ganhadores) values
  ('Show The Weeknd',   '2 ingressos · After Hours Til Dawn · Allianz Parque SP', '2025-08-15', 'ativo',    'todos',  1),
  ('Kit Beleza Premium','Kit skincare premium avaliado em R$ 800',                '2025-04-30', 'ativo',    'todos',  1)
on conflict do nothing;
