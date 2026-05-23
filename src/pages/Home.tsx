import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import AuthCard from '@/components/auth/AuthCard'
import { getClientInfo, logLinkClick } from '@/lib/auditLog'
import styles from './Home.module.css'
import heroBg from '@/assets/hero-bembolado.webp'

export default function Home() {
  const { session, isMember, loading } = useAuth()
  const navigate = useNavigate()

  // ── Audit: clique em link de indicação ──────────────────────────────
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('ref')
    if (!ref) return
    getClientInfo().then(({ ip, ua }) => {
      logLinkClick(ref.toUpperCase(), { ip, ua })
    })
  }, []) // só na montagem — uma vez por visita

  useEffect(() => {
    if (!loading && session && isMember) {
      navigate('/experiencias', { replace: true })
    }
  }, [loading, session, isMember, navigate])

  if (loading) return <div className="route-loading" />

  return (
    <div className={styles.layout}>
      {/* ── Hero ── */}
      <div className={styles.hero}>
        <img src={heroBg} alt="Clube Bem Bolado" className={styles.heroImg} />
      </div>

      {/* ── Form ── */}
      <div className={styles.formSide}>
        <div className={styles.formInner}>
          <AuthCard />
        </div>
      </div>
    </div>
  )
}
