import styles from './MetricCard.module.css'

interface Props {
  icon: string
  label: string
  value: string | number
  change?: string
  changeType?: 'up' | 'down' | 'neutral'
  colorClass?: 'purple' | 'green' | 'amber' | 'red'
  onChangeClick?: () => void
}

export default function MetricCard({ icon, label, value, change, changeType = 'neutral', colorClass = 'purple', onChangeClick }: Props) {
  return (
    <div className={styles.card}>
      <div className={`${styles.icon} ${styles[colorClass]}`}>{icon}</div>
      <div className={styles.label}>{label}</div>
      <div className={styles.value}>{value}</div>
      {change && (
        onChangeClick ? (
          <button
            className={`${styles.change} ${styles.changeLink}`}
            onClick={onChangeClick}
          >
            {change}
          </button>
        ) : (
          <div className={`${styles.change} ${changeType === 'up' ? styles.up : changeType === 'down' ? styles.down : ''}`}>
            {change}
          </div>
        )
      )}
    </div>
  )
}
