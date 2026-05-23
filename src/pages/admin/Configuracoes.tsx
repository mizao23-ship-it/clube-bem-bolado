import styles from './Configuracoes.module.css'

export default function Configuracoes() {
  return (
    <div className="page-enter">
      <div className={styles.header}>
        <div className="page-title">Configurações</div>
        <div className="page-sub">Em desenvolvimento</div>
      </div>

      <div className="card" style={{ maxWidth: 480, textAlign: 'center', padding: '48px 32px' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🚧</div>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 18, fontWeight: 700, color: 'var(--text-1)', marginBottom: 8 }}>
          Em desenvolvimento
        </div>
        <div style={{ fontSize: 13.5, color: 'var(--text-3)', lineHeight: 1.6 }}>
          Esta seção estará disponível em breve.
        </div>
      </div>
    </div>
  )
}
