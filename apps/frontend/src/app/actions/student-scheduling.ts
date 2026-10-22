"use server"

import { revalidatePath } from "next/cache"

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }

export interface StudentProfile {
  matricula: string
  nome: string
  email?: string
  telefone?: string
  modalidade: string
  categoria: string
  disciplinas: string[]
  totalDisciplinas: number
}

export interface StudentBooking {
  id: string
  matricula: string
  opcaoId: string
  data: string
  hora: string
  localId: string
  localNome: string
  localEndereco?: string
  localLink?: string
  localTelefone?: string
  status: string
  periodo: string
  protocolo?: string
  disciplinasSnapshot?: string[]
  createdAt: string
}

export interface LocalOption {
  id: string
  nome: string
  endereco: string
  linkLocal?: string
  telefone?: string
  status: boolean
}

export interface StudentFlowData {
  student: StudentProfile
  activeBooking: StudentBooking | null
  locals: LocalOption[]
  periodo: string
}

export interface AvailableSlot {
  id: string
  localId: string
  localNome: string
  data: string
  hora: string
  vagas: number
  status: boolean
}

export async function fetchPublicApi<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const baseUrl =
    process.env.NEXT_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://backend:3004"
  const url = `${baseUrl}${endpoint}`

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      cache: "no-store",
    })

    if (!response.ok) {
      const error = await response.json().catch(() => null)
      throw new Error(
        error?.message ||
          error?.error ||
          `Erro HTTP ${response.status} ao comunicar com o servidor.`
      )
    }

    return (await response.json()) as T
  } catch (error: any) {
    console.error(`[Public API Fetch Error] ${url}:`, error?.message)
    throw new Error(
      error?.message === "fetch failed"
        ? "Não foi possível conectar ao servidor de agendamento. Tente novamente em instantes."
        : error?.message || "Erro de conexão com o servidor de agendamento."
    )
  }
}

/**
 * Consulta pública de perfil, agendamento ativo e polos do estudante.
 */
export async function getPublicStudentFlow(
  matricula: string,
  periodo?: string
): Promise<ActionResult<StudentFlowData>> {
  try {
    const params = new URLSearchParams()
    params.append("matricula", matricula.trim())
    if (periodo && periodo.trim()) {
      params.append("periodo", periodo.trim())
    }

    const data = await fetchPublicApi<StudentFlowData>(
      `/api/public/scheduling/student-flow?${params.toString()}`,
      { method: "GET" }
    )
    return { success: true, data }
  } catch (err: any) {
    return {
      success: false,
      error:
        err?.message ||
        "Não foi possível localizar as informações para a matrícula informada.",
    }
  }
}

/**
 * Consulta horários futuros com vagas disponíveis para o polo.
 */
export async function getPublicAvailableSlots(
  localId: string,
  periodo?: string
): Promise<AvailableSlot[]> {
  try {
    const params = new URLSearchParams()
    params.append("localId", localId)
    if (periodo && periodo.trim()) {
      params.append("periodo", periodo.trim())
    }

    const res = await fetchPublicApi<AvailableSlot[]>(
      `/api/public/scheduling/available-slots?${params.toString()}`,
      { method: "GET" }
    )
    return Array.isArray(res) ? res : []
  } catch (err: any) {
    console.error("[getPublicAvailableSlots Error]:", err?.message)
    return []
  }
}

/**
 * Submete a reserva de horário de prova para o aluno.
 */
export async function submitPublicBooking(data: {
  opcaoId: string
  matricula: string
  periodo: string
}): Promise<ActionResult<any>> {
  try {
    const res = await fetchPublicApi("/api/public/scheduling/book", {
      method: "POST",
      body: JSON.stringify(data),
    })
    revalidatePath("/agendamento")
    revalidatePath("/nexus/agendamento")
    return { success: true, data: res }
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Não foi possível confirmar o agendamento.",
    }
  }
}

/**
 * Cancela o agendamento ativo do estudante e libera a vaga.
 */
export async function cancelPublicBooking(
  bookingId: string,
  matricula: string
): Promise<ActionResult<any>> {
  try {
    const res = await fetchPublicApi("/api/public/scheduling/cancel", {
      method: "POST",
      body: JSON.stringify({ bookingId, matricula }),
    })
    revalidatePath("/agendamento")
    revalidatePath("/nexus/agendamento")
    return { success: true, data: res }
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Não foi possível cancelar o agendamento.",
    }
  }
}

/**
 * Remarca o agendamento do estudante (cancela o anterior e reserva novo horário).
 */
export async function reschedulePublicBooking(data: {
  bookingId: string
  matricula: string
  newOpcaoId: string
  periodo: string
}): Promise<ActionResult<any>> {
  try {
    const res = await fetchPublicApi("/api/public/scheduling/reschedule", {
      method: "POST",
      body: JSON.stringify(data),
    })
    revalidatePath("/agendamento")
    revalidatePath("/nexus/agendamento")
    return { success: true, data: res }
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Não foi possível remarcar o agendamento.",
    }
  }
}
