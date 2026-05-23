import { supabase } from '@/lib/supabase'

/**
 * Registra uma ação administrativa no admin_audit_log.
 * Fire-and-forget — nunca lança exceção nem bloqueia a UX.
 */
export function logAdminAction(
  acao: string,
  opts?: {
    entidade?: string
    entidade_id?: string
    descricao?: string
    metadata?: Record<string, unknown>
  }
) {
  supabase.rpc('log_admin_action', {
    p_acao:        acao,
    p_entidade:    opts?.entidade    ?? null,
    p_entidade_id: opts?.entidade_id ?? null,
    p_descricao:   opts?.descricao   ?? null,
    p_metadata:    opts?.metadata    ?? null,
  }).then(undefined, () => {})
}
