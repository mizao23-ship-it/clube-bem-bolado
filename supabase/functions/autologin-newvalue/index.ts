import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  try {
    const { email } = await req.json()
    console.log('[autologin-newvalue] email:', email)

    const response = await fetch(
      `https://api-v2.newvalue.com.br/wp-json/api/whitelabel/auth_login?email=${encodeURIComponent(email)}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('NV_TOKEN_RH')}`
        }
      }
    )

    const data = await response.json()
    console.log('[autologin-newvalue] NV response status:', response.status)
    console.log('[autologin-newvalue] NV response data:', JSON.stringify(data))

    if (!response.ok || !data.token) {
      return new Response(JSON.stringify({ error: data?.message ?? 'Erro na New Value', nv_status: response.status, nv_data: data }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
        status: 400
      })
    }

    const url = `https://www.newvalue.com.br/token_login/?uuid=${Deno.env.get('NV_UUID_RH')}&token=${data.token}`
    console.log('[autologin-newvalue] url gerada:', url)

    return new Response(JSON.stringify({ url }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
      status: 200
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    console.error('[autologin-newvalue] catch:', msg)
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})
