import { useState, useEffect, useRef, FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { getClientInfo, logMemberAuth } from '@/lib/auditLog'
import { useAuth } from '@/contexts/AuthContext'
import { CURSOS } from '@/lib/cursos'
import styles from './AuthForm.module.css'
import cStyles from './RegisterForm.module.css'
import logo from '@/assets/logo-bem-bolado.svg'

/* ── Dados ── */
const FACULDADES = [
  'Universidade de São Paulo (USP)',
  'Universidade Federal de São Paulo (UNIFESP)',
  'Universidade Presbiteriana Mackenzie',
  'Pontifícia Universidade Católica de São Paulo (PUC-SP)',
  'Fundação Getulio Vargas (FGV)',
  'Insper Instituto de Ensino e Pesquisa',
  'FAAP (Fundação Armando Alvares Penteado)',
  'ESPM (Escola Superior de Propaganda e Marketing)',
  'FIAP (Faculdade de Informática e Administração Paulista)',
  'FECAP (Fundação Escola de Comércio Álvares Penteado)',
  'Universidade Paulista (UNIP)',
  'Universidade Nove de Julho (UNINOVE)',
  'Universidade Cruzeiro do Sul',
  'Universidade Cidade de São Paulo (UNICID)',
  'Universidade São Judas Tadeu',
  'Universidade Anhembi Morumbi',
  'Centro Universitário das Faculdades Metropolitanas Unidas (FMU)',
  'Centro Universitário Senac',
  'Centro Universitário Belas Artes de São Paulo',
  'Centro Universitário São Camilo',
  'Centro Universitário Ítalo Brasileiro',
  "Centro Universitário Sant'Anna",
  'Centro Universitário Paulistano (UNIPAULISTANA)',
  'Centro Universitário Sumaré',
  'Faculdade Cásper Líbero',
  'Faculdade Santa Marcelina',
  'Faculdade Sumaré',
  'Faculdade Impacta de Tecnologia',
  'Faculdade Méliès',
  'Faculdade Trevisan',
  'Faculdade Sebrae',
  'Faculdade Zumbi dos Palmares',
  'Faculdade São Bento',
  'Faculdade Paulus (FAPCOM)',
  'Faculdade ESEG (Grupo Etapa)',
  'Faculdade Saint Paul',
  'Faculdade FIA de Administração e Negócios',
  'Faculdade INSPER',
  'Faculdade Drummond (Carlos Drummond de Andrade)',
  'Faculdade Flamingo',
  'Faculdade Campos Salles',
  'Faculdade Mozarteum de São Paulo',
  'Faculdade Integrada Cantareira',
  'Faculdade Paschoal Dantas',
  'Faculdade Sequencial',
  'Faculdade Unida de São Paulo',
  'Faculdade Brasil',
  'Faculdade Legale',
  'Instituto Federal de São Paulo (IFSP)',
  'Centro Paula Souza (FATEC / ETEC)',
  'UNIVESP (Universidade Virtual do Estado de São Paulo)',
  'Claretiano Centro Universitário',
  'IBMEC São Paulo',
  'Instituto Mauá de Tecnologia',
  'Instituto Singularidades',
  'Instituto Vera Cruz',
  'Escola Superior de Sociologia e Política (FESPSP)',
  'Escola de Direito de São Paulo (FGV Direito SP)',
  'Escola de Economia de São Paulo (FGV EESP)',
  'Escola Paulista de Direito (EPD)',
  'Escola Brasileira de Administração Pública e de Empresas (FGV EBAPE)',
  'Senac São Paulo',
  'Senai São Paulo',
  'FAM (Faculdade das Américas)',
  'Unisa (Universidade de Santo Amaro)',
  'UniFECAF (Centro Universitário UniFECAF)',
  'Outros',
]

const SEMESTRES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']

/* ── Combobox com busca ── */
function Combobox({
  id,
  placeholder,
  options,
  value,
  onChange,
}: {
  id: string
  placeholder: string
  options: string[]
  value: string
  onChange: (v: string) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const filtered = query.trim()
    ? options.filter(o => o.toLowerCase().includes(query.toLowerCase()))
    : options

  // Fecha ao clicar fora
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function select(opt: string) {
    onChange(opt)
    setQuery('')
    setOpen(false)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value)
    onChange('')        // limpa seleção ao digitar
    setOpen(true)
  }

  function handleFocus() {
    setOpen(true)
  }

  const displayValue = value || query

  return (
    <div ref={ref} className={cStyles.comboWrap}>
      <div className={`${cStyles.comboInput} ${value ? cStyles.comboSelected : ''}`}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className={cStyles.comboIcon}>
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          id={id}
          type="text"
          placeholder={placeholder}
          value={displayValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          autoComplete="off"
          className={cStyles.comboText}
        />
        {value && (
          <button
            type="button"
            className={cStyles.comboClear}
            onClick={() => { onChange(''); setQuery(''); setOpen(false) }}
            aria-label="Limpar"
          >×</button>
        )}
      </div>

      {open && filtered.length > 0 && (
        <ul className={cStyles.comboList}>
          {filtered.slice(0, 80).map(opt => (
            <li
              key={opt}
              className={`${cStyles.comboItem} ${opt === value ? cStyles.comboItemActive : ''}`}
              onMouseDown={() => select(opt)}
            >
              {opt}
            </li>
          ))}
        </ul>
      )}

      {open && filtered.length === 0 && query.trim() && (
        <div className={cStyles.comboEmpty}>Nenhuma opção encontrada</div>
      )}
    </div>
  )
}

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
  const [faculdade, setFaculdade] = useState('')
  const [curso, setCurso] = useState('')
  const [semestre, setSemestre] = useState('')
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
    if (!faculdade) {
      setError('Selecione sua faculdade.')
      return
    }
    if (!curso) {
      setError('Selecione seu curso.')
      return
    }
    if (!semestre) {
      setError('Selecione seu semestre.')
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
        p_faculdade:     faculdade,
        p_curso:         curso,
        p_semestre:      semestre,
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

      // 3. Sync New Value (fire-and-forget)
      if (memberData?.id) {
        supabase.functions
          .invoke('sync-newvalue', {
            body: {
              nome:     nome.trim(),
              email:    email.trim().toLowerCase(),
              telefone: telefone.trim() || null,
              user_id:  memberData.id,
              ref_code: memberData.ref_code,
            },
          })
          .then(({ error }) => {
            if (error) console.warn('[sync-newvalue]', error.message)
          })

        // 4. Sync RD Station (fire-and-forget)
        supabase.functions
          .invoke('sync-rdstation', {
            body: {
              nome:      nome.trim(),
              email:     email.trim().toLowerCase(),
              telefone:  telefone.trim() || null,
              faculdade,
              curso,
              semestre,
            },
          })
          .then(({ error }) => {
            if (error) console.warn('[sync-rdstation]', error.message)
          })
      }

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
        <img src={logo} alt="Clube Bem Bolado" className={styles.logoImg} />
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

      {/* ── Dados Acadêmicos ── */}
      <div className={cStyles.academicSection}>
        <div className={cStyles.academicLabel}>Dados acadêmicos</div>

        <div className="form-group">
          <label htmlFor="reg-faculdade">Faculdade *</label>
          <Combobox
            id="reg-faculdade"
            placeholder="Buscar faculdade…"
            options={FACULDADES}
            value={faculdade}
            onChange={setFaculdade}
          />
        </div>

        <div className="form-group">
          <label htmlFor="reg-curso">Curso *</label>
          <Combobox
            id="reg-curso"
            placeholder="Buscar curso…"
            options={CURSOS}
            value={curso}
            onChange={setCurso}
          />
        </div>

        <div className="form-group">
          <label htmlFor="reg-semestre">Semestre *</label>
          <select
            id="reg-semestre"
            className="input"
            value={semestre}
            onChange={e => setSemestre(e.target.value)}
          >
            <option value="">Selecione o semestre</option>
            {SEMESTRES.map(s => (
              <option key={s} value={s}>{s}º semestre</option>
            ))}
          </select>
        </div>
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
