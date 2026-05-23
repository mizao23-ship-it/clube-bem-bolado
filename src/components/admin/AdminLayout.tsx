import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import { supabase } from '@/lib/supabase'
import styles from './AdminLayout.module.css'

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const mustChange = false // must_change_password not used in new JWT auth

  return (
    <div className={styles.layout}>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className={styles.main}>
        {/* Mobile topbar com hamburger */}
        <div className={styles.topbar}>
          <button
            className={styles.hamburger}
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menu"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <span className={styles.topbarLogo}>Backoffice</span>
        </div>

        <div className={styles.mainContent}>
          <Outlet />
        </div>
      </main>
      {mustChange && <ChangePasswordModal memberId="" />}
    </div>
  )
}

function ChangePasswordModal({ memberId }: { memberId: string }) {
  const [nova, setNova] = useState('')
  const [confirma, setConfirma] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSalvar() {
    if (nova.length < 8) { setError('A senha deve ter pelo menos 8 caracteres.'); return }
    if (nova !== confirma) { setError('As senhas não coincidem.'); return }
    setLoading(true)
    setError('')

    const { error: authErr } = await supabase.auth.updateUser({ password: nova })
    if (authErr) { setError(authErr.message); setLoading(false); return }

    await supabase.from('team_members').update({ must_change_password: false }).eq('id', memberId)

    // força reload do perfil
    window.location.reload()
  }

  return (
    <div className="modal-backdrop open" style={{ zIndex: 10000 }}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div style={{ fontSize: 36, textAlign: 'center', marginBottom: 8 }}>🔐</div>
        <div className="modal-title" style={{ textAlign: 'center' }}>Defina sua senha</div>
        <div className="modal-sub" style={{ textAlign: 'center', marginBottom: 20 }}>
          Por segurança, troque a senha temporária antes de continuar.
        </div>

        {error && (
          <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 14 }}>
            {error}
          </div>
        )}

        <div className="form-group">
          <label>Nova senha</label>
          <input
            className="input"
            type="password"
            placeholder="Mínimo 8 caracteres"
            value={nova}
            onChange={e => setNova(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Confirmar senha</label>
          <input
            className="input"
            type="password"
            placeholder="Repita a nova senha"
            value={confirma}
            onChange={e => setConfirma(e.target.value)}
          />
        </div>

        <button
          className="btn btn-primary"
          style={{ width: '100%', marginTop: 8 }}
          onClick={handleSalvar}
          disabled={loading}
        >
          {loading ? <span className="spinner" /> : 'Salvar senha'}
        </button>
      </div>
    </div>
  )
}
