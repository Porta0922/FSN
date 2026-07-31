import { format, parseISO, isSameDay, startOfMonth, endOfMonth, getDay } from "date-fns"
import { es } from "date-fns/locale"

export function formatCurrency(amount: number): string {
  return `Gs. ${amount.toLocaleString("es-PY")}`
}

export function resizeImage(file: File, maxSize = 1000, quality = 0.8): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
      const width = Math.max(1, Math.round(img.width * scale))
      const height = Math.max(1, Math.round(img.height * scale))

      const canvas = document.createElement("canvas")
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        reject(new Error("No se pudo procesar la imagen"))
        return
      }
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("No se pudo procesar la imagen"))
            return
          }
          resolve(new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }))
        },
        "image/jpeg",
        quality
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("Imagen inválida"))
    }

    img.src = url
  })
}

export function formatDate(dateStr: string): string {
  return format(parseISO(dateStr), "EEEE d 'de' MMMM", { locale: es })
}

export function formatDateShort(dateStr: string): string {
  return format(parseISO(dateStr), "d/M", { locale: es })
}

export function formatDateTime(dateStr: string, time: string): string {
  return `${format(parseISO(dateStr), "EEEE d MMM", { locale: es })} ${time}`
}

export function getMondaysInMonth(year: number, month: number): Date[] {
  const mondays: Date[] = []
  const start = startOfMonth(new Date(year, month))
  const end = endOfMonth(new Date(year, month))
  const current = new Date(start)

  while (current <= end) {
    if (getDay(current) === 1) {
      mondays.push(new Date(current))
    }
    current.setDate(current.getDate() + 1)
  }

  return mondays
}

export function getDayName(dateStr: string): string {
  return format(parseISO(dateStr), "EEEE", { locale: es })
}

export function isToday(dateStr: string): boolean {
  return isSameDay(parseISO(dateStr), new Date())
}

export function isPast(dateStr: string): boolean {
  return parseISO(dateStr) < new Date()
}

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ")
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "confirmed":
      return "bg-green-100 text-green-800"
    case "pending":
      return "bg-yellow-100 text-yellow-800"
    case "declined":
      return "bg-red-100 text-red-800"
    case "no_show":
      return "bg-orange-100 text-orange-800"
    case "scheduled":
      return "bg-blue-100 text-blue-800"
    case "played":
      return "bg-green-100 text-green-800"
    case "cancelled":
      return "bg-gray-100 text-gray-800"
    case "approved":
      return "bg-green-100 text-green-800"
    case "rejected":
      return "bg-red-100 text-red-800"
    default:
      return "bg-gray-100 text-gray-800"
  }
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    confirmed: "Confirmado",
    pending: "Pendiente",
    declined: "No va",
    no_show: "No apareció",
    scheduled: "Programado",
    played: "Jugado",
    cancelled: "Cancelado",
    approved: "Aprobado",
    rejected: "Rechazado",
  }
  return labels[status] || status
}
