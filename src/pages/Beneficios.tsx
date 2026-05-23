import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import MemberHeader from '@/components/member/MemberHeader'
import MemberFooter from '@/components/member/MemberFooter'
import MemberCardBadge from '@/components/member/MemberCardBadge'
import BenefitModal, { type BenefitOffer } from '@/components/member/BenefitModal'
import styles from './Beneficios.module.css'

/* ── Tipos ── */
interface NvMedia {
  url: string
  urlStandard: string
  collection_name: string
}

interface NvAddress {
  city:  string | null
  state: string | null
}

interface NvCategory {
  id: number
  name: string | { pt?: string; en?: string; es?: string }
  slug?: string
}

interface NvOfferMeta {
  how_to_use?:   { pt?: string }
  link_site?:    { pt?: string }
  partner_name?: string
}

interface NvOffer {
  id: number
  uuid: string
  title:    { pt?: string; en?: string; es?: string }
  subtitle: { pt?: string; en?: string; es?: string }
  content:  { pt?: string; en?: string; es?: string }
  type: string
  is_featured: boolean
  active: boolean
  expires_at: string | null
  media?:      NvMedia[]
  address?:    NvAddress[]
  categories?: NvCategory[]
  offer_meta?: NvOfferMeta
  partner?:    { id: number; name: string }
}

function pt(obj?: { pt?: string; en?: string; es?: string }) {
  return obj?.pt ?? obj?.en ?? obj?.es ?? ''
}

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
}

const CARD_GRADS = [
  'linear-gradient(135deg,#7c3aed,#c026d3)',
  'linear-gradient(135deg,#0ea5e9,#6366f1)',
  'linear-gradient(135deg,#10b981,#0ea5e9)',
  'linear-gradient(135deg,#f59e0b,#ef4444)',
  'linear-gradient(135deg,#ec4899,#8b5cf6)',
  'linear-gradient(135deg,#14b8a6,#6366f1)',
  'linear-gradient(135deg,#f97316,#ec4899)',
]
function cardGrad(id: number) { return CARD_GRADS[id % CARD_GRADS.length] }
function cardInitials(title: string) {
  return title.split(' ').filter(w => w.length > 2).slice(0, 2).map(w => w[0].toUpperCase()).join('') || title.slice(0, 2).toUpperCase()
}

function typeLabel(type: string) {
  if (type === 'coupon')  return 'Cupom'
  if (type === 'voucher') return 'Voucher'
  if (type === 'website') return 'Online'
  return 'Benefício'
}

/* ── Card individual ── */
function NvOfferCard({ offer, onClick }: { offer: NvOffer; onClick: () => void }) {
  const title    = pt(offer.title)
  const subtitle = stripHtml(pt(offer.subtitle))
  const desc     = stripHtml(pt(offer.content)).slice(0, 110)
  const imgUrl   = offer.media?.[0]?.urlStandard ?? offer.media?.[0]?.url

  return (
    <div className={styles.nvCard} onClick={onClick} style={{ cursor: 'pointer' }}>
      {imgUrl ? (
        <div className={styles.nvLogoArea}>
          <img
            src={imgUrl}
            alt={title}
            className={styles.nvLogoImg}
            onError={e => {
              const el = e.currentTarget.parentElement!
              el.style.background = cardGrad(offer.id)
              el.innerHTML = `<span style="color:#fff;font-weight:800;font-size:22px">${cardInitials(title)}</span>`
            }}
          />
        </div>
      ) : (
        <div className={styles.nvAvatarFallback} style={{ background: cardGrad(offer.id) }}>
          {cardInitials(title)}
        </div>
      )}
      <div className={styles.nvCardTop}>
        <span className={styles.nvTypeBadge}>{typeLabel(offer.type)}</span>
      </div>
      <div className={styles.nvTitle}>{title}</div>
      {subtitle && subtitle !== title && <div className={styles.nvSubtitle}>{subtitle}</div>}
      {desc && <div className={styles.nvDesc}>{desc}{stripHtml(pt(offer.content)).length > 110 ? '…' : ''}</div>}
      <button className={styles.nvBtn} onClick={e => { e.stopPropagation(); onClick() }}>
        Ver benefício →
      </button>
    </div>
  )
}

function catName(c: NvCategory): string {
  if (typeof c.name === 'string') return c.name
  return c.name?.pt ?? c.name?.en ?? c.name?.es ?? String(c.id)
}

