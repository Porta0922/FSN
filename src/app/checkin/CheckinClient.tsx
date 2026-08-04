"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { confirmCheckin, type CheckinResult } from "@/lib/checkin-actions"

type Status = "loading" | "done" | "error"

export default function CheckinClient({ token }: { token: string }) {
  const [state, setState] = useState<Status>("loading")
  const [result, setResult] = useState<CheckinResult | null>(null)

  useEffect(() => {
    let cancelled = false

    async function run() {
      if (!token) {
        if (!cancelled) {
          setResult({ ok: false, error: "Falta el código QR" })
          setState("error")
        }
        return
      }

      const res = await confirmCheckin(token)
      if (cancelled) return
      setResult(res)
      setState(res.ok ? "done" : "error")
    }

    run()
    return () => {
      cancelled = true
    }
  }, [token])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary to-primary-dark p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 text-center">
        {state === "loading" && (
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
            <p className="text-gray-500">Confirmando tu asistencia...</p>
          </div>
        )}

        {state === "done" && (
          <div className="flex flex-col items-center gap-3">
            <div className="text-6xl">✅</div>
            <h1 className="text-2xl font-bold text-green-600">¡Asistencia confirmada!</h1>
            <p className="text-gray-500">
              {result?.ok && result.already
                ? "Ya estabas confirmado para este partido."
                : "Te esperamos en la cancha."}
            </p>
            <Link
              href="/dashboard"
              className="mt-2 bg-primary text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-primary-light transition-colors"
            >
              Ir al dashboard
            </Link>
          </div>
        )}

        {state === "error" && (
          <div className="flex flex-col items-center gap-3">
            <div className="text-6xl">⚠️</div>
            <h1 className="text-2xl font-bold text-red-600">No se pudo confirmar</h1>
            <p className="text-gray-500">{result && !result.ok ? result.error : "Ocurrió un error"}</p>
            <Link
              href="/matches"
              className="mt-2 bg-gray-100 text-gray-700 px-6 py-2.5 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
            >
              Ver partidos
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
