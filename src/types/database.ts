export type UserStatus = 'ativo' | 'inativo'
export type SorteioStatus = 'ativo' | 'encerrado'
export type GanhadorStatus = 'pendente' | 'notificado' | 'confirmado' | 'expirado' | 'recusado'
export type AuditAcao =
  | 'sorteio_executado' | 'ganhador_notificado' | 'ganhador_confirmou'
  | 'ganhador_recusou'  | 'prazo_expirado'      | 'sorteio_anulado'
export type SorteioElegivel = 'todos' | 'indicou' | 'manual'
export type ExperienceCategory =
  | 'shows'
  | 'cultura'
  | 'tecnologia'
  | 'carreira'
  | 'esportes'
  | 'arte'
  | 'negocios'
  | 'lifestyle'
  | 'viagem'
  | 'bem_estar'
export type ParceiroCategoria =
  | 'alimentacao'
  | 'educacao'
  | 'saude'
  | 'lazer'
  | 'moda'
export type TeamRole = 'admin' | 'operador'

export interface DbUser {
  id: string
  auth_id: string | null
  nome: string
  email: string
  telefone: string | null
  ref_code: string
  referred_by: string | null
  indicados: number
  referral_used: boolean
  created_by_admin: boolean
  status: UserStatus
  nv_user_id: string | null
  nv_synced_at: string | null
  coupon_seen_at: string | null
  coupon_redeemed_at: string | null
  created_at: string
}

export interface DbExperience {
  id: string
  name: string
  category: ExperienceCategory
  description: string | null
  termo_adesao: string | null
  img_url: string | null
  active: boolean
  start_date: string | null
  end_date: string | null
  limit_participants: number | null
  oculto_em: string | null
  participations_count: number
  super_destaque: boolean
  created_at: string
}

export interface DbParticipation {
  id: string
  user_id: string
  experience_id: string
  registered_at: string
  aceito_termo_em: string | null
}

export interface DbSorteio {
  id: number
  premio: string
  descricao: string | null
  encerramento: string | null
  draw_date: string | null
  status: SorteioStatus
  elegivel: SorteioElegivel
  n_ganhadores: number
  ganhador_id: string | null
  experience_id: string | null
  created_at: string
}

export interface DbSorteioWinner {
  id: string
  sorteio_id: number
  user_id: string
  resultado_at: string
  seen_at: string | null
}

export interface DbSorteioGanhador {
  id: string
  sorteio_id: number
  user_id: string
  posicao: number
  status: GanhadorStatus
  notificado_em: string | null
  confirmado_em: string | null
  expirado_em: string | null
  seen_at: string | null
}

export interface DbSorteioAuditLog {
  id: string
  sorteio_id: number | null
  ganhador_id: string | null
  user_id: string | null
  acao: AuditAcao
  executado_por: string | null
  metadata: Record<string, unknown> | null
  criado_em: string
}

export interface DbParceiro {
  id: number
  nome: string
  categoria: ParceiroCategoria
  emoji: string | null
  desconto: string | null
  descricao: string | null
  autologin_url: string | null
  active: boolean
}

export interface DbTeamMember {
  id: string
  auth_id: string | null
  nome: string
  email: string
  role: TeamRole
  active: boolean
  last_seen: string | null
  must_change_password: boolean
  created_at: string
}