/* ── Categorias fixas ── */
interface FixedCategory { id: string; label: string; matchFn: (o: NvOffer) => boolean }

function offerText(o: NvOffer) {
  return (pt(o.title) + ' ' + pt(o.subtitle) + ' ' + pt(o.content)).toLowerCase()
}

const FIXED_CATEGORIES: FixedCategory[] = [
  { id: 'destaques', label: 'Destaques', matchFn: o => o.categories?.some(c => /^destaque/i.test(catName(c))) ?? false },
  {
    id: 'beneficios-irresistiveis', label: 'Benefícios Irresistíveis',
    matchFn: o => o.categories?.length ? o.categories.some(c => /irresist/i.test(catName(c))) : false,
  },
  {
    id: 'compras', label: 'Compras',
    matchFn: o => o.categories?.length
      ? o.categories.some(c => /compras?/i.test(catName(c)))
      : /\bshopping\b|\boutlet\b|\bvarejo\b|lojas? |roupas?|calçados?|acessórios?|eletrônic|decoração|móveis/i.test(offerText(o)),
  },
  {
    id: 'comer-beber', label: 'Comer e Beber',
    matchFn: o => o.categories?.length
      ? o.categories.some(c => /comer|beber/i.test(catName(c)))
      : /restaurante|pizzaria|hamburgueria|sushi|churrascaria|padaria|bistrô|café\b|lanchonete|sorveter|açaíteria/i.test(offerText(o)),
  },
  {
    id: 'cultura-lazer', label: 'Cultura e Lazer',
    matchFn: o => o.categories?.length
      ? o.categories.some(c => /cultura|lazer/i.test(catName(c)))
      : /cinema|teatro|museu|exposição|parque\b|ingresso|concerto|espetáculo|entretenimento/i.test(offerText(o)),
  },
  {
    id: 'ensino', label: 'Ensino',
    matchFn: o => o.categories?.length
      ? o.categories.some(c => /ensin|educa/i.test(catName(c)))
      : /\bcurso\b|faculdade|universidade|escola\b|idiomas?|treinamento|certificação|graduação|pós-graduação|\bMBA\b/i.test(offerText(o)),
  },
  {
    id: 'gift-card', label: 'Gift Card',
    matchFn: o => o.categories?.length
      ? o.categories.some(c => /gift/i.test(catName(c)))
      : /gift\s*card|cartão\s*presente|vale\s*presente/i.test(offerText(o)),
  },
  {
    id: 'pet', label: 'Pet',
    matchFn: o => o.categories?.length
      ? o.categories.some(c => /\bpet\b/i.test(catName(c)))
      : /\bpet\b|\bpatas\b|veterinári|pet\s*shop|banho\s*(e\s*)?tosa|\bração\b/i.test(offerText(o)),
  },
  {
    id: 'saude-bem-estar', label: 'Saúde e Bem Estar',
    matchFn: o => o.categories?.length
      ? o.categories.some(c => /saúde|saude|bem.?estar/i.test(catName(c)))
      : /plano\s*de\s*saúde|dental|dentista|médico|psicólog|farmácia|clínica|ótica\b|óculos|academia\b|fitness|pilates|yoga|massagem|nutrição|bem.?estar/i.test(offerText(o)),
  },
  {
    id: 'servicos', label: 'Serviços',
    matchFn: o => o.categories?.length
      ? o.categories.some(c => /serviç/i.test(catName(c)))
      : /seguro\b|contabilidade|advocacia|jurídico|financeiro\b|imobiliária|lavanderia|mudança\b/i.test(offerText(o)),
  },
  {
    id: 'viagem-turismo', label: 'Viagem e Turismo',
    matchFn: o => o.categories?.length
      ? o.categories.some(c => /viagem|turismo/i.test(catName(c)))
      : /\bhotel\b|\bhostel\b|pousada|resort\b|\bvoo\b|passagem\s*aérea|cruzeiro|intercâmbio/i.test(offerText(o)),
  },
]

/* ── Skeleton card ── */
function SkeletonCard() {
  return (
    <div className={styles.skeletonCard}>
      <div className={`${styles.skeletonBase} ${styles.skeletonLogo}`} />
      <div className={`${styles.skeletonBase} ${styles.skeletonBadge}`} />
      <div className={`${styles.skeletonBase} ${styles.skeletonTitle}`} />
      <div className={`${styles.skeletonBase} ${styles.skeletonTitleShort}`} />
      <div className={`${styles.skeletonBase} ${styles.skeletonLine}`} />
      <div className={`${styles.skeletonBase} ${styles.skeletonLine}`} />
      <div className={`${styles.skeletonBase} ${styles.skeletonLineShort}`} />
      <div className={`${styles.skeletonBase} ${styles.skeletonBtn}`} />
    </div>
  )
}

