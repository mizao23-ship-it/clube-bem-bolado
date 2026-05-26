import styles from './StatsRow.module.css'

interface Props {
  indicados: number
  experiencias: number
}

export default function StatsRow({ indicados, experiencias }: Props) {
  return (
    <div className={styles.row}>
      <div className={`${styles.stat} ${styles.statIndicacoes}`}>
        <div className={styles.num}>{indicados}</div>
        <div className={styles.label}>Indicações</div>
      </div>
      <div className={`${styles.divider} ${styles.dividerIndicacoes}`} />
      <div className={styles.stat}>
        <div className={styles.num}>{experiencias}</div>
        <div className={styles.label}>Experiências</div>
      </div>
    </div>
  )
}
