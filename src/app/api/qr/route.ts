import { NextResponse, type NextRequest } from "next/server"
import QRCode from "qrcode"

export async function GET(request: NextRequest) {
  const data = request.nextUrl.searchParams.get("data") || ""
  if (!data) return new NextResponse("Missing data", { status: 400 })

  const size = Math.min(600, Math.max(120, parseInt(request.nextUrl.searchParams.get("size") || "300") || 300))

  try {
    const buffer = await QRCode.toBuffer(data, {
      width: size,
      margin: 2,
      errorCorrectionLevel: "M",
    })
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600",
      },
    })
  } catch {
    return new NextResponse("Invalid data", { status: 400 })
  }
}
