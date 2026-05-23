import styles from './BarChart.module.css'

interface Props {
  values: number[]
  labels: string[]
}

export default function BarChart({ values, labels }: Props) {
  const max = Math.max(...values, 1)
  return (
    <div className={styles.chart}>
      {values.map((v, i) => (
        <div key={i} className={styles.col}>
          <div
            className={styles.bar}
            style={{ height: `${Math.round(v / max * 85)}%` }}
            title={`${labels[i]}: ${v}`}
          />
          <div className={styles.lbl}>{labels[i]}</div>
        </div>
      ))}
    </div>
  )
}
