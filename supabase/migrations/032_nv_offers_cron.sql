-- ══════════════════════════════════════════════════════════════════
-- 032 — Cron job: aquece cache de ofertas NV a cada 30 min
--
-- Garante que o cache do banco (nv_offers_cache) nunca expire sem
-- ser renovado, evitando que qualquer usuário espere o fetch cold.
-- ══════════════════════════════════════════════════════════════════

-- Habilita extensões (idempotente)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remove job anterior se já existir (idempotente)
do $$
begin
  if exists (select 1 from cron.job where jobname = 'warm-nv-offers-cache') then
    perform cron.unschedule('warm-nv-offers-cache');
  end if;
end
$$;

-- Agenda: a cada 30 minutos
-- DB cache TTL = 60 min, FRESH TTL = 10 min
-- Ao rodar com cache 30 min old → edge function dispara refresh em background
select cron.schedule(
  'warm-nv-offers-cache',
  '*/30 * * * *',
  $$
  select net.http_post(
    url     := 'https://ctnjluwpblbarwiysrsw.supabase.co/functions/v1/ofertas-newvalue',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'apikey',        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0bmpsdXdwYmxiYXJ3aXlzcnN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MjQ5MDAsImV4cCI6MjA5MDMwMDkwMH0.3xmJM3-vACHdJGK3XuH8vnf4a9I4KaUlxy0oY1i2myI',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0bmpsdXdwYmxiYXJ3aXlzcnN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MjQ5MDAsImV4cCI6MjA5MDMwMDkwMH0.3xmJM3-vACHdJGK3XuH8vnf4a9I4KaUlxy0oY1i2myI'
    ),
    body    := '{}'::jsonb
  );
  $$
);
