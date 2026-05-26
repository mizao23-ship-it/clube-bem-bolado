import { useState, useEffect, FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { getClientInfo, logMemberAuth } from '@/lib/auditLog'
import { useAuth } from '@/contexts/AuthContext'
import styles from './AuthForm.module.css'
import cStyles from './RegisterForm.module.css'

/* ── Dados ── */
/* ── Força da senha ── */
function passwordScore(p: string): number {
  let score = 0
  if (p.length >= 8)        score++
  if (/[A-Z]/.test(p))     score++
  if (/[a-z]/.test(p))     score++
  if (/[0-9]/.test(p))     score++
  return score
}

const STRENGTH_LABEL: Record<number, string> = {
  0: '',
  1: 'Muito fraca',
  2: 'Fraca',
  3: 'Média',
  4: 'Forte',
}

/* ── Erros de autenticação ── */
function translateAuthError(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('user already registered') || m.includes('already been registered'))
    return 'Este e-mail já possui uma conta. Tente fazer login.'
  if (m.includes('invalid email'))
    return 'E-mail inválido.'
  if (m.includes('password') && m.includes('short'))
    return 'A senha deve ter no mínimo 6 caracteres.'
  if (m.includes('signup') && m.includes('disabled'))
    return 'Cadastro desabilitado no momento. Tente mais tarde.'
  if (m.includes('rate limit'))
    return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'
  return 'Erro ao criar conta. Tente novamente.'
}

interface Props {
  onSwitch: () => void
}

