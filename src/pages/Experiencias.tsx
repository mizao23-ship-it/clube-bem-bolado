import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import MemberHeader from '@/components/member/MemberHeader'
import StatsRow from '@/components/member/StatsRow'
import ReferralBlock from '@/components/member/ReferralBlock'
import FilterTabs from '@/components/member/FilterTabs'
import ExperienceCard from '@/components/member/ExperienceCard'
import WinnerModal from '@/components/member/WinnerModal'
import AnnouncementModal from '@/components/member/AnnouncementModal'
import MemberFooter from '@/components/member/MemberFooter'
import type { DbExperience } from '@/types/database'
import styles from './Experiencias.module.css'

const FILTER_TABS = [
  { value: 'todas',      label: 'Todas' },
  { value: 'shows',      label: 'Shows' },
  { value: 'cultura',    label: 'Cultura' },
  { value: 'tecnologia', label: 'Tecnologia' },
  { value: 'carreira',   label: 'Carreira' },
  { value: 'esportes',   label: 'Esportes' },
  { value: 'arte',       label: 'Arte' },
  { value: 'negocios',   label: 'Negócios' },
  { value: 'lifestyle',  label: 'Lifestyle' },
  { value: 'viagem',     label: 'Viagem' },
  { value: 'bem_estar',  label: 'Bem-estar' },
]

const SORT_OPTIONS = [
  { value: 'draw_asc',     label: 'Sorteio mais próximo' },
  { value: 'draw_desc',    label: 'Sorteio mais distante' },
  { value: 'created_desc', label: 'O que tá rolando agora ⚡' },
  { value: 'created_asc',  label: 'Mais antigas' },
  { value: 'name_asc',     label: 'A → Z' },
  { value: 'name_desc',    label: 'Z → A' },
]

type SortKey = 'draw_asc' | 'draw_desc' | 'created_desc' | 'created_asc' | 'name_asc' | 'name_desc'

