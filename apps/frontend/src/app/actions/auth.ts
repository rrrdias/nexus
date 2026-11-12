"use server"

import { signOut } from "@/auth"

export async function logoutAction() {
  await signOut({ redirectTo: "/nexus/login" })
}

export async function forgotPasswordAction(login: string) {
  const baseUrl = process.env.NEXT_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3004"
  try {
    const res = await fetch(`${baseUrl}/api/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login: login.trim() }),
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
      body: JSON.stringify({ token: token.trim(), newPass: newPass.trim() }),
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
