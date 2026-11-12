"use server"

import { signOut } from "@/auth"
import { headers } from "next/headers"

export async function logoutAction() {
  await signOut({ redirectTo: "/nexus/login" })
}

async function resolveRequestOrigin(clientOrigin?: string): Promise<string> {
  if (clientOrigin && /^https?:\/\//i.test(clientOrigin.trim())) {
    return clientOrigin.trim().replace(/\/+$/, "")
  }
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
    // Ignorar se chamado fora de contexto de request Next.js
  }
  return ""
}

export async function forgotPasswordAction(login: string, clientOrigin?: string) {
  const baseUrl = process.env.NEXT_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3004"
  const originUrl = await resolveRequestOrigin(clientOrigin)
  try {
    const res = await fetch(`${baseUrl}/api/auth/forgot-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(originUrl ? { "X-Client-Origin": originUrl } : {}),
      },
      body: JSON.stringify({ login: login.trim(), originUrl }),
      cache: "no-store",
    })
    const data = await res.json()
    if (!res.ok) {
      return { success: false, error: data?.message || "Erro ao solicitar recuperação de senha." }
    }
    return {
      success: true,
      message: data?.message || "Se as credenciais estiverem cadastradas, o e-mail de recuperação foi enviado.",
    }
  } catch (err: any) {
    console.error("[forgotPasswordAction] Erro:", err?.message)
    return { success: false, error: err?.message || "Erro ao comunicar com o servidor de autenticação." }
  }
}

export async function resetPasswordAction(token: string, newPass: string) {
  const baseUrl = process.env.NEXT_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3004"
  try {
    const res = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: token.trim(),
        newPassword: newPass.trim(),
      }),
      cache: "no-store",
    })
    const data = await res.json()
    if (!res.ok) {
      return { success: false, error: data?.message || "Erro ao redefinir a senha." }
    }
    return {
      success: true,
      message: data?.message || "Senha redefinida com sucesso!",
    }
  } catch (err: any) {
    console.error("[resetPasswordAction] Erro:", err?.message)
    return { success: false, error: err?.message || "Erro ao comunicar com o servidor de autenticação." }
  }
}
