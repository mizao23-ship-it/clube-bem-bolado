import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Token público RD Station — usado na API de conversões
// supabase secrets set RDSTATION_PUBLIC_TOKEN=3c55df75386f664b0aafc5725c893526
const RD_TOKEN = Deno.env.get('RDSTATION_PUBLIC_TOKEN') ?? ''

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  try {
    const { nome, email, telefone, faculdade, curso, semestre } = await req.json()
    console.log('[sync-rdstation] iniciando para:', email)

    if (!email) {
      return new Response(JSON.stringify({ error: 'email obrigatorio' }), {
        headers: { ...CORS, 'Content-Type': 'application/json' }, status: 400
      })
    }

    const partes = (nome ?? '').trim().split(' ')
    const primeiro = partes[0] ?? ''
    const ultimo   = partes.slice(1).join(' ') || primeiro

    // Formata telefone: remove formatação e adiciona DDI 55
    const phone = telefone
      ? '+55' + telefone.replace(/\D/g, '')
      : undefined

    // Payload para a API v3 do RD Station Marketing
    // Endpoint de conversão: registra evento + cria/atualiza lead
    const payload = {
      event_type: 'CONVERSION',
      event_family: 'CDP',
      payload: {
        conversion_identifier: 'Cadastro Clube Bem Bolado',
        name: nome?.trim() ?? '',
        email: email.trim().toLowerCase(),
        ...(phone ? { mobile_phone: phone } : {}),
        cf_faculdade_c: faculdade ?? '',
        cf_curso_c:     curso     ?? '',
        cf_semestre_c:  semestre  ?? '',
        tags: ['membro_clube_bem_bolado'],
      },
    }

    const response = await fetch(
      `https://api.rd.services/platform/conversions?api_key=${RD_TOKEN}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept':       'application/json',
        },
        body: JSON.stringify(payload),
      }
    )

    const text = await response.text()
    console.log('[sync-rdstation] status:', response.status)
    console.log('[sync-rdstation] response:', text)

    if (!response.ok) {
      console.error('[sync-rdstation] erro RD Station:', text)
      return new Response(JSON.stringify({ error: text }), {
        headers: { ...CORS, 'Content-Type': 'application/json' }, status: 400
      })
    }

    console.log('[sync-rdstation] lead criado com sucesso para:', email)
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...CORS, 'Content-Type': 'application/json' }, status: 200
    })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    console.error('[sync-rdstation] catch:', msg)
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...CORS, 'Content-Type': 'application/json' }, status: 500
    })
  }
})