export default function Experiencias() {
  const { profile } = useAuth()
  const [experiences, setExperiences]     = useState<DbExperience[]>([])
  const [participacoes, setParticipacoes] = useState<Set<string>>(new Set())
  const [drawDates, setDrawDates]         = useState<Record<string, string>>({})
  const [encerradas, setEncerradas]       = useState<Set<string>>(new Set())
  type WinnerInfo = { nome: string; isCurrentUser: boolean }
  type ResultadoInfo = { winners: WinnerInfo[]; premio: string; drawDate: string; drawAt: string | null; isCurrentUser: boolean }
  const [resultados, setResultados]       = useState<Record<string, ResultadoInfo>>({})
  const [filter, setFilter]               = useState('todas')
  const [sort, setSort]                   = useState<SortKey>('created_desc')
  const [loading, setLoading]             = useState(true)
  const [winnerPrize, setWinnerPrize]     = useState<string | null>(null)
  const [winnerMeta, setWinnerMeta]       = useState<{ experience_name: string; draw_date: string } | null>(null)
  const [announcements, setAnnouncements] = useState<any[]>([])

  useEffect(() => { loadData() }, [profile])

  async function loadData() {
    if (!profile) return
    setLoading(true)

    const [{ data: exps }, { data: parts }, { data: wins }, { data: sorteios }, { data: ganhadores }] = await Promise.all([
      supabase.from('experiences').select('*').eq('active', true),
      supabase.from('participations').select('experience_id').eq('user_id', profile.id),
      supabase
        .from('sorteio_ganhadores')
        .select('id, sorteio_id, sorteios(premio, draw_date, experiences(name))')
        .eq('user_id', profile.id)
        .is('seen_at', null)
        .in('status', ['pendente', 'notificado'])
        .limit(1),
      supabase
        .from('sorteios')
        .select('experience_id, draw_date, status')
        .not('experience_id', 'is', null),
      supabase.rpc('get_sorteio_resultados'),
    ])

    setParticipacoes(new Set((parts ?? []).map(p => p.experience_id)))

    const seteAtras = new Date()
    seteAtras.setDate(seteAtras.getDate() - 7)

    const dateMap: Record<string, string> = {}
    const encerradasSet = new Set<string>()
    const ocultasSet = new Set<string>()

    for (const s of sorteios ?? []) {
      if (!s.experience_id) continue
      if (s.draw_date) dateMap[s.experience_id] = s.draw_date
      if (s.status === 'encerrado') {
        encerradasSet.add(s.experience_id)
        // oculta automaticamente 7 dias após o sorteio
        if (s.draw_date && new Date(s.draw_date) < seteAtras) {
          ocultasSet.add(s.experience_id)
        }
      }
    }

    // também oculta as que o admin ocultou manualmente
    for (const e of exps ?? []) {
      if (e.oculto_em) ocultasSet.add(e.id)
    }

    const resultadosMap: Record<string, ResultadoInfo> = {}
    for (const g of ganhadores ?? []) {
      const row = g as { experience_id: string; premio: string; draw_date: string; executado_em: string | null; winner_nome: string; winner_user_id: string }
      if (!row.experience_id) continue
      if (!resultadosMap[row.experience_id]) {
        resultadosMap[row.experience_id] = {
          winners:       [],
          premio:        row.premio ?? '',
          drawDate:      row.draw_date ?? '',
          drawAt:        row.executado_em ?? null,
          isCurrentUser: false,
        }
      }
      const isCurrent = row.winner_user_id === profile.id
      resultadosMap[row.experience_id].winners.push({ nome: row.winner_nome ?? 'Vencedor(a)', isCurrentUser: isCurrent })
      if (isCurrent) resultadosMap[row.experience_id].isCurrentUser = true
    }

    setDrawDates(dateMap)
    setEncerradas(encerradasSet)
    setResultados(resultadosMap)
    setExperiences((exps ?? []).filter(e => !ocultasSet.has(e.id)))

    if (wins && wins.length > 0) {
      const w = wins[0] as unknown as {
        id: string; sorteio_id: number
        sorteios: { premio: string; draw_date: string | null; experiences: { name: string } | null } | null
      }
      setWinnerPrize(w.sorteios?.premio ?? 'Prêmio especial')
      setWinnerMeta({
        experience_name: w.sorteios?.experiences?.name ?? '',
        draw_date:       w.sorteios?.draw_date ?? '',
      })
    }

    const { data: annData } = await supabase.rpc('get_active_announcements')
    setAnnouncements(annData ?? [])

    setLoading(false)
  }

  async function handleDismissWinner() {
    if (!profile) return
    const prize = winnerPrize
    const meta  = winnerMeta
    setWinnerPrize(null)
    setWinnerMeta(null)

    await supabase
      .from('sorteio_ganhadores')
      .update({ seen_at: new Date().toISOString(), notificado_em: new Date().toISOString() })
      .eq('user_id', profile.id)
      .is('seen_at', null)
      .in('status', ['pendente', 'notificado'])

    // Dispara sync com RD Station (fire-and-forget)
    if (meta?.experience_name) {
      supabase.functions.invoke('winner-rdstation', {
        body: {
          email:           profile.email,
          nome:            profile.nome,
          premio:          prize ?? '',
          experience_name: meta.experience_name,
          draw_date:       meta.draw_date,
        },
      }).then(({ error }) => {
        if (error) console.warn('[winner-rdstation]', error.message)
      })
    }
  }

  const usedCategories = new Set(experiences.map(e => e.category).filter(Boolean))
  const visibleTabs = FILTER_TABS.filter(t => t.value === 'todas' || usedCategories.has(t.value as any))
  const activeFilter = visibleTabs.some(t => t.value === filter) ? filter : 'todas'

  // Filtra por categoria
  const filtered = activeFilter === 'todas'
    ? experiences
    : experiences.filter(e => e.category === activeFilter)

  // Encerradas sempre ao fundo; super destaque sobe ao topo; dentro de cada grupo aplica o sort escolhido
  const sorted = [...filtered].sort((a, b) => {
    const aEnc = encerradas.has(a.id)
    const bEnc = encerradas.has(b.id)
    if (aEnc !== bEnc) return aEnc ? 1 : -1

    // Super destaque sobe ao topo (dentro de ativas e dentro de encerradas)
    if (a.super_destaque !== b.super_destaque) return a.super_destaque ? -1 : 1

    switch (sort) {
      case 'draw_asc': {
        const da = drawDates[a.id], db = drawDates[b.id]
        if (!da && !db) return 0
        if (!da) return 1
        if (!db) return -1
        return new Date(da).getTime() - new Date(db).getTime()
      }
      case 'draw_desc': {
        const da = drawDates[a.id], db = drawDates[b.id]
        if (!da && !db) return 0
        if (!da) return 1
        if (!db) return -1
        return new Date(db).getTime() - new Date(da).getTime()
      }
      case 'created_desc':
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      case 'created_asc':
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      case 'name_asc':
        return a.name.localeCompare(b.name, 'pt-BR')
      case 'name_desc':
        return b.name.localeCompare(a.name, 'pt-BR')
      default:
        return 0
    }
  })

  return (
    <div className={styles.page}>
      {winnerPrize && (
        <WinnerModal prizeName={winnerPrize} onClose={handleDismissWinner} />
      )}
      {!winnerPrize && announcements.length > 0 && (
        <AnnouncementModal announcements={announcements} onAllDismissed={() => setAnnouncements([])} />
      )}
      <MemberHeader />

      {/* ── Hero strip ── */}
      <div className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.greeting}>
            <div className={styles.greetingHi}>E aí, {profile?.nome?.split(' ')[0]}! 👋</div>
            <div className={styles.greetingSub}>Em qual role a gente se encontra?</div>
          </div>
          <div className={styles.heroRight}>
            <div className={styles.statsWrap}>
              <StatsRow
                indicados={profile?.indicados ?? 0}
                experiencias={participacoes.size}
              />
            </div>
            {profile?.ref_code && (
              <div className={profile?.referral_used ? styles.referralUsedWrap : undefined}>
                <ReferralBlock refCode={profile.ref_code} referralUsed={profile.referral_used ?? false} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Grid ── */}
      <div className={styles.content}>
        <div className={styles.sectionHead}>
          <div>
            <div className="section-title">Viva novas experiências</div>
            <div className={styles.sectionSub}>{sorted.length} disponíveis</div>
          </div>

          {/* Ordenação */}
          <div className={styles.sortWrap}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" width="13" height="13" className={styles.sortIcon}>
              <line x1="3" y1="6"  x2="21" y2="6"/>
              <line x1="6" y1="12" x2="18" y2="12"/>
              <line x1="9" y1="18" x2="15" y2="18"/>
            </svg>
            <select
              className={styles.sortSelect}
              value={sort}
              onChange={e => setSort(e.target.value as SortKey)}
            >
              {SORT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        <FilterTabs tabs={visibleTabs} active={activeFilter} onChange={setFilter} />

        {loading ? (
          <div className={styles.loading}>Carregando…</div>
        ) : sorted.length === 0 ? (
          <div className={styles.empty}>Nenhuma experiência nesta categoria no momento.</div>
        ) : (
          <div className={styles.grid}>
            {sorted.map(exp => (
              <ExperienceCard
                key={exp.id}
                experience={exp}
                participando={participacoes.has(exp.id)}
                drawDate={drawDates[exp.id] ?? null}
                encerrado={encerradas.has(exp.id)}
                resultado={resultados[exp.id] ?? null}
                onParticipou={() => {
                  setParticipacoes(prev => new Set([...prev, exp.id]))
                }}
              />
            ))}
          </div>
        )}
      </div>
      <MemberFooter />
    </div>
  )
}
