"use server"

import { auth, signOut } from "../../auth"
import { headers } from "next/headers"
import { cache } from "react"

const getCachedSession = cache(async () => {
  return auth()
})

const getCachedClientOrigin = cache(async () => {
  try {
    const h = await headers()
    const origin = h.get("origin")
    if (origin && /^https?:\/\//i.test(origin)) {
      return origin.replace(/\/+$/, "")
    }
    const host = h.get("x-forwarded-host") || h.get("host")
    const proto = h.get("x-forwarded-proto") || "http"
    if (host) {
      return `${proto}://${host}`.replace(/\/+$/, "")
    }
  } catch {
    // Ignora caso executado fora de contexto de request Next.js
  }
  return ""
})

export async function fetchFromApi<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  let token: string | undefined = process.env.TEST_AUTH_TOKEN
  let clientOrigin = ""
  if (!token) {
    const [session, resolvedOrigin] = await Promise.all([
      getCachedSession(),
      getCachedClientOrigin(),
    ])
    token = session?.user?.accessToken
    clientOrigin = resolvedOrigin

    if (!token) {
      await signOut({ redirectTo: "/nexus/login" })
    }
  }

  const baseUrl = process.env.NEXT_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3004"
  const url = `${baseUrl}${endpoint}`

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        ...(clientOrigin ? { "X-Client-Origin": clientOrigin } : {}),
      },
    })

    if (response.status === 401) {
      await signOut({ redirectTo: "/nexus/login" })
    }

    if (!response.ok) {
      const error = await response.json().catch(() => null)
      throw new Error(error?.message || error?.error || `Erro HTTP ${response.status} na API.`)
    }

    return await response.json() as T
  } catch (error: any) {
    // Next.js utiliza erros com digest NEXT_REDIRECT para realizar redirecionamentos no servidor
    if (
      error?.message === 'NEXT_REDIRECT' ||
      (typeof error?.digest === 'string' && error.digest.startsWith('NEXT_REDIRECT'))
    ) {
      throw error;
    }

    console.error(`[API Fetch Error] Failed to connect to ${url}:`, error);
    throw new Error(error.message || "Erro de conexão com o backend.");
  }
}

