import { useState, FormEvent, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import styles from './ResetPassword.module.css'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [senha, setSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Caso 1: já existe sessão PASSWORD_RECOVERY (vinda de verifyOtp ou hash)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) { setReady(true); return }
    })

    // Caso 2: sessão chega via hash na URL (Supabase /auth/v1/verify redirect)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && session) {
        setReady(true)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    const strongEnough =
      senha.length >= 8 &&
      /[A-Z]/.test(senha) &&
      /[a-z]/.test(senha) &&
      /[0-9]/.test(senha)
    if (!strongEnough) {
      setError('A senha deve ter no mínimo 8 caracteres, com letra maiúscula, minúscula e número.')
      return
    }
    if (senha !== confirmar) { setError('As senhas não coincidem.'); return }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password: senha })
    setLoading(false)
    if (error) { setError(error.message); return }
    setSuccess(true)
    await supabase.auth.signOut()
    setTimeout(() => navigate('/'), 2500)
  }

  if (!ready) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 16 }}>
        <span className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
        <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>Verificando link…</p>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logoMark}>
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </div>
        <h1 className={styles.title}>Nova senha</h1>
        <p className={styles.sub}>Digite e confirme sua nova senha abaixo.</p>

        {success ? (
          <div className={styles.successBox}>
            Senha redefinida! Redirecionando…
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            {error && <div className={styles.errorBox}>{error}</div>}
            <div className="form-group">
              <label htmlFor="rp-senha">Nova senha</label>
              <input
                id="rp-senha"
                className="input"
                type="password"
                placeholder="Mín. 8 caracteres com maiúscula e número"
                value={senha}
                onChange={e => setSenha(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="rp-confirmar">Confirmar senha</label>
              <input
                id="rp-confirmar"
                className="input"
                type="password"
                placeholder="Repita a senha"
                value={confirmar}
                onChange={e => setConfirmar(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '11px' }}
              disabled={loading}
            >
              {loading ? <span className="spinner" /> : 'Redefinir senha'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
