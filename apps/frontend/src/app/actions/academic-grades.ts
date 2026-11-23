"use server"

import { fetchFromApi } from "./api"

export interface OnlineTurmaItem {
  id: string
  turma: string
  codTurma: string | null
  disciplina: string
  nomeDisciplina: string
  codDisciplina: string | null
  curso: string | null
  cursoNome: string | null
  cursoInstituicao: string | null
  periodo: string
  modelagem: string
  sourceInstitution: string
  moodleCourseId: string | null
  moodleCourseFullname: string | null
  totalAlunos: number
  totalMatriculados: number
  totalSuspensos: number
  totalCancelados: number
  totalNotasLancadasVa1: number
  totalNotasLancadasVa2: number
  totalNotasLancadasVa3: number
  syncedAt: string
}

export interface ParsedGradeActivityItem {
  nome: string
  status: string
  nota?: string | null
  notaMax?: string | null
  data: string
  fase?: 1 | 2 | 3
}

export interface StudentGradeRowItem {
  matriculaId: string
  turmaId: string
  matricula: string
  nomeAluno: string
  emailAluno: string | null
  cpfAluno: string | null
  statusMatricula: "matriculado" | "suspenso" | "cancelado"
  situacaoLyceum: string | null
  ativoLyceum: string | null
  enrolmentStatusAva: string | null
  bloqueioLancamento: boolean
  notas: {
    va1: number | null
    va1Raw: string | null
    va1Status: "Pendente" | "Lançada"
    va2: number | null
    va2Raw: string | null
    va2Status: "Pendente" | "Lançada"
    va3: number | null
    va3Raw: string | null
    va3Status: "Pendente" | "Lançada"
    mediaFinal: number | null
    mediaRaw: string | null
    itensVa1: ParsedGradeActivityItem[]
    itensVa2: ParsedGradeActivityItem[]
    itensVa3: ParsedGradeActivityItem[]
    statusConsolidacao: "sincronizado" | "pendente" | "divergente"
    divergenciaMotivo: string | null
    lastAvaSyncAt: string | null
  }
}

export async function getOnlineTurmasAction(filters: {
  periodo?: string
  search?: string
  instituicao?: string
  page?: number
  pageSize?: number
} = {}) {
  try {
    const params = new URLSearchParams()
    if (filters.periodo) params.append("periodo", filters.periodo)
    if (filters.search) params.append("search", filters.search)
    if (filters.instituicao) params.append("instituicao", filters.instituicao)
    if (filters.page) params.append("page", String(filters.page))
    if (filters.pageSize) params.append("pageSize", String(filters.pageSize))

    const res = await fetchFromApi(`/api/academic/grades/turmas?${params.toString()}`, {
      method: "GET",
    })
    return { success: true as const, data: res }
  } catch (err: any) {
    return {
      success: false as const,
      error: err?.message || "Erro ao consultar turmas 100% online espelhadas.",
    }
  }
}

export async function getTurmaDetailsAction(turmaId: string) {
  try {
    const res = await fetchFromApi(`/api/academic/grades/turmas/${encodeURIComponent(turmaId)}`, {
      method: "GET",
    })
    return { success: true as const, data: res as OnlineTurmaItem }
  } catch (err: any) {
    return {
      success: false as const,
      error: err?.message || "Erro ao consultar detalhes da turma online.",
    }
  }
}

export async function getTurmaGradesWithStudentsAction(
  turmaId: string,
  filters: {
    statusMatricula?: string
    statusNota?: string
    search?: string
    page?: number
    pageSize?: number
  } = {},
) {
  try {
    const params = new URLSearchParams()
    if (filters.statusMatricula) params.append("statusMatricula", filters.statusMatricula)
    if (filters.statusNota) params.append("statusNota", filters.statusNota)
    if (filters.search) params.append("search", filters.search)
    if (filters.page) params.append("page", String(filters.page))
    if (filters.pageSize) params.append("pageSize", String(filters.pageSize))

    const res = await fetchFromApi(
      `/api/academic/grades/turmas/${encodeURIComponent(turmaId)}/alunos?${params.toString()}`,
      { method: "GET" },
    )
    return { success: true as const, data: res }
  } catch (err: any) {
    return {
      success: false as const,
      error: err?.message || "Erro ao consultar alunos e notas da turma.",
    }
  }
}

export async function getStudentGradesHistoryAction(matricula: string, periodo?: string) {
  try {
    const params = new URLSearchParams()
    if (periodo) params.append("periodo", periodo)
    const qs = params.toString()
    const res = await fetchFromApi(
      `/api/academic/grades/alunos/${encodeURIComponent(matricula)}/notas${qs ? `?${qs}` : ""}`,
      { method: "GET" },
    )
    return { success: true as const, data: res?.data || [] }
  } catch (err: any) {
    return {
      success: false as const,
      error: err?.message || "Erro ao consultar histórico de notas do aluno.",
    }
  }
}

export async function triggerSyncGradesMirrorAction(payload: {
  periodo?: string
  correlateAfter?: boolean
  async?: boolean
} = {}) {
  try {
    const res = await fetchFromApi(`/api/academic/grades/sync-mirror`, {
      method: "POST",
      body: JSON.stringify(payload),
    })
    return { success: true as const, data: res }
  } catch (err: any) {
    return {
      success: false as const,
      error: err?.message || "Erro ao espelhar turmas 100% online e buscar notas.",
    }
  }
}

export async function triggerSyncAvaCorrelateAction(payload: {
  periodo?: string
  turmaId?: string
  async?: boolean
} = {}) {
  try {
    const res = await fetchFromApi(`/api/academic/grades/sync-ava-correlate`, {
      method: "POST",
      body: JSON.stringify(payload),
    })
    return { success: true as const, data: res }
  } catch (err: any) {
    return {
      success: false as const,
      error: err?.message || "Erro ao correlacionar notas com o AVA.",
    }
  }
}

export async function exportAcademicGradesAction(filters: {
  periodo?: string
  instituicao?: string
  turmaId?: string
  statusMatricula?: string
  search?: string
} = {}) {
  try {
    const params = new URLSearchParams()
    if (filters.periodo) params.append("periodo", filters.periodo)
    if (filters.instituicao) params.append("instituicao", filters.instituicao)
    if (filters.turmaId) params.append("turmaId", filters.turmaId)
    if (filters.statusMatricula && filters.statusMatricula !== "todos") {
      params.append("statusMatricula", filters.statusMatricula)
    }
    if (filters.search) params.append("search", filters.search)

    const res = await fetchFromApi(`/api/academic/grades/export?${params.toString()}`, {
      method: "GET",
    })
    return { success: true as const, data: res?.data || [] }
  } catch (err: any) {
    return {
      success: false as const,
      error: err?.message || "Erro ao exportar notas acadêmicas.",
    }
  }
}
