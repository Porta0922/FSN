"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Navbar from "@/components/Navbar"
import { createClient } from "@/lib/supabase/client"
import { TEAM_NAME, ROLES } from "@/lib/constants"
import { formatCurrency } from "@/lib/utils"
import type { Profile, TeamConfig } from "@/types"
import { toast } from "sonner"

export default function AdminPage() {
  const router = useRouter()
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [players, setPlayers] = useState<(Profile & { roles: string[] })[]>([])
  const [config, setConfig] = useState<TeamConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/login"); return }

      const { data: isAdminUser } = await supabase.rpc("is_admin", { user_id: user.id })
      if (!isAdminUser) {
        router.push("/dashboard")
        return
      }

      const { data: isSuperAdminUser } = await supabase.rpc("is_super_admin", { user_id: user.id })
      setIsSuperAdmin(!!isSuperAdminUser)

      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .order("name")

      const { data: allRoles } = await supabase.from("roles").select("id, name")

      if (profiles && allRoles) {
        const roleMap = Object.fromEntries(allRoles.map((r) => [r.id, r.name]))

        const { data: allProfileRoles } = await supabase
          .from("profile_roles")
          .select("profile_id, role_id")

        const withRoles = profiles.map((p) => {
          const userRoleIds = allProfileRoles
            ?.filter((pr) => pr.profile_id === p.id)
            .map((pr) => roleMap[pr.role_id])
            .filter(Boolean) || []
          return { ...p, roles: userRoleIds as string[] }
        })
        setPlayers(withRoles)
      }

      const { data: configData } = await supabase
        .from("team_config")
        .select("*")
        .limit(1)
        .single()

      if (configData) setConfig(configData)

      setLoading(false)
    }

    load()
  }, [router])

  async function handleRoleChange(profileId: string, role: string, add: boolean) {
    const supabase = createClient()
    const { data: roleData } = await supabase
      .from("roles")
      .select("id")
      .eq("name", role)
      .single()

    if (!roleData) return

    if (add) {
      await supabase.from("profile_roles").insert({ profile_id: profileId, role_id: roleData.id })
    } else {
      await supabase
        .from("profile_roles")
        .delete()
        .eq("profile_id", profileId)
        .eq("role_id", roleData.id)
    }

    setPlayers((prev) =>
      prev.map((p) =>
        p.id === profileId
          ? { ...p, roles: add ? [...p.roles, role] : p.roles.filter((r) => r !== role) }
          : p
      )
    )
  }

  async function handleGenerateMatches() {
    setGenerating(true)
    try {
      const res = await fetch("/api/cron/generate-matches")
      const data = await res.json()
      toast.success(`Se crearon ${data.created || 0} partidos`)
    } catch {
      toast.error("Error al generar partidos")
    }
    setGenerating(false)
  }

  async function handleUpdateConfig(field: string, value: any) {
    if (!config) return
    const supabase = createClient()
    await supabase.from("team_config").update({ [field]: value }).eq("id", config.id)
    setConfig((prev) => prev ? { ...prev, [field]: value } : null)
    toast.success("Configuración actualizada")
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Panel de Administración</h1>

        {/* Configuración del equipo */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Configuración del equipo</h2>

          {config && (
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-500 mb-1">Nombre del equipo</label>
                <input
                  defaultValue={config.team_name}
                  onBlur={(e) => handleUpdateConfig("team_name", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1">Siglas</label>
                <input
                  defaultValue={config.team_siglas}
                  onBlur={(e) => handleUpdateConfig("team_siglas", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1">Costo por hora (Gs.)</label>
                <input
                  type="number"
                  defaultValue={config.default_cost}
                  onBlur={(e) => handleUpdateConfig("default_cost", parseInt(e.target.value) || 180000)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1">Horario (HH:MM)</label>
                <input
                  defaultValue={config.default_time}
                  onBlur={(e) => handleUpdateConfig("default_time", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1">Ubicación</label>
                <input
                  defaultValue={config.default_location || ""}
                  onBlur={(e) => handleUpdateConfig("default_location", e.target.value || null)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1">Duración (minutos)</label>
                <input
                  type="number"
                  defaultValue={config.default_duration_minutes}
                  onBlur={(e) => handleUpdateConfig("default_duration_minutes", parseInt(e.target.value) || 60)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
            </div>
          )}
        </div>

        {/* Generar partidos */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 mb-6">
          <h2 className="font-semibold text-gray-900 mb-3">Generar partidos del mes</h2>
          <p className="text-sm text-gray-500 mb-3">
            Creá automáticamente todos los partidos del mes actual (solo los lunes).
          </p>
          <button
            onClick={handleGenerateMatches}
            disabled={generating}
            className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-light disabled:opacity-50"
          >
            {generating ? "Generando..." : "Generar partidos"}
          </button>
        </div>

        {/* Gestión de jugadores */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Jugadores y Roles</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {players.map((player) => (
              <div key={player.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{player.name}</p>
                  <p className="text-xs text-gray-400">
                    {player.position || "Sin posición"}
                    {player.phone && ` | ${player.phone}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {ROLES.map((role) => {
                    const hasRole = player.roles.includes(role.value)
                    const isDisabled = (role.value === "super_admin" && !isSuperAdmin) ||
                      (role.value === "admin" && !isSuperAdmin)
                    return (
                      <button
                        key={role.value}
                        onClick={() => handleRoleChange(player.id, role.value, !hasRole)}
                        disabled={isDisabled}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                          hasRole
                            ? "bg-primary text-white"
                            : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {role.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
