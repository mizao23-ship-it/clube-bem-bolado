import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { CURSOS } from '@/lib/cursos'
import { logAdminAction } from '@/lib/adminLog'
import { getClientInfo, logMemberProfileChange } from '@/lib/auditLog'
import MemberHeader from '@/components/member/MemberHeader'
import MemberFooter from '@/components/member/MemberFooter'
import Combobox from '@/components/shared/Combobox'
import styles from './Perfil.module.css'

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

const SEMESTRES = ['1º', '2º', '3º', '4º', '5º', '6º', '7º', '8º', '9º', '10º', 'Formado(a)']

export default function Perfil() {
  const { profile, refreshProfile, signOut } = useAuth()
  const navigate = useNavigate()

  const [nome, setNome]           = useState('')
  const [telefone, setTelefone]   = useState('')
  const [faculdade, setFaculdade] = useState('')
  const [curso, setCurso]         = useState('')
  const [semestre, setSemestre]   = useState('')
  const [saving, setSaving]       = useState(false)
  const [success, setSuccess]     = useState(false)
  const [error, setError]         = useState('')

  useEffect(() => {
    if (!profile) return
    setNome(profile.nome ?? '')
    setTelefone(profile.telefone ?? '')
    setFaculdade((profile as any).faculdade ?? '')
    setCurso((profile as any).curso ?? '')
    setSemestre((profile as any).semestre ?? '')
  }, [profile])

  const initials = profile?.nome
    ? profile.nome.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    : ''

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess(false)
    if (!nome.trim()) { setError('O nome não pode ficar em branco.'); return }

    setSaving(true)
    const { ip, ua } = await getClientInfo()
    // Snapshot do estado anterior (para o log de auditoria)
    const antes = {
      nome:      profile?.nome      ?? '',
      telefone:  profile?.telefone  ?? '',
      faculdade: (profile as any)?.faculdade ?? '',
      curso:     (profile as any)?.curso     ?? '',
      semestre:  (profile as any)?.semestre  ?? '',
    }
    try {
      const { error: rpcErr } = await supabase.rpc('update_profile', {
        p_nome:      nome.trim(),
        p_telefone:  telefone.trim() || null,
        p_faculdade: faculdade.trim() || null,
        p_curso:     curso || null,
        p_semestre:  semestre || null,
      })
      if (rpcErr) throw rpcErr
      await refreshProfile()

      // Sync RD Station com dados atualizados (fire-and-forget)
      supabase.functions
        .invoke('sync-rdstation', {
          body: {
            nome:      nome.trim(),
            email:     profile!.email,
            telefone:  telefone.trim() || null,
            faculdade: faculdade.trim() || null,
            curso:     curso || null,
            semestre:  semestre || null,
          },
        })
        .then(({ error }) => {
          if (error) console.warn('[sync-rdstation]', error.message)
        })

      // ── Audit: log de alteração de perfil com before/after ──
      const depois = {
        nome:      nome.trim(),
        telefone:  telefone.trim() || null,
        faculdade: faculdade.trim() || null,
        curso:     curso || null,
        semestre:  semestre || null,
      }
      logMemberProfileChange(antes, depois, { ip, ua })
      logAdminAction('perfil_atualizado', {
        entidade: 'users',
        entidade_id: profile!.id,
        descricao: `Membro "${nome.trim()}" atualizou o próprio perfil`,
        metadata: { antes, depois },
      })
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.page}>
      <MemberHeader />

      <div className={styles.content}>
        {/* ── Avatar card ── */}
        <div className={styles.avatarCard}>
          <div className={styles.avatarCircle}>{initials}</div>
          <div className={styles.avatarName}>{profile?.nome}</div>
          <div className={styles.avatarEmail}>{profile?.email}</div>
          {memberSince && (
            <div className={styles.avatarSince}>Membro desde {memberSince}</div>
          )}
          <div className={styles.statsRow}>
            <div className={styles.statItem}>
              <div className={styles.statValue}>{profile?.indicados ?? 0}</div>
              <div className={styles.statLabel}>Indicados</div>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.statItem}>
              <div className={styles.statValue}>{profile?.ref_code ?? '—'}</div>
              <div className={styles.statLabel}>Seu código</div>
            </div>
          </div>
        </div>

        {/* ── Form card ── */}
        <div className={styles.formCard}>
          <div className={styles.formTitle}>Meus dados</div>
          <div className={styles.formSub}>Mantenha seu perfil atualizado</div>

          {error && (
            <div className={styles.errorBox}>{error}</div>
          )}
          {success && (
            <div className={styles.successBox}>✓ Dados atualizados com sucesso!</div>
          )}

          <form onSubmit={handleSave} noValidate>
            {/* Dados pessoais */}
            <div className={styles.sectionTitle}>Dados pessoais</div>

            <div className={styles.formGroup}>
              <label>Nome completo *</label>
              <input
                className="input"
                value={nome}
                onChange={e => setNome(e.target.value)}
                placeholder="Seu nome completo"
              />
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>Telefone / WhatsApp</label>
                <input
                  className="input"
                  value={telefone}
                  onChange={e => setTelefone(e.target.value)}
                  placeholder="(11) 99999-9999"
                  type="tel"
                />
              </div>
              <div className={styles.formGroup}>
                <label>E-mail</label>
                <input
                  className="input"
                  value={profile?.email ?? ''}
                  disabled
                  style={{ opacity: 0.6, cursor: 'not-allowed' }}
                />
                <div className={styles.hint}>Para alterar o e-mail, entre em contato com o suporte.</div>
              </div>
            </div>

            {/* Dados acadêmicos */}
            <div className={styles.sectionTitle} style={{ marginTop: 24 }}>Dados acadêmicos</div>

            <div className={styles.formGroup}>
              <label>Faculdade / Instituição</label>
              <Combobox
                placeholder="Buscar faculdade…"
                options={FACULDADES}
                value={faculdade}
                onChange={setFaculdade}
              />
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>Curso</label>
                <select
                  className="input"
                  value={curso}
                  onChange={e => setCurso(e.target.value)}
                >
                  <option value="">Selecione seu curso</option>
                  {CURSOS.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label>Semestre</label>
                <select
                  className="input"
                  value={semestre}
                  onChange={e => setSemestre(e.target.value)}
                >
                  <option value="">Selecione</option>
                  {SEMESTRES.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles.formFooter}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigate('/experiencias')}
                disabled={saving}
              >
                Voltar
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Salvando…' : 'Salvar alterações'}
              </button>
            </div>
          </form>
        </div>
      </div>
      <MemberFooter />

      {/* Botão de logout — visível só no mobile (header esconde o Sair em telas pequenas) */}
      <div className={styles.mobileLogout}>
        <button
          className={styles.mobileLogoutBtn}
          onClick={async () => { await signOut(); navigate('/') }}
        >
          Encerrar sessão
        </button>
      </div>
    </div>
  )
}
