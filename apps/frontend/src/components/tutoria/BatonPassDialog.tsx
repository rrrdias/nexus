"use client"

import React, { useState, useEffect, useCallback } from "react"
import {
  ArrowRightLeft,
  UserCheck,
  RefreshCw,
  AlertTriangle,
  Check,
} from "lucide-react"
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  getTutoriaTutores,
  transferirTutoriaBastao,
  type ActiveTutor,
} from "@/app/actions/tutoria"
import { validateBatonPassInput } from "@/lib/tutoria-utils"

export interface BatonPassSuccessResult {
  card?: any
  evento?: any
  novoTutorId: string
  novoTutorNome?: string
  notaTransicao: string
}

export interface BatonPassDialogProps {
  /** Identificador do cartão de atendimento em tutoria_atendimentos_kanban */
  cardId?: string
  /** Matrícula do discente */
  matricula?: string
  /** Nome do discente */
  alunoNome?: string
  /** ID do tutor titular atual (para desabilitar no select) */
  currentTutorId?: string | null
  /** Nome do tutor titular atual */
  currentTutorNome?: string | null
  /** Nome da disciplina para contexto pedagógico */
  disciplinaNome?: string
  /** Elemento customizado de trigger (se utilizado em modo trigger/uncontrolled) */
  trigger?: React.ReactNode
  /** Estado open controlado */
  open?: boolean
  /** Callback ao mudar o estado de abertura */
  onOpenChange?: (open: boolean) => void
  /** Lista pré-carregada de tutores (opcional para evitar fetch redundante) */
  initialTutors?: ActiveTutor[]
  /** Callback executado após transferência bem-sucedida */
  onSuccess?: (result: BatonPassSuccessResult) => void
  /** Callback executado ao cancelar ou fechar sem salvar */
  onCancel?: () => void
  /** Exibir cabeçalho textual próprio (útil em modo standalone) */
  showHeader?: boolean
  /** Classe CSS adicional */
  className?: string
  /** Objeto de card kanban completo para extração automática de propriedades */
  card?: any
}

/**
 * Formulário central de Passagem de Bastão pedagógico.
 * Pode ser renderizado dentro do Dialog ou diretamente em drawers/painéis.
 */
