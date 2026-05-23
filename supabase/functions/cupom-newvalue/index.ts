import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const NV_BASE     = 'https://api-v2.newvalue.com.br/api/v2/key'
const NV_WP_BASE  = 'https://api-v2.newvalue.com.br/wp-json/api/whitelabel'

async function authLogin(email: string, nvToken: string): Promise<string | null> {
  const res = await fetch(
    `${NV_WP_BASE}/auth_login?email=${encodeURIComponent(email)}`,
    { method: 'POST', headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${nvToken}` } }
  )
  const data = await res.json()
  return data?.token ?? null
}

async function registerUser(email: string, nome: string, nvToken: string): Promise<boolean> {
  const partes    = (nome ?? '').trim().split(' ')
  const name      = partes[0]
  const last_name = partes.slice(1).join(' ') || partes[0]

  const res = await fetch(`${NV_BASE}/users`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Accept':        'application/json',
      'Authorization': `Bearer ${nvToken}`,
    },
    body: JSON.stringify({ name, last_name, email, identification: email, active: true, terms: true }),
  })
  // Considera sucesso tanto no 201 (criado) quanto no caso de já existir (o login vai funcionar)
  return res.status < 500
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { offer_id, email, nome } = await req.json()
    if (!offer_id || !email) {
      return new Response(JSON.stringify({ error: 'offer_id e email são obrigatórios' }), {
        headers: { ...CORS, 'Content-Type': 'application/json' }, status: 400,
      })
    }

    const NV_TOKEN = Deno.env.get('NV_TOKEN_RH') ?? ''
    const NV_UUID  = Deno.env.get('NV_UUID_RH')  ?? ''

    // 1. Obter token do usuário via auth_login
    let userToken = await authLogin(email, NV_TOKEN)

    // 2. Fallback: se auth_login falhou, registra o usuário na NV e tenta de novo
    if (!userToken) {
      console.log(`[cupom-newvalue] usuário não encontrado na NV, registrando: ${email}`)
      await registerUser(email, nome ?? email, NV_TOKEN)
      userToken = await authLogin(email, NV_TOKEN)
    }

    if (!userToken) {
      return new Response(JSON.stringify({ error: 'Falha ao autenticar usuário na New Value' }), {
        headers: { ...CORS, 'Content-Type': 'application/json' }, status: 400,
      })
    }

    // 3. Gerar cupom com token do usuário
    const couponRes = await fetch(`${NV_BASE}/offer_coupons/coupon`, {
      method: 'POST',
      headers: {
        'Accept':        'application/json',
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${userToken}`,
        'X-UUID':        NV_UUID,
      },
      body: JSON.stringify({ offer_id }),
    })
    const couponData = await couponRes.json()
    if (!couponRes.ok || !couponData.data?.coupon) {
      return new Response(JSON.stringify({ error: 'Não foi possível gerar o cupom', detail: couponData }), {
        headers: { ...CORS, 'Content-Type': 'application/json' }, status: 400,
      })
    }

    return new Response(JSON.stringify({
      coupon_code: couponData.data.coupon,
      expires_at:  couponData.data.expires_at,
      is_new:      couponData.data.is_new,
    }), {
      headers: { ...CORS, 'Content-Type': 'application/json' }, status: 200,
    })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...CORS, 'Content-Type': 'application/json' }, status: 500,
    })
  }
})
