import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { DbUser } from '@/types/database'

/**
 * Hook para o backoffice: carrega todos os usuários e
 * mantém sincronização via Realtime (INSERT/UPDATE/DELETE).
 */
export function useUsers() {
  const [users, setUsers] = useState<DbUser[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })
    setUsers(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()

    const channel = supabase
      .channel('admin:users')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'users' },
        payload => setUsers(prev => [payload.new as DbUser, ...prev]),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'users' },
        payload => setUsers(prev =>
          prev.map(u => u.id === (payload.new as DbUser).id ? payload.new as DbUser : u)
        ),
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'users' },
        payload => setUsers(prev => prev.filter(u => u.id !== (payload.old as DbUser).id)),
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [load])

  const totalAtivos = users.filter(u => u.status === 'ativo').length
  const totalIndicacoes = users.reduce((acc, u) => acc + u.indicados, 0)

  return { users, loading, reload: load, totalAtivos, totalIndicacoes }
}
