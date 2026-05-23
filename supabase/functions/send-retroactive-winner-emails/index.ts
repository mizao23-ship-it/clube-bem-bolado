import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Busca todos os ganhadores com dados do usuário, sorteio e experiência
    const { data: winners, error } = await supabase
      .from('sorteio_winners')
      .select(`
        id,
        resultado_at,
        users ( nome, email ),
        sorteios ( premio, draw_date, experiences ( name ) )
      `)

    if (error) throw new Error(`Erro ao buscar ganhadores: ${error.message}`)

    const results: { id: string; email: string; status: string }[] = []

    for (const w of winners ?? []) {
      const user  = w.users as { nome: string; email: string } | null
      const s     = w.sorteios as { premio: string; draw_date: string | null; experiences: { name: string } | null } | null

      if (!user?.email || !s?.premio) {
        results.push({ id: w.id, email: user?.email ?? '?', status: 'skipped (dados incompletos)' })
        continue
      }

      const experienceName = s.experiences?.name ?? 'Experiência Clube Bem Bolado'
      const drawDate       = s.draw_date ?? w.resultado_at ?? ''

      try {
        const html = winnerEmail(user.nome ?? '', s.premio, experienceName, drawDate)
        await sendEmail(user.email, `🏆 Você ganhou! — ${experienceName}`, html)
        results.push({ id: w.id, email: user.email, status: 'enviado' })
        console.log('[retroativo] enviado para:', user.email)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        results.push({ id: w.id, email: user.email, status: `erro: ${msg}` })
        console.error('[retroativo] erro ao enviar para:', user.email, msg)
      }
    }

    const enviados = results.filter(r => r.status === 'enviado').length
    console.log(`[retroativo] concluído: ${enviados}/${results.length} emails enviados`)

    return new Response(JSON.stringify({ ok: true, total: results.length, enviados, results }), {
      headers: { ...CORS, 'Content-Type': 'application/json' }, status: 200,
    })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    console.error('[retroativo] erro:', msg)
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...CORS, 'Content-Type': 'application/json' }, status: 500,
    })
  }
})
