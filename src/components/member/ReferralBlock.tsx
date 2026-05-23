import { useState } from 'react'
import styles from './ReferralBlock.module.css'

interface Props {
  refCode: string
  referralUsed: boolean
}

export default function ReferralBlock({ refCode, referralUsed }: Props) {
  const [copied, setCopied] = useState(false)

  const inviteUrl = `${window.location.origin}/?ref=${refCode}`

  function copyLink() {
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function shareWhatsApp() {
    const msg = encodeURIComponent(
      `Oii, descobri uma comunidade de universitários que podemos ter descontos e participar de experiências incríveis durante a faculdade. Segue meu link de convite para participar, é só fazer o seu cadastro! ${inviteUrl}`
    )
    window.open(`https://wa.me/?text=${msg}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className={styles.block}>
      <div className={styles.labelRow}>
        <div className={styles.label}>Seu convite exclusivo</div>
        <span className={referralUsed ? styles.badgeUsed : styles.badgeAvailable}>
          {referralUsed ? 'Indicação realizada' : '1 convite disponível'}
        </span>
      </div>
      {!referralUsed ? (
        <>
          <div className={styles.codeLine}>
            <div className={styles.codeBadge}>{refCode}</div>
          </div>
          <div className={styles.row}>
            <button className={styles.copyBtn} onClick={copyLink}>
              {copied ? '✓ Copiado!' : '🔗 Copiar link'}
            </button>
            <button className={styles.waBtn} onClick={shareWhatsApp}>
              <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              WhatsApp
            </button>
          </div>
          <div className={styles.hint}>
            Você tem apenas <strong>1 convite</strong> para o Clube Bem Bolado. Convide alguém para fazer parte do Clube Bem Bolado
          </div>
        </>
      ) : (
        <div className={styles.usedMsg}>
          Você já utilizou seu convite. Obrigado por fazer o clube crescer! 🎉
        </div>
      )}
    </div>
  )
}
