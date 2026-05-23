import styles from './HBarChart.module.css'

const RANK_COLORS = [
  { bar: 'linear-gradient(90deg, #7c3aed, #a78bfa)', rank: '#7E00E5', bg: 'rgba(126,0,229,.08)' },
  { bar: 'linear-gradient(90deg, #6366f1, #818cf8)', rank: '#6366f1', bg: 'rgba(99,102,241,.07)' },
  { bar: 'linear-gradient(90deg, #0ea5e9, #38bdf8)', rank: '#0ea5e9', bg: 'rgba(14,165,233,.07)' },
  { bar: 'linear-gradient(90deg, #10b981, #34d399)', rank: '#10b981', bg: 'rgba(16,185,129,.07)' },
  { bar: 'linear-gradient(90deg, #f59e0b, #fcd34d)', rank: '#f59e0b', bg: 'rgba(245,158,11,.07)' },
  { bar: 'linear-gradient(90deg, #ec4899, #f9a8d4)', rank: '#ec4899', bg: 'rgba(236,72,153,.07)' },
]

interface Props {
  items: { label: string; value: number }[]
}

export default function HBarChart({ items }: Props) {
  const max = Math.max(...items.map(i => i.value), 1)
  const total = items.reduce((s, i) => s + i.value, 0)

  if (items.length === 0) {
    return <div className={styles.empty}>Nenhuma inscrição ainda.</div>
  }

  return (
    <div className={styles.chart}>
      {items.map((item, i) => {
        const pct = Math.round(item.value / max * 100)
        const share = total > 0 ? Math.round(item.value / total * 100) : 0
        const c = RANK_COLORS[i] ?? RANK_COLORS[RANK_COLORS.length - 1]

        return (
          <div key={i} className={styles.row} style={{ background: c.bg }}>
            <div className={styles.rank} style={{ color: c.rank }}>#{i + 1}</div>
            <div className={styles.info}>
              <div className={styles.topRow}>
                <span className={styles.label} title={item.label}>{item.label}</span>
                <span className={styles.stats}>
                  <strong>{item.value}</strong> inscritos
                  <span className={styles.share} style={{ color: c.rank }}>{share}%</span>
                </span>
              </div>
              <div className={styles.barWrap}>
                <div
                  className={styles.bar}
                  style={{ width: `${pct}%`, background: c.bar }}
                />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
