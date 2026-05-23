import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const body = await req.json()
    const { nome, email, role } = body

    if (!nome || !email || !role) {
      return new Response(JSON.stringify({ error: 'nome, email e role são obrigatórios.' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' }
      })
    }

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // 1. Verifica se já existe como team_member ativo
    const { data: existing } = await adminClient
      .from('team_members')
      .select('id, active')
      .eq('email', email.toLowerCase())
      .maybeSingle()

    if (existing?.active) {
      return new Response(JSON.stringify({ error: 'Este e-mail já está cadastrado na equipe.' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' }
      })
    }

    // Reativa se estava inativo
    if (existing && !existing.active) {
      await adminClient.from('team_members').update({ active: true, role }).eq('id', existing.id)
      return new Response(JSON.stringify({ ok: true, reativado: true }), {
        headers: { ...CORS, 'Content-Type': 'application/json' }
      })
    }

    // 2. Verifica se já existe no auth
    const { data: authList } = await adminClient.auth.admin.listUsers()
    const authUser = authList?.users?.find((u: { email?: string }) => u.email === email.toLowerCase())

    let userId: string
    let tempPassword: string | null = null

    if (authUser) {
      userId = authUser.id
    } else {
      // Gera senha temporária e cria usuário
      tempPassword = Math.random().toString(36).slice(-8) + 'A1!'
      const { data: userData, error: createError } = await adminClient.auth.admin.createUser({
        email: email.toLowerCase(),
        password: tempPassword,
        email_confirm: true,
        user_metadata: { nome },
      })
      if (createError) throw new Error(createError.message)
      userId = userData.user.id
    }

    // 3. Cria o registro na tabela team_members
    const { error: dbError } = await adminClient.from('team_members').insert({
      auth_id: userId,
      nome,
      email: email.toLowerCase(),
      role,
      active: true,
      must_change_password: true,
    })
    if (dbError) throw new Error(dbError.message)

    return new Response(JSON.stringify({ ok: true, tempPassword }), {
      headers: { ...CORS, 'Content-Type': 'application/json' }
    })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro interno.'
    console.error('[invite-team-member]', msg)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' }
    })
  }
})
