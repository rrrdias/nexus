"use client"

import React, { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  Sparkles,
  Search,
  Clock,
  Activity,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  BookOpen,
  RefreshCw,
  Eye,
  X,
  FileText,
  HelpCircle,
  Folder,
  Layers,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Mail,
  Phone,
  MessageCircle,
  Copy,
  Check,
  ExternalLink,
  Send,
  Kanban,
  XCircle,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  getTutoriaDashboardSummary,
  getTutoriaEngagementList,
  getTutoriaStudentLogs,
  triggerTutoriaManualSync,
  getTutoriaDisciplinas,
  getTutoriaExportData,
  createTutoriaKanbanCard,
  updateTutoriaKanbanCard,
  getTutoriaTimeline,
  sendTutoriaEmailAction,
  type TimelineEvent,
} from "@/app/actions/tutoria"
import { TutoriaTimeline } from "@/components/tutoria/TutoriaTimeline"
import { TutoriaInterventionForm } from "@/components/tutoria/TutoriaInterventionForm"

interface TutoriaDashboardProps {
  sessionUser: any
}

export function TutoriaDashboard({ sessionUser }: TutoriaDashboardProps) {
  // Estados principais
  const [summary, setSummary] = useState<any>(null)
  const [students, setStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | null }>({
    message: "",
    type: null,
  })

  // Filtros
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [periodo, setPeriodo] = useState("2026-2")
  const [grupoRisco, setGrupoRisco] = useState<string>("todos")
  const [faixaTempo, setFaixaTempo] = useState<string>("todos")
  const [recenciaAcesso, setRecenciaAcesso] = useState<string>("todos")
  const [statusKanbanFilter, setStatusKanbanFilter] = useState<string>("todos")
  const [selectedDisciplina, setSelectedDisciplina] = useState<string>("todas")
  const [disciplinas, setDisciplinas] = useState<any[]>([])
  const [exporting, setExporting] = useState(false)
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 15, totalPages: 1 })

  // Debounce na busca para evitar requisições a cada tecla digitada
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 350)
    return () => clearTimeout(timer)
  }, [search])

  // Drawer de Detalhes do Aluno
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null)
  const [studentLogs, setStudentLogs] = useState<any[]>([])
  const [studentDiscente, setStudentDiscente] = useState<any | null>(null)
  const [logsLoading, setLogsLoading] = useState(false)
  const [activeTemplate, setActiveTemplate] = useState<"critico" | "atencao" | "autonomo">("critico")
  const [customMessage, setCustomMessage] = useState("")
  const [copiedMessage, setCopiedMessage] = useState(false)
  const [sendingToKanban, setSendingToKanban] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [kanbanSent, setKanbanSent] = useState(false)
  const [detailTab, setDetailTab] = useState<"acolhimento" | "diagnostico" | "historico">("acolhimento")

  // Timeline State
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([])
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [timelineError, setTimelineError] = useState<string | null>(null)

  // Carregar Linha do Tempo Consolidada
  const loadTimeline = useCallback(async (matricula: string, cardId?: string) => {
    if (!matricula) return
    setTimelineLoading(true)
    setTimelineError(null)
    try {
      const res = await getTutoriaTimeline(matricula, cardId)
      if (res.success) {
        setTimelineEvents(res.events || res.data || [])
      } else {
        setTimelineError(res.error || "Erro ao carregar histórico de atendimentos.")
      }
    } catch (err: any) {
      setTimelineError(err?.message || "Falha na comunicação ao buscar linha do tempo.")
    } finally {
      setTimelineLoading(false)
    }
  }, [])

  // Carrega a timeline quando a aba 'historico' estiver ativa
  useEffect(() => {
    if (detailTab === "historico" && selectedStudent?.matricula) {
      loadTimeline(selectedStudent.matricula, selectedStudent.kanban_card_id)
    }
  }, [detailTab, selectedStudent?.matricula, selectedStudent?.kanban_card_id, loadTimeline])

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type })
    setTimeout(() => setToast({ message: "", type: null }), 4500)
  }

  // Carregar lista de disciplinas disponíveis do período
  const loadDisciplinas = useCallback(async () => {
    try {
      const res: any = await getTutoriaDisciplinas(periodo, "ead")
      const list = Array.isArray(res) ? res : res?.data || []
      setDisciplinas(list)
    } catch (err) {
      console.error("Erro ao carregar disciplinas:", err)
    }
  }, [periodo])

  useEffect(() => {
    loadDisciplinas()
  }, [loadDisciplinas])

  // Carregar KPIs do Dashboard
  const loadSummary = useCallback(async () => {
    setSummaryLoading(true)
    try {
      const data = await getTutoriaDashboardSummary(periodo, "ead")
      setSummary(data)
    } catch (err: any) {
      console.error("Erro ao carregar resumo de tutoria:", err)
    } finally {
      setSummaryLoading(false)
    }
  }, [periodo])

  // Carregar lista de alunos e engajamento
  const loadStudents = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getTutoriaEngagementList({
        periodo,
        disciplinaCodigo: selectedDisciplina === "todas" ? undefined : selectedDisciplina,
        grupoRisco: grupoRisco === "todos" ? undefined : (grupoRisco as any),
        faixaTempo: faixaTempo === "todos" ? undefined : faixaTempo,
        recenciaAcesso: recenciaAcesso === "todos" ? undefined : (recenciaAcesso as any),
        statusKanban: statusKanbanFilter === "todos" ? undefined : statusKanbanFilter,
        search: debouncedSearch.trim() || undefined,
        page,
        limit: 15,
      })

      if (res && res.data) {
        setStudents(res.data)
        setPagination(res.pagination || { total: 0, page: 1, limit: 15, totalPages: 1 })
      }
    } catch (err: any) {
      console.error("Erro ao carregar lista de engajamento:", err)
      showToast(err.message || "Erro ao consultar dados de engajamento.", "error")
    } finally {
      setLoading(false)
    }
  }, [periodo, selectedDisciplina, grupoRisco, faixaTempo, recenciaAcesso, statusKanbanFilter, debouncedSearch, page])

  useEffect(() => {
    loadSummary()
  }, [loadSummary])

  useEffect(() => {
    loadStudents()
  }, [loadStudents])

  // Disparo manual de sincronização
  const handleSync = async () => {
    setSyncing(true)
    showToast("Sincronização iniciada com o Moodle EaD (ID 63)...", "success")
    try {
      const res = await triggerTutoriaManualSync("ead")
      showToast(`Sincronização concluída! ${res.records || 0} logs processados.`, "success")
      await Promise.all([loadSummary(), loadStudents(), loadDisciplinas()])
    } catch (err: any) {
      showToast(err.message || "Falha na sincronização.", "error")
    } finally {
      setSyncing(false)
    }
  }

  // Exportar dados filtrados para Excel/CSV
  const exportToExcel = async () => {
    setExporting(true)
    try {
      showToast("Gerando arquivo Excel com os filtros aplicados...", "success")
      const rows = await getTutoriaExportData({
        periodo,
        disciplinaCodigo: selectedDisciplina === "todas" ? undefined : selectedDisciplina,
        grupoRisco: grupoRisco === "todos" ? undefined : (grupoRisco as any),
        faixaTempo: faixaTempo === "todos" ? undefined : faixaTempo,
        recenciaAcesso: recenciaAcesso === "todos" ? undefined : (recenciaAcesso as any),
        statusKanban: statusKanbanFilter === "todos" ? undefined : statusKanbanFilter,
        search: debouncedSearch.trim() || undefined,
      })

      if (!rows || !Array.isArray(rows) || rows.length === 0) {
        showToast("Nenhum registro encontrado para exportar.", "error")
        return
      }

      // Monta CSV com BOM UTF-8 (\uFEFF) para abrir formatado no Excel
      const headers = [
        "Período",
        "Código Disciplina",
        "Nome Disciplina",
        "Matrícula",
        "Nome Aluno",
        "E-mail",
        "Classificação Risco",
        "Fluxo Atendimento",
        "Score Engajamento",
        "Tempo Total",
        "Fase 1",
        "Fase 2",
        "Fase 3",
        "Tempo Leitura",
        "Tempo Avaliações",
        "Total Cliques",
        "Atividades Acessadas",
        "Último Acesso Disciplina",
        "Último Login AVA",
      ]

      const csvRows = [headers.join(";")]

      for (const r of rows) {
        const row = [
          `"${r.periodo || ""}"`,
          `"${r.disciplina_codigo || ""}"`,
          `"${(r.disciplina_nome || "").replace(/"/g, '""')}"`,
          `"${r.matricula || ""}"`,
          `"${(r.aluno_nome || "").replace(/"/g, '""')}"`,
          `"${r.aluno_email || ""}"`,
          `"${r.grupo_risco_calculado || ""}"`,
          `"${r.status_kanban || "sem_atendimento"}"`,
          `"${r.score_engajamento || "0"}"`,
          `"${formatFriendlyDuration(r.tempo_total_minutos)}"`,
          `"${formatFriendlyDuration(r.tempo_fase1_minutos)}"`,
          `"${formatFriendlyDuration(r.tempo_fase2_minutos)}"`,
          `"${formatFriendlyDuration(r.tempo_fase3_minutos)}"`,
          `"${formatFriendlyDuration(r.tempo_leitura_minutos)}"`,
          `"${formatFriendlyDuration(r.tempo_avaliacoes_minutos)}"`,
          `"${r.total_cliques || 0}"`,
          `"${r.total_atividades_acessadas || 0}"`,
          `"${r.data_ultimo_acesso || ""}"`,
          `"${r.data_ultimo_login || ""}"`,
        ]
        csvRows.push(row.join(";"))
      }

      const csvContent = "\uFEFF" + csvRows.join("\r\n")
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.setAttribute("href", url)
      link.setAttribute(
        "download",
        `tutoria_acompanhamento_${periodo}_${new Date().toISOString().slice(0, 10)}.csv`,
      )
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      showToast(`Exportação de ${rows.length} registros concluída com sucesso!`, "success")
    } catch (err: any) {
      console.error("Erro na exportação:", err)
      showToast(err.message || "Erro ao exportar dados.", "error")
    } finally {
      setExporting(false)
    }
  }

  // Template inteligente de mensagens para tutoria pedagógica
  const getMessageTemplate = (type: "critico" | "atencao" | "autonomo", student: any) => {
    const primeiroNome = student?.aluno_nome?.split(" ")[0] || "Estudante"
    const disciplina = student?.disciplina_nome || "sua disciplina"

    switch (type) {
      case "critico":
        return `Olá ${primeiroNome}, tudo bem? Sou o tutor da disciplina ${disciplina}. Notei que você ainda não conseguiu acessar os conteúdos desta semana no AVA. Está com alguma dificuldade técnica ou pedagógica com as atividades? Estou à sua disposição para te apoiar!`
      case "atencao":
        return `Olá ${primeiroNome}, tudo bem? Passando para lembrar que temos atividades e verificações em andamento na disciplina ${disciplina}. Reserve um tempinho para concluir suas leituras e manter suas atividades em dia!`
      case "autonomo":
        return `Olá ${primeiroNome}, parabéns pela sua dedicação e pelo ótimo ritmo de estudos na disciplina ${disciplina}! Continue com esse excelente engajamento. Conte sempre comigo!`
    }
  }

  // Abrir Detalhes do Estudante
  const handleOpenStudentLogs = async (student: any) => {
    setSelectedStudent(student)
    setDetailTab("acolhimento")
    setKanbanSent(!!student.kanban_card_id || !!student.status_kanban)
    setLogsLoading(true)
    setStudentDiscente(null)
    const initialTpl =
      student.grupo_risco_calculado === "atencao"
        ? "atencao"
        : student.grupo_risco_calculado === "autonomo"
        ? "autonomo"
        : "critico"
    setActiveTemplate(initialTpl)
    setCustomMessage(getMessageTemplate(initialTpl, student))

    try {
      const res = await getTutoriaStudentLogs(student.matricula, student.disciplina_id)
      if (res && res.logs) {
        setStudentLogs(Array.isArray(res.logs) ? res.logs : [])
        setStudentDiscente(res.discente || null)
        if (res.kanban) {
          setSelectedStudent((prev: any) => ({
            ...prev,
            kanban_card_id: res.kanban.id || prev?.kanban_card_id,
            kanban_tutor_id: res.kanban.tutor_responsavel_id || prev?.kanban_tutor_id,
            status_kanban: res.kanban.status_kanban || prev?.status_kanban,
            kanban_canal: res.kanban.canal_contato_utilizado || prev?.kanban_canal,
            kanban_ultimo_contato: res.kanban.ultimo_contato_em || prev?.kanban_ultimo_contato,
            kanban_observacoes: res.kanban.observacoes || prev?.kanban_observacoes,
            kanban_tutor_nome: res.kanban.tutor_nome || prev?.kanban_tutor_nome,
            kanban_data_resolucao: res.kanban.data_resolucao || prev?.kanban_data_resolucao,
          }))
          setKanbanSent(true)
        }
      } else {
        setStudentLogs(Array.isArray(res) ? res : [])
      }
    } catch (err: any) {
      showToast(err.message || "Erro ao carregar logs do estudante.", "error")
    } finally {
      setLogsLoading(false)
    }
  }

  // Callback disparado quando uma nova intervenção é gravada com sucesso
  const handleInterventionSuccess = (newEvent?: any) => {
    if (selectedStudent?.matricula) {
      loadTimeline(selectedStudent.matricula, selectedStudent.kanban_card_id)
    }
    if (newEvent) {
      setSelectedStudent((prev: any) => ({
        ...prev,
        kanban_ultimo_contato: newEvent.createdAt || new Date().toISOString(),
        kanban_canal: newEvent.canalContato || prev?.kanban_canal,
        status_kanban: newEvent.metadata?.statusKanban || prev?.status_kanban,
      }))
      if (newEvent.metadata?.statusKanban) {
        setStudents((prev) =>
          prev.map((s) =>
            s.matricula === selectedStudent?.matricula
              ? { ...s, status_kanban: newEvent.metadata.statusKanban }
              : s
          )
        )
      }
    }
    showToast("Intervenção pedagógica registrada com sucesso!", "success")
  }

  // Troca de Template de Contato
  const handleSelectTemplate = (type: "critico" | "atencao" | "autonomo") => {
    setActiveTemplate(type)
    if (selectedStudent) {
      setCustomMessage(getMessageTemplate(type, selectedStudent))
    }
  }

  // Copiar Mensagem para Área de Transferência
  const handleCopyMessage = async () => {
    if (!customMessage) return
    try {
      await navigator.clipboard.writeText(customMessage)
      setCopiedMessage(true)
      setTimeout(() => setCopiedMessage(false), 2000)
      showToast("Mensagem copiada para a área de transferência!", "success")
    } catch {
      showToast("Erro ao copiar mensagem.", "error")
    }
  }

  // Disparo WhatsApp
  const handleSendWhatsApp = () => {
    const rawTel = studentDiscente?.telefone || ""
    const cleanTel = rawTel.replace(/\D/g, "")
    if (!cleanTel) {
      showToast("Estudante não possui telefone/WhatsApp cadastrado na base acadêmica.", "error")
      return
    }
    const finalTel = cleanTel.startsWith("55") ? cleanTel : `55${cleanTel}`
    const url = `https://wa.me/${finalTel}?text=${encodeURIComponent(customMessage)}`
    window.open(url, "_blank")
  }

  // Disparo E-mail Corporativo com Registro em Linha do Tempo
  const handleSendEmail = async () => {
    if (!selectedStudent) return
    const email = studentDiscente?.email || selectedStudent?.aluno_email
    if (!email) {
      showToast("Estudante não possui e-mail cadastrado na base acadêmica.", "error")
      return
    }
    if (!customMessage || !customMessage.trim()) {
      showToast("A mensagem pedagógica não pode estar vazia.", "error")
      return
    }

    setSendingEmail(true)
    try {
      const res = await sendTutoriaEmailAction({
        matricula: selectedStudent.matricula,
        alunoEmail: email,
        alunoNome: selectedStudent.aluno_nome,
        disciplinaNome: selectedStudent.disciplina_nome,
        mensagem: customMessage,
        periodo,
        cardId: selectedStudent.kanban_card_id,
      })

      if (res.success) {
        showToast("E-mail corporativo enviado e registrado na linha do tempo!", "success")
        if (selectedStudent.matricula) {
          loadTimeline(selectedStudent.matricula, selectedStudent.kanban_card_id)
        }
        setSelectedStudent((prev: any) => ({
          ...prev,
          kanban_ultimo_contato: new Date().toISOString(),
          kanban_canal: "email",
          status_kanban: prev?.status_kanban === "a_contatar" ? "em_contato" : prev?.status_kanban,
        }))
        setStudents((prev) =>
          prev.map((s) =>
            s.matricula === selectedStudent.matricula
              ? {
                  ...s,
                  status_kanban: s.status_kanban === "a_contatar" ? "em_contato" : s.status_kanban,
                  kanban_ultimo_contato: new Date().toISOString(),
                  kanban_canal: "email",
                }
              : s
          )
        )
      } else {
        showToast(res.error || "Falha ao enviar e-mail corporativo.", "error")
      }
    } catch (err: any) {
      showToast(err?.message || "Erro inesperado ao disparar e-mail.", "error")
    } finally {
      setSendingEmail(false)
    }
  }

  // Atualizar Status do Aluno no Kanban diretamente do Drawer
  const handleUpdateStudentKanbanStatus = async (newStatus: string) => {
    if (!selectedStudent) return
    const cardId = selectedStudent.kanban_card_id
    setSendingToKanban(true)
    try {
      if (!cardId) {
        const res: any = await createTutoriaKanbanCard({
          periodo,
          institution: "ead",
          matricula: selectedStudent.matricula,
          alunoNome: selectedStudent.aluno_nome,
          alunoEmail: selectedStudent.aluno_email,
          disciplinaCodigo: selectedStudent.disciplina_codigo,
          disciplinaNome: selectedStudent.disciplina_nome,
          statusKanban: newStatus,
          observacoes: customMessage ? `Template ${activeTemplate}: ${customMessage}` : undefined,
          canalContatoUtilizado: "whatsapp",
        })

        if (res && res.success === false) {
          showToast(res.error || "Erro ao iniciar atendimento no Kanban.", "error")
          return
        }

        const newId = res.id || res.data?.id
        setKanbanSent(true)
        setSelectedStudent((prev: any) => ({
          ...prev,
          kanban_card_id: newId,
          status_kanban: newStatus,
          kanban_canal: "whatsapp",
          kanban_ultimo_contato: new Date().toISOString(),
          kanban_tutor_nome: sessionUser?.name || "Você",
        }))
        setStudents((prev) =>
          prev.map((s) =>
            s.matricula === selectedStudent.matricula &&
            (s.disciplina_codigo === selectedStudent.disciplina_codigo || !s.disciplina_codigo)
              ? { ...s, kanban_card_id: newId, status_kanban: newStatus, kanban_canal: "whatsapp" }
              : s
          )
        )
        showToast("Atendimento iniciado no Kanban!", "success")
        return
      }

      const res: any = await updateTutoriaKanbanCard(cardId, {
        statusKanban: newStatus,
        canalContatoUtilizado: "whatsapp",
      })

      if (res && res.success === false) {
        showToast(res.error || "Erro ao atualizar atendimento no Kanban.", "error")
        return
      }

      setKanbanSent(true)
      setSelectedStudent((prev: any) => ({
        ...prev,
        status_kanban: newStatus,
        kanban_ultimo_contato: new Date().toISOString(),
      }))
      setStudents((prev) =>
        prev.map((s) =>
          s.matricula === selectedStudent.matricula &&
          (s.disciplina_codigo === selectedStudent.disciplina_codigo || !s.disciplina_codigo)
            ? { ...s, status_kanban: newStatus }
            : s
        )
      )
      showToast("Fluxo de atendimento atualizado com sucesso!", "success")
    } catch (err: any) {
      console.error("Erro ao atualizar status kanban:", err)
      showToast(err?.message || "Erro ao atualizar fluxo.", "error")
    } finally {
      setSendingToKanban(false)
    }
  }

  // Encaminhar Aluno ao Kanban de Atendimentos
  const handleSendToKanban = async () => {
    if (!selectedStudent) return
    setSendingToKanban(true)
    try {
      const res: any = await createTutoriaKanbanCard({
        periodo,
        institution: "ead",
        matricula: selectedStudent.matricula,
        alunoNome: selectedStudent.aluno_nome,
        alunoEmail: selectedStudent.aluno_email,
        disciplinaCodigo: selectedStudent.disciplina_codigo,
        disciplinaNome: selectedStudent.disciplina_nome,
        statusKanban: selectedStudent.status_kanban || "pendente",
        observacoes: customMessage ? `Template ${activeTemplate}: ${customMessage}` : undefined,
        canalContatoUtilizado: "whatsapp",
      })

      if (res && res.success === false) {
        showToast(res.error || "Erro ao encaminhar aluno ao Kanban.", "error")
        return
      }

      const cardId = res.id || res.data?.id
      setKanbanSent(true)
      setSelectedStudent((prev: any) => ({
        ...prev,
        kanban_card_id: cardId || prev?.kanban_card_id,
        status_kanban: prev?.status_kanban || "pendente",
        kanban_canal: "whatsapp",
        kanban_ultimo_contato: new Date().toISOString(),
        kanban_tutor_nome: sessionUser?.name || "Você",
      }))
      setStudents((prev) =>
        prev.map((s) =>
          s.matricula === selectedStudent.matricula &&
          (s.disciplina_codigo === selectedStudent.disciplina_codigo || !s.disciplina_codigo)
            ? { ...s, kanban_card_id: cardId || s.kanban_card_id, status_kanban: s.status_kanban || "pendente" }
            : s
        )
      )

      if (res && res.created === false) {
        showToast(res.message || "Aluno já possui atendimento ativo no Kanban.", "success")
      } else {
        showToast("Aluno encaminhado ao Kanban de Atendimentos com sucesso!", "success")
      }
    } catch (err: any) {
      console.error("Erro ao encaminhar aluno ao Kanban:", err)
      showToast(err.message || "Erro ao encaminhar aluno ao Kanban.", "error")
    } finally {
      setSendingToKanban(false)
    }
  }

  // Helper para renderizar badge de status Kanban
  const renderKanbanStatusBadge = (status?: string | null) => {
    switch (status) {
      case "pendente":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            A Contatar
          </span>
        )
      case "em_contato":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200">
            <Send className="w-3 h-3 text-blue-600" />
            Em Contato
          </span>
        )
      case "em_recuperacao":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-800 border border-purple-200">
            <Sparkles className="w-3 h-3 text-purple-600" />
            Acompanhamento
          </span>
        )
      case "revertido":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Regularizado
          </span>
        )
      case "evadido":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-300">
            <XCircle className="w-3 h-3 text-gray-500" />
            Não Localizado
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100/70 text-slate-500 border border-slate-200">
            Sem Atendimento
          </span>
        )
    }
  }

  // Helper para renderizar badge de grupo de risco
  const renderRiskBadge = (risk: string) => {
    switch (risk) {
      case "critico":
        return (
          <Badge className="bg-red-500/10 text-red-600 border border-red-500/20 font-semibold gap-1 py-0.5 px-2">
            <AlertOctagon className="w-3.5 h-3.5" /> Risco Crítico
          </Badge>
        )
      case "atencao":
        return (
          <Badge className="bg-amber-500/10 text-amber-600 border border-amber-500/20 font-semibold gap-1 py-0.5 px-2">
            <AlertTriangle className="w-3.5 h-3.5" /> Atenção
          </Badge>
        )
      case "autonomo":
        return (
          <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 font-semibold gap-1 py-0.5 px-2">
            <CheckCircle2 className="w-3.5 h-3.5" /> Autônomo
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="text-gray-500">
            Não Classificado
          </Badge>
        )
    }
  }

  // Helper para ícones de tipo de módulo
  const renderModuleIcon = (tipo: string) => {
    switch (tipo?.toLowerCase()) {
      case "quiz":
        return <HelpCircle className="w-4 h-4 text-purple-500 shrink-0" />
      case "page":
      case "book":
        return <BookOpen className="w-4 h-4 text-blue-500 shrink-0" />
      case "folder":
      case "resource":
        return <Folder className="w-4 h-4 text-amber-500 shrink-0" />
      default:
        return <FileText className="w-4 h-4 text-gray-500 shrink-0" />
    }
  }

  // Helper para formatação de data e hora
  const formatDateTime = (dateStr: string | null | undefined) => {
    if (!dateStr || dateStr === "0" || dateStr.startsWith("1970")) return null
    try {
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return dateStr
      return d.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch {
      return dateStr
    }
  }

  // Helper para formatar tempo de forma natural e amigável para usuários leigos (ex: "53 min", "1h 20min", "< 1 min")
  const formatFriendlyDuration = (minutesVal: number | string | null | undefined): string => {
    if (minutesVal === null || minutesVal === undefined || minutesVal === "") return "0 min"
    const totalMinutes = typeof minutesVal === "string" ? parseFloat(minutesVal) : minutesVal
    if (isNaN(totalMinutes) || totalMinutes <= 0) return "0 min"

    if (totalMinutes < 1) {
      return "< 1 min"
    }

    const roundedMins = Math.round(totalMinutes)
    if (roundedMins < 60) {
      return `${roundedMins} min`
    }

    const hours = Math.floor(roundedMins / 60)
    const remainingMins = roundedMins % 60
    if (remainingMins === 0) {
      return `${hours}h`
    }
    return `${hours}h ${remainingMins}min`
  }

  // Helper visual para recência do último acesso
  const renderAccessRecency = (dateStr: string | null | undefined, loginStr?: string | null) => {
    if (!dateStr || dateStr === "0" || dateStr.startsWith("1970")) {
      return (
        <div className="flex flex-col items-center">
          <span className="text-[11px] text-gray-400 italic">Sem registro</span>
          {loginStr && !loginStr.startsWith("1970") && (
            <span className="text-[10px] text-indigo-500 font-mono mt-0.5" title="Último login no AVA">
              Log: {formatDateTime(loginStr)?.slice(0, 5) || ""}
            </span>
          )}
        </div>
      )
    }

    try {
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return <span className="text-xs text-gray-600">{dateStr}</span>
      const diffMs = Date.now() - d.getTime()
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

      let badgeClass = "bg-emerald-50 text-emerald-700 border-emerald-200"
      const text = diffDays <= 0 ? "Hoje" : diffDays === 1 ? "Ontem" : `há ${diffDays}d`
      if (diffDays > 7 && diffDays <= 14) {
        badgeClass = "bg-amber-50 text-amber-700 border-amber-200"
      } else if (diffDays > 14) {
        badgeClass = "bg-red-50 text-red-700 border-red-200"
      }

      return (
        <div className="flex flex-col items-center select-none" title={`Último acesso: ${formatDateTime(dateStr)}`}>
          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${badgeClass}`}>
            {text}
          </span>
          <span className="text-[10px] text-gray-400 mt-0.5 font-mono">
            {d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} {d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      )
    } catch {
      return <span className="text-xs text-gray-600">{dateStr}</span>
    }
  }

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast.message && (
        <div
          className={`fixed top-4 right-4 z-[9999] px-4 py-3 rounded-lg shadow-2xl border text-sm font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top-4 ${
            toast.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-red-50 text-red-800 border-red-200"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          ) : (
            <AlertOctagon className="w-4 h-4 text-red-600" />
          )}
          {toast.message}
        </div>
      )}

      {/* Header Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-gray-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600">
              <Sparkles className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                Módulo de Tutoria & Engajamento
              </h1>
              <p className="text-sm text-gray-500">
                Acompanhamento contínuo de tempo em tela, detecção de padrões de risco e apoio pedagógico com IA.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/tutoria/kanban">
            <Button
              type="button"
              variant="outline"
              className="border-purple-200 text-purple-700 bg-purple-50/50 hover:bg-purple-100 font-medium shadow-2xs transition-all cursor-pointer gap-2"
            >
              <Kanban className="w-4 h-4 text-purple-600" />
              Atendimentos Kanban
            </Button>
          </Link>

          <Button
            onClick={handleSync}
            disabled={syncing}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-sm transition-all cursor-pointer gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Sincronizando..." : "Atualizar Logs do AVA (ID 63)"}
          </Button>
        </div>
      </div>

      {/* KPI Cards de Resumo Executivo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Analisados */}
        <Card 
          onClick={() => { setGrupoRisco("todos"); setPage(1); }}
          className={`border shadow-sm rounded-xl cursor-pointer transition-all hover:scale-[1.01] ${
            grupoRisco === "todos" ? "border-indigo-400 ring-2 ring-indigo-400/20 shadow-md" : "border-gray-100 hover:border-gray-200"
          }`}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Vínculos Analisados
              </span>
              <span className="p-2 rounded-lg bg-blue-50 text-blue-600">
                <Activity className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-gray-900">
                {summaryLoading ? "..." : summary?.total_alunos_disciplinas?.toLocaleString() || 0}
              </span>
              <span className="text-xs text-gray-400">
                ({summary?.total_alunos_unicos || 0} alunos)
              </span>
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              Em {summary?.total_disciplinas || 0} disciplinas ativas
            </p>
          </CardContent>
        </Card>

        {/* Risco Crítico */}
        <Card 
          onClick={() => { setGrupoRisco("critico"); setPage(1); }}
          className={`border shadow-sm rounded-xl bg-red-50/20 cursor-pointer transition-all hover:scale-[1.01] ${
            grupoRisco === "critico" ? "border-red-400 ring-2 ring-red-400/20 shadow-md bg-red-50/40" : "border-red-100 hover:border-red-200"
          }`}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-red-700 uppercase tracking-wider">
                Risco Crítico
              </span>
              <span className="p-2 rounded-lg bg-red-100/80 text-red-600">
                <AlertOctagon className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-red-700">
                {summaryLoading ? "..." : summary?.total_critico?.toLocaleString() || 0}
              </span>
              <span className="text-xs font-medium text-red-500">
                (&lt; 15 min no ciclo)
              </span>
            </div>
            <p className="text-[11px] text-red-600/70 mt-1">
              Ação prioritária de busca ativa
            </p>
          </CardContent>
        </Card>

        {/* Atenção */}
        <Card 
          onClick={() => { setGrupoRisco("atencao"); setPage(1); }}
          className={`border shadow-sm rounded-xl bg-amber-50/20 cursor-pointer transition-all hover:scale-[1.01] ${
            grupoRisco === "atencao" ? "border-amber-400 ring-2 ring-amber-400/20 shadow-md bg-amber-50/40" : "border-amber-100 hover:border-amber-200"
          }`}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">
                Em Atenção
              </span>
              <span className="p-2 rounded-lg bg-amber-100/80 text-amber-600">
                <AlertTriangle className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-amber-700">
                {summaryLoading ? "..." : summary?.total_atencao?.toLocaleString() || 0}
              </span>
              <span className="text-xs font-medium text-amber-500">
                (15 a 60 min)
              </span>
            </div>
            <p className="text-[11px] text-amber-600/70 mt-1">
              Reforço e incentivo de estudos
            </p>
          </CardContent>
        </Card>

        {/* Autônomos */}
        <Card 
          onClick={() => { setGrupoRisco("autonomo"); setPage(1); }}
          className={`border shadow-sm rounded-xl bg-emerald-50/20 cursor-pointer transition-all hover:scale-[1.01] ${
            grupoRisco === "autonomo" ? "border-emerald-400 ring-2 ring-emerald-400/20 shadow-md bg-emerald-50/40" : "border-emerald-100 hover:border-emerald-200"
          }`}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
                Em Dia
              </span>
              <span className="p-2 rounded-lg bg-emerald-100/80 text-emerald-600">
                <CheckCircle2 className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-emerald-700">
                {summaryLoading ? "..." : summary?.total_autonomo?.toLocaleString() || 0}
              </span>
              <span className="text-xs font-medium text-emerald-500">
                (&gt; 60 min)
              </span>
            </div>
            <p className="text-[11px] text-emerald-600/70 mt-1">
              Alto engajamento sustentado
            </p>
          </CardContent>
        </Card>

        {/* Média de Tempo */}
        <Card className="border border-gray-100 shadow-sm rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Tempo Médio por Aluno
              </span>
              <span className="p-2 rounded-lg bg-purple-50 text-purple-600">
                <Clock className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-gray-900">
                {summaryLoading ? "..." : formatFriendlyDuration(summary?.media_tempo_minutos)}
              </span>
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              Score médio: {summary?.media_score_engajamento || 0}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Barra de Filtros e Ações */}
      <Card className="border border-gray-100 shadow-sm rounded-xl">
        <CardContent className="p-4 space-y-3">
          {/* Linha 1: Busca e Risco */}
          <div className="flex flex-col md:flex-row items-center gap-3">
            {/* Input de Busca */}
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Buscar por nome do aluno, matrícula, e-mail ou disciplina..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                className="pl-9 bg-gray-50/50 border-gray-200 focus-visible:ring-indigo-500 text-xs"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("")
                    setPage(1)
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Filtro de Risco */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="flex p-1 bg-gray-100 rounded-lg text-xs font-medium w-full md:w-auto">
                {[
                  { id: "todos", label: "Todos" },
                  { id: "critico", label: "Crítico" },
                  { id: "atencao", label: "Atenção" },
                  { id: "autonomo", label: "Em Dia" },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setGrupoRisco(item.id)
                      setPage(1)
                    }}
                    className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                      grupoRisco === item.id
                        ? "bg-white text-gray-900 shadow-xs font-semibold"
                        : "text-gray-500 hover:text-gray-900"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Seletor de Período */}
              <select
                value={periodo}
                onChange={(e) => {
                  setPeriodo(e.target.value)
                  setSelectedDisciplina("todas")
                  setPage(1)
                }}
                className="h-9 px-3 text-xs bg-gray-100 border-none rounded-lg text-gray-700 font-medium focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="2026-2">2026-2 (Ativo)</option>
                <option value="2026-1">2026-1 (Histórico)</option>
              </select>
            </div>
          </div>

          {/* Linha 2: Disciplinas, Faixas de Tempo, Recência de Acesso e Exportação */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 pt-2 border-t border-gray-100">
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto flex-1">
              {/* Seletor Dedicado de Disciplinas */}
              <select
                value={selectedDisciplina}
                onChange={(e) => {
                  setSelectedDisciplina(e.target.value)
                  setPage(1)
                }}
                className="h-9 px-3 text-xs bg-gray-100 border-none rounded-lg text-gray-700 font-medium focus:ring-2 focus:ring-indigo-500 cursor-pointer max-w-[280px] truncate"
                title="Filtrar por disciplina"
              >
                <option value="todas">Todas as disciplinas ({disciplinas.length})</option>
                {disciplinas.map((d) => (
                  <option key={d.disciplina_codigo || d.disciplina_id} value={d.disciplina_codigo}>
                    {d.disciplina_nome}
                  </option>
                ))}
              </select>

              {/* Seletor de Faixa de Tempo */}
              <select
                value={faixaTempo}
                onChange={(e) => {
                  setFaixaTempo(e.target.value)
                  setPage(1)
                }}
                className="h-9 px-3 text-xs bg-gray-100 border-none rounded-lg text-gray-700 font-medium focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                title="Filtrar por tempo total"
              >
                <option value="todos">Todos os tempos</option>
                <option value="ate_30">Até 30 minutos</option>
                <option value="ate_60">30 a 60 minutos</option>
                <option value="mais_60">Mais que 60 minutos</option>
              </select>

              {/* Seletor de Recência de Acesso */}
              <select
                value={recenciaAcesso}
                onChange={(e) => {
                  setRecenciaAcesso(e.target.value)
                  setPage(1)
                }}
                className="h-9 px-3 text-xs bg-gray-100 border-none rounded-lg text-gray-700 font-medium focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                title="Filtrar por recência do último acesso"
              >
                <option value="todos">Todos os acessos</option>
                <option value="mais_7_dias">Sem acesso &gt; 7 dias</option>
                <option value="mais_14_dias">Sem acesso &gt; 14 dias</option>
                <option value="mais_30_dias">Sem acesso &gt; 30 dias</option>
                <option value="sem_acesso">Nunca acessou</option>
              </select>

              {/* Seletor de Fluxo de Atendimento */}
              <select
                value={statusKanbanFilter}
                onChange={(e) => {
                  setStatusKanbanFilter(e.target.value)
                  setPage(1)
                }}
                className="h-9 px-3 text-xs bg-gray-100 border-none rounded-lg text-gray-700 font-medium focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                title="Filtrar por status no fluxo de atendimento"
              >
                <option value="todos">Todos os fluxos</option>
                <option value="sem_atendimento">Sem Atendimento</option>
                <option value="pendente">A Contatar</option>
                <option value="em_contato">Em Contato</option>
                <option value="em_recuperacao">Em Acompanhamento</option>
                <option value="revertido">Regularizado</option>
                <option value="evadido">Não Localizado</option>
              </select>
            </div>

            {/* Botão de Exportação Excel */}
            <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={exportToExcel}
                disabled={exporting}
                className="h-9 px-3 text-xs font-semibold text-emerald-700 border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100 hover:text-emerald-800 transition-all cursor-pointer gap-1.5 shadow-2xs"
              >
                <FileSpreadsheet className={`w-3.5 h-3.5 ${exporting ? "animate-spin" : ""}`} />
                {exporting ? "Exportando..." : "Exportar Excel (CSV)"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Engajamento Discente */}
      <Card className="border border-gray-100 shadow-sm rounded-xl overflow-hidden relative">
        {loading && students.length > 0 && (
          <div className="absolute top-2 right-4 z-30 flex items-center gap-1.5 px-2.5 py-1 bg-white/90 backdrop-blur-xs border border-gray-200 rounded-full text-[11px] font-medium text-indigo-600 shadow-xs">
            <RefreshCw className="w-3 h-3 animate-spin" /> Atualizando...
          </div>
        )}
        <Table className={`min-w-[1150px] w-full ${loading && students.length > 0 ? "opacity-50 pointer-events-none transition-opacity duration-200" : "transition-opacity duration-200"}`}>
          <TableHeader className="bg-gray-50/75">
            <TableRow>
              <TableHead className="text-xs font-semibold text-gray-600 uppercase min-w-[180px] max-w-[210px] pl-4">Estudante</TableHead>
              <TableHead className="text-xs font-semibold text-gray-600 uppercase min-w-[170px] max-w-[210px]">Disciplina</TableHead>
              <TableHead className="text-xs font-semibold text-gray-600 uppercase text-center min-w-[115px] w-[115px]">Classificação</TableHead>
              <TableHead className="text-xs font-semibold text-gray-600 uppercase text-center min-w-[125px] w-[125px]">Fluxo Atendimento</TableHead>
              <TableHead className="text-xs font-semibold text-gray-600 uppercase text-center min-w-[95px] w-[95px]">Último Acesso</TableHead>
              <TableHead className="text-xs font-semibold text-gray-600 uppercase text-center min-w-[75px] w-[75px]">Tempo Total</TableHead>
              <TableHead className="text-xs font-semibold text-gray-600 uppercase min-w-[105px] w-[105px]">Tempo por Fase</TableHead>
              <TableHead className="text-xs font-semibold text-gray-600 uppercase min-w-[120px] w-[120px]">Leitura e Avaliações</TableHead>
              <TableHead className="text-xs font-semibold text-gray-600 uppercase text-center min-w-[70px] w-[70px]">Cliques</TableHead>
              <TableHead className="text-xs font-semibold text-gray-600 uppercase text-center min-w-[95px] w-[95px] pr-4">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && students.length === 0 ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i} className="animate-pulse">
                  <TableCell colSpan={10} className="py-4">
                    <div className="h-4 bg-gray-100 rounded-md w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : students.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="py-12 text-center text-gray-400">
                  Nenhum aluno encontrado com os filtros aplicados.
                </TableCell>
              </TableRow>
            ) : (
              students.map((student) => {
                const tempoNum = parseFloat(student.tempo_total_minutos || "0")
                const tempoFase1 = parseFloat(student.tempo_fase1_minutos || "0")
                const tempoFase2 = parseFloat(student.tempo_fase2_minutos || "0")
                const tempoFase3 = parseFloat(student.tempo_fase3_minutos || "0")
                const tempoLeitura = parseFloat(student.tempo_leitura_minutos || "0")
                const tempoProvas = parseFloat(student.tempo_avaliacoes_minutos || "0")

                return (
                  <TableRow key={student.id} className="hover:bg-gray-50/80 transition-colors">
                    {/* Estudante */}
                    <TableCell className="py-3 min-w-[180px] max-w-[210px] pl-4">
                      <div className="font-semibold text-gray-900 text-sm truncate" title={student.aluno_nome}>
                        {student.aluno_nome || "Nome não informado"}
                      </div>
                      <div className="text-xs text-gray-400 flex items-center gap-1.5 mt-0.5">
                        <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-[11px] text-gray-600 shrink-0">
                          {student.matricula || "S/ Matrícula"}
                        </span>
                        <span>•</span>
                        <span className="truncate max-w-[130px]" title={student.aluno_email}>
                          {student.aluno_email || ""}
                        </span>
                      </div>
                    </TableCell>

                    {/* Disciplina */}
                    <TableCell className="py-3 min-w-[170px] max-w-[210px]">
                      <div className="text-sm font-medium text-gray-800 truncate" title={student.disciplina_nome}>
                        {student.disciplina_nome || "Disciplina não identificada"}
                      </div>
                      <div className="text-xs text-indigo-600/80 font-mono truncate">
                        {student.disciplina_codigo || ""}
                      </div>
                    </TableCell>

                    {/* Grupo de Risco */}
                    <TableCell className="py-3 text-center min-w-[115px] w-[115px]">
                      <div className="flex justify-center">
                        {renderRiskBadge(student.grupo_risco_calculado)}
                      </div>
                    </TableCell>

                    {/* Fluxo de Atendimento */}
                    <TableCell className="py-3 text-center min-w-[125px] w-[125px]">
                      <div className="flex justify-center">
                        {renderKanbanStatusBadge(student.status_kanban)}
                      </div>
                    </TableCell>

                    {/* Último Acesso */}
                    <TableCell className="py-3 text-center min-w-[95px] w-[95px]">
                      {renderAccessRecency(student.data_ultimo_acesso, student.data_ultimo_login)}
                    </TableCell>

                    {/* Tempo Total */}
                    <TableCell className="py-3 text-center min-w-[75px] w-[75px]">
                      <span className="font-bold text-gray-900 text-sm">
                        {formatFriendlyDuration(tempoNum)}
                      </span>
                    </TableCell>

                    {/* Tempo por Fase */}
                    <TableCell className="py-3 min-w-[105px] w-[105px]">
                      <div className="flex flex-col gap-1 w-full text-xs">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-gray-500 font-medium">F1:</span>
                          <span className={tempoFase1 > 0 ? "font-semibold text-blue-700 bg-blue-50/70 px-1 py-0.5 rounded text-[10px]" : "text-gray-400 font-normal"}>
                            {tempoFase1 > 0 ? formatFriendlyDuration(tempoFase1) : "—"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-gray-500 font-medium">F2:</span>
                          <span className={tempoFase2 > 0 ? "font-semibold text-amber-700 bg-amber-50/70 px-1 py-0.5 rounded text-[10px]" : "text-gray-400 font-normal"}>
                            {tempoFase2 > 0 ? formatFriendlyDuration(tempoFase2) : "—"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-gray-500 font-medium">F3:</span>
                          <span className={tempoFase3 > 0 ? "font-semibold text-purple-700 bg-purple-50/70 px-1 py-0.5 rounded text-[10px]" : "text-gray-400 font-normal"}>
                            {tempoFase3 > 0 ? formatFriendlyDuration(tempoFase3) : "—"}
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    {/* Leitura e Avaliações */}
                    <TableCell className="py-3 min-w-[120px] w-[120px]">
                      <div className="flex flex-col gap-1 w-full text-xs">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="inline-flex items-center gap-1 text-gray-600 font-medium">
                            <BookOpen className="w-3 h-3 text-blue-600 shrink-0" />
                            Leit:
                          </span>
                          <span className={tempoLeitura > 0 ? "font-semibold text-gray-900 bg-blue-50/50 px-1 py-0.5 rounded text-[10px]" : "text-gray-400 font-normal"}>
                            {tempoLeitura > 0 ? formatFriendlyDuration(tempoLeitura) : "—"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="inline-flex items-center gap-1 text-gray-600 font-medium">
                            <HelpCircle className="w-3 h-3 text-purple-600 shrink-0" />
                            Aval:
                          </span>
                          <span className={tempoProvas > 0 ? "font-semibold text-gray-900 bg-purple-50/50 px-1 py-0.5 rounded text-[10px]" : "text-gray-400 font-normal"}>
                            {tempoProvas > 0 ? formatFriendlyDuration(tempoProvas) : "—"}
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    {/* Total Cliques */}
                    <TableCell className="py-3 text-center min-w-[70px] w-[70px]">
                      <span className="font-semibold text-gray-700 text-sm">
                        {student.total_cliques?.toLocaleString() || 0}
                      </span>
                      <div className="text-[11px] text-gray-400">
                        {student.total_atividades_acessadas || 0} ativ.
                      </div>
                    </TableCell>

                    {/* Ação */}
                    <TableCell className="py-2.5 text-center min-w-[95px] w-[95px] pr-4">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenStudentLogs(student)}
                        className="h-8 px-2.5 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 font-medium cursor-pointer gap-1 mx-auto text-xs"
                      >
                        <Eye className="w-3.5 h-3.5" /> Detalhes
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>

        {/* Paginação */}
        <div className="p-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
          <div>
            Mostrando página <span className="font-semibold text-gray-900">{pagination.page}</span> de{" "}
            <span className="font-semibold text-gray-900">{pagination.totalPages || 1}</span> ({pagination.total} registros)
          </div>

          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => {
                if (page > 1) setPage(page - 1)
              }}
              className="h-8 px-2.5 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= pagination.totalPages || loading}
              onClick={() => {
                if (page < pagination.totalPages) setPage(page + 1)
              }}
              className="h-8 px-2.5 cursor-pointer"
            >
              Próxima <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Modal Central Amplo: Detalhes de Atividades do Aluno */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-200">
            {/* Header Fixo do Modal */}
            <div className="p-5 border-b border-gray-100 bg-gray-50/75 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-indigo-100/70 text-indigo-700 shrink-0">
                    <Activity className="w-5 h-5" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-bold text-gray-900 text-lg sm:text-xl truncate" title={selectedStudent.aluno_nome}>
                      {selectedStudent.aluno_nome}
                    </h3>
                    <p className="text-xs text-gray-500 font-mono flex flex-wrap items-center gap-2 mt-0.5">
                      <span>Matrícula: <strong className="text-gray-700">{selectedStudent.matricula}</strong></span>
                      <span>•</span>
                      <span className="truncate">{selectedStudent.aluno_email}</span>
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-medium text-gray-700 bg-white px-2.5 py-1 rounded-md border border-gray-200/80 shadow-2xs">
                    {selectedStudent.disciplina_nome} <span className="text-indigo-600 font-mono">({selectedStudent.disciplina_codigo})</span>
                  </span>
                  {studentDiscente?.curso_nome && (
                    <span className="text-gray-600 bg-white px-2.5 py-1 rounded-md border border-gray-200/80 shadow-2xs">
                      Curso: <strong>{studentDiscente.curso_nome}</strong>
                    </span>
                  )}
                  {studentDiscente?.unidade_fisica && (
                    <span className="text-gray-600 bg-white px-2.5 py-1 rounded-md border border-gray-200/80 shadow-2xs">
                      Polo: <strong>{studentDiscente.unidade_fisica}</strong>
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <div className="flex flex-col items-end gap-1.5">
                  {renderRiskBadge(selectedStudent.grupo_risco_calculado)}
                  {renderKanbanStatusBadge(selectedStudent.status_kanban)}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedStudent(null)}
                  className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-200/70 transition-colors cursor-pointer"
                  title="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Barra de Abas (Tabs Navigation) */}
            <div className="flex items-center gap-2 px-5 pt-3 border-b border-gray-100 bg-white shrink-0">
              <button
                type="button"
                onClick={() => setDetailTab("acolhimento")}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all border-b-2 cursor-pointer ${
                  detailTab === "acolhimento"
                    ? "border-purple-600 text-purple-700 bg-purple-50/50"
                    : "border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                <MessageCircle className="w-4 h-4" />
                <span>Acolhimento & WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={() => setDetailTab("diagnostico")}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all border-b-2 cursor-pointer ${
                  detailTab === "diagnostico"
                    ? "border-indigo-600 text-indigo-700 bg-indigo-50/50"
                    : "border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                <Activity className="w-4 h-4" />
                <span>Diagnóstico AVA & Materiais ({studentLogs.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setDetailTab("historico")}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all border-b-2 cursor-pointer ${
                  detailTab === "historico"
                    ? "border-blue-600 text-blue-700 bg-blue-50/50"
                    : "border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>Histórico & Tutoria</span>
              </button>
            </div>

            {/* Conteúdo da Aba 1: Acolhimento & WhatsApp */}
            {detailTab === "acolhimento" && (
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
                {/* Stepper do Kanban */}
                <div className="bg-white rounded-xl border border-gray-200/80 p-4 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-purple-100 text-purple-700">
                        <Kanban className="w-4 h-4" />
                      </span>
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-800">
                          Fluxo de Acompanhamento (Kanban)
                        </h4>
                        <p className="text-[11px] text-gray-500">
                          Clique em uma das etapas para avançar o discente no fluxo pedagógico.
                        </p>
                      </div>
                    </div>
                    <div>{renderKanbanStatusBadge(selectedStudent.status_kanban)}</div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                    {[
                      { id: "pendente", step: "1", title: "A Contatar", desc: "Aguardando ação" },
                      { id: "em_contato", step: "2", title: "Em Contato", desc: "Mensagem enviada" },
                      { id: "em_recuperacao", step: "3", title: "Acompanhamento", desc: "Plano pedagógico" },
                      { id: "revertido", step: "4", title: "Regularizado", desc: "Engajamento retomado" },
                    ].map((s) => {
                      const isActive = selectedStudent.status_kanban === s.id
                      const isPassed =
                        (s.id === "pendente" && ["em_contato", "em_recuperacao", "revertido"].includes(selectedStudent.status_kanban)) ||
                        (s.id === "em_contato" && ["em_recuperacao", "revertido"].includes(selectedStudent.status_kanban)) ||
                        (s.id === "em_recuperacao" && ["revertido"].includes(selectedStudent.status_kanban))

                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => handleUpdateStudentKanbanStatus(s.id)}
                          disabled={sendingToKanban}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                            isActive
                              ? "bg-purple-50/90 border-purple-400 ring-2 ring-purple-300 shadow-xs"
                              : isPassed
                              ? "bg-emerald-50/60 border-emerald-200 text-gray-700 hover:bg-emerald-50"
                              : "bg-gray-50/70 border-gray-200 text-gray-500 hover:bg-gray-100"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span
                              className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${
                                isActive
                                  ? "bg-purple-600 text-white"
                                  : isPassed
                                  ? "bg-emerald-600 text-white"
                                  : "bg-gray-200 text-gray-600"
                              }`}
                            >
                              {isPassed ? "✓" : s.step}
                            </span>
                            {isActive && (
                              <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded">
                                Atual
                              </span>
                            )}
                          </div>
                          <div className={`text-xs font-bold leading-tight ${isActive ? "text-purple-900" : isPassed ? "text-emerald-900" : "text-gray-700"}`}>
                            {s.title}
                          </div>
                          <div className="text-[11px] text-gray-400 mt-0.5">{s.desc}</div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Central de Contato Ativo & Acolhimento */}
                <div className="bg-gradient-to-br from-indigo-50/40 via-white to-purple-50/20 rounded-xl border border-gray-200/80 p-5 shadow-2xs space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-indigo-100/70 text-indigo-700">
                        <MessageCircle className="w-4 h-4" />
                      </span>
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-800">
                          Central de Contato Ativo & Acolhimento
                        </h4>
                        <p className="text-[11px] text-gray-500">
                          Selecione o modelo pedagógico e envie diretamente para o estudante via WhatsApp ou E-mail.
                        </p>
                      </div>
                    </div>

                    {/* WhatsApp Badge com destaque */}
                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-2xs text-xs">
                      <Phone className="w-4 h-4 text-emerald-600" />
                      <span className="text-gray-500 font-medium">WhatsApp:</span>
                      <strong className="text-gray-900 font-mono">
                        {studentDiscente?.telefone || (logsLoading ? "Buscando..." : "Não cadastrado")}
                      </strong>
                    </div>
                  </div>

                  {/* Seletor de Templates */}
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-gray-700">Selecione o tom pedagógico:</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleSelectTemplate("critico")}
                          className={`px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                            activeTemplate === "critico"
                              ? "bg-red-500 text-white shadow-2xs"
                              : "bg-red-50 text-red-700 hover:bg-red-100"
                          }`}
                        >
                          Acolhimento Crítico
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSelectTemplate("atencao")}
                          className={`px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                            activeTemplate === "atencao"
                              ? "bg-amber-500 text-white shadow-2xs"
                              : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                          }`}
                        >
                          Lembrete Atenção
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSelectTemplate("autonomo")}
                          className={`px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                            activeTemplate === "autonomo"
                              ? "bg-emerald-600 text-white shadow-2xs"
                              : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          }`}
                        >
                          Incentivo (Em Dia)
                        </button>
                      </div>
                    </div>

                    <textarea
                      value={customMessage}
                      onChange={(e) => setCustomMessage(e.target.value)}
                      rows={4}
                      className="w-full text-xs p-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans leading-relaxed resize-none shadow-2xs"
                      placeholder="Escreva ou edite a mensagem antes de disparar..."
                    />
                  </div>

                  {/* Barra de Ações */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100">
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleSendToKanban}
                        disabled={sendingToKanban}
                        className={`h-9 px-3.5 text-xs font-semibold cursor-pointer gap-1.5 transition-all ${
                          kanbanSent
                            ? "text-emerald-700 border-emerald-300 bg-emerald-50"
                            : "text-purple-700 border-purple-200 bg-purple-50/70 hover:bg-purple-100"
                        }`}
                      >
                        {sendingToKanban ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-600" />
                            Encaminhando...
                          </>
                        ) : kanbanSent ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            Encaminhado ao Kanban
                          </>
                        ) : (
                          <>
                            <Kanban className="w-3.5 h-3.5 text-purple-600" />
                            Encaminhar ao Kanban
                          </>
                        )}
                      </Button>

                      {kanbanSent && (
                        <Link href="/tutoria/kanban" target="_blank">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-9 px-2.5 text-xs font-semibold text-purple-700 hover:text-purple-900 hover:bg-purple-50 cursor-pointer gap-1"
                          >
                            Abrir Kanban
                            <ExternalLink className="w-3 h-3" />
                          </Button>
                        </Link>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleCopyMessage}
                        className="h-9 px-3.5 text-xs font-semibold text-gray-700 border-gray-200 hover:bg-gray-100 cursor-pointer gap-1.5"
                      >
                        {copiedMessage ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" /> Copiado!
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-gray-500" /> Copiar Texto
                          </>
                        )}
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleSendEmail}
                        disabled={sendingEmail}
                        className="h-9 px-3.5 text-xs font-semibold text-blue-700 border-blue-200 bg-blue-50/70 hover:bg-blue-100 disabled:opacity-50 cursor-pointer gap-1.5"
                      >
                        {sendingEmail ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                            Enviando...
                          </>
                        ) : (
                          <>
                            <Mail className="w-3.5 h-3.5 text-blue-600" />
                            Enviar E-mail
                          </>
                        )}
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        onClick={handleSendWhatsApp}
                        disabled={!studentDiscente?.telefone}
                        className="h-9 px-4 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed cursor-pointer gap-1.5 shadow-xs"
                      >
                        <MessageCircle className="w-4 h-4" />
                        Chamar no WhatsApp
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Conteúdo da Aba 2: Diagnóstico AVA & Materiais */}
            {detailTab === "diagnostico" && (
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
                {/* Métricas Principais em Grid Espaçoso */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-white p-3.5 rounded-xl border border-gray-200/80 shadow-2xs">
                    <span className="text-[10px] uppercase font-bold text-gray-400 block">Tempo Total no AVA</span>
                    <span className="text-xl font-bold text-gray-900 mt-1 block">
                      {formatFriendlyDuration(selectedStudent.tempo_total_minutos)}
                    </span>
                    <span className="text-[11px] text-gray-400 mt-0.5 block">Tempo consolidado na disciplina</span>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-gray-200/80 shadow-2xs">
                    <span className="text-[10px] uppercase font-bold text-gray-400 block">Tempos por Fase</span>
                    <div className="mt-1 space-y-0.5 text-xs font-medium">
                      <div className="flex justify-between text-blue-700">
                        <span>Fase 1:</span>
                        <strong>{formatFriendlyDuration(selectedStudent.tempo_fase1_minutos)}</strong>
                      </div>
                      <div className="flex justify-between text-amber-700">
                        <span>Fase 2:</span>
                        <strong>{formatFriendlyDuration(selectedStudent.tempo_fase2_minutos)}</strong>
                      </div>
                      <div className="flex justify-between text-purple-700">
                        <span>Fase 3:</span>
                        <strong>{formatFriendlyDuration(selectedStudent.tempo_fase3_minutos)}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-gray-200/80 shadow-2xs">
                    <span className="text-[10px] uppercase font-bold text-gray-400 block">Leitura vs Avaliações</span>
                    <div className="mt-1 space-y-1 text-xs">
                      <div className="flex justify-between text-gray-700">
                        <span className="flex items-center gap-1">
                          <BookOpen className="w-3.5 h-3.5 text-blue-600" /> Leitura:
                        </span>
                        <strong>{formatFriendlyDuration(selectedStudent.tempo_leitura_minutos)}</strong>
                      </div>
                      <div className="flex justify-between text-gray-700">
                        <span className="flex items-center gap-1">
                          <HelpCircle className="w-3.5 h-3.5 text-purple-600" /> Avaliações:
                        </span>
                        <strong>{formatFriendlyDuration(selectedStudent.tempo_avaliacoes_minutos)}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-gray-200/80 shadow-2xs">
                    <span className="text-[10px] uppercase font-bold text-gray-400 block">Interação & Cliques</span>
                    <span className="text-xl font-bold text-gray-900 mt-1 block">
                      {selectedStudent.total_cliques?.toLocaleString() || 0}
                    </span>
                    <span className="text-[11px] text-gray-400 mt-0.5 block">
                      {selectedStudent.total_atividades_acessadas || 0} atividades acessadas
                    </span>
                  </div>
                </div>

                {/* Recência e Acessos */}
                {(selectedStudent.data_ultimo_acesso || selectedStudent.data_ultimo_login) && (
                  <div className="flex flex-wrap items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200/60 text-xs">
                    {selectedStudent.data_ultimo_acesso && (
                      <span className="flex items-center gap-1.5 text-indigo-700 font-medium">
                        <Clock className="w-3.5 h-3.5" />
                        Último acesso na disciplina: <strong>{formatDateTime(selectedStudent.data_ultimo_acesso)}</strong>
                      </span>
                    )}
                    {selectedStudent.data_ultimo_login && (
                      <span className="flex items-center gap-1.5 text-gray-600">
                        • Último login geral no AVA: <strong>{formatDateTime(selectedStudent.data_ultimo_login)}</strong>
                      </span>
                    )}
                  </div>
                )}

                {/* Lista Completa de Materiais */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase text-gray-500 tracking-wider">
                      Trilha de Navegação & Conteúdos Acessados
                    </h4>
                    <span className="text-xs text-gray-400 font-medium">
                      {studentLogs.length} registros
                    </span>
                  </div>

                  {logsLoading ? (
                    <div className="py-12 text-center text-gray-400 text-sm animate-pulse">
                      Carregando trilha de navegação do estudante...
                    </div>
                  ) : studentLogs.length === 0 ? (
                    <div className="py-12 text-center text-gray-400 text-sm bg-gray-50 rounded-xl border border-dashed border-gray-200">
                      Nenhum log detalhado de atividade registrado para esta disciplina.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                      {studentLogs.map((log) => (
                        <div
                          key={log.id}
                          className="p-3 rounded-xl border border-gray-100 bg-white hover:border-indigo-200 transition-all flex items-start justify-between gap-3 shadow-2xs"
                        >
                          <div className="flex items-start gap-3">
                            <span className="p-2 rounded-lg bg-gray-50 text-indigo-600 mt-0.5 shrink-0">
                              {renderModuleIcon(log.tipo_modulo)}
                            </span>
                            <div>
                              <div className="text-xs font-semibold text-gray-900">
                                {log.conteudo_nome || "Conteúdo sem título"}
                              </div>
                              <div className="text-[11px] text-gray-400 flex flex-wrap items-center gap-1.5 mt-1">
                                <span className="font-medium text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded">
                                  {log.unidade_tematica_nome || "Geral"}
                                </span>
                                <span>•</span>
                                <span className="capitalize">{log.tipo_modulo || "recurso"}</span>
                                {log.data_ultimo_acesso_conteudo && (
                                  <>
                                    <span>•</span>
                                    <span className="text-gray-600 font-mono text-[10px]">
                                      Último clique: {formatDateTime(log.data_ultimo_acesso_conteudo)}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <div className="text-xs font-bold text-gray-900">
                              {formatFriendlyDuration(log.tempo_conteudo_minutos)}
                            </div>
                            <div className="text-[11px] text-gray-400">
                              {log.qtd_cliques_acessos} cliques
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Conteúdo da Aba 3: Histórico & Tutoria */}
            {detailTab === "historico" && (
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
                {/* 1. Status Atual & Gestão de Carteira */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Ficha do Atendimento */}
                  <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-2xs space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Kanban className="w-4 h-4 text-purple-600" />
                        Status Atual da Intervenção
                      </span>
                      {renderKanbanStatusBadge(selectedStudent.status_kanban)}
                    </h4>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between py-1.5 border-b border-gray-100">
                        <span className="text-gray-500">Tutor Responsável:</span>
                        <div className="flex items-center gap-1.5">
                          <strong className="text-gray-900">
                            {selectedStudent.kanban_tutor_nome || (selectedStudent.status_kanban ? (sessionUser?.name || "Você") : "Não atribuído")}
                          </strong>
                          {selectedStudent.kanban_tutor_id === sessionUser?.id && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              Você
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-gray-100">
                        <span className="text-gray-500">Último Contato Realizado:</span>
                        <strong className="text-gray-900 font-mono">
                          {selectedStudent.kanban_ultimo_contato ? formatDateTime(selectedStudent.kanban_ultimo_contato) : "Nenhum registrado"}
                        </strong>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-gray-100">
                        <span className="text-gray-500">Canal de Comunicação:</span>
                        <span className="capitalize font-semibold text-gray-900">
                          {selectedStudent.kanban_canal || "WhatsApp"}
                        </span>
                      </div>
                      {selectedStudent.kanban_data_resolucao && (
                        <div className="flex justify-between py-1.5 border-b border-gray-100">
                          <span className="text-gray-500">Data de Regularização:</span>
                          <strong className="text-emerald-700 font-mono">
                            {formatDateTime(selectedStudent.kanban_data_resolucao)}
                          </strong>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Ações de Gestão de Carteira */}
                  <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-2xs space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-indigo-600" />
                      Gestão de Carteira
                    </h4>
                    <p className="text-xs text-gray-500">
                      Caso o aluno não responda às tentativas de acolhimento ou tenha abandonado, marque como não localizado.
                    </p>

                    <div className="pt-2 flex flex-col gap-2">
                      {selectedStudent.status_kanban !== "evadido" ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleUpdateStudentKanbanStatus("evadido")}
                          disabled={sendingToKanban}
                          className="h-9 text-xs font-semibold text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 cursor-pointer justify-start gap-2"
                        >
                          <XCircle className="w-4 h-4" />
                          Marcar como Não Localizado (Abandono)
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleUpdateStudentKanbanStatus("pendente")}
                          disabled={sendingToKanban}
                          className="h-9 text-xs font-semibold text-indigo-600 border-indigo-200 hover:bg-indigo-50 cursor-pointer justify-start gap-2"
                        >
                          <RefreshCw className="w-4 h-4" />
                          Reativar Atendimento no Kanban
                        </Button>
                      )}

                      <Link href="/tutoria/kanban" target="_blank">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full h-9 text-xs font-semibold text-purple-700 border-purple-200 hover:bg-purple-50 cursor-pointer justify-start gap-2"
                        >
                          <Kanban className="w-4 h-4" />
                          Ver Quadro Kanban Completo
                          <ExternalLink className="w-3 h-3 ml-auto" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>

                {/* 2. Formulário Interativo de Nova Intervenção / Contato */}
                <div className="bg-gradient-to-r from-indigo-50/50 via-purple-50/30 to-blue-50/40 p-4 sm:p-5 rounded-xl border border-indigo-100 shadow-2xs">
                  <TutoriaInterventionForm
                    matricula={selectedStudent.matricula}
                    atendimentoId={selectedStudent.kanban_card_id}
                    periodo={periodo}
                    currentStatus={selectedStudent.status_kanban}
                    onSuccess={handleInterventionSuccess}
                  />
                </div>

                {/* 3. Linha do Tempo Cronológica Completa */}
                <div className="bg-white p-4 sm:p-5 rounded-xl border border-gray-200/80 shadow-2xs">
                  <TutoriaTimeline
                    events={timelineEvents}
                    sessionUser={sessionUser}
                    currentTutorId={selectedStudent.kanban_tutor_id || null}
                    isLoading={timelineLoading}
                    error={timelineError}
                    onRefresh={() => loadTimeline(selectedStudent.matricula, selectedStudent.kanban_card_id)}
                  />
                </div>
              </div>
            )}

            {/* Footer Fixo do Modal */}
            <div className="p-4 px-6 border-t border-gray-100 bg-gray-50/70 flex items-center justify-between shrink-0">
              <span className="text-xs text-gray-400">
                Dados consolidados via SQL Adiado (ID 63) • Tutoria Nexus Core
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedStudent(null)}
                className="cursor-pointer"
              >
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
