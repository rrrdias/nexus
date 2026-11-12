"use client"

import React, { useState } from "react"
import {
  FileText,
  Send,
  MessageCircle,
  Mail,
  Phone,
  BookOpen,
  Sparkles,
  RefreshCw,
  Check,
  AlertTriangle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { createTutoriaIntervention, type TutoriaCanalContato } from "@/app/actions/tutoria"

export interface TutoriaInterventionFormProps {
  matricula: string
  atendimentoId?: string | null
  periodo?: string | null
  currentStatus?: string | null
  onSuccess?: (newEvent?: any) => void
  onCancel?: () => void
  className?: string
}

export function TutoriaInterventionForm({
  matricula,
  atendimentoId,
  periodo = "2026-2",
  currentStatus = "pendente",
  onSuccess,
  onCancel,
  className = "",
}: TutoriaInterventionFormProps) {
  const [tipoEvento, setTipoEvento] = useState<"intervencao_manual" | "contato_enviado">("intervencao_manual")
  const [canalContato, setCanalContato] = useState<TutoriaCanalContato>("whatsapp")
  const [observacoes, setObservacoes] = useState("")
  const [updateKanban, setUpdateKanban] = useState(false)
  const [statusKanban, setStatusKanban] = useState(currentStatus || "em_contato")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    const trimmed = observacoes.trim()
    if (trimmed.length < 5) {
      setFormError("Informe as observações da intervenção (mínimo de 5 caracteres).")
      return
    }

    setIsSubmitting(true)
    try {
      const res = await createTutoriaIntervention({
        matricula,
        atendimentoId: atendimentoId || undefined,
        periodo: periodo || undefined,
        tipoEvento,
        canalContato: tipoEvento === "contato_enviado" ? canalContato : undefined,
        observacoes: trimmed,
        statusKanban: updateKanban ? statusKanban : undefined,
      })

      if (!res.success) {
        setFormError(res.error || "Erro ao registrar intervenção.")
        return
      }

      setObservacoes("")
      setFormSuccess(true)
      setTimeout(() => setFormSuccess(false), 3000)

      if (onSuccess) {
        onSuccess(res.data)
      }
    } catch (err: any) {
      setFormError(err?.message || "Falha na comunicação ao registrar intervenção.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={`space-y-4 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-800 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-600" />
          Registrar Intervenção Pedagógica
        </h4>
        <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-gray-200">
          <button
            type="button"
            onClick={() => setTipoEvento("intervencao_manual")}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
              tipoEvento === "intervencao_manual"
                ? "bg-indigo-600 text-white shadow-2xs"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Anotação Interna
          </button>
          <button
            type="button"
            onClick={() => setTipoEvento("contato_enviado")}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
              tipoEvento === "contato_enviado"
                ? "bg-emerald-600 text-white shadow-2xs"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            Contato Realizado
          </button>
        </div>
      </div>

      {/* Seletor de Canal (exibido quando contato_enviado) */}
      {tipoEvento === "contato_enviado" && (
        <div className="space-y-1.5 pt-1">
          <label className="text-[11px] font-semibold text-gray-600 block">Canal utilizado para contato:</label>
          <div className="flex flex-wrap items-center gap-2">
            {[
              {
                id: "whatsapp",
                label: "WhatsApp",
                icon: MessageCircle,
                color: "text-emerald-700 bg-emerald-50 border-emerald-300",
              },
              {
                id: "email",
                label: "E-mail",
                icon: Mail,
                color: "text-blue-700 bg-blue-50 border-blue-300",
              },
              {
                id: "telefone",
                label: "Telefone",
                icon: Phone,
                color: "text-amber-700 bg-amber-50 border-amber-300",
              },
              {
                id: "ava",
                label: "AVA / Mensagem",
                icon: BookOpen,
                color: "text-purple-700 bg-purple-50 border-purple-300",
              },
              {
                id: "outro",
                label: "Outro",
                icon: Sparkles,
                color: "text-gray-700 bg-gray-50 border-gray-300",
              },
            ].map((c) => {
              const Icon = c.icon
              const isSelected = canalContato === c.id
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCanalContato(c.id as TutoriaCanalContato)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium border flex items-center gap-1.5 transition-all cursor-pointer ${
                    isSelected
                      ? `${c.color} ring-2 ring-indigo-400 font-semibold shadow-2xs`
                      : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {c.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Textarea de Observações */}
      <div className="space-y-1">
        <Textarea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          rows={3}
          placeholder={
            tipoEvento === "intervencao_manual"
              ? "Descreva o diagnóstico pedagógico, dificuldades reportadas pelo aluno ou alinhamentos realizados..."
              : "Descreva a abordagem de contato realizada, retorno do estudante ou próximos passos acordados..."
          }
          className="text-xs bg-white resize-none"
        />
        <div className="flex items-center justify-between text-[11px] text-gray-400">
          <span>Mínimo 5 caracteres</span>
          <span>{observacoes.trim().length} caracteres</span>
        </div>
      </div>

      {/* Atualização Opcional do Kanban */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-2.5 bg-white rounded-lg border border-gray-200 text-xs">
        <label className="flex items-center gap-2 cursor-pointer font-medium text-gray-700">
          <input
            type="checkbox"
            checked={updateKanban}
            onChange={(e) => setUpdateKanban(e.target.checked)}
            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
          />
          <span>Atualizar etapa do discente no Kanban</span>
        </label>

        {updateKanban && (
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500 text-[11px]">Nova etapa:</span>
            <select
              value={statusKanban}
              onChange={(e) => setStatusKanban(e.target.value)}
              className="text-xs font-semibold py-1 px-2 rounded-md border border-gray-300 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="pendente">A Contatar (Pendente)</option>
              <option value="em_contato">Em Contato</option>
              <option value="em_recuperacao">Em Acompanhamento</option>
              <option value="revertido">Regularizado</option>
            </select>
          </div>
        )}
      </div>

      {/* Alerta de Erro */}
      {formError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      {/* Alerta de Sucesso */}
      {formSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Intervenção registrada com sucesso na linha do tempo!</span>
        </div>
      )}

      {/* Botões de Ação */}
      <div className="flex items-center justify-end gap-2 pt-1">
        {onCancel && (
          <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={isSubmitting}>
            Cancelar
          </Button>
        )}
        <Button
          type="submit"
          size="sm"
          disabled={isSubmitting || observacoes.trim().length < 5}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold gap-1.5 cursor-pointer shadow-xs"
        >
          {isSubmitting ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Gravando...
            </>
          ) : (
            <>
              <Check className="w-3.5 h-3.5" />
              Salvar na Linha do Tempo
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
