import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { getClientInfo, logAdminAuth, logAuthEventPublic } from '@/lib/auditLog'
import styles from './AdminLogin.module.css'
import logo from '@/assets/logo-bem-bolado.svg'

export default function AdminLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { ip, ua } = await getClientInfo()

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password: senha })
      if (authError) throw authError

      // Verifica se é team_member via SECURITY DEFINER (bypassa RLS)
      const { data: isAdmin, error: rpcError } = await supabase.rpc('check_is_admin')

      if (rpcError) {
        await supabase.auth.signOut()
        throw new Error(`Erro ao verificar permissão: ${rpcError.message}`)
      }

      if (!isAdmin) {
        // ── Audit: membro comum tentou acessar backoffice ──
        logAuthEventPublic('admin_login_falhou', {
          email: email.trim().toLowerCase(), ip, ua,
        })
        await supabase.auth.signOut()
        throw new Error('Acesso restrito. Você não tem permissão de admin.')
      }

      // ── Audit: login admin bem-sucedido ──
      logAdminAuth('admin_login', { ip, ua })
      navigate('/admin')
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : ''
      const lower = raw.toLowerCase()
      if (lower.includes('invalid login') || lower.includes('invalid credentials')) {
        // ── Audit: senha errada no backoffice ──
        logAuthEventPublic('admin_login_falhou', {
          email: email.trim().toLowerCase(), ip, ua,
        })
      }
      setError(
        lower.includes('invalid login') || lower.includes('invalid credentials')
          ? 'E-mail ou senha incorretos. Verifique seus dados e tente novamente.'
          : lower.includes('too many requests')
            ? 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'
            : raw || 'Erro ao entrar.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {/* Faixa roxa com logo */}
        <div className={styles.logoStrip}>
          <img src={logo} alt="Clube Bem Bolado" />
        </div>

        <div className={styles.cardBody}>
          <div className={styles.sub}>Backoffice · Acesso restrito</div>

          {error && <div className={styles.errorBox}>{error}</div>}

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label htmlFor="al-email">E-mail</label>
              <input id="al-email" className="input" type="email" placeholder="admin@empresa.com" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email"/>
            </div>
            <div className="form-group">
              <label htmlFor="al-senha">Senha</label>
              <input id="al-senha" className="input" type="password" placeholder="Sua senha" value={senha} onChange={e => setSenha(e.target.value)} required autoComplete="current-password"/>
            </div>
            <button type="submit" className={`btn btn-primary ${styles.submitBtn}`} disabled={loading}>
              {loading ? <span className="spinner" /> : 'Entrar no backoffice'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
