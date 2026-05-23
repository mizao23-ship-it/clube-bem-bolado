import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmail } from '../_shared/ses.ts'
import { resetPasswordEmail, confirmEmailTemplate } from '../_shared/email-templates.ts'

serve(async (req) => {
  try {
    const payload = await req.json()
    const { user, email_data } = payload

    const email      = user?.email ?? ''
    const type       = email_data?.email_action_type ?? ''
    const tokenHash  = email_data?.token_hash ?? ''
    const redirectTo = email_data?.redirect_to ?? 'https://clube-bem-bolado.vercel.app'
    // supabaseUrl é a URL do projeto Supabase — usamos para montar o link de verificação nativo
    const supabaseUrl = (email_data?.site_url ?? Deno.env.get('SUPABASE_URL') ?? '').replace(/\/$/, '')

    // Busca o nome do usuário
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('nome')
      .eq('id', user.id)
      .single()
    const nome = profile?.nome ?? email.split('@')[0]

    let subject = ''
    let html = ''

    const APP_URL      = 'https://clube-bem-bolado.vercel.app'
    const anonKey      = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    // SUPABASE_URL é o env var automático com a URL do projeto (https://xxx.supabase.co)
    const projectUrl   = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/$/, '')
    const verifyBase   = `${projectUrl}/auth/v1/verify`

    if (type === 'recovery') {
      const resetUrl = `${verifyBase}?token=${tokenHash}&type=recovery&redirect_to=${encodeURIComponent(`${APP_URL}/reset-password`)}&apikey=${anonKey}`
      subject = 'Redefinição de senha — Clube Bem Bolado'
      html = resetPasswordEmail(nome, resetUrl)

    } else if (type === 'signup' || type === 'email_change') {
      const dest = redirectTo || APP_URL
      const confirmUrl = `${verifyBase}?token=${tokenHash}&type=${type}&redirect_to=${encodeURIComponent(dest)}&apikey=${anonKey}`
      subject = type === 'signup'
        ? 'Confirme seu e-mail — Clube Bem Bolado'
        : 'Confirme seu novo e-mail — Clube Bem Bolado'
      html = confirmEmailTemplate(nome, confirmUrl)

    } else {
      console.log('[auth-email-hook] tipo desconhecido:', type, '— ignorando')
      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json' }, status: 200,
      })
    }

    console.log(`[auth-email-hook] tipo="${type}" para ${email}`)
    await sendEmail(email, subject, html)
    console.log(`[auth-email-hook] enviado com sucesso`)

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' }, status: 200,
    })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    console.error('[auth-email-hook] erro:', msg)
    return new Response(JSON.stringify({ error: msg }), {
      headers: { 'Content-Type': 'application/json' }, status: 200,
    })
  }
})
