-- Cache persistente para ofertas da New Value
-- Sobrevive a cold starts da Edge Function

CREATE TABLE IF NOT EXISTS nv_offers_cache (
  key        text        PRIMARY KEY DEFAULT 'main',
  data       jsonb       NOT NULL,
  cached_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE nv_offers_cache ENABLE ROW LEVEL SECURITY;

-- Leitura pública (anon e authenticated)
CREATE POLICY "nv_offers_cache_select"
  ON nv_offers_cache FOR SELECT
  TO anon, authenticated
  USING (true);
