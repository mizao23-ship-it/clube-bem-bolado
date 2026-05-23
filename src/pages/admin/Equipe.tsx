import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { logAdminAction } from '@/lib/adminLog'
import type { DbTeamMember } from '@/types/database'
import styles from './Equipe.module.css'

const GRADS = [
  'linear-gradient(135deg,#7c3aed,#c026d3)',
  'linear-gradient(135deg,#0ea5e9,#6366f1)',
  'linear-gradient(135deg,#10b981,#0ea5e9)',
]
function grad(nome: string) { return GRADS[nome.charCodeAt(0) % GRADS.length] }
function initials(nome: string) { return nome.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() }

function timeAgo(dateStr: string | null) {
  if (!dateStr) return '—'
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return 'Agora'
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`
  return `há ${Math.floor(diff / 86400)}d`
}

function roleLabel(role: string) {
  if (role === 'admin') return 'Administrador'
  if (role === 'operador') return 'Operador'
  return role
}

export default function Equipe() {
  const [members, setMembers] = useState<DbTeamMember[]>([])
  const [showConvite, setShowConvite] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('team_members').select('*').order('created_at')
    setMembers(data ?? [])
    setLoading(false)
  }

  async function remover(id: string) {
    const m = members.find(x => x.id === id)
    await supabase.from('team_members').update({ active: false }).eq('id', id)
    logAdminAction('membro_equipe_desativado', {
      entidade: 'team_member', entidade_id: id,
      descricao: `Desativou acesso de ${m?.nome ?? id}`,
      metadata: { email: m?.email, role: m?.role },
    })
    load()
  }

  async function reativar(id: string) {
    const m = members.find(x => x.id === id)
    await supabase.from('team_members').update({ active: true }).eq('id', id)
    logAdminAction('membro_equipe_reativado', {
      entidade: 'team_member', entidade_id: id,
      descricao: `Reativou acesso de ${m?.nome ?? id}`,
      metadata: { email: m?.email, role: m?.role },
    })
    load()
  }

  return (
    <div className="page-enter">
      <div className={styles.header}>
        <div>
          <div className="page-title">Equipe</div>
          <div className="page-sub">{!loading && `${members.length} membros · `}Gerencie quem tem acesso ao backoffice</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowConvite(true)}>+ Convidar membro</button>
      </div>

      <div className={`card ${styles.tableWrap}`}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)' }}>Carregando…</div>
        ) : members.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)' }}>Nenhum membro na equipe.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Membro</th>
                <th>Perfil</th>
                <th>Último acesso</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {members.map(m => (
                <tr key={m.id}>
                  <td>
                    <div className="user-cell">
                      <div className="avatar md" style={{ background: grad(m.nome) }}>{initials(m.nome)}</div>
                      <div>
                        <div className="uc-name">{m.nome}</div>
                        <div className="uc-email">{m.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${m.role === 'admin' ? 'badge-purple' : 'badge-gray'}`}>
                      {roleLabel(m.role)}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-2)' }}>{timeAgo(m.last_seen)}</td>
                  <td>
                    <span className={`badge ${m.active ? 'badge-green' : 'badge-gray'}`}>
                      <span className="dot" />{m.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td>
                    {m.role !== 'admin' && (
                      m.active
                        ? <button className={`btn btn-danger ${styles.actionBtn}`} onClick={() => remover(m.id)}>Remover</button>
                        : <button className={`btn ${styles.actionBtn}`} onClick={() => reativar(m.id)}>Reativar</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showConvite && <ConviteModal onClose={() => { setShowConvite(false); load() }} />}
    </div>
  )
}

function ConviteModal({ onClose }: { onClose: () => void }) {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'operador' | 'admin'>('operador')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function handleConvidar() {
    if (!nome.trim() || !email.trim()) { setError('Preencha nome e e-mail.'); return }
    setLoading(true)
    setError('')

    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-team-member`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ nome: nome.trim(), email: email.trim().toLowerCase(), role }),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'Erro ao enviar convite.')
      setTempPassword(data?.tempPassword ?? null)
      logAdminAction('membro_equipe_convidado', {
        entidade: 'team_member',
        descricao: `Convidou ${nome.trim()} (${role}) para a equipe`,
        metadata: { email: email.trim().toLowerCase(), role },
      })
      setSuccess(true)
    } catch (e: any) {
      setError(e.message ?? 'Erro ao enviar convite.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="modal-backdrop open">
        <div className="modal" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
          <div className="modal-title">Membro adicionado!</div>
          <p style={{ color: 'var(--text-2)', fontSize: 14, margin: '8px 0 16px' }}>
            <strong>{email}</strong> foi adicionado à equipe.
          </p>
          {tempPassword && (
            <div style={{ background: 'var(--surface-2, #f3f4f6)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, textAlign: 'left' }}>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 6, fontWeight: 600 }}>SENHA TEMPORÁRIA — compartilhe com o convidado:</div>
              <code style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-1)', letterSpacing: 2 }}>{tempPassword}</code>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>Recomende trocar após o primeiro acesso.</div>
            </div>
          )}
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={onClose}>Fechar</button>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-backdrop open">
      <div className="modal">
        <div className="modal-title">Convidar membro da equipe</div>
        <div className="modal-sub">O convidado receberá um e-mail para definir sua senha e acessar o backoffice.</div>

        {error && (
          <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 14 }}>{error}</div>
        )}

        <div className="form-group">
          <label>Nome completo</label>
          <input className="input" placeholder="Ex: João Silva" value={nome} onChange={e => setNome(e.target.value)} />
        </div>
        <div className="form-group">
          <label>E-mail</label>
          <input className="input" type="email" placeholder="joao@empresa.com" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Perfil de acesso</label>
          <select className="input" value={role} onChange={e => setRole(e.target.value as typeof role)}>
            <option value="operador">Operador — acesso básico ao backoffice</option>
            <option value="admin">Administrador — acesso total</option>
          </select>
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleConvidar} disabled={loading}>
            {loading ? <span className="spinner" /> : '✉️ Enviar convite'}
          </button>
        </div>
      </div>
    </div>
  )
}
