import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import styles from './Sidebar.module.css'
import logo from '@/assets/logo-bem-bolado.svg'

interface NavItem {
  path: string
  label: string
  icon: React.ReactNode
  badge?: string
}

const NAV_ITEMS: NavItem[] = [
  {
    path: '/admin',
    label: 'Dashboard',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
  },
]

const GESTAO_ITEMS: NavItem[] = [
  {
    path: '/admin/usuarios',
    label: 'Usuários',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2"/><path d="M19 8v6M22 11h-6"/>
      </svg>
    ),
  },
  {
    path: '/admin/sorteios',
    label: 'Experiências',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    ),
  },
  {
    path: '/admin/indicacoes',
    label: 'Indicações',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
      </svg>
    ),
  },
  {
    path: '/admin/anuncios',
    label: 'Anúncios',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M3 11l19-9-9 19-2-8-8-2z"/>
      </svg>
    ),
  },
  {
    path: '/admin/logs',
    label: 'Logs de Auditoria',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10 9 9 9 8 9"/>
      </svg>
    ),
  },
  {
    path: '/admin/relatorios',
    label: 'Relatórios',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
  },
]

const CONFIG_ITEMS: NavItem[] = [
  {
    path: '/admin/equipe',
    label: 'Equipe',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="8" r="4"/><path d="M4 20v-1a8 8 0 0116 0v1"/>
      </svg>
    ),
  },
  {
    path: '/admin/configuracoes',
    label: 'Configurações',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
      </svg>
    ),
  },
  {
    path: '/admin/integracao',
    label: 'Integração API',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
        <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
      </svg>
    ),
  },
]

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

export default function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, signOut } = useAuth()
  const [counts, setCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    async function fetchCounts() {
      const [
        { count: usuarios },
        { count: experiencias },
        { count: anuncios },
        { count: equipe },
        { count: indicacoes },
      ] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('experiences').select('*', { count: 'exact', head: true }),
        supabase.from('announcements').select('*', { count: 'exact', head: true }),
        supabase.from('team_members').select('*', { count: 'exact', head: true }).eq('active', true),
        supabase.from('users').select('*', { count: 'exact', head: true }).not('referred_by', 'is', null),
      ])
      setCounts({
        '/admin/usuarios':   usuarios   ?? 0,
        '/admin/sorteios':   experiencias ?? 0,
        '/admin/anuncios':   anuncios   ?? 0,
        '/admin/equipe':     equipe     ?? 0,
        '/admin/indicacoes': indicacoes ?? 0,
      })
    }
    fetchCounts()
  }, [])

  const isActive = (path: string) =>
    path === '/admin'
      ? location.pathname === '/admin'
      : location.pathname.startsWith(path)

  function handleNav(path: string) {
    navigate(path)
    onClose?.()
  }

  function NavLink({ item }: { item: NavItem }) {
    const count = counts[item.path]
    return (
      <div
        className={`${styles.navItem} ${isActive(item.path) ? styles.active : ''}`}
        onClick={() => handleNav(item.path)}
      >
        <span className={styles.navIcon}>{item.icon}</span>
        {item.label}
        {count != null && count > 0 && (
          <span className={styles.navBadge}>{count}</span>
        )}
      </div>
    )
  }

  const initials = user?.name
    ? user.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
    : 'AD'

  return (
    <>
      {/* Overlay escuro no mobile quando sidebar aberta */}
      {isOpen && (
        <div className={styles.mobileOverlay} onClick={onClose} />
      )}

      <aside className={`${styles.sidebar} ${isOpen ? styles.open : ''}`}>
        {/* Logo */}
        <div className={styles.logo}>
          <img src={logo} alt="Clube Bem Bolado" className={styles.logoImg} />
          <div className={styles.logoTag}>Backoffice</div>
        </div>

        {/* Nav */}
        <div className={styles.navSection}>Principal</div>
        {NAV_ITEMS.map(item => <NavLink key={item.path} item={item} />)}

        <div className={styles.navSection}>Gestão</div>
        {GESTAO_ITEMS.map(item => <NavLink key={item.path} item={item} />)}

        <div className={styles.navSection}>Configurações</div>
        {CONFIG_ITEMS.map(item => <NavLink key={item.path} item={item} />)}

        {/* Footer */}
        <div className={styles.footer}>
          <div className={styles.userChip}>
            <div className={styles.avatar}>{initials}</div>
            <div>
              <div className={styles.uname}>{user?.name ?? 'Admin'}</div>
              <div className={styles.urole}>
                {user?.role === 'admin' ? 'Administrador' : 'Operador'}
              </div>
            </div>
          </div>
          <button className={styles.logoutBtn} onClick={signOut} title="Sair">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="15" height="15">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </aside>
    </>
  )
}
