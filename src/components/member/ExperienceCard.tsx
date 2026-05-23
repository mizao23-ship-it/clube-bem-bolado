import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { logAdminAction } from '@/lib/adminLog'
import { getClientInfo } from '@/lib/auditLog'
import type { DbExperience } from '@/types/database'
import styles from './ExperienceCard.module.css'
import mStyles from './ParticipacaoModal.module.css'

const CAT_LABELS: Record<string, string> = {
  shows:      'Shows',
  cultura:    'Cultura',
  tecnologia: 'Tecnologia',
  carreira:   'Carreira',
  esportes:   'Esportes',
  arte:       'Arte',
  negocios:   'Negócios',
  lifestyle:  'Lifestyle',
  viagem:     'Viagem',
  bem_estar:  'Bem-estar',
}

const CAT_EMOJI: Record<string, string> = {
  shows:      '🎸',
  cultura:    '🎭',
  tecnologia: '💻',
  carreira:   '💼',
  esportes:   '⚽',
  arte:       '🎨',
  negocios:   '📈',
  lifestyle:  '✨',
  viagem:     '✈️',
  bem_estar:  '🧘',
}

interface WinnerInfo { nome: string; isCurrentUser: boolean }
interface ResultadoInfo {
  winners: WinnerInfo[]
  premio: string
  drawDate: string
  drawAt: string | null
  isCurrentUser: boolean
}

interface Props {
  experience: DbExperience
  participando: boolean
  drawDate: string | null
  encerrado: boolean
  resultado: ResultadoInfo | null
  onParticipou: () => void
}

function fmtDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
  })
}

