import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

export function AdminRoute() {
  const { session, isAdmin, loading } = useAuth()

  if (loading) return <div className="route-loading" />

  if (!session) return <Navigate to="/admin/login" replace />

  if (!isAdmin) return <Navigate to="/admin/login" replace />

  return <Outlet />
}
