"use client"

import { useEffect, useState } from "react"
import Navbar from "@/components/Navbar"
import { createClient } from "@/lib/supabase/client"
import { formatCurrency, formatDateShort, cn } from "@/lib/utils"
import type { Payment, Match } from "@/types"
import { DollarSign, Check, X, Upload } from "lucide-react"

export default function PaymentsPage() {
  const [payments, setPayments] = useState<(Payment & { match: Match })[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const { data: roleData } = await supabase
        .from("profile_roles")
        .select("roles(name)")
        .eq("profile_id", user.id)

      if (roleData) {
        setIsAdmin(roleData.some((pr: any) => pr.roles?.name === "admin" || pr.roles?.name === "super_admin"))
      }

      const { data } = await supabase
        .from("payments")
        .select("*, match:matches(*)")
        .order("created_at", { ascending: false })

      if (data) setPayments(data)
      setLoading(false)
    }

    load()
  }, [])

  async function handleApprove(paymentId: string) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase
      .from("payments")
      .update({ status: "approved", approved_by: user?.id, approved_at: new Date().toISOString() })
      .eq("id", paymentId)

    setPayments((prev) =>
      prev.map((p) =>
        p.id === paymentId ? { ...p, status: "approved" as Payment["status"], approved_by: user?.id ?? null } : p
      )
    )
  }

  async function handleReject(paymentId: string) {
    const supabase = createClient()
    await supabase
      .from("payments")
      .update({ status: "rejected" })
      .eq("id", paymentId)

    setPayments((prev) =>
      prev.map((p) => (p.id === paymentId ? { ...p, status: "rejected" as Payment["status"] } : p))
    )
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
                      <Upload size={12} />
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
                        onClick={() => handleApprove(payment.id)}
                        className="p-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
                      >
                        <Check size={16} />
                      </button>
                      <button
                        onClick={() => handleReject(payment.id)}
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
