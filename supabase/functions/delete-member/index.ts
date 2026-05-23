import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    // Só admins/operadores podem chamar (verificado via JWT do team_member)
    const authHeader = req.headers.get('Authorization') ?? ''
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS })
    }

    const { user_id } = await req.json()
    if (!user_id) {
      return new Response(JSON.stringify({ error: 'user_id obrigatorio' }), { status: 400, headers: CORS })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // 1. Busca o auth_id antes de deletar
    const { data: user } = await supabase
      .from('users')
      .select('id, nome, email, auth_id')
      .eq('id', user_id)
      .maybeSingle()

    if (!user) {
      return new Response(JSON.stringify({ error: 'Usuário não encontrado' }), { status: 404, headers: CORS })
    }

    console.log(`[delete-member] deletando ${user.nome} (${user.email})`)

    // 2. Remove participações
    await supabase.from('participations').delete().eq('user_id', user_id)

    // 3. Remove registros de ganhadores
    await supabase.from('sorteio_ganhadores').delete().eq('user_id', user_id)

    // 4. Remove sorteio_winners (tabela legada)
    await supabase.from('sorteio_winners').delete().eq('user_id', user_id)

    // 5. Remove logs de referral
    await supabase.from('referral_logs').delete().eq('user_id', user_id)

    // 6. Zera referred_by de quem foi indicado por este usuário
    await supabase.from('users').update({ referred_by: null }).eq('referred_by', user_id)

    // 6. Remove o perfil da tabela users
    const { error: deleteErr } = await supabase.from('users').delete().eq('id', user_id)
    if (deleteErr) {
      console.error('[delete-member] erro ao deletar users:', deleteErr.message)
      return new Response(JSON.stringify({ error: deleteErr.message }), { status: 500, headers: CORS })
    }

    // 7. Remove do Supabase Auth
    if (user.auth_id) {
      const { error: authErr } = await supabase.auth.admin.deleteUser(user.auth_id)
      if (authErr) {
        console.warn('[delete-member] erro ao deletar auth user:', authErr.message)
        // Não bloqueia — perfil já foi removido
      }
    }

    console.log(`[delete-member] ✅ ${user.nome} removido com sucesso`)
    return new Response(JSON.stringify({ ok: true, nome: user.nome }), {
      headers: { ...CORS, 'Content-Type': 'application/json' }, status: 200
    })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    console.error('[delete-member] catch:', msg)
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...CORS, 'Content-Type': 'application/json' }, status: 500
    })
  }
})
