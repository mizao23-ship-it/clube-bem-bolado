import { useState, useEffect, Fragment } from 'react'
import { supabase } from '@/lib/supabase'
import styles from './Logs.module.css'

// ── Utils ─────────────────────────────────────────────────────────────

function fmtDT(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'agora'
  if (m < 60) return `${m}m atrás`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h atrás`
  return `${Math.floor(h / 24)}d atrás`
}

// ── Types ─────────────────────────────────────────────────────────────

interface FeedEvent {
  id: string
  ts: string
  source: 'sorteio' | 'indicacao'
  icon: string
  title: string
  detail: string | null
  actor: string | null
  badgeText: string
  badgeCls: string
}

interface SorteioLogRow {
  id: string
  criado_em: string
  acao: string
  sorteio_premio: string | null
  experience_name: string | null
  executado_por_nome: string | null
  user_nome: string | null
  metadata: Record<string, unknown> | null
}

interface IndicacaoLogRow {
  id: string
  created_at: string
  action: string
  referral_code: string | null
  user_nome: string | null
  user_email: string | null
  email_tentativa: string | null
  ip_address: string | null
}

interface GanhadorRow {
  id: string
  sorteio_premio: string | null
  experience_name: string | null
  user_nome: string | null
  user_email: string | null
  status: string
  posicao: number
  notificado_em: string | null
  confirmado_em: string | null
  expirado_em: string | null
}

interface EquipeRow {
  id: string
  nome: string
  email: string
  role: string
  active: boolean
  last_seen: string | null
  created_at: string
}

interface AdminLogRow {
  id: string
  criado_em: string
  acao: string
  entidade: string | null
  entidade_id: string | null
  descricao: string | null
  executado_por_nome: string | null
  executado_por_email: string | null
  metadata: Record<string, unknown> | null
}

// ── CSV helper ────────────────────────────────────────────────────────

function downloadCSV(filename: string, cols: string[], rows: string[][]) {
  const esc = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = [cols, ...rows].map(r => r.map(esc).join(',')).join('\r\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ── Label maps ────────────────────────────────────────────────────────

const SORTEIO_META: Record<string, { text: string; cls: string; icon: string }> = {
  sorteio_executado:   { text: 'Sorteio executado',   cls: 'badge-purple', icon: '🎲' },
  ganhador_notificado: { text: 'Ganhador notificado', cls: 'badge-blue',   icon: '📨' },
  ganhador_confirmou:  { text: 'Prêmio confirmado',   cls: 'badge-green',  icon: '✅' },
  ganhador_recusou:    { text: 'Prêmio recusado',     cls: 'badge-amber',  icon: '↩️'  },
  prazo_expirado:      { text: 'Prazo expirado',      cls: 'badge-gray',   icon: '⏰'  },
  sorteio_anulado:     { text: 'Sorteio anulado',     cls: 'badge-red',    icon: '🚫'  },
}

const INDICA_META: Record<string, { text: string; cls: string; icon: string }> = {
  signup:          { text: 'Cadastro realizado', cls: 'badge-green',  icon: '🎉' },
  invalid_attempt: { text: 'Código inválido',    cls: 'badge-amber',  icon: '⚠️'  },
  code_used:       { text: 'Código já usado',    cls: 'badge-gray',   icon: '🔒'  },
  rate_limited:    { text: 'Rate limit ativado', cls: 'badge-red',    icon: '🚫'  },
}

const GANHADOR_META: Record<string, { text: string; cls: string }> = {
  pendente:   { text: 'Pendente',   cls: 'badge-amber' },
  notificado: { text: 'Notificado', cls: 'badge-blue'  },
  confirmado: { text: 'Confirmado', cls: 'badge-green' },
  expirado:   { text: 'Expirado',   cls: 'badge-gray'  },
  recusado:   { text: 'Recusado',   cls: 'badge-red'   },
}

// ── Tabs ──────────────────────────────────────────────────────────────

const TABS = [
  { id: 'geral',      label: 'Feed geral'  },
  { id: 'sorteios',   label: 'Sorteios'    },
  { id: 'indicacoes', label: 'Indicações'  },
  { id: 'ganhadores', label: 'Ganhadores'  },
  { id: 'admin',      label: 'Ações admin' },
  { id: 'equipe',     label: 'Equipe'      },
]

// ── Main component ────────────────────────────────────────────────────

export default function Logs() {
  const [tab, setTab]               = useState('geral')
  const [loading, setLoading]       = useState(true)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  const [feedEvents, setFeedEvents] = useState<FeedEvent[]>([])
  const [sorteioLogs, setSorteioLogs] = useState<SorteioLogRow[]>([])
  const [indicaLogs, setIndicaLogs] = useState<IndicacaoLogRow[]>([])
  const [ganhadores, setGanhadores] = useState<GanhadorRow[]>([])
  const [equipe, setEquipe]         = useState<EquipeRow[]>([])

  const [adminLogs, setAdminLogs]   = useState<AdminLogRow[]>([])
  const [cntSorteio, setCntSorteio] = useState(0)
  const [cntIndica, setCntIndica]   = useState(0)
  const [cntGanha, setCntGanha]     = useState(0)
  const [cntAdmin, setCntAdmin]     = useState(0)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [sLogs, iLogs, gRows, eRows, aLogs] = await Promise.all([
      fetchSorteioLogs(),
      fetchIndicaLogs(),
      fetchGanhadores(),
      fetchEquipe(),
      fetchAdminLogs(),
    ])

    setSorteioLogs(sLogs)
    setIndicaLogs(iLogs)
    setGanhadores(gRows)
    setEquipe(eRows)
    setAdminLogs(aLogs)
    setCntSorteio(sLogs.length)
    setCntIndica(iLogs.length)
    setCntGanha(gRows.length)
    setCntAdmin(aLogs.length)

    // Build unified feed
    const sEvents: FeedEvent[] = sLogs.map(l => {
      const m = SORTEIO_META[l.acao] ?? { text: l.acao, cls: 'badge-gray', icon: '📋' }
      return {
        id: `s-${l.id}`,
        ts: l.criado_em,
        source: 'sorteio',
        icon: m.icon,
        title: l.experience_name ?? l.sorteio_premio ?? 'Sorteio',
        detail: l.sorteio_premio && l.experience_name ? `Prêmio: ${l.sorteio_premio}` : null,
        actor: l.executado_por_nome ?? l.user_nome,
        badgeText: m.text,
        badgeCls: m.cls,
      }
    })

    const iEvents: FeedEvent[] = iLogs.map(l => {
      const m = INDICA_META[l.action] ?? { text: l.action, cls: 'badge-gray', icon: '📋' }
      return {
        id: `i-${l.id}`,
        ts: l.created_at,
        source: 'indicacao',
        icon: m.icon,
        title: l.user_nome ?? (l.referral_code ? `Código ${l.referral_code}` : 'Anônimo'),
        detail: l.referral_code ? `Código: ${l.referral_code}` : null,
        actor: l.ip_address ?? null,
        badgeText: m.text,
        badgeCls: m.cls,
      }
    })

    const unified = [...sEvents, ...iEvents]
      .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
      .slice(0, 200)

    setFeedEvents(unified)
    setLastRefresh(new Date())
    setLoading(false)
  }

  async function fetchSorteioLogs(): Promise<SorteioLogRow[]> {
    try {
      const { data } = await supabase
        .from('sorteio_audit_log')
        .select(`
          id, criado_em, acao, metadata,
          sorteios ( premio, experiences ( name ) ),
          team_members!executado_por ( nome ),
          users ( nome )
        `)
        .order('criado_em', { ascending: false })
        .limit(300)

      return (data ?? []).map((r: any) => ({
        id: r.id,
        criado_em: r.criado_em,
        acao: r.acao,
        sorteio_premio: r.sorteios?.premio ?? null,
        experience_name: r.sorteios?.experiences?.name ?? null,
        executado_por_nome: r.team_members?.nome ?? null,
        user_nome: r.users?.nome ?? null,
        metadata: r.metadata,
      }))
    } catch {
      return []
    }
  }

  async function fetchIndicaLogs(): Promise<IndicacaoLogRow[]> {
    const { data } = await supabase
      .from('referral_logs')
      .select('id, created_at, action, referral_code, ip_address, email_tentativa, users ( nome, email )')
      .order('created_at', { ascending: false })
      .limit(300)

    return (data ?? []).map((l: any) => ({
      id: l.id,
      created_at: l.created_at,
      action: l.action,
      referral_code: l.referral_code,
      ip_address: l.ip_address,
      email_tentativa: l.email_tentativa ?? null,
      user_nome: l.users?.nome ?? null,
      user_email: l.users?.email ?? null,
    }))
  }

  async function fetchGanhadores(): Promise<GanhadorRow[]> {
    const { data } = await supabase
      .from('sorteio_ganhadores')
      .select(`
        id, status, posicao, notificado_em, confirmado_em, expirado_em,
        sorteios ( premio, experiences ( name ) ),
        users ( nome, email )
      `)
      .order('notificado_em', { ascending: false })
      .limit(200)

    return (data ?? []).map((r: any) => ({
      id: r.id,
      sorteio_premio: r.sorteios?.premio ?? null,
      experience_name: r.sorteios?.experiences?.name ?? null,
      user_nome: r.users?.nome ?? null,
      user_email: r.users?.email ?? null,
      status: r.status,
      posicao: r.posicao,
      notificado_em: r.notificado_em,
      confirmado_em: r.confirmado_em,
      expirado_em: r.expirado_em,
    }))
  }

  async function fetchAdminLogs(): Promise<AdminLogRow[]> {
    try {
      const { data } = await supabase
        .from('admin_audit_log')
        .select('id, criado_em, acao, entidade, entidade_id, descricao, metadata, team_members!executado_por ( nome, email )')
        .order('criado_em', { ascending: false })
        .limit(300)

      return (data ?? []).map((r: any) => ({
        id: r.id,
        criado_em: r.criado_em,
        acao: r.acao,
        entidade: r.entidade,
        entidade_id: r.entidade_id,
        descricao: r.descricao,
        executado_por_nome: r.team_members?.nome ?? null,
        executado_por_email: r.team_members?.email ?? null,
        metadata: r.metadata,
      }))
    } catch {
      return []
    }
  }

  async function fetchEquipe(): Promise<EquipeRow[]> {
    const { data } = await supabase
      .from('team_members')
      .select('id, nome, email, role, active, last_seen, created_at')
      .order('last_seen', { ascending: false, nullsFirst: false })

    return (data ?? []).map((r: any) => ({
      id: r.id,
      nome: r.nome,
      email: r.email,
      role: r.role,
      active: r.active,
      last_seen: r.last_seen,
      created_at: r.created_at,
    }))
  }

  const totalEvents = cntSorteio + cntIndica

  return (
    <div className="page-enter">
      {/* Header */}
      <div className={styles.header}>
        <div>
          <div className="page-title">Logs de Auditoria</div>
          <div className="page-sub">
            Histórico completo e imutável de todos os eventos do sistema
          </div>
        </div>
        <button className="btn btn-secondary" onClick={loadAll} disabled={loading}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" width="14" height="14">
            <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
          </svg>
          {loading ? 'Carregando…' : 'Atualizar'}
        </button>
      </div>

      {/* KPIs */}
      <div className={styles.kpiRow}>
        <div className={styles.kpi}>
          <div className={styles.kpiValue}>{totalEvents}</div>
          <div className={styles.kpiLabel}>Total de eventos</div>
        </div>
        <div className={`${styles.kpi} ${styles.kpiPurple}`}>
          <div className={styles.kpiValue}>{cntSorteio}</div>
          <div className={styles.kpiLabel}>Eventos de sorteio</div>
        </div>
        <div className={`${styles.kpi} ${styles.kpiBlue}`}>
          <div className={styles.kpiValue}>{cntIndica}</div>
          <div className={styles.kpiLabel}>Eventos de indicação</div>
        </div>
        <div className={`${styles.kpi} ${styles.kpiGreen}`}>
          <div className={styles.kpiValue}>{cntGanha}</div>
          <div className={styles.kpiLabel}>Registros de ganhadores</div>
        </div>
      </div>

      <div className={styles.immutableNote}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" width="13" height="13" style={{ flexShrink: 0 }}>
          <rect x="3" y="11" width="18" height="11" rx="2"/>
          <path d="M7 11V7a5 5 0 0110 0v4"/>
        </svg>
        Logs imutáveis — nenhum evento pode ser editado ou removido
        &nbsp;·&nbsp; Última atualização: {lastRefresh.toLocaleTimeString('pt-BR')}
      </div>

      {/* Tabs */}
      <div className={styles.tabBar}>
        {TABS.map(t => {
          const countMap: Record<string, number> = {
            sorteios: cntSorteio,
            indicacoes: cntIndica,
            ganhadores: cntGanha,
            admin: cntAdmin,
          }
          const cnt = countMap[t.id]
          return (
            <button
              key={t.id}
              className={`${styles.tabBtn} ${tab === t.id ? styles.tabActive : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              {cnt !== undefined && cnt > 0 && (
                <span className={styles.tabCount}>{cnt}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Content */}
      {loading ? (
        <div className={styles.loading}>Carregando logs…</div>
      ) : (
        <>
          {tab === 'geral'      && <FeedTab       events={feedEvents} />}
          {tab === 'sorteios'   && <SorteiosTab   logs={sorteioLogs} />}
          {tab === 'indicacoes' && <IndicacoesTab  logs={indicaLogs} />}
          {tab === 'ganhadores' && <GanhadoresTab  rows={ganhadores} />}
          {tab === 'admin'      && <AdminTab       logs={adminLogs} />}
          {tab === 'equipe'     && <EquipeTab      rows={equipe} />}
        </>
      )}
    </div>
  )
}

// ── FeedTab ───────────────────────────────────────────────────────────

function FeedTab({ events }: { events: FeedEvent[] }) {
  function handleExport() {
    const cols = ['Data', 'Tipo', 'Evento', 'Título', 'Detalhe', 'Por']
    const rows = events.map(e => [
      new Date(e.ts).toLocaleString('pt-BR'),
      e.source === 'sorteio' ? 'Sorteio' : 'Indicação',
      e.badgeText,
      e.title,
      e.detail ?? '',
      e.actor ?? '',
    ])
    downloadCSV(`logs-feed-geral-${new Date().toISOString().slice(0,10)}.csv`, cols, rows)
  }

  if (events.length === 0) {
    return <EmptyCard msg="Nenhum evento registrado ainda." />
  }
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <button className="btn" onClick={handleExport}>⬇ Exportar CSV</button>
      </div>
    <div className={styles.feedList}>
      {events.map(ev => (
        <div key={ev.id} className={styles.feedItem}>
          <div className={styles.feedIcon}>{ev.icon}</div>
          <div className={styles.feedBody}>
            <div className={styles.feedRow1}>
              <span className={`badge ${ev.badgeCls}`}>{ev.badgeText}</span>
              <span className={`badge ${ev.source === 'sorteio' ? 'badge-purple' : 'badge-blue'}`}
                style={{ opacity: 0.55, fontSize: 10 }}>
                {ev.source === 'sorteio' ? 'Sorteio' : 'Indicação'}
              </span>
              <span className={styles.feedTime}>{timeAgo(ev.ts)}</span>
            </div>
            <div className={styles.feedTitle}>{ev.title}</div>
            {ev.detail && <div className={styles.feedDetail}>{ev.detail}</div>}
            {ev.actor && <div className={styles.feedActor}>Por: {ev.actor}</div>}
          </div>
          <div className={styles.feedTs}>{fmtDate(ev.ts)}</div>
        </div>
      ))}
    </div>
    </>
  )
}

