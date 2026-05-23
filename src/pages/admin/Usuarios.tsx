import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { logAdminAction } from '@/lib/adminLog'
import type { DbUser } from '@/types/database'
import styles from './Usuarios.module.css'

const GRADS = [
  'linear-gradient(135deg,#7c3aed,#c026d3)',
  'linear-gradient(135deg,#0ea5e9,#6366f1)',
  'linear-gradient(135deg,#10b981,#0ea5e9)',
  'linear-gradient(135deg,#f59e0b,#ef4444)',
  'linear-gradient(135deg,#ec4899,#8b5cf6)',
]
function grad(nome: string) { return GRADS[nome.charCodeAt(0) % GRADS.length] }
function initials(nome: string) { return nome.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() }

export default function Usuarios() {
  const [users, setUsers] = useState<DbUser[]>([])
  const [filtered, setFiltered] = useState<DbUser[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editUser, setEditUser] = useState<DbUser | null>(null)
  const [deleteUser, setDeleteUser] = useState<DbUser | null>(null)
  const [resetMsg, setResetMsg] = useState('')

  useEffect(() => { loadUsers() }, [])

  useEffect(() => {
    let data = users
    if (search) data = data.filter(u =>
      u.nome.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.ref_code.toLowerCase().includes(search.toLowerCase())
    )
    if (statusFilter) data = data.filter(u => u.status === statusFilter)
    setFiltered(data)
  }, [search, statusFilter, users])

  async function loadUsers() {
    setLoading(true)
    const { data } = await supabase.from('users').select('*').order('created_at', { ascending: false })
    setUsers(data ?? [])
    setLoading(false)
  }

  async function handleToggleStatus(user: DbUser) {
    const newStatus = user.status === 'ativo' ? 'inativo' : 'ativo'
    await supabase.from('users').update({ status: newStatus }).eq('id', user.id)
    logAdminAction(newStatus === 'ativo' ? 'usuario_reativado' : 'usuario_desativado', {
      entidade: 'user', entidade_id: user.id,
      descricao: `${newStatus === 'ativo' ? 'Reativou' : 'Desativou'} o usuário ${user.nome}`,
      metadata: { email: user.email, status_anterior: user.status, status_novo: newStatus },
    })
    loadUsers()
  }

  async function handleResetSenha(user: DbUser) {
    setResetMsg('')
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) {
      setResetMsg(`Erro: ${error.message}`)
    } else {
      setResetMsg(`E-mail de redefinição enviado para ${user.email}`)
    }
    setTimeout(() => setResetMsg(''), 4000)
  }



  function handleExportCSV() {
    const cols = ['Nome', 'E-mail', 'Telefone', 'Código', 'Indicados', 'Status', 'Cadastro', 'NV Sincronizado', 'Convite Usado']
    const rows = filtered.map(u => [
      u.nome,
      u.email,
      u.telefone ?? '',
      u.ref_code,
      String(u.indicados),
      u.status === 'ativo' ? 'Ativo' : 'Inativo',
      new Date(u.created_at).toLocaleDateString('pt-BR'),
      u.nv_user_id ? 'Sim' : 'Não',
      u.referral_used ? 'Sim' : 'Não',
    ])

    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`
    const csv = [cols, ...rows].map(r => r.map(escape).join(',')).join('\r\n')

    // BOM UTF-8 para Excel abrir acentos corretamente
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `clube-bem-bolado-membros-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)

    logAdminAction('exportou_csv_usuarios', {
      entidade: 'users',
      descricao: `Exportou lista de ${filtered.length} membro(s) em CSV`,
      metadata: { total: filtered.length, filtro_busca: search || null, filtro_status: statusFilter || null },
    })
  }

  async function handleDelete(user: DbUser) {
    const { error } = await supabase.functions.invoke('delete-member', {
      body: { user_id: user.id },
    })
    if (error) {
      alert(`Erro ao excluir: ${error.message}`)
      return
    }
    logAdminAction('usuario_removido', {
      entidade: 'user', entidade_id: user.id,
      descricao: `Removeu o usuário ${user.nome}`,
      metadata: { email: user.email, ref_code: user.ref_code },
    })
    setDeleteUser(null)
    loadUsers()
  }

  return (
    <div className="page-enter">
      <div className={styles.header}>
        <div>
          <div className="page-title">Usuários</div>
          <div className="page-sub">{users.length.toLocaleString('pt-BR')} membros cadastrados na plataforma</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn" onClick={handleExportCSV} disabled={filtered.length === 0}>
            ⬇ Exportar CSV {filtered.length < users.length ? `(${filtered.length})` : ''}
          </button>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Novo usuário</button>
        </div>
      </div>

      {resetMsg && (
        <div style={{ background: 'var(--success-bg)', color: 'var(--success)', borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 500, marginBottom: 16 }}>
          {resetMsg}
        </div>
      )}

      <div className={styles.searchBar}>
        <div className={styles.searchWrap}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input className="input" placeholder="Buscar por nome, e-mail ou código..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input" style={{ width: 185 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">Todos os status</option>
          <option value="ativo">Ativo</option>
          <option value="inativo">Inativo</option>
        </select>
      </div>

      <div className={`card ${styles.tableWrap}`} style={{ padding: 0 }}>
        <table>
          <thead>
            <tr><th>Membro</th><th>Código</th><th>Indicações</th><th>Cadastro</th><th>Status</th><th>Convite</th><th>Ações</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-3)', padding: 32 }}>Carregando…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-3)', padding: 32 }}>Nenhum usuário encontrado.</td></tr>
            ) : filtered.map(u => (
              <tr key={u.id}>
                <td>
                  <div className="user-cell">
                    <div className="avatar sm" style={{ background: grad(u.nome) }}>{initials(u.nome)}</div>
                    <div><div className="uc-name">{u.nome}</div><div className="uc-email">{u.email}</div></div>
                  </div>
                </td>
                <td><code>{u.ref_code}</code></td>
                <td>{u.indicados}</td>
                <td style={{ color: 'var(--text-2)' }}>{new Date(u.created_at).toLocaleDateString('pt-BR')}</td>
                <td><span className={`badge ${u.status === 'ativo' ? 'badge-green' : 'badge-gray'}`}><span className="dot" />{u.status === 'ativo' ? 'Ativo' : 'Inativo'}</span></td>
                <td>
                  {u.referral_used
                    ? <span className="badge badge-gray">Usado</span>
                    : <span className="badge badge-green">Disponível</span>
                  }
                </td>
                <td>
                  <div className={styles.actions}>
                    <button className={`btn ${styles.actionBtn}`} onClick={() => setEditUser(u)}>✏️ Editar</button>
                    <button className={`btn ${styles.actionBtn}`} onClick={() => handleResetSenha(u)}>🔑 Reset senha</button>
                    {u.status === 'ativo'
                      ? <button className={`btn ${styles.actionBtn}`} onClick={() => handleToggleStatus(u)}>Desativar</button>
                      : <button className={`btn ${styles.actionBtn}`} onClick={() => handleToggleStatus(u)}>Reativar</button>
                    }
                    <button className={`btn btn-danger ${styles.actionBtn}`} onClick={() => setDeleteUser(u)}>🗑️ Excluir</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && <NovoUsuarioModal onClose={() => { setShowModal(false); loadUsers() }} />}
      {editUser && <EditUsuarioModal user={editUser} onClose={() => { setEditUser(null); loadUsers() }} />}
      {deleteUser && (
        <div className="modal-backdrop open">
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-title">Excluir usuário</div>
            <p style={{ color: 'var(--text-2)', fontSize: 14, margin: '8px 0 24px' }}>
              Tem certeza que deseja excluir <strong>{deleteUser.nome}</strong>? Esta ação não pode ser desfeita.
            </p>
            <div className="modal-footer">
              <button className="btn" onClick={() => setDeleteUser(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={() => handleDelete(deleteUser)}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function EditUsuarioModal({ user, onClose }: { user: DbUser; onClose: () => void }) {
  const [nome, setNome] = useState(user.nome)
  const [email, setEmail] = useState(user.email)
  const [telefone, setTelefone] = useState(user.telefone ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    if (!nome || !email) { setError('Nome e e-mail são obrigatórios.'); return }
    setLoading(true)
    setError('')
    const { error: err } = await supabase.from('users').update({
      nome: nome.trim(),
      email: email.trim().toLowerCase(),
      telefone: telefone.trim() || null,
    }).eq('id', user.id)
    setLoading(false)
    if (err) { setError(err.message); return }
    logAdminAction('usuario_editado', {
      entidade: 'user', entidade_id: user.id,
      descricao: `Editou dados do usuário ${nome.trim()}`,
      metadata: { campos_alterados: ['nome', 'email', 'telefone'], email_novo: email.trim().toLowerCase() },
    })
    onClose()
  }

  return (
    <div className="modal-backdrop open">
      <div className="modal">
        <div className="modal-title">Editar usuário</div>
        {error && <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 14 }}>{error}</div>}
        <div className="form-group"><label>Nome completo</label><input className="input" value={nome} onChange={e => setNome(e.target.value)} /></div>
        <div className="form-group"><label>E-mail</label><input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
        <div className="form-group"><label>Telefone</label><input className="input" placeholder="(11) 99999-0000" value={telefone} onChange={e => setTelefone(e.target.value)} /></div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading}>{loading ? <span className="spinner" /> : 'Salvar'}</button>
        </div>
      </div>
    </div>
  )
}

function NovoUsuarioModal({ onClose }: { onClose: () => void }) {
  const [nome, setNome] = useState('')
  const [sobrenome, setSobrenome] = useState('')
  const [email, setEmail] = useState('')
  const [tel, setTel] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function generateCLBCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let code = 'CLB'
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)]
    return code
  }

  async function handleSubmit() {
    const nomeCompleto = `${nome.trim()} ${sobrenome.trim()}`.trim()
    if (!nomeCompleto || !email) { setError('Preencha nome e e-mail.'); return }
    setLoading(true)
    setError('')
    const refCode = generateCLBCode()
    const { error: err } = await supabase.from('users').insert({
      nome: nomeCompleto,
      email: email.trim().toLowerCase(),
      telefone: tel || null,
      ref_code: refCode,
      created_by_admin: true,
      referral_used: false,
    })
    setLoading(false)
    if (err) { setError(err.message); return }
    logAdminAction('usuario_criado', {
      entidade: 'user',
      descricao: `Criou usuário ${nomeCompleto} pelo backoffice`,
      metadata: { email: email.trim().toLowerCase(), ref_code: refCode },
    })
    onClose()
  }

  return (
    <div className="modal-backdrop open">
      <div className="modal">
        <div className="modal-title">Novo usuário</div>
        <div className="modal-sub">O usuário será cadastrado na plataforma. Para sincronizar com a New Value API, configure as credenciais na aba Integração.</div>
        <div className="notice notice-info">⚙️ Integração ativa · POST /api/v2/key/users</div>
        {error && <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 14 }}>{error}</div>}
        <div className="form-row">
          <div className="form-group"><label>Nome</label><input className="input" placeholder="Nome" value={nome} onChange={e => setNome(e.target.value)} /></div>
          <div className="form-group"><label>Sobrenome</label><input className="input" placeholder="Sobrenome" value={sobrenome} onChange={e => setSobrenome(e.target.value)} /></div>
        </div>
        <div className="form-group"><label>E-mail</label><input className="input" type="email" placeholder="email@empresa.com" value={email} onChange={e => setEmail(e.target.value)} /></div>
        <div className="form-group"><label>Telefone</label><input className="input" placeholder="(11) 99999-0000" value={tel} onChange={e => setTel(e.target.value)} /></div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>{loading ? <span className="spinner" /> : 'Cadastrar'}</button>
        </div>
      </div>
    </div>
  )
}
