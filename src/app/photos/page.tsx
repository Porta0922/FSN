"use client"

import { useEffect, useState } from "react"
import Navbar from "@/components/Navbar"
import { createClient } from "@/lib/supabase/client"
import { formatDateShort } from "@/lib/utils"
import type { Photo, Match } from "@/types"
import { Image, Upload, X } from "lucide-react"

export default function PhotosPage() {
  const [photos, setPhotos] = useState<(Photo & { match: Match })[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [selectedMatch, setSelectedMatch] = useState("")
  const [matches, setMatches] = useState<Match[]>([])
  const [preview, setPreview] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const { data: roleData } = await supabase
          .from("profile_roles")
          .select("roles(name)")
          .eq("profile_id", user.id)
        if (roleData) {
          setIsAdmin(roleData.some((pr: any) => pr.roles?.name === "admin" || pr.roles?.name === "super_admin"))
        }
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

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !selectedMatch) return

    setUploading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const fileName = `${selectedMatch}/${Date.now()}-${file.name}`
    const { data: uploadData, error } = await supabase.storage
      .from("photos")
      .upload(fileName, file)

    if (error || !uploadData) {
      setUploading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from("photos")
      .getPublicUrl(uploadData.path)

    await supabase.from("photos").insert({
      match_id: selectedMatch,
      profile_id: user.id,
      url: publicUrl,
    })

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
    await supabase.from("photos").delete().eq("id", photoId)
    setPhotos((prev) => prev.filter((p) => p.id !== photoId))
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
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Fotos</h1>

        {isAdmin && (
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-6">
            <h2 className="font-semibold text-gray-900 mb-3">Subir foto</h2>
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
              <label className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-light cursor-pointer">
                <Upload size={18} />
                {uploading ? "Subiendo..." : "Subir"}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleUpload}
                  className="hidden"
                  disabled={!selectedMatch || uploading}
                />
              </label>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {photos.map((photo) => (
            <div key={photo.id} className="relative group">
              <img
                src={photo.url}
                alt={photo.caption || "Foto del partido"}
                className="w-full h-48 object-cover rounded-xl cursor-pointer"
                onClick={() => setPreview(photo.url)}
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3 rounded-b-xl">
                <p className="text-white text-xs">
                  {photo.match ? formatDateShort(photo.match.date) : ""}
                </p>
              </div>
              {isAdmin && (
                <button
                  onClick={() => handleDelete(photo.id)}
                  className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
        </div>

        {photos.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <Image size={48} className="mx-auto mb-2" />
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
