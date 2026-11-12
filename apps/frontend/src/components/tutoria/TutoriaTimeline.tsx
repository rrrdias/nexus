"use client"

import React from "react"
import {
  Clock,
  PlusCircle,
  ArrowRight,
  Send,
  MessageCircle,
  Phone,
  Mail,
  FileText,
  Users,
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
  BookOpen,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import type { TimelineEvent } from "@/app/actions/tutoria"

export interface TutoriaTimelineProps {
  events: TimelineEvent[]
  sessionUser?: {
    id?: string
    name?: string
    email?: string
    isSuperAdmin?: boolean
  }
  currentTutorId?: string | null
  isLoading?: boolean
  error?: string | null
  onRefresh?: () => void
  emptyMessage?: string
  className?: string
}

const formatAbsoluteDateTime = (dateStr: string) => {
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return d
      .toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
      .replace(",", " às")
  } catch {
    return dateStr
  }
}

const formatRelativeTime = (dateStr: string) => {
  try {
    const d = new Date(dateStr)
    const diffMs = Date.now() - d.getTime()
    if (isNaN(diffMs) || diffMs < 0) return "agora há pouco"
    const diffSec = Math.floor(diffMs / 1000)
    if (diffSec < 60) return "agora há pouco"
    const diffMin = Math.floor(diffSec / 60)
    if (diffMin < 60) return `há ${diffMin} min`
    const diffHours = Math.floor(diffMin / 60)
    if (diffHours < 24) return `há ${diffHours} h`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays === 1) return "ontem"
    if (diffDays < 7) return `há ${diffDays} dias`
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
  } catch {
    return ""
  }
}

const getEventConfig = (tipoEvento: string, canalContato?: string | null) => {
  switch (tipoEvento) {
    case "abertura":
      return {
        label: "Abertura de Atendimento",
        icon: PlusCircle,
        nodeClass: "bg-blue-100 text-blue-700 ring-white",
        badgeClass: "bg-blue-50 text-blue-800 border-blue-200",
      }
    case "mudanca_status":
      return {
        label: "Mudança de Etapa",
        icon: ArrowRight,
        nodeClass: "bg-purple-100 text-purple-700 ring-white",
        badgeClass: "bg-purple-50 text-purple-800 border-purple-200",
      }
    case "contato_enviado": {
      let icon = Send
      if (canalContato === "whatsapp") icon = MessageCircle
      else if (canalContato === "email") icon = Mail
      else if (canalContato === "telefone") icon = Phone
      else if (canalContato === "ava") icon = BookOpen
      return {
        label: "Contato Enviado",
        icon,
        nodeClass: "bg-emerald-100 text-emerald-700 ring-white",
        badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
      }
    }
    case "intervencao_manual":
      return {
        label: "Intervenção Pedagógica",
        icon: FileText,
        nodeClass: "bg-indigo-100 text-indigo-700 ring-white",
        badgeClass: "bg-indigo-50 text-indigo-800 border-indigo-200",
      }
    case "passagem_bastao":
      return {
        label: "Transferência de Atendimento",
        icon: Users,
        nodeClass: "bg-amber-100 text-amber-700 ring-white",
        badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
      }
    case "finalizacao":
      return {
        label: "Atendimento Regularizado",
        icon: CheckCircle2,
        nodeClass: "bg-teal-100 text-teal-700 ring-white",
        badgeClass: "bg-teal-50 text-teal-800 border-teal-200",
      }
    case "reabertura":
      return {
        label: "Atendimento Reaberto",
        icon: RefreshCw,
        nodeClass: "bg-slate-200 text-slate-700 ring-white",
        badgeClass: "bg-slate-100 text-slate-800 border-slate-300",
      }
    default:
      return {
        label: tipoEvento || "Evento",
        icon: Clock,
        nodeClass: "bg-gray-100 text-gray-700 ring-white",
        badgeClass: "bg-gray-50 text-gray-700 border-gray-200",
      }
  }
}

