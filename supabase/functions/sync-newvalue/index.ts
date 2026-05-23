import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const NV_BASE    = 'https://api-v2.newvalue.com.br'
const NV_HEADERS = (token: string) => ({
  'Content-Type':  'application/json',
  'Accept':        'application/json',
  'Authorization': `Bearer ${token}`,
})

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  try {
    const { nome, email, telefone, user_id, ref_code } = await req.json()
    console.log('[sync-newvalue] iniciando para:', email)

    const partes = (nome ?? '').trim().split(' ')
    const name      = partes[0]
    const last_name = partes.slice(1).join(' ') || partes[0]
    const phone     = telefone ? '55' + telefone.replace(/\D/g, '') : undefined
    const identification = ref_code ?? email
    const token = Deno.env.get('NV_TOKEN_RH')!

    // ── 1. Verificar se usuário já existe na NV (endpoint público, sem auth) ──
    const t0 = performance.now()
    const validateRes = await fetch(`${NV_BASE}/api/v2/public/_n/user/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ userEmail: email }),
    })
    const validateData = await validateRes.json()
    const t1 = performance.now()
    console.log(`[sync-newvalue] validate → ${validateRes.status} userExistis=${validateData.userExistis} em ${Math.round(t1 - t0)}ms`)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // ── 2a. Usuário já existe → busca ID direto ──
    if (validateData.userExistis) {
      const t2 = performance.now()
      const searchRes = await fetch(
        `${NV_BASE}/api/v2/key/users?email=${encodeURIComponent(email)}`,
        { headers: NV_HEADERS(token) },
      )
      const searchData = await searchRes.json()
      const t3 = performance.now()
      console.log(`[sync-newvalue] GET /users?email → ${searchRes.status} em ${Math.round(t3 - t2)}ms | total: ${Math.round(t3 - t0)}ms`)

      const existingId = searchData?.data?.[0]?.id
      if (existingId && user_id) {
        await supabase
          .from('users')
          .update({ nv_user_id: String(existingId), nv_synced_at: new Date().toISOString() })
          .eq('id', user_id)
        console.log('[sync-newvalue] usuário existente sincronizado:', existingId)
      }

      return new Response(JSON.stringify({ id: existingId, already_exists: true }), {
        headers: { ...CORS, 'Content-Type': 'application/json' }, status: 200,
      })
    }

    // ── 2b. Usuário novo → criar na NV ──
    const t2 = performance.now()
    const createRes = await fetch(`${NV_BASE}/api/v2/key/users`, {
      method: 'POST',
      headers: NV_HEADERS(token),
      body: JSON.stringify({ name, last_name, identification, email, active: true, phone, terms: true }),
    })
    const createData = await createRes.json()
    const t3 = performance.now()
    console.log(`[sync-newvalue] POST /users → ${createRes.status} em ${Math.round(t3 - t2)}ms | total: ${Math.round(t3 - t0)}ms`)

    if (!createRes.ok) {
      console.error('[sync-newvalue] erro ao criar usuário na NV:', createData)
      return new Response(JSON.stringify({ error: createData }), {
        headers: { ...CORS, 'Content-Type': 'application/json' }, status: 400,
      })
    }

    if (createData.id && user_id) {
      await supabase
        .from('users')
        .update({ nv_user_id: String(createData.id), nv_synced_at: new Date().toISOString() })
        .eq('id', user_id)
      console.log('[sync-newvalue] usuário criado na NV, id:', createData.id)
    }

    return new Response(JSON.stringify(createData), {
      headers: { ...CORS, 'Content-Type': 'application/json' }, status: 200,
    })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    console.error('[sync-newvalue] catch:', msg)
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...CORS, 'Content-Type': 'application/json' }, status: 500,
    })
  }
})
