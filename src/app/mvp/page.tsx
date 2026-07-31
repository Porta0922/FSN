"use client"

import { useEffect, useState } from "react"
import Navbar from "@/components/Navbar"
import { createClient } from "@/lib/supabase/client"
import { formatDateShort } from "@/lib/utils"
import type { Match, Profile } from "@/types"
import { toast } from "sonner"

interface MatchWithMVP extends Match {
  mvp: { name: string; votes: number } | null
  canVote: boolean
  hasVoted: boolean
}

export default function MVPPage() {
  const [playedMatches, setPlayedMatches] = useState<MatchWithMVP[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [players, setPlayers] = useState<Profile[]>([])

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const { data: allPlayers } = await supabase
        .from("profiles")
        .select("*")
        .eq("is_active", true)
      if (allPlayers) setPlayers(allPlayers)
      const playerList = allPlayers || []

      const { data: matches } = await supabase
        .from("matches")
        .select("*")
        .eq("status", "played")
        .order("date", { ascending: false })

      if (!matches) { setLoading(false); return }

      const matchesWithMVP: MatchWithMVP[] = await Promise.all(
        matches.map(async (m) => {
          const { data: myVote } = await supabase
            .from("mvp_votes")
            .select("id")
            .eq("match_id", m.id)
            .eq("voter_id", user.id)

          const { data: votes } = await supabase
            .from("mvp_votes")
            .select("voted_id")
            .eq("match_id", m.id)

          let mvp = null
          if (votes && votes.length > 0) {
            const count: Record<string, number> = {}
            votes.forEach((v) => {
              count[v.voted_id] = (count[v.voted_id] || 0) + 1
            })
            const top = Object.entries(count).sort((a, b) => b[1] - a[1])[0]
            const topPlayer = playerList.find((p) => p.id === top?.[0])
            if (topPlayer) {
              mvp = { name: topPlayer.nickname || topPlayer.name, votes: top[1] }
            }
          }

          return {
            ...m,
            mvp,
            canVote: !myVote || myVote.length === 0,
            hasVoted: (myVote && myVote.length > 0) || false,
          }
        })
      )

      setPlayedMatches(matchesWithMVP)
      setLoading(false)
    }

    load()
  }, [])

  async function handleVote(matchId: string, votedId: string) {
    const supabase = createClient()
    const { error } = await supabase.from("mvp_votes").insert({
      match_id: matchId,
      voter_id: userId,
      voted_id: votedId,
    })

    if (error) {
      toast.error("No se pudo registrar el voto")
      return
    }

    toast.success("Voto registrado")
    setPlayedMatches((prev) =>
      prev.map((m) =>
        m.id === matchId ? { ...m, canVote: false, hasVoted: true } : m
      )
    )
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
        <h1 className="text-2xl font-bold text-gray-900 mb-6">🏆 MVP</h1>

        <div className="space-y-4">
          {playedMatches.map((match) => (
            <div key={match.id} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <p className="font-semibold text-gray-900">{formatDateShort(match.date)}</p>
                {match.mvp && (
                  <span className="text-sm text-yellow-600 font-medium">
                    🏆 {match.mvp.name} ({match.mvp.votes} voto{match.mvp.votes !== 1 ? "s" : ""})
                  </span>
                )}
              </div>

              {match.canVote && (
                <div>
                  <p className="text-sm text-gray-500 mb-2">Votá al MVP del partido:</p>
                  <div className="flex flex-wrap gap-2">
                    {players.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => handleVote(match.id, p.id)}
                        className="px-3 py-1.5 bg-gray-50 hover:bg-primary hover:text-white rounded-lg text-sm font-medium transition-colors border border-gray-200"
                      >
                        {p.nickname || p.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {match.hasVoted && !match.mvp && (
                <p className="text-sm text-gray-400">Votaste. Resultados cuando voten todos.</p>
              )}
            </div>
          ))}

          {playedMatches.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-2">🏆</p>
              <p>No hay partidos jugados todavía</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