const PAGE_SIZE       = 25
const CACHE_KEY       = 'nv_offers_v2'
const CACHE_TTL_FRESH = 10 * 60 * 1000   // 10 min — considerado "fresco"
const CACHE_TTL_STALE = 2 * 60 * 60 * 1000 // 2h  — stale mas usável (mostra imediatamente)

/* L1 — módulo (SPA navigation, instantâneo) */
let _moduleCache: { data: NvOffer[]; ts: number } | null = null

/* Helpers de cache */
function readLocalCache(): { data: NvOffer[]; ts: number } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { data: NvOffer[]; ts: number }
    if (Date.now() - parsed.ts > CACHE_TTL_STALE) return null // expirado de vez
    return parsed
  } catch { return null }
}

function writeCache(data: NvOffer[]) {
  const entry = { data, ts: Date.now() }
  _moduleCache = entry
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(entry)) } catch { /* quota */ }
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(entry)) } catch { /* quota */ }
}

function deduplicateOffers(raw: NvOffer[]): NvOffer[] {
  const seenId  = new Set<string>()
  const seenKey = new Set<string>()
  return raw.filter(o => {
    const id = String(o.id)
    if (seenId.has(id)) return false
    seenId.add(id)
    const contentKey = (pt(o.title) + '|' + pt(o.content).slice(0, 80)).toLowerCase().trim()
    if (contentKey.length > 2 && seenKey.has(contentKey)) return false
    seenKey.add(contentKey)
    return true
  }).filter(o => o.active)
}

async function fetchFromApi(): Promise<NvOffer[]> {
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
  const ANON_KEY     = import.meta.env.VITE_SUPABASE_ANON_KEY as string
  const res  = await fetch(`${SUPABASE_URL}/functions/v1/ofertas-newvalue`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
  })
  const json = await res.json()
  if (json?.error) throw new Error(json.error)
  return deduplicateOffers(Array.isArray(json) ? json : (json?.data ?? []))
}

/* Atualiza cache em background sem bloquear a UI */
function revalidateInBackground() {
  fetchFromApi().then(writeCache).catch(() => { /* silencioso */ })
}

async function loadOffers(): Promise<NvOffer[]> {
  const now = Date.now()

  // L1 — módulo (navegação SPA, instantâneo)
  if (_moduleCache) {
    const isFresh = now - _moduleCache.ts < CACHE_TTL_FRESH
    if (!isFresh) revalidateInBackground()
    return _moduleCache.data
  }

  // L2 — localStorage (persiste entre sessões, TTL 2h)
  const localEntry = readLocalCache()
  if (localEntry) {
    _moduleCache = localEntry
    const isFresh = now - localEntry.ts < CACHE_TTL_FRESH
    if (!isFresh) revalidateInBackground() // stale → atualiza em background
    return localEntry.data
  }

  // L3 — fetch bloqueante (só na 1ª visita ever ou após 2h sem uso)
  const data = await fetchFromApi()
  writeCache(data)
  return data
}

