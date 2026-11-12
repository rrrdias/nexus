"use server"

import { fetchFromApi } from "./api"

export interface TutoriaEngagementFilters {
  periodo?: string
  disciplinaId?: string
  disciplinaCodigo?: string
  grupoRisco?: 'critico' | 'atencao' | 'procrastinacao' | 'autonomo'
  search?: string
  faixaTempo?: string
  recenciaAcesso?: 'todos' | 'mais_7_dias' | 'mais_14_dias' | 'mais_30_dias' | 'sem_acesso'
  statusKanban?: string
  page?: number
  limit?: number
}

export async function getTutoriaDashboardSummary(periodo = '2026-2', institution = 'ead') {
  try {
    return await fetchFromApi(`/api/tutoria/summary?periodo=${periodo}&institution=${institution}`, {
      method: 'GET',
      cache: 'no-store',
    })
  } catch (err: any) {
    console.error("[getTutoriaDashboardSummary] Erro:", err?.message)
    return {
      success: false,
      error: err?.message,
      totalAlunos: 0,
      criticos: 0,
      atencao: 0,
      procrastinacao: 0,
      autonomos: 0,
    }
  }
}

export async function getTutoriaEngagementList(filters: TutoriaEngagementFilters) {
  try {
    const query = new URLSearchParams()
    if (filters.periodo) query.set('periodo', filters.periodo)
    if (filters.disciplinaId) query.set('disciplinaId', filters.disciplinaId)
    if (filters.disciplinaCodigo) query.set('disciplinaCodigo', filters.disciplinaCodigo)
    if (filters.grupoRisco) query.set('grupoRisco', filters.grupoRisco)
    if (filters.search) query.set('search', filters.search)
    if (filters.faixaTempo && filters.faixaTempo !== 'todos') query.set('faixaTempo', filters.faixaTempo)
    if (filters.recenciaAcesso && filters.recenciaAcesso !== 'todos') query.set('recenciaAcesso', filters.recenciaAcesso)
    if (filters.statusKanban && filters.statusKanban !== 'todos') query.set('statusKanban', filters.statusKanban)
    if (filters.page) query.set('page', String(filters.page))
    if (filters.limit) query.set('limit', String(filters.limit))

    return await fetchFromApi(`/api/tutoria/engajamento?${query.toString()}`, {
      method: 'GET',
      cache: 'no-store',
    })
  } catch (err: any) {
    console.error("[getTutoriaEngagementList] Erro:", err?.message)
    return {
      success: false,
      error: err?.message,
      data: [],
      pagination: { total: 0, page: 1, limit: 15, totalPages: 1 },
    }
  }
}

export async function getTutoriaDisciplinas(periodo = '2026-2', institution = 'ead') {
  try {
    const res = await fetchFromApi(`/api/tutoria/disciplinas?periodo=${periodo}&institution=${institution}`, {
      method: 'GET',
      cache: 'no-store',
    })
    return { success: true, data: Array.isArray(res) ? res : res?.data || [] }
  } catch (err: any) {
    console.error("[getTutoriaDisciplinas] Erro:", err?.message)
    return { success: false, data: [], error: err?.message }
  }
}

export async function getTutoriaExportData(filters: TutoriaEngagementFilters) {
  try {
    const query = new URLSearchParams()
    if (filters.periodo) query.set('periodo', filters.periodo)
    if (filters.disciplinaId) query.set('disciplinaId', filters.disciplinaId)
    if (filters.disciplinaCodigo) query.set('disciplinaCodigo', filters.disciplinaCodigo)
    if (filters.grupoRisco) query.set('grupoRisco', filters.grupoRisco)
    if (filters.search) query.set('search', filters.search)
    if (filters.faixaTempo && filters.faixaTempo !== 'todos') query.set('faixaTempo', filters.faixaTempo)
    if (filters.recenciaAcesso && filters.recenciaAcesso !== 'todos') query.set('recenciaAcesso', filters.recenciaAcesso)
    if (filters.statusKanban && filters.statusKanban !== 'todos') query.set('statusKanban', filters.statusKanban)

    return await fetchFromApi(`/api/tutoria/exportar?${query.toString()}`, {
      method: 'GET',
      cache: 'no-store',
    })
  } catch (err: any) {
    console.error("[getTutoriaExportData] Erro:", err?.message)
    return []
  }
}