// ── SorteiosTab ───────────────────────────────────────────────────────

function SorteiosTab({ logs }: { logs: SorteioLogRow[] }) {
  const [expanded, setExpanded] = useState<string | null>(null)

  function handleExport() {
    const cols = ['Data/Hora', 'Evento', 'Experiência', 'Prêmio', 'Executado por']
    const exportRows = logs.map(l => {
      const m = SORTEIO_META[l.acao] ?? { text: l.acao }
      return [fmtDT(l.criado_em), m.text, l.experience_name ?? '', l.sorteio_premio ?? '', l.executado_por_nome ?? l.user_nome ?? '']
    })
    downloadCSV(`logs-sorteios-${new Date().toISOString().slice(0,10)}.csv`, cols, exportRows)
  }

  if (logs.length === 0) {
    return <EmptyCard msg="Nenhum evento de sorteio registrado." />
  }

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="card-title">🎲 Audit log de sorteios</div>
          <div className="card-sub">Imutável — não pode ser editado ou removido</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn" onClick={handleExport}>⬇ Exportar CSV</button>
          <span className={styles.totalBadge}>{logs.length} registros</span>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Data / Hora</th>
            <th>Evento</th>
            <th>Experiência</th>
            <th>Prêmio</th>
            <th>Executado por</th>
            <th>Dados</th>
          </tr>
        </thead>
        <tbody>
          {logs.map(l => {
            const m = SORTEIO_META[l.acao] ?? { text: l.acao, cls: 'badge-gray', icon: '📋' }
            const isExp = expanded === l.id
            return (
              <Fragment key={l.id}>
                <tr>
                  <td style={{ fontSize: 12, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                    {fmtDT(l.criado_em)}
                  </td>
                  <td>
                    <span className={`badge ${m.cls}`}>{m.icon} {m.text}</span>
                  </td>
                  <td style={{ fontSize: 13 }}>{l.experience_name ?? <Dash />}</td>
                  <td style={{ fontSize: 13 }}>{l.sorteio_premio ?? <Dash />}</td>
                  <td style={{ fontSize: 13 }}>{l.executado_por_nome ?? l.user_nome ?? <Dash />}</td>
                  <td>
                    {l.metadata ? (
                      <button className={styles.metaBtn} onClick={() => setExpanded(isExp ? null : l.id)}>
                        {isExp ? 'Ocultar ▲' : 'Ver ▼'}
                      </button>
                    ) : <Dash />}
                  </td>
                </tr>
                {isExp && l.metadata && (
                  <tr>
                    <td colSpan={6} className={styles.metaCell}>
                      <pre className={styles.metaPre}>{JSON.stringify(l.metadata, null, 2)}</pre>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── IndicacoesTab ─────────────────────────────────────────────────────

function IndicacoesTab({ logs }: { logs: IndicacaoLogRow[] }) {
  const [filter, setFilter] = useState('all')

  const filtered = filter === 'all' ? logs : logs.filter(l => l.action === filter)

  function handleExport() {
    const cols = ['Data/Hora', 'Evento', 'Código', 'Usuário', 'Email', 'IP']
    const exportRows = filtered.map(l => {
      const m = INDICA_META[l.action] ?? { text: l.action }
      return [fmtDT(l.created_at), m.text, l.referral_code ?? '', l.user_nome ?? '', l.user_email ?? '', l.ip_address ?? '']
    })
    downloadCSV(`logs-indicacoes-${new Date().toISOString().slice(0,10)}.csv`, cols, exportRows)
  }

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="card-title">🔗 Log de indicações</div>
          <div className="card-sub">Todos os eventos de convite e cadastro</div>
        </div>
        <div className={styles.filterRow}>
          {(['all', 'signup', 'invalid_attempt', 'rate_limited'] as const).map(f => (
            <button
              key={f}
              className={`${styles.filterBtn} ${filter === f ? styles.filterActive : ''}`}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? `Todos (${logs.length})` : `${INDICA_META[f]?.text ?? f} (${logs.filter(l => l.action === f).length})`}
            </button>
          ))}
          <button className="btn" onClick={handleExport}>⬇ Exportar CSV</button>
        </div>
      </div>
      {filtered.length === 0 ? (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-3)' }}>
          Nenhum evento nesta categoria.
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Data / Hora</th>
              <th>Evento</th>
              <th>Código</th>
              <th>Usuário</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(l => {
              const m = INDICA_META[l.action] ?? { text: l.action, cls: 'badge-gray', icon: '📋' }
              return (
                <tr key={l.id}>
                  <td style={{ fontSize: 12, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                    {fmtDT(l.created_at)}
                  </td>
                  <td>
                    <span className={`badge ${m.cls}`}>{m.icon} {m.text}</span>
                  </td>
                  <td>
                    {l.referral_code
                      ? <code style={{ fontSize: 12 }}>{l.referral_code}</code>
                      : <Dash />}
                  </td>
                  <td>
                    {l.user_nome ? (
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>
                          {l.user_nome}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{l.user_email}</div>
                      </div>
                    ) : l.email_tentativa ? (
                      <div style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic' }}>
                        {l.email_tentativa}
                      </div>
                    ) : <Dash />}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'monospace' }}>
                    {l.ip_address ?? '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ── GanhadoresTab ─────────────────────────────────────────────────────

function GanhadoresTab({ rows }: { rows: GanhadorRow[] }) {
  const [statusFilter, setStatusFilter] = useState('all')

  const filtered = statusFilter === 'all'
    ? rows
    : rows.filter(r => r.status === statusFilter)

  const statusCounts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1
    return acc
  }, {})

  function handleExport() {
    const cols = ['Ganhador', 'Email', 'Experiência', 'Prêmio', 'Status', 'Pos.', 'Notificado', 'Confirmado/Expirado']
    const exportRows = filtered.map(r => [
      r.user_nome ?? '', r.user_email ?? '', r.experience_name ?? '', r.sorteio_premio ?? '',
      GANHADOR_META[r.status]?.text ?? r.status, String(r.posicao),
      r.notificado_em ? fmtDT(r.notificado_em) : '',
      r.confirmado_em ? fmtDT(r.confirmado_em) : (r.expirado_em ? fmtDT(r.expirado_em) : ''),
    ])
    downloadCSV(`logs-ganhadores-${new Date().toISOString().slice(0,10)}.csv`, cols, exportRows)
  }

  if (rows.length === 0) return <EmptyCard msg="Nenhum ganhador registrado ainda." />

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="card-title">🏆 Histórico de ganhadores</div>
          <div className="card-sub">Ciclo de vida completo de cada prêmio sorteado</div>
        </div>
        <div className={styles.filterRow}>
          <button
            className={`${styles.filterBtn} ${statusFilter === 'all' ? styles.filterActive : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            Todos ({rows.length})
          </button>
          {Object.entries(GANHADOR_META).map(([k, v]) =>
            statusCounts[k] ? (
              <button
                key={k}
                className={`${styles.filterBtn} ${statusFilter === k ? styles.filterActive : ''}`}
                onClick={() => setStatusFilter(k)}
              >
                {v.text} ({statusCounts[k]})
              </button>
            ) : null
          )}
          <button className="btn" onClick={handleExport}>⬇ Exportar CSV</button>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Ganhador</th>
            <th>Experiência / Prêmio</th>
            <th>Status</th>
            <th>Pos.</th>
            <th>Notificado</th>
            <th>Confirmado / Expirado</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(r => {
            const m = GANHADOR_META[r.status] ?? { text: r.status, cls: 'badge-gray' }
            return (
              <tr key={r.id}>
                <td>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>
                      {r.user_nome ?? '—'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{r.user_email}</div>
                  </div>
                </td>
                <td>
                  <div style={{ fontSize: 13 }}>{r.experience_name ?? <Dash />}</div>
                  {r.sorteio_premio && (
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{r.sorteio_premio}</div>
                  )}
                </td>
                <td><span className={`badge ${m.cls}`}>{m.text}</span></td>
                <td style={{ fontSize: 13, textAlign: 'center', fontWeight: 600 }}>
                  #{r.posicao}
                </td>
                <td style={{ fontSize: 12, color: 'var(--text-2)' }}>
                  {r.notificado_em ? fmtDT(r.notificado_em) : <Dash />}
                </td>
                <td style={{ fontSize: 12, color: 'var(--text-2)' }}>
                  {r.confirmado_em
                    ? <span style={{ color: 'var(--success)' }}>{fmtDT(r.confirmado_em)}</span>
                    : r.expirado_em
                    ? <span style={{ color: 'var(--text-3)' }}>{fmtDT(r.expirado_em)}</span>
                    : <Dash />}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── AdminTab ──────────────────────────────────────────────────────────

const ADMIN_ACAO_META: Record<string, { icon: string; cls: string }> = {
  experiencia_criada:          { icon: '⭐', cls: 'badge-purple' },
  sorteio_executado:           { icon: '🎲', cls: 'badge-purple' },
  usuario_criado:              { icon: '👤', cls: 'badge-green'  },
  usuario_editado:             { icon: '✏️',  cls: 'badge-blue'   },
  usuario_desativado:          { icon: '🚫', cls: 'badge-red'    },
  usuario_reativado:           { icon: '✅', cls: 'badge-green'  },
  usuario_removido:            { icon: '🗑️',  cls: 'badge-red'    },
  usuario_sincronizado_nv:     { icon: '🔄', cls: 'badge-blue'   },
  membro_equipe_convidado:     { icon: '📩', cls: 'badge-purple' },
  membro_equipe_desativado:    { icon: '🔒', cls: 'badge-amber'  },
  membro_equipe_reativado:     { icon: '🔓', cls: 'badge-green'  },
}

function AdminTab({ logs }: { logs: AdminLogRow[] }) {
  const [expanded, setExpanded] = useState<string | null>(null)

  function handleExport() {
    const cols = ['Data/Hora', 'Ação', 'Descrição', 'Entidade', 'Admin', 'Email admin']
    const exportRows = logs.map(l => [
      fmtDT(l.criado_em), l.acao.replace(/_/g, ' '), l.descricao ?? '',
      l.entidade ?? '', l.executado_por_nome ?? '', l.executado_por_email ?? '',
    ])
    downloadCSV(`logs-admin-${new Date().toISOString().slice(0,10)}.csv`, cols, exportRows)
  }

  if (logs.length === 0) {
    return (
      <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-3)' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🛡️</div>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Nenhuma ação registrada ainda</div>
        <div style={{ fontSize: 13 }}>
          As ações dos administradores aparecerão aqui assim que a migration 018 for aplicada.<br />
          Veja o arquivo <code>supabase/migrations/018_admin_audit_log.sql</code>.
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="card-title">🛡️ Ações do backoffice</div>
          <div className="card-sub">Tudo que os administradores fizeram no sistema</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn" onClick={handleExport}>⬇ Exportar CSV</button>
          <span className={styles.totalBadge}>{logs.length} registros</span>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Data / Hora</th>
            <th>Ação</th>
            <th>Descrição</th>
            <th>Admin</th>
            <th>Dados</th>
          </tr>
        </thead>
        <tbody>
          {logs.map(l => {
            const m = ADMIN_ACAO_META[l.acao] ?? { icon: '📋', cls: 'badge-gray' }
            const isExp = expanded === l.id
            return (
              <Fragment key={l.id}>
                <tr>
                  <td style={{ fontSize: 12, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                    {fmtDT(l.criado_em)}
                  </td>
                  <td>
                    <span className={`badge ${m.cls}`}>{m.icon} {l.acao.replace(/_/g, ' ')}</span>
                  </td>
                  <td style={{ fontSize: 13, color: 'var(--text-1)', maxWidth: 280 }}>
                    {l.descricao ?? <Dash />}
                  </td>
                  <td>
                    {l.executado_por_nome ? (
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{l.executado_por_nome}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{l.executado_por_email}</div>
                      </div>
                    ) : <Dash />}
                  </td>
                  <td>
                    {l.metadata ? (
                      <button className={styles.metaBtn} onClick={() => setExpanded(isExp ? null : l.id)}>
                        {isExp ? 'Ocultar ▲' : 'Ver ▼'}
                      </button>
                    ) : <Dash />}
                  </td>
                </tr>
                {isExp && l.metadata && (
                  <tr>
                    <td colSpan={5} className={styles.metaCell}>
                      <pre className={styles.metaPre}>{JSON.stringify(l.metadata, null, 2)}</pre>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── EquipeTab ─────────────────────────────────────────────────────────

function EquipeTab({ rows }: { rows: EquipeRow[] }) {
  if (rows.length === 0) return <EmptyCard msg="Nenhum membro da equipe." />

  function handleExport() {
    const cols = ['Nome', 'Email', 'Perfil', 'Status', 'Último acesso', 'Membro desde']
    const exportRows = rows.map(r => [
      r.nome, r.email, r.role === 'admin' ? 'Admin' : 'Operador',
      r.active ? 'Ativo' : 'Inativo',
      r.last_seen ? fmtDT(r.last_seen) : '',
      fmtDate(r.created_at),
    ])
    downloadCSV(`logs-equipe-${new Date().toISOString().slice(0,10)}.csv`, cols, exportRows)
  }

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="card-title">👥 Acesso da equipe</div>
          <div className="card-sub">Última atividade de cada administrador no sistema</div>
        </div>
        <button className="btn" onClick={handleExport}>⬇ Exportar CSV</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Membro</th>
            <th>Perfil</th>
            <th>Status</th>
            <th>Último acesso</th>
            <th>Membro desde</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id}>
              <td>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>
                    {r.nome}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{r.email}</div>
                </div>
              </td>
              <td>
                <span className={`badge ${r.role === 'admin' ? 'badge-purple' : 'badge-blue'}`}>
                  {r.role === 'admin' ? 'Admin' : 'Operador'}
                </span>
              </td>
              <td>
                <span className={`badge ${r.active ? 'badge-green' : 'badge-gray'}`}>
                  {r.active ? 'Ativo' : 'Inativo'}
                </span>
              </td>
              <td style={{ fontSize: 12, color: 'var(--text-2)' }}>
                {r.last_seen ? (
                  <>
                    <span title={fmtDT(r.last_seen)}>{timeAgo(r.last_seen)}</span>
                    <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{fmtDT(r.last_seen)}</div>
                  </>
                ) : <Dash />}
              </td>
              <td style={{ fontSize: 12, color: 'var(--text-2)' }}>
                {fmtDate(r.created_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Shared helpers ────────────────────────────────────────────────────

function EmptyCard({ msg }: { msg: string }) {
  return (
    <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-3)' }}>
      {msg}
    </div>
  )
}

function Dash() {
  return <span style={{ color: 'var(--text-3)', fontSize: 12 }}>—</span>
}
