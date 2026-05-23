import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { getClientInfo, logMemberAuth, logAuthEventPublic } from '@/lib/auditLog'
import styles from './AuthForm.module.css'
import logo from '@/assets/logo-bem-bolado.svg'

interface Props {
  onSwitch: () => void
}

export default function LoginForm({ onSwitch }: Props) {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [showSenha, setShowSenha] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [error, setError] = useState('')
  const [resetMsg, setResetMsg] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { ip, ua } = await getClientInfo()

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
      if (error) throw error
      // ── Audit: login bem-sucedido ──
      logMemberAuth('login', { ip, ua })
      navigate('/experiencias')
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : ''
      // ── Audit: login com falha ──
      logAuthEventPublic('login_falhou', { email: email.trim().toLowerCase(), ip, ua })
      const msg = raw.toLowerCase().includes('invalid login') || raw.toLowerCase().includes('invalid credentials')
        ? 'E-mail ou senha incorretos. Verifique seus dados e tente novamente.'
        : raw.toLowerCase().includes('email not confirmed')
          ? '✉️ Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.'
          : raw.toLowerCase().includes('too many requests')
            ? 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'
            : raw || 'Erro ao entrar. Tente novamente.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  async function handleReset() {
    if (!email.trim()) {
      setError('Digite seu e-mail acima para redefinir a senha.')
      return
    }
    setResetLoading(true)
    setError('')
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setResetMsg('Se este e-mail estiver cadastrado, você receberá o link de redefinição em breve. Verifique também a caixa de spam.')
    setResetLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className={styles.header}>
        <img src={logo} alt="Clube Bem Bolado" className={styles.logoImg} />
        <h1 className={styles.title}>Bem-vindo de volta</h1>
        <p className={styles.subtitle}>Acesse sua conta para continuar</p>
      </div>

      {error && <div className={styles.errorBox}>{error}</div>}
      {resetMsg && <div className={styles.successBox}>{resetMsg}</div>}

      <div className="form-group">
        <label htmlFor="login-email">E-mail</label>
        <input
          id="login-email"
          className="input"
          type="email"
          placeholder="seu@email.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
      </div>

      <div className="form-group">
        <label htmlFor="login-senha">Senha</label>
        <div className={styles.pwWrap}>
          <input
            id="login-senha"
            className="input"
            type={showSenha ? 'text' : 'password'}
            placeholder="Sua senha"
            value={senha}
            onChange={e => setSenha(e.target.value)}
            required
            autoComplete="current-password"
          />
          <button
            type="button"
            className={styles.eyeBtn}
            onClick={() => setShowSenha(v => !v)}
            aria-label={showSenha ? 'Ocultar senha' : 'Mostrar senha'}
          >
            {showSenha ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            )}
          </button>
        </div>
      </div>

      <div className={styles.forgotWrap}>
        <button
          type="button"
          className={styles.linkBtn}
          onClick={handleReset}
          disabled={resetLoading}
        >
          {resetLoading ? 'Enviando…' : 'Esqueci minha senha'}
        </button>
      </div>

      <button
        type="submit"
        className={`btn btn-primary ${styles.submitBtn}`}
        disabled={loading}
      >
        {loading ? <span className="spinner" /> : null}
        {loading ? 'Entrando…' : 'Entrar'}
      </button>

      <p className={styles.switchLink}>
        Ainda não é membro?{' '}
        <button type="button" onClick={onSwitch} className={styles.linkBtn}>
          Cadastre-se grátis →
        </button>
      </p>
    </form>
  )
}
