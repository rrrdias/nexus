"use server"

import { auth, signOut } from "@/auth"

export async function fetchFromApi<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const session = await auth()
  // @ts-ignore
  const token = session?.user?.accessToken

  if (!token) {
    await signOut({ redirectTo: "/login" })
  }

  const baseUrl = process.env.NEXT_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"
  const url = `${baseUrl}${endpoint}`

  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
  })

  if (response.status === 401) {
    await signOut({ redirectTo: "/login" })
  }

  if (!response.ok) {
    const error = await response.json().catch(() => null)
    throw new Error(error?.message || error?.error || "Erro na requisição.")
  }

  return response.json() as Promise<T>
}
