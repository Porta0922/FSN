"use client"

import { useEffect, useState } from "react"
import Navbar from "@/components/Navbar"
import { createClient } from "@/lib/supabase/client"
import { formatDateShort } from "@/lib/utils"
import type { Photo, Match } from "@/types"
import { Image as ImageIcon, Upload, X } from "lucide-react"
import { toast } from "sonner"

const MAX_PHOTOS_PER_MATCH = 3

interface PhotoWithMatch extends Photo {
  match: Match | null
}

export default function PhotosPage() {
  const [photos, setPhotos] = useState<PhotoWithMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [selectedMatch, setSelectedMatch] = useState("")
  const [matches, setMatches] = useState<Match[]>([])
  const [preview, setPreview] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        setUserId(user.id)
        const { data: isAdminUser } = await supabase.rpc("is_admin", { user_id: user.id })
        setIsAdmin(!!isAdminUser)
      }

      const { data: matchData } = await supabase
        .from("matches")
        .select("*")
        .order("date", { ascending: false })

      if (matchData) setMatches(matchData)

      const { data } = await supabase
        .from("photos")
        .select("*, match:matches(*)")
        .order("created_at", { ascending: false })

      if (data) setPhotos(data)
      setLoading(false)
    }

    load()
  }, [])

  const myPhotosInSelectedMatch = userId && selectedMatch
    ? photos.filter((p) => p.match_id === selectedMatch && p.profile_id === userId).length
    : 0

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !selectedMatch) return

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: myPhotos } = await supabase
      .from("photos")
      .select("id")
      .eq("match_id", selectedMatch)
      .eq("profile_id", user.id)

    if (myPhotos && myPhotos.length >= MAX_PHOTOS_PER_MATCH) {
      toast.error(`Ya subiste ${MAX_PHOTOS_PER_MATCH} fotos de este partido`)
      e.target.value = ""
      return
    }

    setUploading(true)
    const fileName = `${selectedMatch}/${user.id}-${Date.now()}-${file.name}`
    const { data: uploadData, error } = await supabase.storage
      .from("photos")
      .upload(fileName, file)

    if (error || !uploadData) {
      toast.error("Error al subir la foto")
      setUploading(false)
      e.target.value = ""
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from("photos")
      .getPublicUrl(uploadData.path)

    const { error: insertError } = await supabase.from("photos").insert({
      match_id: selectedMatch,
      profile_id: user.id,
      url: publicUrl,
    })

    if (insertError) {
      if (insertError.code === "42501") {
        toast.error(`Llegaste al límite de ${MAX_PHOTOS_PER_MATCH} fotos por partido`)
      } else {
        toast.error("Error al guardar la foto")
      }
      setUploading(false)
      e.target.value = ""
      return
    }

    toast.success("Foto subida")
    const { data: newPhotos } = await supabase
      .from("photos")
      .select("*, match:matches(*)")
      .order("created_at", { ascending: false })

    if (newPhotos) setPhotos(newPhotos)
    setUploading(false)
    e.target.value = ""
  }

  async function handleDelete(photoId: string) {
    const supabase = createClient()
    const { error } = await supabase.from("photos").delete().eq("id", photoId)
    if (error) {
      toast.error("Error al borrar la foto")
      return
    }
    setPhotos((prev) => prev.filter((p) => p.id !== photoId))
    toast.success("Foto eliminada")
  }

  const grouped: { matchId: string; label: string; items: PhotoWithMatch[] }[] = []
  photos.forEach((photo) => {
    const label = photo.match ? formatDateShort(photo.match.date) : "Sin partido"
    const group = grouped.find((g) => g.matchId === photo.match_id)
    if (group) {
      group.items.push(photo)
    } else {
      grouped.push({ matchId: photo.match_id, label, items: [photo] })
    }
  })

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
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Galería de fotos</h1>

        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-6">
          <h2 className="font-semibold text-gray-900 mb-3">Subir foto</h2>
          <p className="text-sm text-gray-500 mb-3">
            Todos pueden subir fotos. Máximo {MAX_PHOTOS_PER_MATCH} por partido por jugador.
          </p>
          <div className="flex gap-2">
            <select
              value={selectedMatch}
              onChange={(e) => setSelectedMatch(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
            >
              <option value="">Seleccionar partido</option>
              {matches.map((m) => (
                <option key={m.id} value={m.id}>
                  {formatDateShort(m.date)} - {m.time}hs
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-light cursor-pointer disabled:opacity-50">
              <Upload size={18} />
              {uploading ? "Subiendo..." : "Subir"}
              <input
                type="file"
                accept="image/*"
                onChange={handleUpload}
                className="hidden"
                disabled={!selectedMatch || uploading || myPhotosInSelectedMatch >= MAX_PHOTOS_PER_MATCH}
              />
            </label>
          </div>
          {selectedMatch && (
            <p className="text-xs text-gray-400 mt-2">
              Subiste {myPhotosInSelectedMatch} de {MAX_PHOTOS_PER_MATCH} fotos de este partido.
            </p>
          )}
        </div>

        {grouped.map((group) => (
          <div key={group.matchId} className="mb-6">
            <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span className="text-sm">📸</span>
              Partido del {group.label}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {group.items.map((photo) => (
                <div key={photo.id} className="relative group">
                  <img
                    src={photo.url}
                    alt="Foto del partido"
                    className="w-full h-48 object-cover rounded-xl cursor-pointer"
                    onClick={() => setPreview(photo.url)}
                  />
                  {(isAdmin || photo.profile_id === userId) && (
                    <button
                      onClick={() => handleDelete(photo.id)}
                      className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Borrar foto"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {photos.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <ImageIcon size={48} className="mx-auto mb-2" aria-hidden />
            <p>No hay fotos todavía</p>
          </div>
        )}

        {preview && (
          <div
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
            onClick={() => setPreview(null)}
          >
            <img src={preview} alt="Preview" className="max-w-full max-h-full rounded-xl" />
          </div>
        )}
      </main>
    </div>
  )
}
