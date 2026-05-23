import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

// Página intermediária que verifica o token_hash do Supabase Auth
// e redireciona o usuário para o destino correto
export default function AuthConfirm() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState('')

  useEffect(() => {
    const tokenHash = searchParams.get('token_hash')
    const type      = searchParams.get('type') as 'recovery' | 'signup' | 'email_change' | null
    const next      = searchParams.get('next') ?? '/'

    if (!tokenHash || !type) {
      setError('Link inválido ou expirado.')
      return
    }

    supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      .then(({ error }) => {
        if (error) {
          setError('Link inválido ou expirado. Solicite um novo.')
        } else if (type === 'recovery') {
          navigate('/reset-password', { replace: true })
        } else {
          navigate(next, { replace: true })
        }
      })
  }, [])

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 24 }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: '32px 28px', maxWidth: 400, textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,.08)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
          <h2 style={{ margin: '0 0 8px', color: '#1e1245' }}>Link expirado</h2>
          <p style={{ color: '#6b7280', fontSize: 14 }}>{error}</p>
          <button
            className="btn btn-primary"
            style={{ marginTop: 20, width: '100%', justifyContent: 'center' }}
            onClick={() => navigate('/')}
          >
            Voltar ao início
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ textAlign: 'center' }}>
        <span className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
        <p style={{ marginTop: 16, color: '#6b7280' }}>Verificando…</p>
      </div>
    </div>
  )
}
