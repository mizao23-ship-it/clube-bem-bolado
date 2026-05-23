import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const RD_TOKEN = Deno.env.get('RDSTATION_PUBLIC_TOKEN') ?? ''

// Converte nome da experiência em slug para tag: "Show The Weeknd" → "ganhador_show_the_weeknd"
function slugify(text: string): string {
  return 'ganhador_' + text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // remove acentos
    .replace(/[^a-z0-9\s_]/g, '')      // remove caracteres especiais
    .trim()
    .replace(/\s+/g, '_')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  try {
    const { email, nome, premio, experience_name, draw_date } = await req.json()
    console.log('[winner-rdstation] ganhador:', email, '| experiência:', experience_name)

    if (!email || !experience_name) {
      return new Response(JSON.stringify({ error: 'email e experience_name obrigatorios' }), {
        headers: { ...CORS, 'Content-Type': 'application/json' }, status: 400,
      })
    }

    const partes = (nome ?? '').trim().split(' ')
    const primeiro = partes[0] ?? ''
    const ultimo   = partes.slice(1).join(' ') || primeiro
    const tag      = slugify(experience_name)

    const payload = {
      event_type:   'CONVERSION',
      event_family: 'CDP',
      payload: {
        conversion_identifier: `Ganhador - ${experience_name}`,
        name:  nome?.trim() ?? '',
        email: email.trim().toLowerCase(),
        tags:  ['ganhador_clube_bem_bolado', tag],
        cf_premio_clube_bem_bolado:      premio         ?? '',
        cf_experiencia_clube_bem_bolado: experience_name ?? '',
        cf_data_sorteio:        draw_date       ?? '',
      },
    }

    console.log('[winner-rdstation] enviando para RD Station, tag:', tag)

    const response = await fetch(
      `https://api.rd.services/platform/conversions?api_key=${RD_TOKEN}`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body:    JSON.stringify(payload),
      }
    )

    const text = await response.text()
    console.log('[winner-rdstation] status RD:', response.status, text)

    if (!response.ok) {
      return new Response(JSON.stringify({ error: text }), {
        headers: { ...CORS, 'Content-Type': 'application/json' }, status: 400,
      })
    }

    return new Response(JSON.stringify({ ok: true, tag }), {
      headers: { ...CORS, 'Content-Type': 'application/json' }, status: 200,
    })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    console.error('[winner-rdstation] catch:', msg)
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...CORS, 'Content-Type': 'application/json' }, status: 500,
    })
  }
})
