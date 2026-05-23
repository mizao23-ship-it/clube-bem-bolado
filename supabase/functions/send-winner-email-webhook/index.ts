import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmail } from '../_shared/ses.ts'
import { winnerEmail } from '../_shared/email-templates.ts'

// Supabase Database Webhook — fires on INSERT to sorteio_winners
// Payload: { type, table, schema, record: { id, sorteio_id, user_id, resultado_at }, old_record }

serve(async (req) => {
  // Optional shared secret verification (set x-webhook-secret header in Supabase webhook config)
  const WEBHOOK_SECRET = Deno.env.get('WINNER_WEBHOOK_SECRET')
  if (WEBHOOK_SECRET) {
    const incoming = req.headers.get('x-webhook-secret')
    if (incoming !== WEBHOOK_SECRET) {
      console.error('[winner-webhook] segredo inválido')
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }
  }

  let payload: {
    type: string
    table: string
    record: { id: string; sorteio_id: string; user_id: string; resultado_at: string | null }
  }

  try {
    payload = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 })
  }

  // Only handle INSERT events on sorteio_winners
  if (payload.type !== 'INSERT' || payload.table !== 'sorteio_winners') {
    console.log('[winner-webhook] ignorando evento:', payload.type, payload.table)
    return new Response(JSON.stringify({ ok: true, skipped: true }), { status: 200 })
  }

  const { sorteio_id, user_id, resultado_at } = payload.record
  console.log('[winner-webhook] novo ganhador — sorteio_id:', sorteio_id, 'user_id:', user_id)

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Fetch user email + nome
    const { data: user, error: userErr } = await supabase
      .from('users')
      .select('nome, email')
      .eq('id', user_id)
      .single()

    if (userErr || !user) {
      console.error('[winner-webhook] usuário não encontrado:', userErr?.message)
      return new Response(JSON.stringify({ error: 'Usuário não encontrado' }), { status: 404 })
    }

    // Fetch sorteio + experience
    const { data: sorteio, error: sorteioErr } = await supabase
      .from('sorteios')
      .select('premio, draw_date, experiences ( name )')
      .eq('id', sorteio_id)
      .single()

    if (sorteioErr || !sorteio) {
      console.error('[winner-webhook] sorteio não encontrado:', sorteioErr?.message)
      return new Response(JSON.stringify({ error: 'Sorteio não encontrado' }), { status: 404 })
    }

    const exp = sorteio.experiences as { name: string } | null
    const experienceName = exp?.name ?? 'Experiência Clube Bem Bolado'
    const drawDate = sorteio.draw_date ?? resultado_at ?? ''

    console.log('[winner-webhook] enviando email para:', user.email, '| prêmio:', sorteio.premio)
    const html = winnerEmail(user.nome ?? '', sorteio.premio, experienceName, drawDate)
    await sendEmail(user.email, `🏆 Você ganhou! — ${experienceName}`, html)
    console.log('[winner-webhook] email enviado com sucesso para:', user.email)

    return new Response(JSON.stringify({ ok: true, email: user.email }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    console.error('[winner-webhook] erro:', msg)
    return new Response(JSON.stringify({ error: msg }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
