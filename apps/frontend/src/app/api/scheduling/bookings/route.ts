import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"

export async function GET(req: NextRequest) {
  const session = await auth()
  const token = session?.user?.accessToken
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"
  const url = `${baseUrl}/api/scheduling/bookings?${searchParams.toString()}`

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      }
    })
    
    if (!res.ok) {
      const err = await res.json().catch(() => null)
      return NextResponse.json(err || { error: "Erro na consulta de agendamentos." }, { status: res.status })
    }
    
    const data = await res.json()
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
