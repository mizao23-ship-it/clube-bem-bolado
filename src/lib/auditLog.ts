import { supabase } from '@/lib/supabase'

// ── Coleta IP e User-Agent do cliente ────────────────────────────────
// Fire-and-forget: nunca lança exceção, timeout de 2s

export async function getClientInfo(): Promise<{ ip: string | null; ua: string }> {
  const ua = navigator.userAgent
  let ip: string | null = null
  try {
    const res = await fetch('https://api.ipify.org?format=json', {
      signal: AbortSignal.timeout(2000),
    })
    const data = await res.json()
    ip = data.ip ?? null
  } catch {
    // silencioso — IP é best-effort
  }
  return { ip, ua }
}

// ── Log de auth de membro (autenticado) ──────────────────────────────
export function logMemberAuth(
  evento: 'login' | 'logout' | 'cadastro' | 'senha_redefinida',
  opts?: { ip?: string | null; ua?: string; metadata?: Record<string, unknown> }
) {
  supabase.rpc('log_member_auth', {
    p_evento:   evento,
    p_ip:       opts?.ip   ?? null,
    p_ua:       opts?.ua   ?? null,
    p_metadata: opts?.metadata ?? null,
  }).then(undefined, () => {})
}

// ── Log de auth público (sem sessão: falha de login, link click) ──────
export function logAuthEventPublic(
  evento: 'login_falhou' | 'admin_login_falhou' | 'link_click',
  opts?: { email?: string; ip?: string | null; ua?: string }
) {
  supabase.rpc('log_auth_event_public', {
    p_evento: evento,
    p_email:  opts?.email ?? null,
    p_ip:     opts?.ip    ?? null,
    p_ua:     opts?.ua    ?? null,
  }).then(undefined, () => {})
}

// ── Log de auth de admin (autenticado) ───────────────────────────────
export function logAdminAuth(
  evento: 'admin_login' | 'admin_logout',
  opts?: { ip?: string | null; ua?: string }
) {
  supabase.rpc('log_admin_auth', {
    p_evento: evento,
    p_ip:     opts?.ip ?? null,
    p_ua:     opts?.ua ?? null,
  }).then(undefined, () => {})
}

// ── Log de alteração de perfil de membro ─────────────────────────────
export function logMemberProfileChange(
  antes: Record<string, unknown>,
  depois: Record<string, unknown>,
  opts?: { ip?: string | null; ua?: string }
) {
  supabase.rpc('log_member_profile_change', {
    p_antes:  antes,
    p_depois: depois,
    p_ip:     opts?.ip ?? null,
    p_ua:     opts?.ua ?? null,
  }).then(undefined, () => {})
}

// ── Log de clique em link de indicação ───────────────────────────────
export function logLinkClick(
  referralCode: string,
  opts?: { ip?: string | null; ua?: string }
) {
  supabase.rpc('log_link_click', {
    p_referral_code: referralCode,
    p_ip:            opts?.ip ?? null,
    p_ua:            opts?.ua ?? null,
  }).then(undefined, () => {})
}
