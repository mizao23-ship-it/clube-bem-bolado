import styles from './FilterTabs.module.css'

interface Tab {
  value: string
  label: string
}

interface Props {
  tabs: Tab[]
  active: string
  onChange: (value: string) => void
}

export default function FilterTabs({ tabs, active, onChange }: Props) {
  return (
    <div className={styles.tabs}>
      {tabs.map(t => (
        <button
          key={t.value}
          className={`${styles.tab} ${active === t.value ? styles.active : ''}`}
          onClick={() => onChange(t.value)}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
