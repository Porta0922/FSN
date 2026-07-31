"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Navbar from "@/components/Navbar"
import { createClient } from "@/lib/supabase/client"
import { formatCurrency, formatDate, getStatusColor, getStatusLabel } from "@/lib/utils"
import { CalendarDays, Users, Trophy, ArrowRight, CircleDot, Store, Plus, Trash2, X, Upload } from "lucide-react"
import { toast } from "sonner"
import type { Match, MarketplaceItem, Profile } from "@/types"

interface MvpStanding {
  profile_id: string
  name: string
  nickname: string | null
  points: number
  mvp_wins: number
  second_places: number
}

export default function DashboardPage() {
  const [user, setUser] = useState<Profile | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [nextMatch, setNextMatch] = useState<Match | null>(null)
  const [myAttendance, setMyAttendance] = useState<string | null>(null)
  const [stats, setStats] = useState({ totalMatches: 0, totalGoals: 0, attendance: 0 })
  const [mvpStandings, setMvpStandings] = useState<MvpStanding[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [marketplaceItems, setMarketplaceItems] = useState<MarketplaceItem[]>([])
  const [showMarketplaceModal, setShowMarketplaceModal] = useState(false)
  const [productName, setProductName] = useState("")
  const [productDescription, setProductDescription] = useState("")
  const [productPrice, setProductPrice] = useState("")
  const [productFile, setProductFile] = useState<File | null>(null)
  const [productPreview, setProductPreview] = useState<string | null>(null)
  const [savingProduct, setSavingProduct] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) return

      setUserId(authUser.id)

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", authUser.id)
        .single()

      setUser(profile)

      const today = new Date()
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`

      const { data: matches } = await supabase
        .from("matches")
        .select("*")
        .gte("date", todayStr)
        .eq("status", "scheduled")
        .order("date", { ascending: true })
        .limit(1)

      if (matches && matches.length > 0) {
        setNextMatch(matches[0])
        const { data: att } = await supabase
          .from("attendance")
          .select("status")
          .eq("match_id", matches[0].id)
          .eq("profile_id", authUser.id)
          .single()

        if (att) setMyAttendance(att.status)
      }

      const { count: matchCount } = await supabase
        .from("matches")
        .select("*", { count: "exact", head: true })
        .eq("status", "played")

      const { count: goalCount } = await supabase
        .from("goals")
        .select("*", { count: "exact", head: true })

      const { count: myMatches } = await supabase
        .from("attendance")
        .select("*", { count: "exact", head: true })
        .eq("profile_id", authUser.id)

      const { count: myConfirmed } = await supabase
        .from("attendance")
        .select("*", { count: "exact", head: true })
        .eq("profile_id", authUser.id)
        .eq("status", "confirmed")

      setStats({
        totalMatches: matchCount || 0,
        totalGoals: goalCount || 0,
        attendance: myConfirmed && myConfirmed > 0 ? Math.round((myConfirmed / (myMatches || 1)) * 100) : 0,
      })

      const { data: standings } = await supabase.rpc("mvp_standings_for_year", {
        target_year: today.getFullYear(),
      })
      setMvpStandings((standings || []) as MvpStanding[])

      const { data: isAdminUser } = await supabase.rpc("is_admin", { user_id: authUser.id })
      setIsAdmin(!!isAdminUser)

      const { data: items } = await supabase
        .from("marketplace_items")
        .select("*")
        .order("created_at", { ascending: false })
      if (items) setMarketplaceItems(items)

      setLoading(false)
    }

    load()
  }, [])

  async function handleAddProduct() {
    if (!productName.trim() || !productPrice || !productFile) {
      toast.error("Completá nombre, precio y foto")
      return
    }

    const price = Number(productPrice)
    if (isNaN(price) || price <= 0) {
      toast.error("Precio inválido")
      return
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    setSavingProduct(true)
    const fileName = `${Date.now()}-${productFile.name}`
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("marketplace")
      .upload(fileName, productFile)

    if (uploadError || !uploadData) {
      toast.error("Error al subir la foto")
      setSavingProduct(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from("marketplace")
      .getPublicUrl(uploadData.path)

    const { error: insertError } = await supabase.from("marketplace_items").insert({
      name: productName.trim(),
      description: productDescription.trim() || null,
      price,
      image_url: publicUrl,
      created_by: user.id,
    })

    if (insertError) {
      toast.error("Error al guardar el producto")
      setSavingProduct(false)
      return
    }

    toast.success("Producto agregado")
    const { data: items } = await supabase
      .from("marketplace_items")
      .select("*")
      .order("created_at", { ascending: false })
    if (items) setMarketplaceItems(items)

    setProductName("")
    setProductDescription("")
    setProductPrice("")
    setProductFile(null)
    setProductPreview(null)
    setShowMarketplaceModal(false)
    setSavingProduct(false)
  }

  async function handleDeleteProduct(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from("marketplace_items").delete().eq("id", id)
    if (error) {
      toast.error("Error al borrar el producto")
      return
    }
    setMarketplaceItems((prev) => prev.filter((i) => i.id !== id))
    toast.success("Producto eliminado")
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
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-6">
          <Link
            href={userId ? `/players/${userId}` : "/profile"}
            className="inline-flex items-center gap-2 group"
          >
            <h1 className="text-2xl font-bold text-gray-900 group-hover:text-primary transition-colors">
              Bienvenido, {user?.nickname || user?.name || "Jugador"} 👋
            </h1>
          </Link>
          <p className="text-gray-500 text-sm">Fútbol Sin Nivel ⚽</p>
        </div>

        {nextMatch && (
          <Link
            href={`/matches/${nextMatch.id}`}
            className="block bg-gradient-to-r from-primary to-primary-dark rounded-xl p-5 text-white mb-6 hover:opacity-95 transition-opacity"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/70 text-sm font-medium">PRÓXIMO PARTIDO</span>
              <ArrowRight size={20} className="text-white/70" />
            </div>
            <p className="text-xl font-bold">{formatDate(nextMatch.date)}</p>
            <p className="text-white/80">{nextMatch.time}hs | {formatCurrency(nextMatch.cost)}</p>
            {myAttendance && (
              <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(myAttendance)}`}>
                {getStatusLabel(myAttendance)}
              </span>
            )}
          </Link>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <CalendarDays size={20} className="text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.totalMatches}</p>
                <p className="text-xs text-gray-500">Partidos jugados</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-50 rounded-lg">
                <CircleDot size={20} className="text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.totalGoals}</p>
                <p className="text-xs text-gray-500">Goles totales</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 rounded-lg">
                <Users size={20} className="text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.attendance}%</p>
                <p className="text-xs text-gray-500">Asistencia</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-50 rounded-lg">
                <Trophy size={20} className="text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {mvpStandings[0]?.nickname || mvpStandings[0]?.name || "-"}
                </p>
                <p className="text-xs text-gray-500">
                  Líder MVP {mvpStandings[0] ? `(${mvpStandings[0].points} pts)` : ""}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h2 className="font-semibold text-gray-900 mb-3">Acciones rápidas</h2>
            <div className="space-y-2">
              <Link href="/matches" className="block p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                <p className="font-medium text-gray-900">📋 Anotarme al próximo partido</p>
                <p className="text-sm text-gray-500">Confirmá o decliná tu asistencia</p>
              </Link>
              <Link href="/payments" className="block p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                <p className="font-medium text-gray-900">💰 Pagar cuota</p>
                <p className="text-sm text-gray-500">Subí tu comprobante de pago</p>
              </Link>
              <Link href="/stats" className="block p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                <p className="font-medium text-gray-900">📊 Estadísticas del mes</p>
                <p className="text-sm text-gray-500">Goles, asistencias y más</p>
              </Link>
              {userId && (
                <Link href={`/players/${userId}`} className="block p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                  <p className="font-medium text-gray-900">👤 Mi perfil</p>
                  <p className="text-sm text-gray-500">Editar mis datos y foto</p>
                </Link>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h2 className="font-semibold text-gray-900 mb-3">🏆 Tabla general MVP</h2>
            <div className="space-y-2">
              {mvpStandings.slice(0, 10).map((s, i) => (
                <div key={s.profile_id} className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
                  <div className="flex items-center gap-2">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? "bg-yellow-100 text-yellow-700" : i === 1 ? "bg-gray-200 text-gray-600" : i === 2 ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-500"}`}>
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium text-gray-700">{s.nickname || s.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">
                      🏆 {s.mvp_wins} {s.mvp_wins === 1 ? "vez" : "veces"}
                    </span>
                    <span className="text-sm font-bold text-yellow-600">{s.points} pts</span>
                  </div>
                </div>
              ))}
              {mvpStandings.length === 0 && (
                <p className="text-sm text-gray-400">Aún no hay votos cargados.</p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Store size={20} className="text-primary" />
              Marketplace
            </h2>
            {isAdmin && (
              <button
                onClick={() => setShowMarketplaceModal(true)}
                className="inline-flex items-center gap-1.5 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-light transition-colors"
              >
                <Plus size={16} />
                Agregar producto
              </button>
            )}
          </div>

          {marketplaceItems.length === 0 ? (
            <p className="text-sm text-gray-400">Aún no hay productos cargados.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {marketplaceItems.map((item) => (
                <div key={item.id} className="relative group bg-gray-50 rounded-xl overflow-hidden border border-gray-100">
                  <img src={item.image_url} alt={item.name} className="w-full h-40 object-cover" />
                  <div className="p-3">
                    <p className="font-medium text-gray-900 text-sm truncate">{item.name}</p>
                    {item.description && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{item.description}</p>
                    )}
                    <p className="text-primary font-bold mt-1">{formatCurrency(item.price)}</p>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => handleDeleteProduct(item.id)}
                      className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Borrar producto"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {showMarketplaceModal && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={() => setShowMarketplaceModal(false)}
        >
          <div className="bg-white rounded-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Nuevo producto</h3>
              <button onClick={() => setShowMarketplaceModal(false)} className="p-1 rounded-lg hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>

            {productPreview ? (
              <div className="relative mb-4">
                <img src={productPreview} alt="Preview" className="w-full h-48 object-cover rounded-xl" />
                <button
                  onClick={() => { setProductFile(null); setProductPreview(null) }}
                  className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl p-8 mb-4 cursor-pointer hover:border-primary transition-colors">
                <Upload size={28} className="text-gray-400 mb-2" />
                <span className="text-sm text-gray-500">Seleccionar foto del producto</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      setProductFile(file)
                      setProductPreview(URL.createObjectURL(file))
                    }
                  }}
                />
              </label>
            )}

            <div className="space-y-3">
              <input
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Nombre del producto"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
              <input
                value={productDescription}
                onChange={(e) => setProductDescription(e.target.value)}
                placeholder="Descripción (opcional)"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
              <input
                value={productPrice}
                onChange={(e) => setProductPrice(e.target.value)}
                placeholder="Precio (Gs.)"
                type="number"
                min="0"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>

            <button
              onClick={handleAddProduct}
              disabled={savingProduct}
              className="w-full mt-4 bg-primary text-white py-2 rounded-lg text-sm font-medium hover:bg-primary-light disabled:opacity-50 transition-colors"
            >
              {savingProduct ? "Guardando..." : "Guardar producto"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
