import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { logMemberAuth, logAdminAuth } from '@/lib/auditLog'
import type { DbUser, DbTeamMember } from '@/types/database'

interface AuthContextValue {
  session: Session | null
  user: User | null
  /** Perfil da tabela public.users (membros) */
  profile: DbUser | null
  /** Perfil da tabela public.team_members (admins/operadores) */
  teamMember: DbTeamMember | null
  loading: boolean
  isMember: boolean
  isAdmin: boolean
  signOut: () => Promise<void>
  refreshProfile: (uid?: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<DbUser | null>(null)
  const [teamMember, setTeamMember] = useState<DbTeamMember | null>(null)
  const [loading, setLoading] = useState(true)
  const profilesLoaded = useRef(false)

  async function fetchProfile(uid: string) {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('auth_id', uid)
      .maybeSingle()
    setProfile(data ?? null)

    // Auto-sync na New Value se o usuário ainda não foi registrado lá
    if (data && !data.nv_user_id) {
      supabase.functions
        .invoke('sync-newvalue', {
          body: {
            nome:     data.nome,
            email:    data.email,
            telefone: data.telefone ?? null,
            user_id:  data.id,
            ref_code: data.ref_code,
          },
        })
        .then(({ error }) => {
          if (error) console.warn('[sync-newvalue login]', error.message)
        })
    }
  }

  async function fetchTeamMember(_uid: string) {
    // Usa SECURITY DEFINER para bypassa RLS em team_members
    const { data } = await supabase.rpc('get_my_team_profile')
    setTeamMember(data ?? null)

    // Atualiza last_seen
    if (data) {
      await supabase
        .from('team_members')
        .update({ last_seen: new Date().toISOString() })
        .eq('id', data.id)
    }
  }

  async function loadProfiles(uid: string) {
    await Promise.all([fetchProfile(uid), fetchTeamMember(uid)])
    profilesLoaded.current = true
    setLoading(false)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        loadProfiles(session.user.id)
      } else {
        setLoading(false)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        // Só mostra spinner no login inicial — não em renovações de token (troca de aba)
        if (!profilesLoaded.current) setLoading(true)
        loadProfiles(session.user.id)
      } else {
        profilesLoaded.current = false
        setProfile(null)
        setTeamMember(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function refreshProfile(uid?: string) {
    const id = uid ?? user?.id
    if (id) await fetchProfile(id)
  }

  async function signOut() {
    // ── Audit: logout — loga antes de destruir a sessão ──
    if (teamMember) {
      logAdminAuth('admin_logout', { ua: navigator.userAgent })
    } else if (profile) {
      logMemberAuth('logout', { ua: navigator.userAgent })
    }
    await supabase.auth.signOut()
  }

  const isMember = profile !== null
  const isAdmin = teamMember !== null

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        teamMember,
        loading,
        isMember,
        isAdmin,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