export default function RegisterForm({ onSwitch }: Props) {
  const { refreshProfile } = useAuth()
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [codigoIndicacao, setCodigoIndicacao] = useState('')

  const [showSenha, setShowSenha] = useState(false)
  const [showConfirmar, setShowConfirmar] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Auto-fill referral code from URL param ?ref=CLB...
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const ref = params.get('ref')
    if (ref) setCodigoIndicacao(ref.toUpperCase())
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (!nome.trim()) {
      setError('Nome completo é obrigatório.')
      return
    }
    if (!email.trim()) {
      setError('E-mail é obrigatório.')
      return
    }
    if (!telefone.trim()) {
      setError('Telefone (WhatsApp) é obrigatório.')
      return
    }

    if (passwordScore(senha) < 4) {
      setError('A senha deve ter no mínimo 8 caracteres, incluindo letra maiúscula, minúscula e número.')
      return
    }
    if (senha !== confirmar) {
      setError('As senhas não coincidem.')
      return
    }
    if (!codigoIndicacao.trim()) {
      setError('🕵️ Ops! Esse clube é fechado. Você precisa de um convite.')
      return
    }

    setLoading(true)

    const { ip, ua } = await getClientInfo()

    try {
      // 1. Cria conta no Supabase Auth
      const { data: authData, error: authError } =
        await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password: senha,
          options: { data: { nome: nome.trim() } },
        })

      if (authError) throw new Error(translateAuthError(authError.message))
      if (!authData.user) throw new Error('Não foi possível criar a conta. Tente novamente.')

      // 2. Cria perfil via RPC (SECURITY DEFINER — bypassa RLS)
      const { data: memberData, error: profileError } = await supabase.rpc('register_member', {
        p_auth_id:       authData.user.id,
        p_nome:          nome.trim(),
        p_email:         email.trim().toLowerCase(),
        p_telefone:      telefone.trim() || null,
        p_referral_code: codigoIndicacao.trim() || null,

        p_ip_address:    ip,
      })

      if (profileError) {
        const m = profileError.message ?? ''
        if (m.includes('register_member') || m.includes('schema cache') || m.includes('function'))
          throw new Error('Erro ao criar perfil. Tente novamente em instantes.')
        if (m.includes('duplicate') || m.includes('already exists'))
          throw new Error('Este e-mail já possui uma conta. Tente fazer login.')
        throw new Error('Erro ao criar conta. Tente novamente.')
      }
      if (memberData?.error) throw new Error(memberData.error)

      // 5. Log de cadastro no auth_logs
      logMemberAuth('cadastro', { ip, ua, metadata: { email: email.trim().toLowerCase() } })

      // 6. Garante sessão ativa.
      // signUp pode retornar session: null quando o auth user já existia
      // (tentativa anterior com código inválido). Nesse caso, fazemos login explícito.
      if (!authData.session) {
        const { data: signInData } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password: senha,
        })
        if (!signInData?.session) {
          setError('✉️ Confirme seu e-mail para continuar. Verifique sua caixa de entrada.')
          return
        }
      }

      // 7. Força reload do perfil no AuthContext.
      // O onAuthStateChange do signUp dispara ANTES do register_member criar o perfil,
      // então isMember fica false na primeira leitura. refreshProfile re-busca o perfil
      // agora que ele já existe, atualizando isMember → true → redirect imediato.
      await refreshProfile(authData.user.id)
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Erro inesperado ao cadastrar. Tente novamente.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className={styles.header}>
        <h1 className={styles.title}>Criar conta</h1>
        <p className={styles.subtitle}>Você foi convidado a fazer parte dessa comunidade exclusiva, onde os universitários vivem o extraordinário!</p>
      </div>

      {error && <div className={styles.errorBox}>{error}</div>}

      <div className="form-group">
        <label htmlFor="reg-nome">Nome completo</label>
        <input
          id="reg-nome"
          className="input"
          placeholder="Seu nome completo"
          value={nome}
          onChange={e => setNome(e.target.value)}
          required
          autoComplete="name"
        />
      </div>

      <div className="form-group">
        <label htmlFor="reg-email">E-mail</label>
        <input
          id="reg-email"
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
        <label htmlFor="reg-tel">Telefone (WhatsApp)</label>
        <input
          id="reg-tel"
          className="input"
          type="tel"
          placeholder="(11) 99999-0000"
          value={telefone}
          required
          onChange={e => {
            const raw      = e.target.value
            const digits   = raw.replace(/\D/g, '').slice(0, 11)
            const prevDigs = telefone.replace(/\D/g, '')

            // Se estava apagando mas o nº de dígitos ficou igual,
            // o char removido era da máscara → remove o dígito anterior também
            const isDeleting = raw.length < telefone.length
            const finalDigs  = (isDeleting && digits.length === prevDigs.length && digits.length > 0)
              ? digits.slice(0, -1)
              : digits

            let masked = finalDigs
            if (finalDigs.length > 0) masked = '(' + finalDigs
            if (finalDigs.length >= 2) masked = '(' + finalDigs.slice(0,2) + ') ' + finalDigs.slice(2)
            if (finalDigs.length >= 7) masked = '(' + finalDigs.slice(0,2) + ') ' + finalDigs.slice(2,7) + '-' + finalDigs.slice(7)
            setTelefone(masked)
          }}
          autoComplete="tel"
        />
      </div>



      <div className="form-row">
        <div className="form-group">
          <label htmlFor="reg-senha">Senha</label>
          <div className={cStyles.pwWrap}>
            <input
              id="reg-senha"
              className="input"
              type={showSenha ? 'text' : 'password'}
              placeholder="Mín. 8 caracteres"
              value={senha}
              onChange={e => setSenha(e.target.value)}
              required
              autoComplete="new-password"
            />
            <button
              type="button"
              className={cStyles.eyeBtn}
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
          {senha.length > 0 && (() => {
            const score = passwordScore(senha)
            return (
              <div className={cStyles.strengthWrap}>
                <div className={cStyles.strengthBars}>
                  {[1, 2, 3, 4].map(i => (
                    <div
                      key={i}
                      className={cStyles.strengthBar}
                      data-active={i <= score ? score : undefined}
                    />
                  ))}
                </div>
                <span className={cStyles.strengthLabel} data-score={score}>
                  {STRENGTH_LABEL[score]}
                </span>
                {score < 4 && (
                  <div className={cStyles.strengthHint}>
                    Use maiúscula, minúscula e número
                  </div>
                )}
              </div>
            )
          })()}
        </div>
        <div className="form-group">
          <label htmlFor="reg-confirmar">Confirmar senha</label>
          <div className={cStyles.pwWrap}>
            <input
              id="reg-confirmar"
              className="input"
              type={showConfirmar ? 'text' : 'password'}
              placeholder="Repita a senha"
              value={confirmar}
              onChange={e => setConfirmar(e.target.value)}
              required
              autoComplete="new-password"
            />
            <button
              type="button"
              className={cStyles.eyeBtn}
              onClick={() => setShowConfirmar(v => !v)}
              aria-label={showConfirmar ? 'Ocultar senha' : 'Mostrar senha'}
            >
              {showConfirmar ? (
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
      </div>

      <div className="form-group">
        <label htmlFor="reg-indicacao">Código de indicação *</label>
        <input
          id="reg-indicacao"
          className="input"
          placeholder="Código de convite"
          value={codigoIndicacao}
          onChange={e => setCodigoIndicacao(e.target.value.toUpperCase())}
          autoComplete="off"
          required
          style={{ letterSpacing: '.05em', fontWeight: 600 }}
        />
        <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 4 }}>
          Você precisa de um convite de um membro para se cadastrar.
        </div>
      </div>

      <button
        type="submit"
        className={`btn btn-primary ${styles.submitBtn} ${styles.submitBtnPacaembu}`}
        disabled={loading}
      >
        {loading ? <span className="spinner" /> : null}
        {loading ? 'Criando conta…' : 'Criar conta grátis'}
      </button>

      <p className={styles.switchLink}>
        Já sou membro?{' '}
        <button type="button" onClick={onSwitch} className={styles.linkBtn}>
          Entrar →
        </button>
      </p>
    </form>
  )
}