export async function getTutoriaStudentLogs(matricula: string, disciplinaId?: string) {
  try {
    const query = disciplinaId ? `?disciplinaId=${disciplinaId}` : ''
    return await fetchFromApi(`/api/tutoria/aluno/${encodeURIComponent(matricula.trim())}/logs${query}`, {
      method: 'GET',
      cache: 'no-store',
    })
  } catch (err: any) {
    console.error("[getTutoriaStudentLogs] Erro:", err?.message)
    return { logs: [], discente: null, kanban: null, error: err?.message }
  }
}

export async function lookupTutoriaDiscente(matricula: string, periodo = '2026-2', institution = 'ead') {
  try {
    const query = new URLSearchParams({ periodo, institution })
    return await fetchFromApi(
      `/api/tutoria/aluno/${encodeURIComponent(matricula.trim())}/lookup?${query.toString()}`,
      {
        method: 'GET',
        cache: 'no-store',
      },
    )
  } catch (err: any) {
    console.error("[lookupTutoriaDiscente] Erro:", err?.message)
    return { found: false, error: err?.message }
  }
}

export async function getTutoriaSyncStatus() {
  try {
    return await fetchFromApi('/api/tutoria/sync/status', {
      method: 'GET',
    })
  } catch (err: any) {
    console.error("[getTutoriaSyncStatus] Erro:", err?.message)
    return { isSyncing: false, error: err?.message }
  }
}

export async function triggerTutoriaManualSync(institution = 'ead') {
  try {
    return await fetchFromApi('/api/tutoria/sync', {
      method: 'POST',
      body: JSON.stringify({ institution }),
    })
  } catch (err: any) {
    console.error("[triggerTutoriaManualSync] Erro:", err?.message)
    return { success: false, error: err?.message }
  }
}

export interface TutoriaKanbanFilters {
  periodo?: string
  institution?: string
  disciplinaCodigo?: string
  statusKanban?: string
  grupoRisco?: string
  search?: string
}

export interface CreateKanbanCardInput {
  periodo: string
  institution?: string
  matricula: string
  alunoNome?: string
  alunoEmail?: string
  disciplinaCodigo?: string
  disciplinaNome?: string
  statusKanban?: string
  observacoes?: string
  canalContatoUtilizado?: string
}

export interface UpdateKanbanCardInput {
  statusKanban?: string
  observacoes?: string
  canalContatoUtilizado?: string
  ultimoContatoEm?: string
  dataResolucao?: string
}

export async function getTutoriaKanbanCards(filters: TutoriaKanbanFilters = {}) {
  try {
    const query = new URLSearchParams()
    if (filters.periodo) query.set('periodo', filters.periodo)
    if (filters.institution) query.set('institution', filters.institution)
    if (filters.disciplinaCodigo && filters.disciplinaCodigo !== 'todas')
      query.set('disciplinaCodigo', filters.disciplinaCodigo)
    if (filters.statusKanban && filters.statusKanban !== 'todos')
      query.set('statusKanban', filters.statusKanban)
    if (filters.grupoRisco && filters.grupoRisco !== 'todos')
      query.set('grupoRisco', filters.grupoRisco)
    if (filters.search) query.set('search', filters.search)

    const res = await fetchFromApi(`/api/tutoria/kanban?${query.toString()}`, {
      method: 'GET',
      cache: 'no-store',
    })
    return { success: true, ...res }
  } catch (err: any) {
    console.error("[getTutoriaKanbanCards] Erro:", err?.message)
    return {
      success: false,
      error: err?.message || 'Erro ao buscar cartões do Kanban.',
      cards: [],
      summary: { total: 0 },
    }
  }
}

