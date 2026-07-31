export type Role = "super_admin" | "admin" | "jugador"

export interface Profile {
  id: string
  name: string
  nickname: string | null
  phone: string | null
  avatar_url: string | null
  position: string | null
  is_active: boolean
  created_at: string
}

export interface ProfileWithRoles extends Profile {
  roles: Role[]
}

export type MatchStatus = "scheduled" | "played" | "cancelled"

export interface Match {
  id: string
  date: string
  time: string
  location: string | null
  duration_minutes: number
  cost: number
  status: MatchStatus
  notes: string | null
  home_score: number | null
  away_score: number | null
  created_by: string | null
  created_at: string
}

export type AttendanceStatus = "confirmed" | "pending" | "declined" | "no_show"

export interface Attendance {
  id: string
  match_id: string
  profile_id: string
  status: AttendanceStatus
  fined: boolean
  created_at: string
}

export interface AttendanceWithProfile extends Attendance {
  profiles: Profile
}

export interface Goal {
  id: string
  match_id: string
  scorer_id: string
  assist_id: string | null
  created_at: string
}

export interface GoalWithProfiles extends Goal {
  scorer: Profile
  assist: Profile | null
}

export type PaymentStatus = "pending" | "approved" | "rejected"

export interface Payment {
  id: string
  match_id: string
  profile_id: string
  amount: number
  status: PaymentStatus
  receipt_url: string | null
  approved_by: string | null
  approved_at: string | null
  notes: string | null
  created_at: string
}

export interface PaymentWithProfile extends Payment {
  profiles: Profile
}

export interface Photo {
  id: string
  match_id: string
  profile_id: string
  url: string
  caption: string | null
  created_at: string
}

export interface PhotoWithProfile extends Photo {
  profiles: Profile
}

export interface MvpVote {
  id: string
  match_id: string
  voter_id: string
  voted_id: string
  created_at: string
}

export interface Fine {
  id: string
  match_id: string
  profile_id: string
  amount: number
  reason: string | null
  paid: boolean
  created_at: string
}

export interface FineWithProfile extends Fine {
  profiles: Profile
}

export interface Expense {
  id: string
  match_id: string
  description: string
  amount: number
  paid_by: string | null
  created_at: string
}

export type EncuentroTeam = "home" | "away"

export interface EncuentroPlayer {
  id: string
  encuentro_id: string
  profile_id: string
  team: EncuentroTeam
  goals: number
  created_at: string
  profile?: Profile | null
}

export interface Encuentro {
  id: string
  match_id: string
  index: number
  team_home_goals: number
  team_away_goals: number
  created_at: string
}

export interface EncuentroWithPlayers extends Encuentro {
  players: EncuentroPlayer[]
}

export interface TeamConfig {
  id: string
  team_name: string
  team_siglas: string
  default_cost: number
  default_time: string
  default_location: string | null
  default_duration_minutes: number
  default_day_of_week: number
  fine_percentage: number
  mvp_points_first: number
  mvp_points_second: number
  mvp_vote_deadline_hours: number
  created_at: string
  updated_at: string
}

export interface Season {
  id: string
  name: string
  start_date: string
  end_date: string | null
  is_active: boolean
  created_at: string
}

export interface MatchWithDetails extends Match {
  attendance: AttendanceWithProfile[]
  goals: GoalWithProfiles[]
  payments: PaymentWithProfile[]
  photos: PhotoWithProfile[]
  expenses: Expense[]
  mvp?: Profile | null
}
