import { useState } from 'react'
import RegisterForm from './RegisterForm'
import LoginForm from './LoginForm'
import styles from './AuthCard.module.css'

export default function AuthCard() {
  const hasRef = new URLSearchParams(window.location.search).has('ref')
  const [mode, setMode] = useState<'register' | 'login'>(hasRef ? 'register' : 'login')

  return (
    <div className={styles.card}>
      <div
        className={styles.formWrap}
        key={mode}
        style={{ animation: 'authFadeIn 200ms ease' }}
      >
        {mode === 'register' ? (
          <RegisterForm onSwitch={() => setMode('login')} />
        ) : (
          <LoginForm onSwitch={() => setMode('register')} />
        )}
      </div>
    </div>
  )
}
