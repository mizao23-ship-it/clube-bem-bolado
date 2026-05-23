import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

const NV_BASE             = 'https://api-v2.newvalue.com.br/api/v2/key'
const PER_PAGE            = 20                    // igual ao site NV → servido do cache Cloudflare deles
const NV_SP_LOCATION_ID   = 2                     // São Paulo (estado) na hierarquia NV — inclui todas as cidades + nacionais
const CACHE_TTL_FRESH = 10 * 60 * 1000        // 10 min — fresh
const CACHE_TTL_STALE = 60 * 60 * 1000        // 60 min — stale mas usável (DB cache cobre o resto)
const DB_CACHE_TTL    = 60 * 60 * 1000        // 60 min — TTL do cache no banco

// L1: cache em memória (persiste enquanto o processo está quente)
let _cache: { data: unknown[]; ts: number } | null = null
let _refreshing = false

// ── Helpers de idioma ──
type LangObj = { pt?: string; en?: string; es?: string } | string | null | undefined
function pt(obj: LangObj): string {
  if (!obj) return ''
  if (typeof obj === 'string') return obj
  return obj.pt ?? obj.en ?? obj.es ?? ''
}

// ── Slim: mantém só campos usados, descarta ES/EN e campos irrelevantes ──
function slimOffer(o: Record<string, unknown>): Record<string, unknown> {
  const media = ((o.media as Array<Record<string, unknown>>) ?? []).map(m => ({
    url:             m.url,
    urlStandard:     m.urlStandard,
    collection_name: m.collection_name,
  }))

  const address = ((o.address as Array<Record<string, unknown>>) ?? []).map(a => ({
    city:  a.city,
    state: a.state,
  }))

  const categories = ((o.categories as Array<Record<string, unknown>>) ?? []).map(c => {
    const name = c.name as LangObj
    return { id: c.id, name: { pt: pt(name) } }
  })

  const meta  = o.offer_meta as Record<string, unknown> | null
  const howTo = meta?.how_to_use as LangObj
  const link  = meta?.link_site  as LangObj

  const partner = o.partner as Record<string, unknown> | null

  return {
    id:          o.id,
    uuid:        o.uuid,
    title:       { pt: pt(o.title    as LangObj) },
    subtitle:    { pt: pt(o.subtitle as LangObj) },
    content:     { pt: pt(o.content  as LangObj) },
    type:        o.type,
    is_featured: o.is_featured,
    active:      o.active,
    expires_at:  o.expires_at,
    media,
    address,
    categories,
    offer_meta: meta ? {
      how_to_use:  howTo ? { pt: pt(howTo) } : undefined,
      link_site:   link  ? { pt: pt(link)  } : undefined,
      partner_name: meta.partner_name,
    } : undefined,
    partner: partner ? { id: partner.id, name: partner.name } : undefined,
  }
}

// POST /offers/search com whereLocation=[SP] — filtro server-side, inclui interior SP + nacionais
async function fetchPage(token: string, uuid: string, page: number) {
  const include = 'media,address,categories,offerMeta,partner'
  const url = `${NV_BASE}/offers/search?uuid=${uuid}&per_page=${PER_PAGE}&page=${page}&include=${encodeURIComponent(include)}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Accept':        'application/json',
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`,
      'X-UUID':        uuid,
    },
    body: JSON.stringify({
      scopes: [{ name: 'whereLocation', parameters: [{ location: [NV_SP_LOCATION_ID] }] }],
      sort:   [{ field: 'id', direction: 'desc' }],
    }),
  })
  const text = await res.text()
  try { return JSON.parse(text) } catch { return null }
}

// Filtro geográfico agora é server-side (whereLocation=[SP_ID]) — sem string matching local
async function fetchFromNV(token: string, uuid: string): Promise<unknown[]> {
  const first = await fetchPage(token, uuid, 1)
  if (!first) return []

  const lastPage: number = first?.meta?.last_page ?? 1
  let allOffers: unknown[] = Array.isArray(first) ? first : (first?.data ?? [])

  if (lastPage > 1) {
    const pages = Array.from({ length: lastPage - 1 }, (_, i) => i + 2)
    const chunks = []
    for (let i = 0; i < pages.length; i += 10) chunks.push(pages.slice(i, i + 10))
    for (const chunk of chunks) {
      const results = await Promise.all(chunk.map(p => fetchPage(token, uuid, p)))
      for (const r of results) {
        if (r?.data) allOffers = allOffers.concat(r.data)
      }
    }
  }

  const seen = new Set<unknown>()
  const active = (allOffers as Array<Record<string, unknown>>)
    .filter(o => {
      if (!o.active) return false
      if (seen.has(o.id)) return false
      seen.add(o.id)
      return true
    })
    .map(slimOffer)

  console.log(`[ofertas-newvalue] fetchFromNV — total=${allOffers.length} ativas=${active.length} páginas=${lastPage}`)
  return active
}

