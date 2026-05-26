import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import styles from './AnnouncementModal.module.css'

interface Announcement {
  id: string
  tipo: string
  titulo: string
  descricao: string | null
  midia_url: string | null
  cta_label: string
  cta_url: string | null
  cta_url_mobile: string | null
  veiculacao: string
  veiculacao_dias: number | null
  prioridade: number
}

interface Props {
  announcements: Announcement[]
  onAllDismissed: () => void
}

function isMobile() {
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
}

function getYouTubeId(url: string) {
  const m = url.match(/(?:youtu\.be\/|v=|embed\/)([A-Za-z0-9_-]{11})/)
  return m ? m[1] : null
}

const SESSION_KEY = 'clube_bem_bolado_ann_seen'
const SHOW_DELAY  = 5_000   // ms antes de abrir
const SKIP_AT     = 5       // segundos para Pular + CTA (aparecem juntos)

export default function AnnouncementModal({ announcements, onAllDismissed }: Props) {
  const { profile } = useAuth()
  const [queue,      setQueue]      = useState<Announcement[]>([])
  const [copied,     setCopied]     = useState(false)
  const [visible,    setVisible]    = useState(false)
  const [showSkip,   setShowSkip]   = useState(false)
  const [showCTA,    setShowCTA]    = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [doneCount,  setDoneCount]  = useState(0)

  // ── Filtra queue
  useEffect(() => {
    const seenThisSession: string[] = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? '[]')
    const filtered = announcements.filter(a => {
      if (a.veiculacao === 'por_sessao' && seenThisSession.includes(a.id)) return false
      return true
    })
    if (filtered.length === 0) { onAllDismissed(); return }
    setQueue(filtered)
    setTotalCount(filtered.length)
    setDoneCount(0)
  }, [announcements, profile])

  // ── Delay de 5s antes de abrir
  useEffect(() => {
    if (queue.length === 0) return
    const t = setTimeout(() => setVisible(true), SHOW_DELAY)
    return () => clearTimeout(t)
  }, [queue.length])

  // ── Timers para skip e CTA
  // Indicação: CTA imediato, Pular após 10s
  // Outros:    Pular + CTA juntos após 5s
  useEffect(() => {
    if (!visible || queue.length === 0) return
    const isIndicacao = queue[0]?.tipo === 'indicacao'
    setShowSkip(false)
    setShowCTA(isIndicacao)   // imediato para indicação
    if (isIndicacao) {
      const t = setTimeout(() => setShowSkip(true), 10_000)
      return () => clearTimeout(t)
    }
    // Para todos os outros tipos: Pular e CTA aparecem juntos
    const t = setTimeout(() => { setShowSkip(true); setShowCTA(true) }, SKIP_AT * 1_000)
    return () => clearTimeout(t)
  }, [visible, queue[0]?.id])

  // ── Scroll lock
  useEffect(() => {
    if (!visible) return
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [visible])

  function dismiss(ann: Announcement, clicked: boolean) {
    supabase.rpc('dismiss_announcement', {
      p_announcement_id: ann.id,
      p_clicked: clicked,
    }).then(undefined, () => {})

    if (ann.veiculacao === 'por_sessao') {
      const seen: string[] = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? '[]')
      sessionStorage.setItem(SESSION_KEY, JSON.stringify([...seen, ann.id]))
    }

    const next = queue.slice(1)
    if (next.length === 0) { onAllDismissed(); return }
    setQueue(next)
    setDoneCount(d => d + 1)
    setShowSkip(false)
    setShowCTA(false)
  }

  if (!visible || queue.length === 0) return null

  const ann        = queue[0]
  const mobile     = isMobile()
  const isReferral = ann.tipo === 'indicacao'
  const refLink    = `${window.location.origin}/?ref=${profile?.ref_code ?? ''}`
  const vidId      = ann.tipo === 'video_youtube' && ann.midia_url ? getYouTubeId(ann.midia_url) : null
  const hasImage   = (ann.tipo === 'imagem' || ann.tipo === 'indicacao') && !!ann.midia_url

  const bgStyle = hasImage
    ? { backgroundImage: `url(${ann.midia_url})` }
    : undefined

  function handleCTA() {
    const url = mobile ? (ann.cta_url_mobile ?? ann.cta_url) : ann.cta_url
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
    dismiss(ann, true)
  }

  function handleWhatsApp() {
    const msg = encodeURIComponent(
      `Ei! Entrei no Clube Bem Bolado, o clube de benefícios e experiências exclusivas para universitários!\n\nVocê foi indicado(a) por mim — acesse pelo meu link exclusivo:\n${refLink}`
    )
    if (mobile) {
      window.location.href = `https://wa.me/?text=${msg}`
    } else {
      window.open(`https://wa.me/?text=${msg}`, '_blank', 'noopener,noreferrer')
    }
    dismiss(ann, true)
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(refLink).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  return (
    <div className={styles.overlay}>

      {/* ── Fundo desfocado ── */}
      <div className={styles.blurBg} style={bgStyle} />

      {/* ── Shell ── */}
      <div className={`${styles.shell} ${vidId ? styles.shellVideo : ''}`}>

        {/* Fundo interno */}
        <div className={styles.shellBg} style={bgStyle} />

        {/* ── Barra de progresso Stories (CSS animation — sem JS) ── */}
        <div className={styles.progressRow}>
          {Array.from({ length: totalCount }).map((_, i) => (
            <div key={i} className={styles.progressTrack}>
              {i < doneCount ? (
                <div className={styles.progressFillPast} />
              ) : i === doneCount ? (
                <div key={ann.id} className={styles.progressFillCurrent} />
              ) : (
                <div className={styles.progressFillFuture} />
              )}
            </div>
          ))}
        </div>

        {/* ── Botão Pular (após 5s) ── */}
        {showSkip && (
          <button
            className={styles.skipBtn}
            onClick={() => dismiss(ann, false)}
            aria-label="Pular anúncio"
          >
            Pular →
          </button>
        )}

        {/* ── Imagem ── */}
        {hasImage && (
          <div className={styles.mediaArea}>
            <img src={ann.midia_url!} alt={ann.titulo} className={styles.mediaImg} />
          </div>
        )}

        {/* ── Vídeo YouTube ── */}
        {vidId && (
          <div className={styles.videoArea}>
            <iframe
              src={`https://www.youtube.com/embed/${vidId}?autoplay=1&mute=1&playsinline=1&rel=0`}
              title={ann.titulo}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className={styles.videoIframe}
            />
          </div>
        )}

        {/* ── Painel (título + CTA) ── */}
        <div className={styles.panel}>
          <div className={styles.title}>{ann.titulo}</div>
          {ann.descricao && <div className={styles.sub}>{ann.descricao}</div>}

          {/* Tipo indicação */}
          {isReferral && showCTA && (
            <div className={styles.actions}>
              <div className={styles.refLinkBox}>
                <span className={styles.refLinkText}>
                  {window.location.host}/?ref={profile?.ref_code ?? '…'}
                </span>
                <span className={styles.refLinkLabel}>seu link</span>
              </div>

              <button className={styles.btnWhatsApp} onClick={handleWhatsApp}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Indicar pelo WhatsApp
              </button>

              <button
                className={copied ? styles.btnCopyDone : styles.btnCopy}
                onClick={handleCopyLink}
              >
                {copied ? '✓ Link copiado!' : '📋 Copiar link exclusivo'}
              </button>

              <div className={styles.refFootnote}>
                Cada amigo indicado aumenta suas chances nos sorteios! 🎉
              </div>
            </div>
          )}

          {/* CTA normal */}
          {!isReferral && (
            <>
              {!mobile && ann.cta_url_mobile && !ann.cta_url && (
                <div className={styles.desktopNotice}>
                  📱 O link de ativação só funciona pelo celular — fique de olho no seu WhatsApp!
                </div>
              )}
              {showCTA && (
                <div className={styles.actions}>
                  <button className={styles.btnPrimary} onClick={handleCTA}>
                    {ann.cta_label}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
