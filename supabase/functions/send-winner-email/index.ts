import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { sendEmail } from '../_shared/ses.ts'
import { winnerEmail } from '../_shared/email-templates.ts'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { email, nome, premio, experience_name, draw_date } = await req.json()

    if (!email || !premio || !experience_name) {
      return new Response(JSON.stringify({ error: 'email, premio e experience_name são obrigatórios' }), {
        headers: { ...CORS, 'Content-Type': 'application/json' }, status: 400,
      })
    }

    console.log('[send-winner-email] enviando para:', email, '| prêmio:', premio)
    const html = winnerEmail(nome ?? '', premio, experience_name, draw_date ?? '')
    await sendEmail(email, `🏆 Você ganhou! — ${experience_name}`, html)
    console.log('[send-winner-email] enviado com sucesso para:', email)

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...CORS, 'Content-Type': 'application/json' }, status: 200,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    console.error('[send-winner-email] erro:', msg)
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...CORS, 'Content-Type': 'application/json' }, status: 500,
    })
  }
})