export function BatonPassForm({
  cardId,
  matricula,
  alunoNome,
  currentTutorId,
  currentTutorNome,
  disciplinaNome,
  initialTutors,
  onSuccess,
  onCancel,
  showHeader = true,
  card,
  className = "",
}: BatonPassDialogProps) {
  // Resolução de propriedades diretas com fallback defensivo para objeto card
  const effectiveCardId = cardId || card?.id || ""
  const effectiveMatricula = matricula || card?.matricula || ""
  const effectiveAlunoNome = alunoNome || card?.aluno_nome || card?.alunoNome || "Estudante"
  const effectiveCurrentTutorId =
    currentTutorId !== undefined
      ? currentTutorId
      : (card?.tutor_responsavel_id || card?.tutorResponsavelId || null)
  const effectiveCurrentTutorNome =
    currentTutorNome !== undefined
      ? currentTutorNome
      : (card?.tutor_nome || card?.tutorResponsavelNome || null)
  const effectiveDisciplinaNome =
    disciplinaNome ||
    card?.disciplina_nome ||
    card?.disciplinaNome ||
    card?.disciplina_codigo ||
    ""

  // Estado do formulário
  const [tutores, setTutores] = useState<ActiveTutor[]>(initialTutors || [])
  const [isLoadingTutores, setIsLoadingTutores] = useState(false)
  const [tutoresError, setTutoresError] = useState<string | null>(null)
  const [selectedTutorId, setSelectedTutorId] = useState("")
  const [notaTransicao, setNotaTransicao] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Atualiza lista se initialTutors mudar externamente
  useEffect(() => {
    if (initialTutors && initialTutors.length > 0) {
      setTutores(initialTutors)
    }
  }, [initialTutors])

  // Busca lista de tutores ativos se necessário
  const fetchTutors = useCallback(async () => {
    setIsLoadingTutores(true)
    setTutoresError(null)
    try {
      const res = await getTutoriaTutores()
      if (res && res.success && Array.isArray(res.tutores)) {
        setTutores(res.tutores)
      } else if (res && Array.isArray(res.data)) {
        setTutores(res.data)
      } else {
        setTutoresError(res?.error || "Não foi possível carregar a lista de tutores ativos.")
      }
    } catch (err: any) {
      setTutoresError(err?.message || "Erro ao conectar com serviço de tutores.")
    } finally {
      setIsLoadingTutores(false)
    }
  }, [])

  useEffect(() => {
    if (!initialTutors || initialTutors.length === 0) {
      fetchTutors()
    }
  }, [initialTutors, fetchTutors])

  // Validação dinâmica em tempo de digitação
  const trimmedNote = notaTransicao.trim()
  const noteLength = trimmedNote.length
  const isNoteValid = noteLength >= 5
  const isTutorSelected = Boolean(selectedTutorId && selectedTutorId.trim().length > 0)
  const isSelfTransfer = Boolean(
    selectedTutorId &&
    effectiveCurrentTutorId &&
    selectedTutorId.trim() === effectiveCurrentTutorId.trim()
  )
  const canSubmit =
    !isSubmitting &&
    isTutorSelected &&
    !isSelfTransfer &&
    isNoteValid &&
    Boolean(effectiveCardId)

  // Submissão do bastão
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (isSubmitting) return

    // Validação estrita
    const validation = validateBatonPassInput(
      selectedTutorId,
      effectiveCurrentTutorId,
      notaTransicao
    )
    if (!validation.valid) {
      setSubmitError(validation.error || "Dados inválidos.")
      return
    }

    if (!effectiveCardId) {
      setSubmitError("ID do atendimento é obrigatório.")
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const res = await transferirTutoriaBastao(effectiveCardId, {
        novoTutorId: selectedTutorId.trim(),
        notaTransicao: trimmedNote,
      })

      if (res && res.success) {
        const targetTutor = tutores.find((t) => t.id === selectedTutorId)
        onSuccess?.({
          card: res.card,
          evento: res.evento,
          novoTutorId: selectedTutorId.trim(),
          novoTutorNome: targetTutor?.name,
          notaTransicao: trimmedNote,
        })
      } else {
        setSubmitError(res?.error || "Erro ao transferir atendimento.")
      }
    } catch (err: any) {
      setSubmitError(err?.message || "Erro inesperado ao transferir atendimento.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {showHeader && (
        <div className="flex flex-col gap-1 pb-1">
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-purple-600 shrink-0" />
            Transferência de Atendimento
          </h3>
          <p className="text-xs text-gray-500">
            Transfira a responsabilidade do atendimento para outro tutor com justificativa registrada
            na trilha de auditoria e linha do tempo.
          </p>
        </div>
      )}

      {/* Quadro Resumo do Estudante */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-xs space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="font-bold text-gray-900 truncate">{effectiveAlunoNome}</span>
          <span className="text-[10px] font-mono text-gray-500 shrink-0">
            Matr: {effectiveMatricula}
          </span>
        </div>
        {effectiveDisciplinaNome && (
          <p className="text-[11px] text-purple-700 font-medium truncate">
            {effectiveDisciplinaNome}
          </p>
        )}
        <div className="flex items-center gap-1.5 text-[11px] pt-0.5">
          <span className="text-gray-500">Tutor titular atual:</span>
          {effectiveCurrentTutorNome ? (
            <span className="font-semibold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200 inline-flex items-center gap-1">
              <UserCheck className="w-3 h-3 text-slate-500" />
              {effectiveCurrentTutorNome}
            </span>
          ) : (
            <span className="italic text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 border-dashed">
              Sem tutor atribuído
            </span>
          )}
        </div>
      </div>

      {/* Seletor de Novo Tutor */}
      <div className="space-y-1.5">
        <label htmlFor="novoTutorSelect" className="block text-xs font-semibold text-gray-700">
          Novo Tutor Responsável Titular <span className="text-red-500">*</span>
        </label>
        {isLoadingTutores ? (
          <div className="flex items-center gap-2 text-xs text-gray-500 p-2.5 bg-gray-50 border border-gray-200 rounded-lg">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-600" />
            <span>Carregando tutores ativos...</span>
          </div>
        ) : tutoresError ? (
          <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center justify-between">
            <span>{tutoresError}</span>
            <button
              type="button"
              onClick={fetchTutors}
              className="text-xs font-semibold underline text-red-800 hover:text-red-900 cursor-pointer"
            >
              Tentar novamente
            </button>
          </div>
        ) : (
          <select
            id="novoTutorSelect"
            value={selectedTutorId}
            onChange={(e) => {
              setSelectedTutorId(e.target.value)
              if (submitError) setSubmitError(null)
            }}
            className="w-full h-9 px-3 text-xs bg-white text-gray-800 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
          >
            <option value="">Selecione o novo tutor responsável...</option>
            {tutores.length === 0 ? (
              <option value="" disabled>
                Nenhum tutor ativo encontrado
              </option>
            ) : (
              tutores.map((t) => {
                const isCurrent = Boolean(
                  effectiveCurrentTutorId && t.id === effectiveCurrentTutorId
                )
                return (
                  <option key={t.id} value={t.id} disabled={isCurrent}>
                    {t.name} {isCurrent ? "(Tutor atual)" : t.email ? `(${t.email})` : ""}
                  </option>
                )
              })
            )}
          </select>
        )}
        {isSelfTransfer && (
          <p className="text-[11px] text-amber-600 font-medium">
            O discente já está atribuído a este tutor. Selecione outro colega.
          </p>
        )}
      </div>

      {/* Textarea: Nota Pedagógica de Transição */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="notaTransicao" className="block text-xs font-semibold text-gray-700">
            Nota Pedagógica de Transição <span className="text-red-500">*</span>
          </label>
          <span
            className={`text-[10px] font-mono ${
              noteLength < 5 ? "text-amber-600 font-medium" : "text-emerald-600 font-bold"
            }`}
          >
            {`${noteLength} / 5 mín.`}
          </span>
        </div>
        <textarea
          id="notaTransicao"
          rows={3}
          value={notaTransicao}
          onChange={(e) => {
            setNotaTransicao(e.target.value)
            if (submitError) setSubmitError(null)
          }}
          placeholder="Descreva o motivo da transferência de atendimento, histórico recente e orientações pedagógicas para continuidade..."
          className="w-full p-2.5 rounded-lg border border-gray-200 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500 leading-relaxed resize-none"
        />
        <p className="text-[10px] text-gray-400">
          Mínimo de 5 caracteres. Esta nota será registrada permanentemente na trilha de
          auditoria e visível na timeline.
        </p>
      </div>

      {/* Banner de Erro */}
      {submitError && (
        <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <span>{submitError}</span>
        </div>
      )}

      {/* Rodapé com Ações */}
      <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={isSubmitting}
          className="h-8 text-xs cursor-pointer"
        >
          Cancelar
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => handleSubmit()}
          disabled={!canSubmit}
          className="h-8 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white cursor-pointer gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Transferindo...
            </>
          ) : (
            <>
              <Check className="w-3.5 h-3.5" />
              Confirmar Transferência
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

/**
 * Componente Modal Base UI de Transferência de Atendimento
 */
export function BatonPassDialog({
  trigger,
  open,
  onOpenChange,
  className = "",
  ...formProps
}: BatonPassDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = open !== undefined
  const dialogOpen = isControlled ? open : internalOpen

  const handleOpenChange = (nextOpen: boolean) => {
    if (!isControlled) {
      setInternalOpen(nextOpen)
    }
    onOpenChange?.(nextOpen)
    if (!nextOpen) {
      formProps.onCancel?.()
    }
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
      {trigger ? (
        <DialogTrigger render={trigger as any} />
      ) : !isControlled ? (
        <DialogTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 text-purple-700 border-purple-200 hover:bg-purple-50 text-xs"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-purple-600" />
              Transferir Atendimento
            </Button>
          }
        />
      ) : null}

      <DialogContent
        className={`sm:max-w-md bg-white p-6 rounded-2xl shadow-2xl border border-slate-200 ${className}`}
      >
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-purple-600 shrink-0" />
            Transferência de Atendimento
          </DialogTitle>
          <DialogDescription className="text-xs text-gray-500">
            Transfira a responsabilidade do atendimento para outro tutor com justificativa registrada
            na trilha de auditoria e linha do tempo.
          </DialogDescription>
        </DialogHeader>

        <BatonPassForm
          {...formProps}
          showHeader={false}
          onSuccess={(res) => {
            formProps.onSuccess?.(res)
            handleOpenChange(false)
          }}
          onCancel={() => handleOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

export const TransferirAtendimentoDialog = BatonPassDialog
export const TransferirAtendimentoForm = BatonPassForm
