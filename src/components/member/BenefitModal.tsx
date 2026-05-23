import { useState } from 'react'
import styles from './BenefitModal.module.css'

interface NvOfferMeta {
  how_to_use?: { pt?: string }
  link_site?:  { pt?: string }
  partner_name?: string
}

export interface BenefitOffer {
  id: number
  uuid: string
  title:    { pt?: string; en?: string; es?: string }
  subtitle: { pt?: string; en?: string; es?: string }
  content:  { pt?: string; en?: string; es?: string }
  type: string
  expires_at: string | null
  media?: { url: string; urlStandard?: string }[]
  offer_meta?: NvOfferMeta
  partner?: { name: string }
}

interface Props {
  offer: BenefitOffer
  email: string
  memberName: string
  memberCode: string
  onClose: () => void
}

function pt(obj?: { pt?: string; en?: string; es?: string }) {
  return obj?.pt ?? obj?.en ?? obj?.es ?? ''
}

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\r\n/g, '\n').trim()
}

function formatDate(iso: string | null) {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return d.toLocaleDateString('pt-BR')
}

const CARD_GRADS = [
  'linear-gradient(135deg,#7c3aed,#c026d3)',
  'linear-gradient(135deg,#0ea5e9,#6366f1)',
  'linear-gradient(135deg,#10b981,#0ea5e9)',
  'linear-gradient(135deg,#f59e0b,#ef4444)',
  'linear-gradient(135deg,#ec4899,#8b5cf6)',
]
function cardGrad(id: number) { return CARD_GRADS[id % CARD_GRADS.length] }
function initials(title: string) {
  return title.split(' ').filter(w => w.length > 2).slice(0, 2).map(w => w[0].toUpperCase()).join('') || title.slice(0, 2).toUpperCase()
}

export default function BenefitModal({ offer, email, memberName, memberCode, onClose }: Props) {
  const [step, setStep]         = useState<'detail' | 'coupon'>('detail')
  const [loading, setLoading]   = useState(false)
  const [couponCode, setCouponCode] = useState('')
  const [couponExp, setCouponExp]   = useState<string | null>(null)
  const [error, setError]       = useState('')
  const [copied, setCopied]     = useState(false)

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
  const ANON_KEY     = import.meta.env.VITE_SUPABASE_ANON_KEY as string

  const title       = pt(offer.title)
  const desc        = stripHtml(pt(offer.content))
  const howToUse    = stripHtml(offer.offer_meta?.how_to_use?.pt ?? '')
  const linkSite    = offer.offer_meta?.link_site?.pt ?? ''
  const partnerName = offer.partner?.name ?? offer.offer_meta?.partner_name ?? ''
  const expiry      = formatDate(offer.expires_at)
  const imgUrl      = offer.media?.[0]?.urlStandard ?? offer.media?.[0]?.url
  const isCouponType = offer.type === 'coupon' || offer.type === 'voucher'

  async function handleGerarCupom() {
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/cupom-newvalue`, {
        method: 'POST',
        headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ offer_id: offer.id, email, nome: memberName }),
      })
      const data = await res.json()
      if (data.error) {
        // Voucher presencial: sem código digital — mostrar identificação do membro
        if (offer.type === 'voucher') {
          setCouponCode('')
          setStep('coupon')
          return
        }
        setError('Não foi possível gerar o cupom. Tente novamente.')
        return
      }
      setCouponCode(data.coupon_code)
      setCouponExp(formatDate(data.expires_at))
      setStep('coupon')
    } catch {
      setError('Não foi possível gerar o cupom. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  function copyCoupon() {
    navigator.clipboard.writeText(couponCode).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function openSite() {
    if (linkSite) window.open(linkSite, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.logoWrap}>
            {imgUrl ? (
              <img
                src={imgUrl}
                alt={title}
                className={styles.logoImg}
                onError={e => {
                  const el = e.currentTarget.parentElement!
                  el.style.background = cardGrad(offer.id)
                  el.innerHTML = `<span style="color:#fff;font-weight:800;font-size:20px">${initials(title)}</span>`
                }}
              />
            ) : (
              <div className={styles.logoFallback} style={{ background: cardGrad(offer.id) }}>
                {initials(title)}
              </div>
            )}
          </div>
          <div className={styles.headerInfo}>
            {partnerName && <div className={styles.partnerName}>{partnerName}</div>}
            <div className={styles.modalTitle}>{title}</div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Fechar">×</button>
        </div>

        <div className={styles.modalBody}>
          {step === 'detail' ? (
            <>
              {/* Descrição */}
              {desc && (
                <div className={styles.section}>
                  <div className={styles.sectionLabel}>Descrição do benefício</div>
                  <p className={styles.sectionText}>{desc}</p>
                </div>
              )}

              {/* Como usar */}
              {howToUse && (
                <div className={styles.section}>
                  <div className={styles.sectionLabel}>Como usar</div>
                  <p className={styles.sectionText}>{howToUse}</p>
                </div>
              )}

              {/* Validade */}
              {expiry && (
                <div className={styles.section}>
                  <div className={styles.sectionLabel}>Válido até</div>
                  <p className={styles.sectionText}>{expiry}</p>
                </div>
              )}

              {error && <div className={styles.errorMsg}>{error}</div>}

              {/* Ações */}
              <div className={styles.actions}>
                {isCouponType ? (
                  <button className={styles.primaryBtn} onClick={handleGerarCupom} disabled={loading}>
                    {loading
                      ? <span className="spinner" style={{ width: 13, height: 13, borderTopColor: '#fff' }} />
                      : 'Gerar cupom'
                    }
                  </button>
                ) : linkSite ? (
                  <button className={styles.primaryBtn} onClick={openSite}>
                    Acessar o site →
                  </button>
                ) : null}
              </div>
            </>
          ) : (
            <>
              {/* Cupom gerado (ou voucher presencial sem código) */}
              {couponCode ? (
                <div className={styles.couponBox}>
                  <div className={styles.couponLabel}>Código promocional</div>
                  <div className={styles.couponRow}>
                    <span className={styles.couponCode}>{couponCode}</span>
                    <button className={styles.copyBtn} onClick={copyCoupon}>
                      {copied ? '✓ Copiado!' : 'Copiar código'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className={styles.couponBox}>
                  <div className={styles.couponLabel}>Voucher presencial</div>
                  <p className={styles.sectionText} style={{ marginTop: 4 }}>
                    Apresente seu código de membro na loja para usufruir do benefício.
                  </p>
                </div>
              )}

              {/* Dados do membro */}
              <div className={styles.memberBox}>
                <div className={styles.memberRow}><span>Nome</span><strong>{memberName}</strong></div>
                <div className={styles.memberRow}><span>Código</span><strong>{memberCode}</strong></div>
                {couponExp && <div className={styles.memberRow}><span>Válido até</span><strong>{couponExp}</strong></div>}
              </div>

              {/* Como usar */}
              {howToUse && (
                <div className={styles.section}>
                  <div className={styles.sectionLabel}>Como usar o benefício</div>
                  <p className={styles.sectionText}>{howToUse}</p>
                </div>
              )}

              {/* Acessar site */}
              {linkSite && (
                <div className={styles.actions}>
                  <button className={styles.primaryBtn} onClick={openSite}>
                    Clique aqui para acessar o site →
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