export async function createTutoriaKanbanCard(data: CreateKanbanCardInput) {
  try {
    const res = await fetchFromApi('/api/tutoria/kanban', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    return { success: true, ...res }
  } catch (err: any) {
    console.error("[createTutoriaKanbanCard] Erro:", err?.message)
    return {
      success: false,
      error: err?.message || 'Erro ao cadastrar atendimento.',
    }
  }
}

export async function updateTutoriaKanbanCard(
  id: string,
  data: UpdateKanbanCardInput,
) {
  try {
    const res = await fetchFromApi(`/api/tutoria/kanban/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
    return { success: true, ...res }
  } catch (err: any) {
    console.error("[updateTutoriaKanbanCard] Erro:", err?.message)
    return {
      success: false,
      error: err?.message || 'Erro ao atualizar atendimento.',
    }
  }
}

export async function deleteTutoriaKanbanCard(id: string) {
  try {
    const res = await fetchFromApi(`/api/tutoria/kanban/${id}`, {
      method: 'DELETE',
    })
    return { success: true, ...res }
  } catch (err: any) {
    console.error("[deleteTutoriaKanbanCard] Erro:", err?.message)
    return {
      success: false,
      error: err?.message || 'Erro ao excluir atendimento.',
    }
  }
}

// ============================================================================
// Multi-Tutor Hybrid Attendance & Audit Trail Server Actions (Milestones M2-M4)
// ============================================================================

export type TutoriaTipoEvento =
  | 'abertura'
  | 'mudanca_status'
  | 'contato_enviado'
  | 'intervencao_manual'
  | 'passagem_bastao'
  | 'finalizacao'
  | 'reabertura'

export type TutoriaCanalContato =
  | 'whatsapp'
  | 'email'
  | 'telefone'
  | 'ava'
  | 'outro'

export interface TimelineEvent {
  id: string
  atendimentoId?: string | null
  matricula: string
  periodo?: string
  sourceInstitution?: string
  tipoEvento: TutoriaTipoEvento
  autorId?: string | null
  autorNome: string
  tutorResponsavelAnteriorId?: string | null
  tutorResponsavelNovoId?: string | null
  estadoAnterior?: string | null
  estadoNovo?: string | null
  canalContato?: TutoriaCanalContato | null
  observacoes?: string | null
  metadata?: any
  createdAt: string
}

export interface ActiveTutor {
  id: string
  name: string
  email: string
}

export type TutorResponsavel = ActiveTutor

export interface CreateInterventionInput {
  matricula: string
  atendimentoId?: string | null
  periodo?: string | null
  tipoEvento:
    | 'intervencao_manual'
    | 'contato_enviado'
    | 'abertura'
    | 'mudanca_status'
    | 'passagem_bastao'
    | 'finalizacao'
    | 'reabertura'
  canalContato?: TutoriaCanalContato | null
  observacoes: string
  statusKanban?: string | null
  metadata?: any
}

export type CreateTutoriaIntervencaoInput = CreateInterventionInput

export interface TransferirTutoriaBastaoInput {
  novoTutorId: string
  notaTransicao: string
}

/**
 * Consulta a linha do tempo cronológica consolidada de intervenções e eventos de um discente.
 * Rota backend: GET /api/tutoria/aluno/:matricula/timeline(?atendimentoId=...)
 */
export async function getTutoriaTimeline(
  matricula: string,
  atendimentoId?: string,
): Promise<{
  success: boolean
  data: TimelineEvent[]
  events: TimelineEvent[]
  error?: string
}> {
  if (!matricula || matricula.trim().length === 0) {
    return {
      success: false,
      data: [],
      events: [],
      error: "Matrícula é obrigatória.",
    }
  }

  try {
    const query = atendimentoId ? `?atendimentoId=${encodeURIComponent(atendimentoId.trim())}` : ""
    const res = await fetchFromApi<TimelineEvent[] | { events?: TimelineEvent[]; data?: TimelineEvent[] }>(
      `/api/tutoria/aluno/${encodeURIComponent(matricula.trim())}/timeline${query}`,
      {
        method: "GET",
        cache: "no-store",
      },
    )
    const events: TimelineEvent[] = Array.isArray(res) ? res : res?.events || res?.data || []
    return {
      success: true,
      data: events,
      events,
    }
  } catch (err: any) {
    console.error("[getTutoriaTimeline] Erro:", err?.message)
    return {
      success: false,
      data: [],
      events: [],
      error: err?.message || "Erro ao carregar histórico.",
    }
  }
}

/**
 * Registra intervenções pedagógicas ou tentativas/envios de contato na trilha de auditoria.
 * Rota backend: POST /api/tutoria/intervencoes
 */
export async function createTutoriaIntervention(
  data: CreateInterventionInput,
): Promise<{
  success: boolean
  data?: TimelineEvent
  id?: string
  error?: string
}> {
  if (!data.matricula || data.matricula.trim().length === 0) {
    return {
      success: false,
      error: "Matrícula é obrigatória.",
    }
  }

  if (!data.observacoes || data.observacoes.trim().length === 0) {
    return {
      success: false,
      error: "Observações são obrigatórias para registrar intervenção.",
    }
  }

  try {
    const payload = {
      ...data,
      matricula: data.matricula.trim(),
      observacoes: data.observacoes.trim(),
      atendimentoId: data.atendimentoId?.trim() || undefined,
      periodo: data.periodo?.trim() || undefined,
      canalContato: data.canalContato || undefined,
      statusKanban: data.statusKanban || undefined,
    }

    const res = await fetchFromApi<TimelineEvent>('/api/tutoria/intervencoes', {
      method: 'POST',
      body: JSON.stringify(payload),
    })

    return {
      success: true,
      data: res,
      id: res?.id,
      ...(typeof res === 'object' && res !== null ? res : {}),
    }
  } catch (err: any) {
    console.error("[createTutoriaIntervention] Erro:", err?.message)
    return {
      success: false,
      error: err?.message || "Erro ao registrar intervenção.",
    }
  }
}

// Alias para compatibilidade total com chamadas existentes
export const createTutoriaIntervencao = createTutoriaIntervention

/**
 * Realiza a transferência formal de titularidade principal de atendimento (passagem de bastão).
 * Rota backend: POST /api/tutoria/kanban/:id/transferir
 */
export async function transferirTutoriaBastao(
  id: string,
  data: TransferirTutoriaBastaoInput,
): Promise<{
  success: boolean
  card?: any
  evento?: any
  message?: string
  error?: string
}> {
  if (!id || id.trim().length === 0) {
    return {
      success: false,
      error: "ID do atendimento é obrigatório.",
    }
  }

  if (!data.novoTutorId || data.novoTutorId.trim().length === 0) {
    return {
      success: false,
      error: "Selecione o novo tutor responsável.",
    }
  }

  if (!data.notaTransicao || data.notaTransicao.trim().length < 5) {
    return {
      success: false,
      error: "Nota de transição é obrigatória (mínimo 5 caracteres).",
    }
  }

  try {
    const res = await fetchFromApi(`/api/tutoria/kanban/${encodeURIComponent(id.trim())}/transferir`, {
      method: 'POST',
      body: JSON.stringify({
        novoTutorId: data.novoTutorId.trim(),
        notaTransicao: data.notaTransicao.trim(),
      }),
    })
    return {
      success: true,
      ...(typeof res === 'object' && res !== null ? res : {}),
    }
  } catch (err: any) {
    console.error("[transferirTutoriaBastao] Erro:", err?.message)
    return {
      success: false,
      error: err?.message || "Erro ao transferir atendimento.",
    }
  }
}

export const transferirAtendimento = transferirTutoriaBastao
export const transferirAtendimentoAction = transferirTutoriaBastao

/**
 * Consulta a lista de tutores ativos no sistema para seleção em dropdowns e passagens de bastão.
 * Rota backend: GET /api/tutoria/tutores
 */
export async function getTutoriaTutores(): Promise<{
  success: boolean
  data: ActiveTutor[]
  tutores: ActiveTutor[]
  error?: string
}> {
  try {
    const res = await fetchFromApi<ActiveTutor[] | { tutores?: ActiveTutor[]; data?: ActiveTutor[] }>(
      '/api/tutoria/tutores',
      {
        method: 'GET',
        cache: 'no-store',
      },
    )
    const tutores: ActiveTutor[] = Array.isArray(res) ? res : res?.tutores || res?.data || []
    return {
      success: true,
      data: tutores,
      tutores,
    }
  } catch (err: any) {
    console.error("[getTutoriaTutores] Erro:", err?.message)
    return {
      success: false,
      data: [],
      tutores: [],
      error: err?.message || "Erro ao buscar tutores.",
    }
  }
}

// Alias para compatibilidade total com chamadas existentes
export const getTutoresAtivos = getTutoriaTutores

export interface SendTutoriaEmailPayload {
  matricula: string
  alunoEmail: string
  alunoNome?: string
  disciplinaNome?: string
  mensagem: string
  periodo?: string
  cardId?: string
}

/**
 * Dispara e-mail oficial de orientação pedagógica ao aluno e registra intervenção na linha do tempo.
 * Rota backend: POST /api/tutoria/enviar-email
 */
export async function sendTutoriaEmailAction(payload: SendTutoriaEmailPayload) {
  try {
    return await fetchFromApi<{
      success: boolean
      messageId?: string
      eventoId?: string
      cardId?: string
      message?: string
      error?: string
    }>('/api/tutoria/enviar-email', {
      method: 'POST',
      body: JSON.stringify(payload),
      cache: 'no-store',
    })
  } catch (err: any) {
    console.error('[sendTutoriaEmailAction] Erro:', err?.message)
    return {
      success: false,
      error: err?.message || 'Falha ao enviar e-mail da tutoria.',
    }
  }
}
