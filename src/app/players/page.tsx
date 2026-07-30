"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Navbar from "@/components/Navbar"
import { createClient } from "@/lib/supabase/client"
import type { Profile } from "@/types"

export default function PlayersPage() {
  const [players, setPlayers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
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
            <Link
              key={player.id}
              href={`/players/${player.id}`}
              className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
            >
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
