import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { MemberRoute } from '@/routes/MemberRoute'
import { AdminRoute } from '@/routes/AdminRoute'

// Páginas públicas
import Home from '@/pages/Home'
import ResetPassword from '@/pages/ResetPassword'
import AuthConfirm from '@/pages/AuthConfirm'

// Páginas de membro
import Experiencias from '@/pages/Experiencias'
import Beneficios from '@/pages/Beneficios'
import Perfil from '@/pages/Perfil'

// Páginas admin
import AdminLayout from '@/components/admin/AdminLayout'
import AdminLogin from '@/pages/admin/AdminLogin'
import Dashboard from '@/pages/admin/Dashboard'
import Usuarios from '@/pages/admin/Usuarios'
import Sorteios from '@/pages/admin/Sorteios'
import Indicacoes from '@/pages/admin/Indicacoes'
import Relatorios from '@/pages/admin/Relatorios'
import Equipe from '@/pages/admin/Equipe'
import Configuracoes from '@/pages/admin/Configuracoes'
import Integracao from '@/pages/admin/Integracao'
import Logs from '@/pages/admin/Logs'
import Anuncios from '@/pages/admin/Anuncios'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* ── Públicas ── */}
          <Route path="/" element={<Home />} />
          <Route path="/auth/confirm" element={<AuthConfirm />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* ── Membro ── */}
          <Route element={<MemberRoute />}>
            <Route path="/experiencias" element={<Experiencias />} />
            <Route path="/beneficios" element={<Beneficios />} />
            <Route path="/perfil" element={<Perfil />} />
          </Route>

          {/* ── Admin ── */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminRoute />}>
            <Route element={<AdminLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="usuarios" element={<Usuarios />} />
            <Route path="sorteios" element={<Sorteios />} />
            <Route path="indicacoes" element={<Indicacoes />} />
            <Route path="logs" element={<Logs />} />
            <Route path="relatorios" element={<Relatorios />} />
            <Route path="equipe" element={<Equipe />} />
            <Route path="configuracoes" element={<Configuracoes />} />
            <Route path="integracao" element={<Integracao />} />
            <Route path="anuncios" element={<Anuncios />} />
            </Route>
          </Route>

          {/* ── Fallback ── */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
