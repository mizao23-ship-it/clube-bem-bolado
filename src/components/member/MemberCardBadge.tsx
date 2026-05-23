import styles from './MemberCardBadge.module.css'

interface Props {
  nome: string
  refCode: string
  compact?: boolean
}

export default function MemberCardBadge({ nome, refCode, compact = false }: Props) {
  if (compact) {
    return (
      <div className={styles.cardCompact}>
        <div className={styles.compactLogo}>
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </div>
        <div className={styles.compactInfo}>
          <div className={styles.compactNome}>{nome}</div>
          <div className={styles.compactCodeLabel}>Código de membro</div>
          <div className={styles.compactCode}>{refCode}</div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.logo}>
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </div>
        <span className={styles.brand}>bem bolado</span>
      </div>
      <div className={styles.nome}>{nome}</div>
      <div className={styles.codeLabel}>Código de membro</div>
      <div className={styles.code}>{refCode}</div>
    </div>
  )
}
