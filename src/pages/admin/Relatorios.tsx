export default function Relatorios() {
  return (
    <div className="page-enter">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <div className="page-title">Relatórios</div>
          <div className="page-sub">Dados exportáveis e métricas detalhadas do clube</div>
        </div>
      </div>

      <div className="card" style={{ textAlign: 'center', padding: '64px 32px' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🚧</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-1)', marginBottom: 8 }}>Em desenvolvimento</div>
        <div style={{ fontSize: 14, color: 'var(--text-2)', maxWidth: 380, margin: '0 auto' }}>
          Esta seção está sendo construída. Em breve você terá acesso a relatórios completos de membros, sorteios, indicações e crescimento.
        </div>
      </div>
    </div>
  )
}