/* ── Modal de confirmação de participação ── */
function ParticipacaoModal({
  experience,
  drawDate,
  onConfirm,
  onClose,
}: {
  experience: DbExperience
  drawDate: string | null
  onConfirm: () => Promise<void>
  onClose: () => void
}) {
  const [aceito, setAceito] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleConfirmar() {
    if (!aceito || loading) return
    setLoading(true)
    await onConfirm()
    setLoading(false)
  }

  return (
    <div className={mStyles.overlay} onClick={onClose}>
      <div className={mStyles.card} onClick={e => e.stopPropagation()}>
        <button className={mStyles.closeX} onClick={onClose} aria-label="Fechar">×</button>

        {/* Header */}
        <div className={mStyles.header}>
          <div className={mStyles.catTag}>
            {CAT_EMOJI[experience.category]} SORTEIO EXCLUSIVO
          </div>
          <div className={mStyles.title}>{experience.name}</div>
        </div>

        {/* Infos */}
        <div className={mStyles.infoGrid}>
          {(experience.start_date || experience.end_date) && (
            <div className={mStyles.infoBox}>
              <div className={mStyles.infoLabel}>📅 PERÍODO DE PARTICIPAÇÃO</div>
              <div className={mStyles.infoValue}>
                {experience.start_date ? fmtDate(experience.start_date) : '—'}
                {experience.start_date && experience.end_date && ' até '}
                {experience.end_date ? fmtDate(experience.end_date) : ''}
              </div>
            </div>
          )}
          {drawDate && (
            <div className={`${mStyles.infoBox} ${mStyles.infoBoxHighlight}`}>
              <div className={mStyles.infoLabel}>📅 DATA DO SORTEIO</div>
              <div className={mStyles.infoValue}>{fmtDate(drawDate)}</div>
            </div>
          )}
        </div>

        {/* Termo de adesão */}
        {experience.termo_adesao && (
          <div className={mStyles.termoBox}>
            <div className={mStyles.termoLabel}>📋 POLÍTICA DE PARTICIPAÇÃO</div>
            <div className={mStyles.termoText}>{experience.termo_adesao}</div>
          </div>
        )}

        {/* Checkbox aceite */}
        <label className={mStyles.checkLabel}>
          <input
            type="checkbox"
            checked={aceito}
            onChange={e => setAceito(e.target.checked)}
            className={mStyles.checkbox}
          />
          <span>Li e aceito os termos de participação</span>
        </label>

        {/* Ações */}
        <div className={mStyles.actions}>
          <button
            className={mStyles.btnConfirmar}
            onClick={handleConfirmar}
            disabled={!aceito || loading}
          >
            {loading
              ? <span className="spinner" style={{ borderTopColor: '#fff' }} />
              : '✓ Confirmar participação'
            }
          </button>
          <button className={mStyles.btnFechar} onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  )
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

/* ── Countdown helpers ── */
function getDaysLabel(drawDate: string): string {
  const now  = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const draw  = new Date(drawDate + 'T00:00:00')
  const drawDay = new Date(draw.getFullYear(), draw.getMonth(), draw.getDate())
  const diffDays = Math.round((drawDay.getTime() - today.getTime()) / 86_400_000)
  if (diffDays < 0)  return ''
  if (diffDays === 0) return 'Hoje!'
  if (diffDays === 1) return 'Amanhã'
  return `Faltam ${diffDays} dias`
}

function isDrawToday(drawDate: string): boolean {
  const now = new Date()
  const draw = new Date(drawDate + 'T00:00:00')
  return (
    draw.getFullYear() === now.getFullYear() &&
    draw.getMonth()    === now.getMonth()    &&
    draw.getDate()     === now.getDate()
  )
}

function getDrawDiffDays(drawDate: string): number {
  const now     = new Date()
  const today   = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const draw    = new Date(drawDate + 'T00:00:00')
  const drawDay = new Date(draw.getFullYear(), draw.getMonth(), draw.getDate())
  return Math.round((drawDay.getTime() - today.getTime()) / 86_400_000)
}

function abrevNome(nome: string) {
  const parts = nome.split(' ')
  if (parts.length < 2) return nome
  return `${parts[0]} ${parts[1][0]}.`
}

/* ── Modal de resultado do sorteio ── */
function ResultadoModal({
  experience,
  resultado,
  participando,
  onClose,
}: {
  experience: DbExperience
  resultado: ResultadoInfo
  participando: boolean
  onClose: () => void
}) {
  const vencedores = resultado.winners

  return (
    <div className={mStyles.overlay} onClick={onClose}>
      <div className={mStyles.card} onClick={e => e.stopPropagation()}>
        <button className={mStyles.closeX} onClick={onClose} aria-label="Fechar">×</button>

        {/* Header */}
        <div className={mStyles.header}>
          <div className={mStyles.catTag}>{CAT_EMOJI[experience.category]} RESULTADO DO SORTEIO</div>
          <div className={mStyles.title}>{experience.name}</div>
        </div>

        {/* Banner se o membro atual ganhou */}
        {resultado.isCurrentUser && (
          <div style={{ background: 'var(--warning-bg)', borderBottom: '1px solid #fde68a', padding: '14px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 26, marginBottom: 4 }}>🏆</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--warning)' }}>Você foi sorteado(a)!</div>
            <div style={{ fontSize: 12, color: 'var(--warning)', marginTop: 2, opacity: .8 }}>Aguarde o contato do Clube Bem Bolado via WhatsApp</div>
          </div>
        )}

        {/* Info grid */}
        <div className={mStyles.infoGrid}>
          {resultado.premio && (
            <div className={`${mStyles.infoBox} ${mStyles.infoBoxHighlight}`}>
              <div className={mStyles.infoLabel}>🎁 PRÊMIO</div>
              <div className={mStyles.infoValue}>{resultado.premio}</div>
            </div>
          )}
          <div className={mStyles.infoBox}>
            <div className={mStyles.infoLabel}>📅 SORTEIO REALIZADO</div>
            <div className={mStyles.infoValue}>
              {resultado.drawAt
                ? fmtDateTime(resultado.drawAt)
                : resultado.drawDate ? fmtDate(resultado.drawDate) : '—'}
            </div>
          </div>
          <div className={mStyles.infoBox}>
            <div className={mStyles.infoLabel}>👤 SUA PARTICIPAÇÃO</div>
            <div className={mStyles.infoValue} style={{ color: participando ? 'var(--success)' : 'var(--text-3)' }}>
              {participando ? '✓ Você participou' : 'Não participou'}
            </div>
          </div>
        </div>

        {/* Lista de vencedores */}
        <div style={{ padding: '0 20px 4px' }}>
          <div className={mStyles.termoLabel} style={{ marginBottom: 8 }}>
            🏆 {vencedores.length === 1 ? 'VENCEDOR(A)' : `VENCEDORES (${vencedores.length})`}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {vencedores.map((w, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: w.isCurrentUser ? 'var(--warning-bg)' : 'var(--surface-2)',
                border: `1px solid ${w.isCurrentUser ? '#fde68a' : 'var(--border)'}`,
                borderRadius: 'var(--radius)', padding: '10px 14px',
              }}>
                <span style={{ fontSize: 16 }}>{vencedores.length > 1 ? `${i + 1}º` : '🏆'}</span>
                <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-1)' }}>
                  {w.isCurrentUser ? `${abrevNome(w.nome)} (você!)` : abrevNome(w.nome)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className={mStyles.actions}>
          <button className={mStyles.btnFechar} onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  )
}

/* ── Card da experiência ── */
export default function ExperienceCard({ experience, participando, drawDate, encerrado, resultado, onParticipou }: Props) {
  const { profile } = useAuth()
  const [showModal, setShowModal]           = useState(false)
  const [showResultado, setShowResultado]   = useState(false)
  const [liveTime, setLiveTime]             = useState('')

  // Countdown ao vivo — só ativa quando o sorteio é hoje
  useEffect(() => {
    if (!drawDate || encerrado || !isDrawToday(drawDate)) return
    function tick() {
      const now = new Date()
      const midnight = new Date(now)
      midnight.setHours(23, 59, 59, 999)
      const diff = Math.max(0, midnight.getTime() - now.getTime())
      const h = Math.floor(diff / 3_600_000)
      const m = Math.floor((diff % 3_600_000) / 60_000)
      const s = Math.floor((diff % 60_000) / 1_000)
      setLiveTime(
        `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      )
    }
    tick()
    const id = setInterval(tick, 1_000)
    return () => clearInterval(id)
  }, [drawDate, encerrado])

  async function handleConfirmar() {
    if (!profile) return
    const agora = new Date().toISOString()
    const { ip, ua } = await getClientInfo()
    await supabase.from('participations').insert({
      user_id:         profile.id,
      experience_id:   experience.id,
      aceito_termo_em: agora,
      ip_address:      ip,
      user_agent:      ua,
    })
    logAdminAction('participacao_confirmada', {
      entidade:    'experience',
      entidade_id: experience.id,
      descricao:   `Membro confirmou participação: ${experience.name}`,
      metadata: {
        user_id:      profile.id,
        experience_id: experience.id,
        termo_aceito: true,
        aceito_em:    agora,
        start_date:   experience.start_date ?? null,
        end_date:     experience.end_date   ?? null,
        draw_date:    drawDate              ?? null,
      },
    })
    setShowModal(false)
    onParticipou()
  }

  const firstName      = profile?.nome?.split(' ')[0] ?? 'Você'
  const daysLabel      = drawDate && !encerrado ? getDaysLabel(drawDate) : ''
  const countdownLabel = liveTime || daysLabel
  const isLive         = !!liveTime
  const isPastDraw     = !!drawDate && !encerrado && getDrawDiffDays(drawDate) < 0

  const urgencyClass = (() => {
    if (!drawDate || encerrado || !countdownLabel) return styles.drawCountdown
    if (isLive) return styles.countdownUrgent
    const diff = getDrawDiffDays(drawDate)
    if (diff <= 0) return styles.countdownToday
    if (diff === 1) return styles.countdownTomorrow
    if (diff <= 7)  return styles.countdownSoon
    return styles.drawCountdown
  })()

  return (
    <>
      <div className={[
        styles.card,
        encerrado           ? styles.cardEncerrado    : '',
        experience.super_destaque ? styles.cardSuperDestaque : '',
      ].filter(Boolean).join(' ')}>
        {/* Thumb */}
        <div className={`${styles.thumb} ${!experience.img_url ? styles[`cat_${experience.category}`] : ''}`}>
          {experience.img_url
            ? <img src={experience.img_url} alt={experience.name} className={styles.thumbImg} />
            : null
          }
          {/* Shimmer sutil no super destaque */}
          {experience.super_destaque && <div className={styles.superThumbShimmer} />}
          <span className={styles.catBadge}>{CAT_LABELS[experience.category]}</span>
          {/* Badge ⭐ Destaque */}
          {experience.super_destaque && !encerrado && (
            <span className={styles.superBadge}>⭐ Destaque</span>
          )}
          {encerrado && <div className={styles.encerradoOverlay}><span>Sorteio realizado</span></div>}
        </div>

        {/* Body */}
        <div className={styles.body}>
          <div className={styles.name}>{experience.name}</div>
          {experience.description && (
            <div className={styles.desc}>{experience.description}</div>
          )}
          {/* Prova social */}
          {!encerrado && experience.participations_count > 0 && (
            <div className={styles.socialProof}>
              *{firstName} e outros {experience.participations_count} membros querem ir
            </div>
          )}
          {encerrado && resultado && (
            <div className={styles.winnerPreview}>
              {resultado.isCurrentUser
                ? '🏆 Você foi sorteado(a)!'
                : resultado.winners.length === 1
                  ? `🏆 ${resultado.winners[0].nome.split(' ')[0]} venceu`
                  : `🏆 ${resultado.winners.length} vencedores`}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          {drawDate ? (
            <div className={styles.drawDate}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="13" height="13">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <div>
                <span className={styles.drawDateLabel}>Sorteio</span>
                <span className={styles.drawDateValue}>{fmtDate(drawDate)}</span>
                {countdownLabel && (
                  <span className={urgencyClass}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                      strokeLinecap="round" strokeLinejoin="round" width="10" height="10">
                      <path d="M5 22h14"/><path d="M5 2h14"/>
                      <path d="M17 22v-4l-5-4 5-4V2"/><path d="M7 2v4l5 4-5 4v4"/>
                    </svg>
                    {countdownLabel}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div />
          )}
          {encerrado ? (
            resultado ? (
              <button className={styles.btnVerResultado} onClick={() => setShowResultado(true)}>
                Ver resultado →
              </button>
            ) : (
              <div className={styles.encerradoBadge}>🔒 Encerrado</div>
            )
          ) : isPastDraw ? (
            participando
              ? <div className={styles.inscrito}>✓ Inscrito</div>
              : <div className={styles.apuracaoBadge}>Em apuração</div>
          ) : participando ? (
            <div className={styles.inscrito}>✓ Inscrito</div>
          ) : (
            <button
              className={experience.super_destaque ? styles.btnGold : styles.btn}
              onClick={() => setShowModal(true)}
            >
              Tô dentro!
            </button>
          )}
        </div>
      </div>

      {showResultado && resultado && (
        <ResultadoModal
          experience={experience}
          resultado={resultado}
          participando={participando}
          onClose={() => setShowResultado(false)}
        />
      )}

      {showModal && (
        <ParticipacaoModal
          experience={experience}
          drawDate={drawDate}
          onConfirm={handleConfirmar}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  )
}
