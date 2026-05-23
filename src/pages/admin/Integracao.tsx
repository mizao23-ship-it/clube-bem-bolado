import styles from './Integracao.module.css'

export default function Integracao() {
  return (
    <div className="page-enter">
      <div className={styles.header}>
        <div>
          <div className="page-title">Integração API</div>
          <div className="page-sub">Endpoints da New Value API configurados</div>
        </div>
      </div>


      <div className="card">
        <div className="card-head"><div className="card-title">Endpoints configurados</div></div>
        <table>
          <thead>
            <tr><th>Operação</th><th>Endpoint</th><th>Status</th></tr>
          </thead>
          <tbody>
            <tr><td>Cadastro de usuário</td><td><code>POST /api/v2/key/users</code></td><td><span className="badge badge-green"><span className="dot" />Ativo</span></td></tr>
            <tr><td>Autologin (token)</td><td><code>POST /wp-json/api/whitelabel/auth_login</code></td><td><span className="badge badge-green"><span className="dot" />Ativo</span></td></tr>
            <tr><td>Exclusão por ID</td><td><code>DELETE /api/v2/key/users/{'{'}{'}'}ID</code></td><td><span className="badge badge-green"><span className="dot" />Ativo</span></td></tr>
            <tr><td>Exclusão por identification</td><td><code>DELETE /wp-json/api/funcionario/delete</code></td><td><span className="badge badge-green"><span className="dot" />Ativo</span></td></tr>
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-head"><div className="card-title">Suporte New Value</div></div>
        <div style={{ display: 'flex', gap: 24, fontSize: 13, color: 'var(--text-2)', flexWrap: 'wrap' }}>
          <span>📧 suporte@newvalue.com.br</span>
          <span>📧 comercial@newvalue.com.br</span>
          <span>📧 ti@newvalue.com.br</span>
        </div>
      </div>
    </div>
  )
}
