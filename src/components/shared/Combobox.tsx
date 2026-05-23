import { useState, useEffect, useRef } from 'react'
import styles from './Combobox.module.css'

interface Props {
  id?: string
  placeholder?: string
  options: string[]
  value: string
  onChange: (v: string) => void
}

export default function Combobox({ id, placeholder, options, value, onChange }: Props) {
  const [query, setQuery]   = useState('')
  const [open, setOpen]     = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const filtered = query.trim()
    ? options.filter(o => o.toLowerCase().includes(query.toLowerCase()))
    : options

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function select(opt: string) {
    onChange(opt)
    setQuery('')
    setOpen(false)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value)
    onChange('')
    setOpen(true)
  }

  const displayValue = value || query

  return (
    <div ref={ref} className={styles.comboWrap}>
      <div className={`${styles.comboInput} ${value ? styles.comboSelected : ''}`}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className={styles.comboIcon}>
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          id={id}
          type="text"
          placeholder={placeholder ?? 'Buscar…'}
          value={displayValue}
          onChange={handleInputChange}
          onFocus={() => setOpen(true)}
          autoComplete="off"
          className={styles.comboText}
        />
        {value && (
          <button
            type="button"
            className={styles.comboClear}
            onClick={() => { onChange(''); setQuery(''); setOpen(false) }}
            aria-label="Limpar"
          >×</button>
        )}
      </div>

      {open && filtered.length > 0 && (
        <ul className={styles.comboList}>
          {filtered.slice(0, 80).map(opt => (
            <li
              key={opt}
              className={`${styles.comboItem} ${opt === value ? styles.comboItemActive : ''}`}
              onMouseDown={() => select(opt)}
            >
              {opt}
            </li>
          ))}
        </ul>
      )}

      {open && filtered.length === 0 && query.trim() && (
        <div className={styles.comboEmpty}>Nenhuma opção encontrada</div>
      )}
    </div>
  )
}