/* ── Página principal ── */
export default function Beneficios() {
  const { profile } = useAuth()
  const [offers,         setOffers]         = useState<NvOffer[]>([])
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState('')
  const [search,         setSearch]         = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>('destaques')
  const [visibleCount,   setVisibleCount]   = useState(PAGE_SIZE)
  const [selectedOffer,  setSelectedOffer]  = useState<NvOffer | null>(null)
  const [showScrollTop, setShowScrollTop]  = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)

  function fetchOffers() {
    setLoading(true)
    setError('')
    loadOffers()
      .then(data => { setOffers(data); setLoading(false) })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[Beneficios] erro ao carregar ofertas:', msg)
        setError('Não foi possível carregar os benefícios.')
        setLoading(false)
      })
  }

  useEffect(() => { fetchOffers() }, [])

  function handleSearch(val: string) {
    setSearch(val)
    setVisibleCount(PAGE_SIZE)
  }

  function handleCategory(id: string | null) {
    setActiveCategory(id)
    setVisibleCount(PAGE_SIZE)
  }

  const afterSearch = search.trim()
    ? offers.filter(o => {
        const q = search.toLowerCase()
        return (
          pt(o.title).toLowerCase().includes(q) ||
          pt(o.subtitle).toLowerCase().includes(q) ||
          (o.partner?.name ?? '').toLowerCase().includes(q) ||
          stripHtml(pt(o.content)).toLowerCase().includes(q)
        )
      })
    : offers

  const filtered = activeCategory === null
    ? afterSearch
    : afterSearch.filter(o => FIXED_CATEGORIES.find(c => c.id === activeCategory)?.matchFn(o) ?? false)

  const paginated = filtered.slice(0, visibleCount)
  const visibleCategories = FIXED_CATEGORIES.filter(c => afterSearch.some(o => c.matchFn(o)))

  useEffect(() => {
    function onScroll() { setShowScrollTop(window.scrollY > 400) }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) setVisibleCount(c => c + PAGE_SIZE) },
      { rootMargin: '200px' }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [filtered.length])

  return (
    <div className={styles.page}>
      <MemberHeader />

      {/* ── Header strip ── */}
      <div className={styles.strip}>
        <div className={styles.stripInner}>
          <div>
            <div className={styles.stripTitle}>Benefícios e Parceiros</div>
            <div className={styles.stripSub}>Descubra os descontos exclusivos do seu clube</div>
          </div>
          {profile && <MemberCardBadge nome={profile.nome} refCode={profile.ref_code} compact />}
        </div>
      </div>

      {/* ── Como usar ── */}
      <div className={styles.howTo}>
        <div className={styles.howToInner}>
          <div className={styles.howToStep}>
            <div className={styles.stepNum}>1</div>
            <div>Escolha um benefício abaixo</div>
          </div>
          <div className={styles.howToArrow}>→</div>
          <div className={styles.howToStep}>
            <div className={styles.stepNum}>2</div>
            <div>Clique em "Ver benefício"</div>
          </div>
          <div className={styles.howToArrow}>→</div>
          <div className={styles.howToStep}>
            <div className={styles.stepNum}>3</div>
            <div>Gere seu cupom e acesse o site</div>
          </div>
        </div>
      </div>

      {/* ── Conteúdo ── */}
      <div className={styles.content}>

        {/* Busca */}
        <div className={styles.searchWrap}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className="input"
            placeholder="Buscar benefícios…"
            value={search}
            onChange={e => handleSearch(e.target.value)}
          />
        </div>

        {/* Categorias */}
        {!loading && !error && (
          <div className={styles.categoryRow}>
            <button
              className={activeCategory === null ? styles.catPillActive : styles.catPill}
              onClick={() => handleCategory(null)}
            >
              Todas <span className={styles.catCount}>{afterSearch.length}</span>
            </button>
            {visibleCategories.map(c => (
              <button
                key={c.id}
                className={activeCategory === c.id ? styles.catPillActive : styles.catPill}
                onClick={() => handleCategory(c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className={styles.grid}>
            {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : error ? (
          <div className={styles.empty}>
            <div>{error}</div>
            <button
              className={styles.retryBtn}
              onClick={() => {
                try { sessionStorage.removeItem('nv_offers_v1') } catch { }
                _moduleCache = null
                fetchOffers()
              }}
            >
              Tentar novamente
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className={styles.empty}>Nenhum benefício encontrado.</div>
        ) : (
          <>
            <div className={styles.grid}>
              {paginated.map(offer => (
                <NvOfferCard
                  key={String(offer.id)}
                  offer={offer}
                  onClick={() => setSelectedOffer(offer)}
                />
              ))}
            </div>
            {visibleCount < filtered.length && (
              <div ref={sentinelRef} className={styles.sentinel}>
                <span className="spinner" style={{ width: 18, height: 18, borderTopColor: 'var(--purple)' }} />
              </div>
            )}
          </>
        )}
      </div>

      <MemberFooter />

      {/* ── Scroll to top ── */}
      {showScrollTop && (
        <button
          className={styles.scrollTopBtn}
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Voltar ao topo"
        >
          ↑
        </button>
      )}

      {/* ── Modal de benefício ── */}
      {selectedOffer && profile && (
        <BenefitModal
          key={selectedOffer.id}
          offer={selectedOffer as BenefitOffer}
          email={profile.email}
          memberName={profile.nome}
          memberCode={profile.ref_code ?? ''}
          onClose={() => setSelectedOffer(null)}
        />
      )}
    </div>
  )
}