// ── DB cache helpers ──
function makeSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
}

async function readDbCache(): Promise<{ data: unknown[]; ts: number } | null> {
  try {
    const sb = makeSupabase()
    const { data, error } = await sb
      .from('nv_offers_cache')
      .select('data, cached_at')
      .eq('key', 'main')
      .single()
    if (error || !data) return null
    const ts = new Date(data.cached_at).getTime()
    if (Date.now() - ts > DB_CACHE_TTL) return null   // expirado
    return { data: data.data as unknown[], ts }
  } catch { return null }
}

async function writeDbCache(offers: unknown[]): Promise<void> {
  try {
    const sb = makeSupabase()
    await sb.from('nv_offers_cache').upsert({
      key:       'main',
      data:      offers,
      cached_at: new Date().toISOString(),
    })
  } catch (e) { console.warn('[ofertas-newvalue] writeDbCache error:', e) }
}

async function buildCache(token: string, uuid: string): Promise<unknown[]> {
  const active = await fetchFromNV(token, uuid)
  if (active.length === 0) return _cache?.data ?? []
  _cache = { data: active, ts: Date.now() }
  writeDbCache(active)   // persiste no banco sem bloquear
  return active
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  const NV_TOKEN = Deno.env.get('NV_TOKEN_RH') ?? ''
  const NV_UUID  = Deno.env.get('NV_UUID_RH')  ?? ''

  // ── L1: memória (instantâneo, processo quente) ──────────────────
  if (_cache) {
    const age     = Date.now() - _cache.ts
    const isFresh = age < CACHE_TTL_FRESH
    const isStale = age < CACHE_TTL_STALE

    if (isStale) {
      console.log(`[ofertas-newvalue] L1 ${isFresh ? 'HIT' : 'STALE'} (${_cache.data.length} ofertas, ${Math.round(age/1000)}s)`)
      if (!isFresh && !_refreshing) {
        _refreshing = true
        buildCache(NV_TOKEN, NV_UUID).finally(() => { _refreshing = false })
      }
      return new Response(JSON.stringify(_cache.data), {
        headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'max-age=600', 'X-Cache': isFresh ? 'HIT' : 'STALE' },
        status: 200,
      })
    }
  }

  // ── L2: banco de dados (sobrevive a cold starts) ────────────────
  const dbEntry = await readDbCache()
  if (dbEntry) {
    _cache = dbEntry   // aquece L1 para próximas requisições desta instância
    const age     = Date.now() - dbEntry.ts
    const isFresh = age < CACHE_TTL_FRESH
    console.log(`[ofertas-newvalue] L2 DB ${isFresh ? 'HIT' : 'STALE'} (${dbEntry.data.length} ofertas, ${Math.round(age/1000)}s)`)
    if (!isFresh && !_refreshing) {
      _refreshing = true
      buildCache(NV_TOKEN, NV_UUID).finally(() => { _refreshing = false })
    }
    return new Response(JSON.stringify(dbEntry.data), {
      headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'max-age=600', 'X-Cache': isFresh ? 'DB-HIT' : 'DB-STALE' },
      status: 200,
    })
  }

  // ── L3: fetch bloqueante (só quando banco também está vazio) ─────
  console.log('[ofertas-newvalue] L3 MISS — buscando na NV API...')
  const active = await buildCache(NV_TOKEN, NV_UUID)

  if (active.length === 0) {
    return new Response(JSON.stringify({ error: 'Falha ao buscar ofertas' }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
      status: 502,
    })
  }

  return new Response(JSON.stringify(active), {
    headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'max-age=600', 'X-Cache': 'MISS' },
    status: 200,
  })
})
