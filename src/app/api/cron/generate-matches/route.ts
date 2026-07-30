import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET() {
  try {
    const supabase = createAdminClient()

    const { data: config } = await supabase
      .from("team_config")
      .select("*")
      .limit(1)
      .single()

    if (!config) {
      return NextResponse.json({ error: "No config found" }, { status: 500 })
    }

    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth()

    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)

    let created = 0

    for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
      if (d.getDay() !== config.default_day_of_week) continue

      const dateStr = d.toISOString().split("T")[0]

      const { data: existing } = await supabase
        .from("matches")
        .select("id")
        .eq("date", dateStr)
        .limit(1)

      if (existing && existing.length > 0) continue

      // Skip past dates (only if not today and in the past)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (d < today) continue

      await supabase.from("matches").insert({
        date: dateStr,
        time: config.default_time,
        location: config.default_location,
        duration_minutes: config.default_duration_minutes,
        cost: config.default_cost,
      })

      created++
    }

    return NextResponse.json({ created, month: month + 1, year })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
