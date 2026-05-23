import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import MetricCard from '@/components/admin/MetricCard'
import styles from './Indicacoes.module.css'

const GRADS = [
  'linear-gradient(135deg,#7c3aed,#c026d3)',
  'linear-gradient(135deg,#0ea5e9,#6366f1)',
  'linear-gradient(135deg,#10b981,#0ea5e9)',
  'linear-gradient(135deg,#f59e0b,#ef4444)',
  'linear-gradient(135deg,#ec4899,#8b5cf6)',
]
function grad(nome: string) { return GRADS[nome.charCodeAt(0) % GRADS.length] }
function initials(nome: string) { return nome.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() }
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

interface Inscricao {
  id: string
  nome: string
  email: string
  created_at: string
  referred_by: string | null
  indicador_nome: string | null
  indicador_code: string | null
}

interface AuditEntry {
  id: string
  created_at: string
  action: 'signup' | 'invalid_attempt' | 'code_used' | 'rate_limited'
  referral_code: string | null
  user_nome: string | null
  user_email: string | null
  ip_address: string | null
}

const ACTION_LABEL: Record<string, { label: string; badge: string; color: string }> = {
  signup:          { label: 'Cadastro',           badge: 'badge-green',  color: 'var(--success)' },
  invalid_attempt: { label: 'Código inválido',    badge: 'badge-amber',  color: 'var(--amber)'   },
  code_used:       { label: 'Código já usado',    badge: 'badge-gray',   color: 'var(--text-3)'  },
  rate_limited:    { label: 'Rate limit',         badge: 'badge-red',    color: 'var(--danger)'  },
}

