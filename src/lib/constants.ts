export const TEAM_NAME = "Fútbol Sin Nivel"
export const TEAM_SIGLAS = "FSN"

export const DEFAULT_COST = 180_000
export const DEFAULT_TIME = "20:00"
export const DEFAULT_DURATION_MINUTES = 60
export const DEFAULT_DAY_OF_WEEK = 1 // Monday

export const FINE_PERCENTAGE = 1.0 // 100% of the day's share

export const POSITIONS = [
  "Arquero",
  "Defensor",
  "Mediocampista",
  "Delantero",
  "Libero",
  "Volante",
  "Extremo",
] as const

export const ROLES = [
  { value: "super_admin" as const, label: "Super Admin" },
  { value: "admin" as const, label: "Admin" },
  { value: "jugador" as const, label: "Jugador" },
]

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
  { href: "/matches", label: "Partidos", icon: "CalendarDays" },
  { href: "/players", label: "Jugadores", icon: "Users" },
  { href: "/payments", label: "Pagos", icon: "DollarSign" },
  { href: "/stats", label: "Estadísticas", icon: "BarChart3" },
  { href: "/mvp", label: "MVP", icon: "Trophy" },
  { href: "/photos", label: "Fotos", icon: "Image" },
]
