import styles from './WelcomeModal.module.css'
import bannerIfood from '@/assets/banner-ifood.jpg'

const IFOOD_LINK = 'https://app.ifood.com.br/F4X4/clubeciee'

function isMobileDevice() {
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
}

interface Props {
  onRedeem: () => void
  onLater: () => void
}

export default function WelcomeModal({ onRedeem, onLater }: Props) {
  const mobile = isMobileDevice()

  function handleRedeem() {
    if (mobile) {
      window.open(IFOOD_LINK, '_blank', 'noopener,noreferrer')
    }
    onRedeem()
  }

  return (
    <div className={styles.overlay} onClick={onLater}>
      <div className={styles.card} onClick={e => e.stopPropagation()}>
        <button className={styles.closeX} onClick={onLater} aria-label="Fechar">×</button>

        <img src={bannerIfood} alt="2 meses grátis no iFood" className={styles.banner} />

        <div className={styles.body}>
          <div className={styles.title}>Presente especial pra você 🎁</div>

          {mobile ? (
            <>
              <div className={styles.sub}>
                Como membro Clube Bem Bolado, você ganhou <strong>2 meses grátis</strong> no iFood!
              </div>
              <div className={styles.actions}>
                <button className={styles.btnPrimary} onClick={handleRedeem}>
                  Resgatar agora
                </button>
                <button className={styles.btnSecondary} onClick={onLater}>
                  Depois
                </button>
              </div>
            </>
          ) : (
            <>
              <div className={styles.sub}>
                Como membro Clube Bem Bolado, você ganhou <strong>2 meses grátis</strong> no iFood!<br />
                Seu cupom será enviado <strong>via WhatsApp</strong> em breve.
              </div>
              <div className={styles.desktopNotice}>
                📱 O link de ativação só funciona pelo celular — fique de olho no seu WhatsApp!
              </div>
              <div className={styles.actions}>
                <button className={styles.btnPrimary} onClick={handleRedeem}>
                  Entendido!
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
