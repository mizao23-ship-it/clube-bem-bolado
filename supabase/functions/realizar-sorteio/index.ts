import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmail } from '../_shared/ses.ts'
import { winnerEmail } from '../_shared/email-templates.ts'

// Edge function que executa o sorteio server-side e envia emails num único call.
// Aceita: { sorteio_id: number, executado_por: string | null }
// Retorna: { ganhadores, total_inscritos, hash_lista, hash_resultado, emails_enviados }

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { sorteio_id, executado_por } = await req.json()

    if (!sorteio_id) {
      return new Response(JSON.stringify({ error: 'sorteio_id é obrigatório' }), {
        headers: { ...CORS, 'Content-Type': 'application/json' }, status: 400,
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // 1. Executa o sorteio via RPC
    console.log('[realizar-sorteio] executando sorteio_id:', sorteio_id)
    const { data, error } = await supabase.rpc('executar_sorteio', {
      p_sorteio_id:    sorteio_id,
      p_executado_por: executado_por ?? null,
    })

    if (error) throw new Error(`Erro no sorteio: ${error.message}`)
    if (data?.error) throw new Error(data.error)

    console.log('[realizar-sorteio] resultado:', JSON.stringify(data))

    const ganhadoresIds: string[] = data.ganhadores ?? []

    // 2. Busca dados dos ganhadores + sorteio + experiência para email
    let emailsEnviados: string[] = []

    if (ganhadoresIds.length > 0) {
      const { data: sorteioData } = await supabase
        .from('sorteios')
        .select('premio, draw_date, experiences ( name )')
        .eq('id', sorteio_id)
        .single()

      const experienceName = (sorteioData?.experiences as { name: string } | null)?.name ?? 'Experiência Clube Bem Bolado'
      const drawDate = sorteioData?.draw_date ?? new Date().toISOString().split('T')[0]

      const { data: users } = await supabase
        .from('users')
        .select('id, nome, email')
        .in('id', ganhadoresIds)

      for (const user of users ?? []) {
        if (!user.email) continue
        try {
          const html = winnerEmail(user.nome ?? '', sorteioData?.premio ?? '', experienceName, drawDate)
          await sendEmail(user.email, `🏆 Você ganhou! — ${experienceName}`, html)
          emailsEnviados.push(user.email)
          console.log('[realizar-sorteio] email enviado para:', user.email)
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          console.error('[realizar-sorteio] erro ao enviar email para:', user.email, msg)
        }
      }
    }

    return new Response(JSON.stringify({
      ganhadores:      ganhadoresIds,
      total_inscritos: data.total_inscritos,
      hash_lista:      data.hash_lista,
      hash_resultado:  data.hash_resultado,
      emails_enviados: emailsEnviados,
    }), {
      headers: { ...CORS, 'Content-Type': 'application/json' }, status: 200,
    })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    console.error('[realizar-sorteio] erro:', msg)
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...CORS, 'Content-Type': 'application/json' }, status: 500,
    })
  }
})
