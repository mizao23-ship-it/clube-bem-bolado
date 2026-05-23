import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import styles from './MemberHeader.module.css'
import logo from '@/assets/logo-bem-bolado.svg'

export default function MemberHeader() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const initials = profile?.nome
    ? profile.nome.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div className={styles.logoWrap}>
          <img src={logo} alt="Clube Bem Bolado" className={styles.logoImg} />
        </div>

        <nav className={styles.nav}>
          <button
            className={`${styles.navLink} ${location.pathname === '/experiencias' ? styles.active : ''}`}
            onClick={() => navigate('/experiencias')}
          >
            Experiências
          </button>
          <button
            className={`${styles.navLink} ${location.pathname === '/beneficios' ? styles.active : ''}`}
            onClick={() => navigate('/beneficios')}
          >
            Benefícios
          </button>
        </nav>

        <div className={styles.userArea}>
          <button className={styles.avatarBtn} onClick={() => navigate('/perfil')} title="Meu perfil">
            <div className={styles.avatar}>{initials}</div>
            <div className={styles.userName}>{profile?.nome?.split(' ')[0]}</div>
          </button>
          <button className={styles.logoutBtn} onClick={handleSignOut}>Sair</button>
        </div>
      </div>
    </header>
  )
}
