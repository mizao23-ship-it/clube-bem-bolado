import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { DbUser } from '@/types/database'

/**
 * Hook para a página de indicações do backoffice.
 * Retorna o ranking de top referrers.
 * Realtime: atualiza quando o campo indicados muda em qualquer usuário.
 */
export function useIndicacoes() {
  const [topReferrers, setTopReferrers] = useState<DbUser[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('users')
      .select('*')
      .gt('indicados', 0)
      .order('indicados', { ascending: false })
      .limit(20)
    setTopReferrers(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()

    const channel = supabase
      .channel('admin:indicacoes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'users' },
        () => {
          // Recarrega ranking quando qualquer usuário tiver indicados atualizado
          load()
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const totalIndicacoes = topReferrers.reduce((acc, u) => acc + u.indicados, 0)
  const media = topReferrers.length > 0
    ? (totalIndicacoes / topReferrers.length).toFixed(1)
    : '0'

  return { topReferrers, totalIndicacoes, media, loading, reload: load }
}
