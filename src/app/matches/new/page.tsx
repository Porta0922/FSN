"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Navbar from "@/components/Navbar"
import { createClient } from "@/lib/supabase/client"
import { DEFAULT_COST, DEFAULT_TIME } from "@/lib/constants"
import { toast } from "sonner"

export default function NewMatchPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    date: "",
    time: DEFAULT_TIME,
    location: "",
    duration_minutes: 60,
    cost: DEFAULT_COST,
    notes: "",
  })
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.date) return

    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from("matches")
      .insert({
        date: form.date,
        time: form.time,
        location: form.location || null,
        duration_minutes: form.duration_minutes,
        cost: form.cost,
        notes: form.notes || null,
        created_by: user?.id,
      })
      .select()
      .single()

    if (error) {
      toast.error("Error al crear partido")
      setLoading(false)
      return
    }

    toast.success("Partido creado")
    router.push(`/matches/${data.id}`)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Nuevo partido</h1>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha *</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Horario</label>
            <input
              type="time"
              value={form.time}
              onChange={(e) => setForm({ ...form, time: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ubicación</label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
              placeholder="Dirección de la cancha"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Costo (Gs.)</label>
              <input
                type="number"
                value={form.cost}
                onChange={(e) => setForm({ ...form, cost: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duración (min)</label>
              <input
                type="number"
                value={form.duration_minutes}
                onChange={(e) => setForm({ ...form, duration_minutes: parseInt(e.target.value) || 60 })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
              rows={3}
              placeholder="Cancha x, cualquier detalle..."
            />
          </div>

          <button
            type="submit"
            disabled={loading || !form.date}
            className="w-full bg-primary text-white py-2.5 rounded-lg font-semibold hover:bg-primary-light transition-colors disabled:opacity-50"
          >
            {loading ? "Creando..." : "Crear partido"}
          </button>
        </form>
      </main>
    </div>
  )
}
