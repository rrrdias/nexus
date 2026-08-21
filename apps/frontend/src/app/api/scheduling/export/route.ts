import { NextRequest } from "next/server"
import { auth } from "@/auth"

export async function GET(req: NextRequest) {
  const session = await auth()
  const token = session?.user?.accessToken
  if (!token) {
    return new Response("Unauthorized", { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"
  const url = `${baseUrl}/api/scheduling/export?${searchParams.toString()}`

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`
      }
    })
    
    if (!res.ok) {
      return new Response("Erro ao exportar planilha", { status: res.status })
    }

    const headers = new Headers()
    headers.set("Content-Type", "text/csv; charset=utf-8")
    headers.set("Content-Disposition", "attachment; filename=agendamentos.csv")

    return new Response(res.body, {
      status: 200,
      headers
    })
  } catch (err: any) {
    return new Response(err.message, { status: 500 })
  }
}
