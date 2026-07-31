"use client"

import { useEffect, useState } from "react"
import Navbar from "@/components/Navbar"
import { createClient } from "@/lib/supabase/client"
import { formatCurrency, resizeImage } from "@/lib/utils"
import type { MarketplaceItem } from "@/types"
import { Store, Plus, Trash2, X, Upload } from "lucide-react"
import { toast } from "sonner"

export default function MarketplacePage() {
  const [items, setItems] = useState<MarketplaceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [price, setPrice] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const { data: isAdminUser } = await supabase.rpc("is_admin", { user_id: user.id })
        setIsAdmin(!!isAdminUser)
      }

      const { data } = await supabase
        .from("marketplace_items")
        .select("*")
        .order("created_at", { ascending: false })

      if (data) setItems(data)
      setLoading(false)
    }

    load()
  }, [])

  async function handleAddProduct() {
    if (!name.trim() || !price || !file) {
      toast.error("Completá nombre, precio y foto")
      return
    }

    const priceNum = Number(price)
    if (isNaN(priceNum) || priceNum <= 0) {
      toast.error("Precio inválido")
      return
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    setSaving(true)

    let resized = file
    try {
      resized = await resizeImage(file)
    } catch {
      toast.error("No se pudo procesar la imagen")
      setSaving(false)
      return
    }

    const fileName = `${Date.now()}-${resized.name}`
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("marketplace")
      .upload(fileName, resized)

    if (uploadError || !uploadData) {
      toast.error("Error al subir la foto")
      setSaving(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from("marketplace")
      .getPublicUrl(uploadData.path)

    const { error: insertError } = await supabase.from("marketplace_items").insert({
      name: name.trim(),
      description: description.trim() || null,
      price: priceNum,
      image_url: publicUrl,
      created_by: user.id,
    })

    if (insertError) {
      toast.error("Error al guardar el producto")
      setSaving(false)
      return
    }

    toast.success("Producto agregado")
    const { data } = await supabase
      .from("marketplace_items")
      .select("*")
      .order("created_at", { ascending: false })
    if (data) setItems(data)

    setName("")
    setDescription("")
    setPrice("")
    setFile(null)
    setPreview(null)
    setShowModal(false)
    setSaving(false)
  }

  async function handleDeleteProduct(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from("marketplace_items").delete().eq("id", id)
    if (error) {
      toast.error("Error al borrar el producto")
      return
    }
    setItems((prev) => prev.filter((i) => i.id !== id))
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
      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Store size={24} className="text-primary" />
            Marketplace
          </h1>
          {isAdmin && (
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-1.5 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-light transition-colors"
            >
              <Plus size={16} />
              Agregar producto
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Store size={48} className="mx-auto mb-2" aria-hidden />
            <p>No hay productos todavía</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {items.map((item) => (
              <div key={item.id} className="relative group bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100">
                <div className="bg-gray-100 h-48">
                  <img src={item.image_url} alt={item.name} className="w-full h-full object-contain" />
                </div>
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

        {showModal && (
          <div
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
            onClick={() => setShowModal(false)}
          >
            <div className="bg-white rounded-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Nuevo producto</h3>
                <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-gray-100">
                  <X size={18} />
                </button>
              </div>

              {preview ? (
                <div className="relative mb-4">
                  <img src={preview} alt="Preview" className="w-full h-48 object-contain bg-gray-100 rounded-xl" />
                  <button
                    onClick={() => { setFile(null); setPreview(null) }}
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
                      const selected = e.target.files?.[0]
                      if (selected) {
                        setFile(selected)
                        setPreview(URL.createObjectURL(selected))
                      }
                    }}
                  />
                </label>
              )}

              <div className="space-y-3">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nombre del producto"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descripción (opcional)"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
                <input
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="Precio (Gs.)"
                  type="number"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>

              <button
                onClick={handleAddProduct}
                disabled={saving}
                className="w-full mt-4 bg-primary text-white py-2 rounded-lg text-sm font-medium hover:bg-primary-light disabled:opacity-50 transition-colors"
              >
                {saving ? "Guardando..." : "Guardar producto"}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
