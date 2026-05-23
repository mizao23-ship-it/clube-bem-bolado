import { useState } from 'react'
import type { DbParceiro } from '@/types/database'
import styles from './PartnerCard.module.css'

interface Props {
  parceiro: DbParceiro
  /** Chamado quando o parceiro usa autologin New Value.
   *  Deve chamar a Edge Function e retornar a URL. */
  onNewValueAccess?: () => Promise<string | null>
}

export default function PartnerCard({ parceiro, onNewValueAccess }: Props) {
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  async function handleAccess() {
    setErrorMsg('')

    // Parceiro New Value: gera autologin dinâmico
    if (onNewValueAccess) {
      setLoading(true)
      const url = await onNewValueAccess()
      setLoading(false)
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer')
      } else {
        setErrorMsg('Não foi possível gerar o link. Tente novamente.')
      }
      return
    }

    // Parceiro com URL estática
    if (parceiro.autologin_url) {
      window.open(parceiro.autologin_url, '_blank', 'noopener,noreferrer')
    }
  }

  const hasAccess = !!onNewValueAccess || !!parceiro.autologin_url

  return (
    <div className={styles.card}>
      <div className={styles.emoji}>{parceiro.emoji ?? '🏷️'}</div>
      <div className={styles.nome}>{parceiro.nome}</div>
      <div className={styles.desconto}>{parceiro.desconto}</div>
      {parceiro.descricao && (
        <div className={styles.desc}>{parceiro.descricao}</div>
      )}
      {errorMsg && <div className={styles.error}>{errorMsg}</div>}
      {hasAccess ? (
        <button
          className={styles.btn}
          onClick={handleAccess}
          disabled={loading}
        >
          {loading ? (
            <span className="spinner" style={{ width: 12, height: 12, borderTopColor: 'var(--purple)' }} />
          ) : (
            'Ativar benefício →'
          )}
        </button>
      ) : (
        <div className={styles.hint}>Apresente sua carteirinha</div>
      )}
    </div>
  )
}