export default function Indicacoes() {
  const [inscricoes, setInscricoes]       = useState<Inscricao[]>([])
  const [auditLog, setAuditLog]           = useState<AuditEntry[]>([])
  const [totalIndicacoes, setTotalIndicacoes] = useState(0)
  const [totalIndicadores, setTotalIndicadores] = useState(0)
  const [totalInvalidos, setTotalInvalidos]   = useState(0)
  const [totalBloqueados, setTotalBloqueados] = useState(0)
  const [loading, setLoading]             = useState(true)
  const [loadingLog, setLoadingLog]       = useState(true)

  useEffect(() => {
    loadInscricoes()
    loadAuditLog()
  }, [])

  async function loadInscricoes() {
    const [{ data: indicados }, { data: todosUsuarios }] = await Promise.all([
      supabase.from('users').select('id, nome, email, created_at, referred_by')
        .not('referred_by', 'is', null).order('created_at', { ascending: false }),
      supabase.from('users').select('id, ref_code, nome, indicados'),
    ])

    const byId: Record<string, { nome: string; ref_code: string }> = {}
    const byCode: Record<string, { nome: string; ref_code: string }> = {}
    let totalInd = 0
    for (const u of todosUsuarios ?? []) {
      byId[u.id]       = { nome: u.nome, ref_code: u.ref_code }
      byCode[u.ref_code] = { nome: u.nome, ref_code: u.ref_code }
      if (u.indicados > 0) totalInd++
    }

    const lista: Inscricao[] = (indicados ?? []).map(u => {
      const ref = u.referred_by ? (byId[u.referred_by] ?? byCode[u.referred_by] ?? null) : null
      return {
        id: u.id, nome: u.nome, email: u.email, created_at: u.created_at,
        referred_by: u.referred_by,
        indicador_nome: ref?.nome ?? null,
        indicador_code: ref?.ref_code ?? u.referred_by ?? null,
      }
    })

    setInscricoes(lista)
    setTotalIndicacoes(lista.length)
    setTotalIndicadores(totalInd)
    setLoading(false)
  }

  async function loadAuditLog() {
    const { data: logs } = await supabase
      .from('referral_logs')
      .select('id, created_at, action, referral_code, ip_address, user_id, users(nome, email)')
      .order('created_at', { ascending: false })
      .limit(200)

    const entries: AuditEntry[] = (logs ?? []).map((l: any) => ({
      id:           l.id,
      created_at:   l.created_at,
      action:       l.action,
      referral_code: l.referral_code,
      ip_address:   l.ip_address,
      user_nome:    l.users?.nome ?? null,
      user_email:   l.users?.email ?? null,
    }))

    setAuditLog(entries)
    setTotalInvalidos(entries.filter(e => e.action === 'invalid_attempt').length)
    setTotalBloqueados(entries.filter(e => e.action === 'rate_limited').length)
    setLoadingLog(false)
  }

  return (
    <div className="page-enter">
      <div className={styles.header}>
        <div>
          <div className="page-title">Indicações e Referrals</div>
          <div className="page-sub">{!loading && `${totalIndicacoes} indicações realizadas · `}Acompanhe quem está trazendo mais membros</div>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="grid-2" style={{ marginBottom: 18 }}>
        <MetricCard icon="🔗" label="Total de indicações" value={totalIndicacoes} colorClass="purple" />
        <MetricCard icon="👥" label="Membros indicadores" value={totalIndicadores} colorClass="green" />
      </div>
      <div className="grid-2" style={{ marginBottom: 18 }}>
        <MetricCard icon="⚠️" label="Códigos inválidos tentados" value={totalInvalidos} colorClass="amber" />
        <MetricCard icon="🚫" label="Bloqueados por rate limit" value={totalBloqueados} colorClass="red" />
      </div>

      {/* ── Inscrições confirmadas ── */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-head">
          <div className="card-title">Cadastros por indicação</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Novo membro</th>
              <th>Indicado por</th>
              <th>Código</th>
              <th>Cadastro</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-3)' }}>Carregando…</td></tr>
            ) : inscricoes.length === 0 ? (
              <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-3)' }}>Nenhuma indicação registrada ainda.</td></tr>
            ) : inscricoes.map(u => (
              <tr key={u.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="avatar xs" style={{ background: grad(u.nome) }}>{initials(u.nome)}</div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-1)' }}>{u.nome}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{u.email}</div>
                    </div>
                  </div>
                </td>
                <td>
                  {u.indicador_nome ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="avatar xs" style={{ background: grad(u.indicador_nome) }}>{initials(u.indicador_nome)}</div>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{u.indicador_nome}</span>
                    </div>
                  ) : (
                    <span style={{ color: 'var(--text-3)', fontSize: 12 }}>—</span>
                  )}
                </td>
                <td><code style={{ fontSize: 12 }}>{u.indicador_code ?? '—'}</code></td>
                <td style={{ color: 'var(--text-2)', fontSize: 12 }}>{fmtDate(u.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Audit log completo ── */}
      <div className="card">
        <div className="card-head">
          <div>
            <div className="card-title">🔒 Log de auditoria</div>
            <div className="card-sub">Todos os eventos de convite — imutável</div>
          </div>
        </div>
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
            {loadingLog ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-3)' }}>Carregando…</td></tr>
            ) : auditLog.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-3)' }}>Nenhum evento registrado.</td></tr>
            ) : auditLog.map(e => {
              const meta = ACTION_LABEL[e.action] ?? { label: e.action, badge: 'badge-gray', color: 'var(--text-3)' }
              return (
                <tr key={e.id}>
                  <td style={{ fontSize: 12, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                    {fmtDateTime(e.created_at)}
                  </td>
                  <td>
                    <span className={`badge ${meta.badge}`}>{meta.label}</span>
                  </td>
                  <td>
                    {e.referral_code
                      ? <code style={{ fontSize: 12 }}>{e.referral_code}</code>
                      : <span style={{ color: 'var(--text-3)', fontSize: 12 }}>—</span>
                    }
                  </td>
                  <td>
                    {e.user_nome ? (
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>{e.user_nome}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{e.user_email}</div>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-3)', fontSize: 12 }}>—</span>
                    )}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'monospace' }}>
                    {e.ip_address ?? '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
