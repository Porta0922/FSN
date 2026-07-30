"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Navbar from "@/components/Navbar"
import { createClient } from "@/lib/supabase/client"
import type { Profile } from "@/types"
import { Shield, ShieldOff } from "lucide-react"
import { toast } from "sonner"

export default function PlayersPage() {
  const [players, setPlayers] = useState<Profile[]>([])
  const [adminIds, setAdminIds] = useState<Set<string>>(new Set())
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const { data: isAdminUser } = await supabase.rpc("is_admin", { user_id: user.id })
        setIsAdmin(!!isAdminUser)

        const { data: allRoles } = await supabase.from("roles").select("id, name")
        const adminRoleIds = allRoles?.filter((r) => ["admin", "super_admin"].includes(r.name)).map((r) => r.id) || []
        const { data: prs } = await supabase.from("profile_roles").select("profile_id").in("role_id", adminRoleIds)
        if (prs) setAdminIds(new Set(prs.map((pr) => pr.profile_id)))
      }

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("is_active", true)
        .order("name")

      if (data) setPlayers(data)
      setLoading(false)
    }

    load()
  }, [])

  async function toggleAdmin(playerId: string, makeAdmin: boolean) {
    const supabase = createClient()
    const { data: roleData } = await supabase
      .from("roles")
      .select("id")
      .eq("name", "admin")
      .single()

    if (!roleData) return

    if (makeAdmin) {
      await supabase.from("profile_roles").insert({ profile_id: playerId, role_id: roleData.id })
      setAdminIds((prev) => new Set(prev).add(playerId))
      toast.success("Jugador promovido a admin")
    } else {
      await supabase.from("profile_roles").delete().eq("profile_id", playerId).eq("role_id", roleData.id)
      setAdminIds((prev) => { const next = new Set(prev); next.delete(playerId); return next })
      toast.success("Admin revocado")
    }
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
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Jugadores</h1>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {players.map((player) => (
            <div key={player.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 relative">
              <Link href={`/players/${player.id}`}>
                <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-white font-bold text-lg mb-2">
                  {(player.nickname || player.name).charAt(0).toUpperCase()}
                </div>
                <p className="font-medium text-gray-900 text-sm truncate">
                  {player.nickname || player.name}
                </p>
                {player.position && (
                  <p className="text-xs text-gray-400">{player.position}</p>
                )}
              </Link>
              {isAdmin && (
                <button
                  onClick={() => toggleAdmin(player.id, !adminIds.has(player.id))}
                  className={`mt-2 w-full flex items-center justify-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                    adminIds.has(player.id)
                      ? "bg-primary/10 text-primary hover:bg-primary/20"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  {adminIds.has(player.id) ? <Shield size={12} /> : <ShieldOff size={12} />}
                  {adminIds.has(player.id) ? "Admin" : "Hacer admin"}
                </button>
              )}
            </div>
          ))}
        </div>

        {players.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p className="text-4xl mb-2">👥</p>
            <p>No hay jugadores registrados</p>
          </div>
        )}
      </main>
    </div>
  )
}
