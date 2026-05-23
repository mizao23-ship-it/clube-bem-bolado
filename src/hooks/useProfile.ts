import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { DbUser } from '@/types/database'

/**
 * Retorna o perfil atualizado do membro logado.
 * Inclui Realtime para refletir mudanças de indicados, status etc.
 */
export function useProfile() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<DbUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setProfile(null); setLoading(false); return }

    supabase
      .from('users')
      .select('*')
      .eq('auth_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setProfile(data ?? null)
        setLoading(false)
      })

    const channel = supabase
      .channel(`profile:${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'users', filter: `auth_id=eq.${user.id}` },
        payload => setProfile(payload.new as DbUser),
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user])

  return { profile, loading }
}
