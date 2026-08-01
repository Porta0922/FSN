"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { TEAM_NAME } from "@/lib/constants"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [resetOk, setResetOk] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showForgot, setShowForgot] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("reset") === "ok") {
      const id = window.setTimeout(() => {
        setResetOk(true)
        window.history.replaceState({}, "", window.location.pathname)
      }, 0)
      return () => window.clearTimeout(id)
    }
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push("/dashboard")
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setResetLoading(true)

    const origin = window.location.origin
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/reset-password`,
    })

    setResetLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    setResetSent(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary to-primary-dark p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="text-5xl mb-2">⚽</div>
          <h1 className="text-2xl font-bold text-primary">{TEAM_NAME}</h1>
          <p className="text-sm text-gray-500 mt-1">Iniciar sesión</p>
        </div>

        {resetOk && (
          <div className="mb-4 bg-green-50 border border-green-200 p-4 rounded-lg text-sm text-green-700">
            Contraseña actualizada. Iniciá sesión con tu contraseña nueva.
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-colors"
              placeholder="tu@email.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña
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

          {error && (
            <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white py-2.5 rounded-lg font-semibold hover:bg-primary-light transition-colors disabled:opacity-50"
          >
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          ¿No tenés cuenta?{" "}
          <Link href="/register" className="text-primary font-semibold hover:underline">
            Registrarse
          </Link>
        </p>

        {!showForgot ? (
          <p className="text-center text-sm text-gray-500 mt-2">
            <button
              type="button"
              onClick={() => setShowForgot(true)}
              className="text-primary font-semibold hover:underline"
            >
              Olvidé mi contraseña
            </button>
          </p>
        ) : resetSent ? (
          <div className="mt-4 bg-green-50 p-4 rounded-lg text-sm text-green-700">
            Enviamos un correo de recuperación a <strong>{email}</strong>. Revisá tu bandeja de entrada.
          </div>
        ) : (
          <form onSubmit={handleResetPassword} className="mt-4 space-y-3">
            <p className="text-sm text-gray-500">
              Ingresá tu email y te enviaremos un enlace para cambiar tu contraseña.
            </p>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-colors text-sm"
              placeholder="tu@email.com"
              required
            />
            {error && (
              <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={resetLoading}
                className="flex-1 bg-primary text-white py-2 rounded-lg text-sm font-semibold hover:bg-primary-light transition-colors disabled:opacity-50"
              >
                {resetLoading ? "Enviando..." : "Enviar enlace"}
              </button>
              <button
                type="button"
                onClick={() => { setShowForgot(false); setError("") }}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
