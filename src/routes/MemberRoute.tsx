import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

export function MemberRoute() {
  const { session, isMember, loading } = useAuth()

  if (loading) return <div className="route-loading" />

  if (!session) return <Navigate to="/" replace />

  // Sessão existe mas perfil ainda não foi criado (edge case)
  if (!isMember) return <Navigate to="/" replace />

  return <Outlet />
}
