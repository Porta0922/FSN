"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { TEAM_NAME } from "@/lib/constants"

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error || !session) {
        setError("El enlace es inválido o expiró. Volvé a solicitar la recuperación de contraseña.")
        setLoading(false)
        return
      }
      setLoading(false)
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.")
      return
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.")
      return
    }

    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })

    setSaving(false)

    if (error) {
      setError(error.message)
      return
    }

    setDone(true)
    setTimeout(() => router.push("/dashboard"), 2000)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary to-primary-dark p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="text-5xl mb-2">⚽</div>
          <h1 className="text-2xl font-bold text-primary">{TEAM_NAME}</h1>
          <p className="text-sm text-gray-500 mt-1">Nueva contraseña</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : error && !done ? (
          <div className="space-y-4">
            <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>
            <Link
              href="/login"
              className="block text-center bg-primary text-white py-2.5 rounded-lg font-semibold hover:bg-primary-light transition-colors"
            >
              Volver al inicio de sesión
            </Link>
          </div>
        ) : done ? (
          <div className="bg-green-50 p-4 rounded-lg text-sm text-green-700 text-center">
            Contraseña actualizada correctamente. Redirigiendo...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nueva contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-colors"
                placeholder="••••••••"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirmar contraseña
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-colors"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-primary text-white py-2.5 rounded-lg font-semibold hover:bg-primary-light transition-colors disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Guardar contraseña"}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