export function TutoriaTimeline({
  events,
  sessionUser,
  currentTutorId,
  isLoading = false,
  error = null,
  onRefresh,
  emptyMessage = "Nenhum histórico registrado para este estudante.",
  className = "",
}: TutoriaTimelineProps) {
  // Ordenação cronológica: mais recente no topo para visualização rápida da última atividade
  const sortedEvents = [...events].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header da Timeline */}
      <div className="flex items-center justify-between pb-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-600" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-800">
            Linha do Tempo de Atendimentos & Auditoria
          </h4>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
            {events.length}
          </span>
        </div>

        {onRefresh && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
            className="h-8 px-2.5 text-xs text-gray-600 hover:text-indigo-600 cursor-pointer gap-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        )}
      </div>

      {/* Estado de Erro */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="text-xs font-semibold text-red-800 underline hover:no-underline cursor-pointer"
            >
              Tentar novamente
            </button>
          )}
        </div>
      )}

      {/* Estado Carregando (Skeletons) */}
      {isLoading && events.length === 0 && (
        <div className="space-y-4 py-2">
          {[1, 2, 3].map((n) => (
            <div key={n} className="flex items-start gap-3 animate-pulse">
              <div className="w-7 h-7 rounded-full bg-gray-200 shrink-0 mt-1" />
              <div className="flex-1 space-y-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
                <div className="h-3.5 bg-gray-200 rounded w-1/3" />
                <div className="h-3 bg-gray-100 rounded w-full" />
                <div className="h-3 bg-gray-100 rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Estado Vazio */}
      {!isLoading && !error && sortedEvents.length === 0 && (
        <div className="py-10 text-center bg-gray-50/70 rounded-xl border border-dashed border-gray-200 p-6 space-y-2">
          <Clock className="w-8 h-8 text-gray-300 mx-auto" />
          <p className="text-xs font-semibold text-gray-600">{emptyMessage}</p>
          <p className="text-[11px] text-gray-400 max-w-sm mx-auto">
            Utilize o formulário acima para registrar uma anotação pedagógica ou registrar um contato realizado.
          </p>
        </div>
      )}

      {/* Lista da Timeline Vertical com linha conectora */}
      {!isLoading && sortedEvents.length > 0 && (
        <div className="relative pl-6 sm:pl-8 space-y-5 pt-1">
          {/* Linha vertical conectora */}
          <div className="absolute top-3 bottom-3 left-3 sm:left-4 -ml-px w-0.5 bg-indigo-100" />

          {sortedEvents.map((event) => {
            const config = getEventConfig(event.tipoEvento, event.canalContato)
            const Icon = config.icon

            const isAuthorMe = !!sessionUser?.id && event.autorId === sessionUser.id
            const isAuthorPrimary = !isAuthorMe && !!currentTutorId && event.autorId === currentTutorId

            return (
              <div key={event.id} className="relative group flex items-start gap-3">
                {/* Nó/Ícone da timeline posicionado sobre a linha */}
                <span
                  className={`absolute -left-6 sm:-left-8 top-1.5 w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center ring-4 shadow-2xs shrink-0 transition-transform group-hover:scale-105 ${config.nodeClass}`}
                  title={config.label}
                >
                  <Icon className="w-3.5 h-3.5" />
                </span>

                {/* Conteúdo do Card de Evento */}
                <div className="flex-1 bg-white p-3.5 sm:p-4 rounded-xl border border-gray-200/90 shadow-2xs hover:border-indigo-200 transition-colors space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${config.badgeClass}`}
                      >
                        {config.label}
                      </span>

                      {/* Tag do Autor */}
                      {isAuthorMe ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                          Você
                        </span>
                      ) : isAuthorPrimary ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                          Tutor Titular
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-700 border border-gray-200">
                          Tutor Colaborador
                        </span>
                      )}

                      <span className="text-xs font-semibold text-gray-800">
                        {event.autorNome || "Tutor"}
                      </span>
                    </div>

                    {/* Data/Hora: Relativo + Absoluto */}
                    <div
                      className="flex items-center gap-1.5 text-[11px] text-gray-400 font-mono"
                      title={formatAbsoluteDateTime(event.createdAt)}
                    >
                      <Clock className="w-3 h-3 text-gray-400" />
                      <span className="font-semibold text-gray-600">
                        {formatRelativeTime(event.createdAt)}
                      </span>
                      <span className="hidden sm:inline text-gray-400">
                        ({formatAbsoluteDateTime(event.createdAt)})
                      </span>
                    </div>
                  </div>

                  {/* Informação contextual de transição de etapa */}
                  {event.tipoEvento === "mudanca_status" &&
                    (event.estadoAnterior || event.estadoNovo) && (
                      <div className="flex items-center gap-2 text-xs font-medium text-gray-600 bg-purple-50/60 p-2 rounded-lg border border-purple-100">
                        <span className="capitalize">{event.estadoAnterior || "Sem status"}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-purple-600" />
                        <strong className="capitalize text-purple-900">{event.estadoNovo}</strong>
                      </div>
                    )}

                  {/* Informação de canal quando contato_enviado */}
                  {event.tipoEvento === "contato_enviado" && event.canalContato && (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-800">
                      <span className="font-medium text-gray-500">Canal:</span>
                      <strong className="capitalize bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {event.canalContato}
                      </strong>
                    </div>
                  )}

                  {/* Informação contextual de transferência de atendimento */}
                  {event.tipoEvento === "passagem_bastao" &&
                    (event.tutorResponsavelAnteriorId || event.tutorResponsavelNovoId) && (
                      <div className="flex items-center gap-2 text-xs font-medium text-amber-900 bg-amber-50/60 p-2 rounded-lg border border-amber-100">
                        <Users className="w-3.5 h-3.5 text-amber-700" />
                        <span>Atendimento transferido para outro tutor</span>
                      </div>
                    )}

                  {/* Observações / Notas do Evento */}
                  {event.observacoes && (
                    <div className="text-xs text-gray-700 bg-gray-50/80 p-2.5 rounded-lg border border-gray-100 leading-relaxed whitespace-pre-wrap font-sans">
                      {event.observacoes}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
