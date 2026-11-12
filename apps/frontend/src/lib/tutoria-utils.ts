/**
 * apps/frontend/src/lib/tutoria-utils.ts
 * Utility functions for Multi-Tutor Hybrid Attendance, Timeline and Presentation.
 */

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
  tipoEvento: TutoriaTipoEvento
  autorId: string
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

/**
 * Converte data ISO-8601 para formato legível DD/MM/YYYY HH:mm.
 * Retorna 'Data inválida' se a entrada for nula ou não puder ser convertida.
 */
export function formatTimelineEventDate(isoDate: string): string {
  if (!isoDate) return "Data inválida"
  const d = new Date(isoDate)
  if (isNaN(d.getTime())) return "Data inválida"
  const day = String(d.getDate()).padStart(2, "0")
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const year = d.getFullYear()
  const hours = String(d.getHours()).padStart(2, "0")
  const minutes = String(d.getMinutes()).padStart(2, "0")
  return `${day}/${month}/${year} ${hours}:${minutes}`
}

/**
 * Agrupa eventos da timeline em baldes cronológicos ('Hoje', 'Ontem', ou DD/MM/YYYY).
 */
export function groupTimelineEventsByDate(events: TimelineEvent[]): Record<string, TimelineEvent[]> {
  const groups: Record<string, TimelineEvent[]> = {}
  if (!Array.isArray(events) || events.length === 0) return groups

  const now = new Date()
  const todayYear = now.getFullYear()
  const todayMonth = now.getMonth()
  const todayDate = now.getDate()

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const yestYear = yesterday.getFullYear()
  const yestMonth = yesterday.getMonth()
  const yestDate = yesterday.getDate()

  for (const evt of events) {
    if (!evt || !evt.createdAt) continue
    const d = new Date(evt.createdAt)
    if (isNaN(d.getTime())) continue

    const evtYear = d.getFullYear()
    const evtMonth = d.getMonth()
    const evtDate = d.getDate()

    let label: string
    if (evtYear === todayYear && evtMonth === todayMonth && evtDate === todayDate) {
      label = "Hoje"
    } else if (evtYear === yestYear && evtMonth === yestMonth && evtDate === yestDate) {
      label = "Ontem"
    } else {
      label = formatTimelineEventDate(evt.createdAt).split(" ")[0]
    }

    if (!groups[label]) groups[label] = []
    groups[label].push(evt)
  }
  return groups
}

/**
 * Resolve o badge e estilo de autoridade (Tutor Responsável vs Colaborador)
 * para exibição consistente nos cards e timeline.
 */
export function getAuthorBadge(
  event: TimelineEvent,
  currentUserId: string,
  tutorResponsavelId?: string | null,
): {
  label: string
  variant: "lead" | "collab" | "system"
} {
  const isAuthor = event.autorId === currentUserId
  const isLead = Boolean(tutorResponsavelId && event.autorId === tutorResponsavelId)
  const autorNome = event.autorNome || "Tutor"

  if (isLead && isAuthor) {
    return { label: "Você (Tutor Responsável)", variant: "lead" }
  }
  if (isAuthor) {
    return { label: "Você (Colaborador)", variant: "collab" }
  }
  if (isLead) {
    return { label: `Tutor Responsável (${autorNome})`, variant: "lead" }
  }
  return { label: `Colaborador (${autorNome})`, variant: "collab" }
}

/**
 * Validação de dados do modal de passagem de bastão antes do disparo da requisição.
 */
export function validateBatonPassInput(
  novoTutorId: string,
  currentTutorId: string | null | undefined,
  notaTransicao: string,
): {
  valid: boolean
  error?: string
} {
  const trimmedNovoTutor = novoTutorId?.trim() || ""
  if (trimmedNovoTutor.length === 0) {
    return { valid: false, error: "Selecione o novo tutor responsável." }
  }

  const trimmedCurrent = currentTutorId?.trim() || ""
  if (trimmedCurrent.length > 0 && trimmedNovoTutor === trimmedCurrent) {
    return {
      valid: false,
      error: "O novo tutor deve ser diferente do tutor responsável atual.",
    }
  }

  const trimmedNota = notaTransicao?.trim() || ""
  if (trimmedNota.length < 5) {
    return {
      valid: false,
      error: "A nota pedagógica de transição é obrigatória (mínimo de 5 caracteres).",
    }
  }

  return { valid: true }
}

/**
 * Determina os dados e visual do Tutor Titular do card (F10)
 */
export function getLeadTutorInfo(card: any, sessionUser?: any): {
  tutorId: string | null
  tutorName: string | null
  isMe: boolean
  hasTutor: boolean
} {
  const tutorId = card?.tutor_responsavel_id || card?.tutorResponsavelId || null
  const tutorName =
    card?.tutor_nome ||
    card?.tutorResponsavelNome ||
    card?.tutor_responsavel_nome ||
    card?.tutorNome ||
    null

  const isMe = Boolean(
    (tutorId && sessionUser?.id && tutorId === sessionUser.id) ||
    (tutorName && sessionUser?.name && tutorName.trim().toLowerCase() === sessionUser.name.trim().toLowerCase())
  )

  return {
    tutorId,
    tutorName,
    isMe,
    hasTutor: Boolean(tutorId || tutorName),
  }
}

/**
 * Avalia se o atendimento teve intervenção/contato nas últimas 48 horas (F11)
 */
export function checkRecentIntervention(card: any, nowMs = Date.now()): {
  isRecent: boolean
  elapsedHours: number | null
  formattedRelative: string
  interventionCount: number
} {
  if (!card) {
    return { isRecent: false, elapsedHours: null, formattedRelative: "", interventionCount: 0 }
  }

  const count = Number(card.qtd_intervencoes || card.qtdIntervencoes || 0)
  const rawDate =
    card.ultima_intervencao_em ||
    card.ultimaIntervencaoEm ||
    card.ultimo_contato_em ||
    card.ultimoContatoEm ||
    (count > 0 ? card.updatedAt : null)

  if (!rawDate) {
    return { isRecent: false, elapsedHours: null, formattedRelative: "", interventionCount: count }
  }

  const dateObj = new Date(rawDate)
  const timeMs = dateObj.getTime()

  // Data inválida ou epoch 1970
  if (isNaN(timeMs) || timeMs <= 86400000) {
    return { isRecent: false, elapsedHours: null, formattedRelative: "", interventionCount: count }
  }

  const diffMs = nowMs - timeMs

  // Ignora anomalias no futuro distante (> 1 hora)
  if (diffMs < -3600000) {
    return { isRecent: false, elapsedHours: null, formattedRelative: "", interventionCount: count }
  }

  const MAX_48H_MS = 48 * 60 * 60 * 1000
  const isRecent = diffMs >= -300000 && diffMs <= MAX_48H_MS

  if (!isRecent) {
    return {
      isRecent: false,
      elapsedHours: Math.round(diffMs / 3600000),
      formattedRelative: "",
      interventionCount: count,
    }
  }

  const elapsedMinutes = Math.max(0, Math.floor(diffMs / 60000))
  const elapsedHours = Math.floor(elapsedMinutes / 60)

  let formattedRelative = "agora há pouco"
  if (elapsedMinutes >= 60) {
    formattedRelative = `há ${elapsedHours}h`
  } else if (elapsedMinutes >= 1) {
    formattedRelative = `há ${elapsedMinutes}min`
  }

  return {
    isRecent: true,
    elapsedHours,
    formattedRelative,
    interventionCount: count,
  }
}

