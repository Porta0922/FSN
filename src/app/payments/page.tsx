"use client"

import { useEffect, useState } from "react"
import Navbar from "@/components/Navbar"
import { createClient } from "@/lib/supabase/client"
import { formatCurrency, formatDateShort, cn } from "@/lib/utils"
import type { Payment, Match } from "@/types"
import { DollarSign, Check, X, Upload, FileText } from "lucide-react"
import { toast } from "sonner"

export default function PaymentsPage() {
  const [payments, setPayments] = useState<(Payment & { match: Match })[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [shares, setShares] = useState<Record<string, { amount: number; confirmed: number }>>({})
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [selectedMatch, setSelectedMatch] = useState("")
  const [amount, setAmount] = useState(0)
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const { data: isAdminUser } = await supabase.rpc("is_admin", { user_id: user.id })
      const userIsAdmin = !!isAdminUser
      setIsAdmin(userIsAdmin)

      let paymentsQuery = supabase
        .from("payments")
        .select("*, match:matches(*)")
        .order("created_at", { ascending: false })

      if (!userIsAdmin) {
        paymentsQuery = paymentsQuery.eq("profile_id", user.id)
      }

      const { data } = await paymentsQuery
      if (data) setPayments(data)

      const today = new Date()
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`

      const { data: matchData } = await supabase
        .from("matches")
        .select("*")
        .eq("status", "scheduled")
        .gte("date", todayStr)
        .order("date", { ascending: true })

      if (matchData && matchData.length > 0) {
        setMatches(matchData)

        const { data: attData } = await supabase
          .from("attendance")
          .select("match_id")
          .eq("status", "confirmed")
          .in("match_id", matchData.map((m) => m.id))

        if (attData) {
          const counts: Record<string, number> = {}
          attData.forEach((a) => { counts[a.match_id] = (counts[a.match_id] || 0) + 1 })
          const shareMap: Record<string, { amount: number; confirmed: number }> = {}
          matchData.forEach((m) => {
            const confirmed = counts[m.id] || 0
            shareMap[m.id] = { amount: Math.floor(m.cost / (confirmed || 1)), confirmed }
          })
          setShares(shareMap)
        }
      }

      setLoading(false)
    }

    load()
  }, [reloadKey])

  function handleSelectMatch(matchId: string) {
    setSelectedMatch(matchId)
    setAmount(shares[matchId]?.amount || 0)
  }

  async function handleSubmitPayment(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedMatch || !amount) return

    setSubmitting(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSubmitting(false)
      return
    }

    let receiptUrl: string | null = null
    if (receiptFile) {
      const path = `${selectedMatch}/${user.id}-${Date.now()}-${receiptFile.name}`
      const { error: upErr, data: upData } = await supabase.storage
        .from("receipts")
        .upload(path, receiptFile)

      if (upErr || !upData) {
        toast.error("Error al subir el comprobante")
        setSubmitting(false)
        return
      }

      const { data: { publicUrl } } = supabase.storage
        .from("receipts")
        .getPublicUrl(upData.path)

      receiptUrl = publicUrl
    }

    const { error } = await supabase.from("payments").insert({
      match_id: selectedMatch,
      profile_id: user.id,
      amount,
      receipt_url: receiptUrl,
      status: "pending",
    })

    if (error) {
      if (error.code === "23505") {
        toast.error("Ya cargaste un pago para este partido")
      } else {
        toast.error("Error al cargar el pago")
      }
      setSubmitting(false)
      return
    }

    toast.success("Pago cargado. Esperando aprobación")
    setSelectedMatch("")
    setAmount(0)
    setReceiptFile(null)
    setSubmitting(false)
    setReloadKey((k) => k + 1)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  const myPayments = payments.filter((p) => p.profile_id === userId || isAdmin)
  const pendingPayments = myPayments.filter((p) => p.status === "pending")
  const approvedPayments = myPayments.filter((p) => p.status === "approved")

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Pagos</h1>

        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-2xl font-bold text-gray-900">{myPayments.length}</p>
            <p className="text-sm text-gray-500">Total</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-2xl font-bold text-yellow-600">{pendingPayments.length}</p>
            <p className="text-sm text-gray-500">Pendientes</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-2xl font-bold text-green-600">{approvedPayments.length}</p>
            <p className="text-sm text-gray-500">Aprobados</p>
          </div>
        </div>

        {/* Cargar pago */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 mb-6">
          <h2 className="font-semibold text-gray-900 mb-3">Cargar pago</h2>
          <form onSubmit={handleSubmitPayment} className="space-y-3">
            <div>
              <label className="block text-sm text-gray-500 mb-1">Partido</label>
              <select
                value={selectedMatch}
                onChange={(e) => handleSelectMatch(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                required
              >
                <option value="">Seleccionar partido</option>
                {matches.map((m) => {
                  const share = shares[m.id]
                  return (
                    <option key={m.id} value={m.id}>
                      {formatDateShort(m.date)} - {m.time}hs
                      {share ? ` (cuota ${formatCurrency(share.amount)})` : ""}
                    </option>
                  )
                })}
              </select>
              {selectedMatch && shares[selectedMatch] && (
                <p className="text-xs text-gray-400 mt-1">
                  Cuota estimada: {formatCurrency(shares[selectedMatch].amount)} entre {shares[selectedMatch].confirmed} confirmados
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm text-gray-500 mb-1">Monto (Gs.)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                required
                min={1}
              />
            </div>

            <div>
              <label className="block text-sm text-gray-500 mb-1">Comprobante (opcional)</label>
              <label className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 cursor-pointer hover:bg-gray-100">
                <Upload size={16} className="text-gray-500" />
                <span className="text-sm text-gray-600 truncate">
                  {receiptFile ? receiptFile.name : "Subir imagen del comprobante"}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={submitting || !selectedMatch || !amount}
              className="w-full bg-primary text-white py-2 rounded-lg text-sm font-medium hover:bg-primary-light disabled:opacity-50"
            >
              {submitting ? "Cargando..." : "Cargar pago"}
            </button>
          </form>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Historial de pagos</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {myPayments.map((payment) => (
              <div key={payment.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">
                    {payment.match ? formatDateShort(payment.match.date) : "---"}
                  </p>
                  <p className="text-sm text-gray-500">{formatCurrency(payment.amount)}</p>
                  {payment.receipt_url && (
                    <a
                      href={payment.receipt_url}
                      target="_blank"
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1"
                    >
                      <FileText size={12} />
                      Ver comprobante
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "px-2 py-1 rounded-full text-xs font-medium",
                      payment.status === "approved"
                        ? "bg-green-100 text-green-700"
                        : payment.status === "rejected"
                        ? "bg-red-100 text-red-700"
                        : "bg-yellow-100 text-yellow-700"
                    )}
                  >
                    {payment.status === "approved"
                      ? "Aprobado"
                      : payment.status === "rejected"
                      ? "Rechazado"
                      : "Pendiente"}
                  </span>
                  {isAdmin && payment.status === "pending" && (
                    <div className="flex gap-1">
                      <button
                        onClick={async () => {
                          const supabase = createClient()
                          const { data: { user } } = await supabase.auth.getUser()
                          const { error } = await supabase
                            .from("payments")
                            .update({ status: "approved", approved_by: user?.id, approved_at: new Date().toISOString() })
                            .eq("id", payment.id)
                          if (error) {
                            toast.error("Error al aprobar el pago")
                            return
                          }
                          setReloadKey((k) => k + 1)
                        }}
                        className="p-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
                      >
                        <Check size={16} />
                      </button>
                      <button
                        onClick={async () => {
                          const supabase = createClient()
                          const { error } = await supabase
                            .from("payments")
                            .update({ status: "rejected" })
                            .eq("id", payment.id)
                          if (error) {
                            toast.error("Error al rechazar el pago")
                            return
                          }
                          setReloadKey((k) => k + 1)
                        }}
                        className="p-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {myPayments.length === 0 && (
              <div className="p-8 text-center text-gray-400">
                <DollarSign size={32} className="mx-auto mb-2" />
                <p>Sin pagos registrados</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
