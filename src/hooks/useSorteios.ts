import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { DbSorteio } from '@/types/database'

/**
 * Hook para gerenciar sorteios no backoffice.
 * Realtime: atualiza automaticamente quando um sorteio é
 * criado, editado ou encerrado.
 */
export function useSorteios() {
  const [sorteios, setSorteios] = useState<DbSorteio[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('sorteios')
      .select('*')
      .order('created_at', { ascending: false })
    setSorteios(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()

    const channel = supabase
      .channel('admin:sorteios')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sorteios' },
        payload => setSorteios(prev => [payload.new as DbSorteio, ...prev]),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sorteios' },
        payload => setSorteios(prev =>
          prev.map(s => s.id === (payload.new as DbSorteio).id ? payload.new as DbSorteio : s)
        ),
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [load])

  const ativos = sorteios.filter(s => s.status === 'ativo')
  const encerrados = sorteios.filter(s => s.status === 'encerrado')

  return { sorteios, ativos, encerrados, loading, reload: load }
}
