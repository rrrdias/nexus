"use client"

import React, { useState, useEffect, useCallback } from "react"
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
  TrendingUp,
  Download,
  FileSpreadsheet,
  Mail,
  Phone,
  MessageCircle,
  Copy,
  Check,
  ExternalLink,
  Send,
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
  getTutoriaSyncStatus,
  getTutoriaDisciplinas,
  getTutoriaExportData,
} from "@/app/actions/tutoria"

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

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type })
    setTimeout(() => setToast({ message: "", type: null }), 4500)
  }

  // Carregar lista de disciplinas disponíveis do período
  const loadDisciplinas = useCallback(async () => {
    try {
      const data = await getTutoriaDisciplinas(periodo, "ead")
      if (Array.isArray(data)) {
        setDisciplinas(data)
      }
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
  }, [periodo, selectedDisciplina, grupoRisco, faixaTempo, recenciaAcesso, debouncedSearch, page])

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
      } else {
        setStudentLogs(Array.isArray(res) ? res : [])
      }
    } catch (err: any) {
      showToast(err.message || "Erro ao carregar logs do estudante.", "error")
    } finally {
      setLogsLoading(false)
    }
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

  // Disparo E-mail
  const handleSendEmail = () => {
    const email = studentDiscente?.email || selectedStudent?.aluno_email
    if (!email) {
      showToast("Estudante não possui e-mail cadastrado.", "error")
      return
    }
    const subject = encodeURIComponent(`Acompanhamento Tutoria: ${selectedStudent?.disciplina_nome || "Sua Disciplina"}`)
    const body = encodeURIComponent(customMessage)
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`
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
      let text = diffDays <= 0 ? "Hoje" : diffDays === 1 ? "Ontem" : `há ${diffDays}d`
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
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-xl border text-sm font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top-4 ${
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
      <Card className="border border-gray-100 shadow-sm rounded-xl overflow-hidden">
        <div className="overflow-x-auto relative">
          {loading && students.length > 0 && (
            <div className="absolute top-2 right-4 z-10 flex items-center gap-1.5 px-2.5 py-1 bg-white/90 backdrop-blur-xs border border-gray-200 rounded-full text-[11px] font-medium text-indigo-600 shadow-xs">
              <RefreshCw className="w-3 h-3 animate-spin" /> Atualizando...
            </div>
          )}
          <Table className={loading && students.length > 0 ? "opacity-50 pointer-events-none transition-opacity duration-200" : "transition-opacity duration-200"}>
            <TableHeader className="bg-gray-50/75">
              <TableRow>
                <TableHead className="text-xs font-semibold text-gray-600 uppercase">Estudante</TableHead>
                <TableHead className="text-xs font-semibold text-gray-600 uppercase">Disciplina</TableHead>
                <TableHead className="text-xs font-semibold text-gray-600 uppercase">Classificação</TableHead>
                <TableHead className="text-xs font-semibold text-gray-600 uppercase text-center">Último Acesso</TableHead>
                <TableHead className="text-xs font-semibold text-gray-600 uppercase text-center">Tempo Total</TableHead>
                <TableHead className="text-xs font-semibold text-gray-600 uppercase">Tempo por Fase</TableHead>
                <TableHead className="text-xs font-semibold text-gray-600 uppercase">Leitura e Avaliações</TableHead>
                <TableHead className="text-xs font-semibold text-gray-600 uppercase text-center">Cliques</TableHead>
                <TableHead className="text-xs font-semibold text-gray-600 uppercase text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && students.length === 0 ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i} className="animate-pulse">
                    <TableCell colSpan={9} className="py-4">
                      <div className="h-4 bg-gray-100 rounded-md w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : students.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-12 text-center text-gray-400">
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
                      <TableCell className="py-3">
                        <div className="font-semibold text-gray-900 text-sm">
                          {student.aluno_nome || "Nome não informado"}
                        </div>
                        <div className="text-xs text-gray-400 flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-[11px] text-gray-600">
                            {student.matricula || "S/ Matrícula"}
                          </span>
                          <span>•</span>
                          <span>{student.aluno_email || ""}</span>
                        </div>
                      </TableCell>

                      {/* Disciplina */}
                      <TableCell className="py-3 max-w-[260px]">
                        <div className="text-sm font-medium text-gray-800 truncate" title={student.disciplina_nome}>
                          {student.disciplina_nome || "Disciplina não identificada"}
                        </div>
                        <div className="text-xs text-indigo-600/80 font-mono">
                          {student.disciplina_codigo || ""}
                        </div>
                      </TableCell>

                      {/* Grupo de Risco */}
                      <TableCell className="py-3">
                        {renderRiskBadge(student.grupo_risco_calculado)}
                      </TableCell>

                      {/* Último Acesso */}
                      <TableCell className="py-3 text-center">
                        {renderAccessRecency(student.data_ultimo_acesso, student.data_ultimo_login)}
                      </TableCell>

                      {/* Tempo Total */}
                      <TableCell className="py-3 text-center">
                        <span className="font-bold text-gray-900 text-sm">
                          {formatFriendlyDuration(tempoNum)}
                        </span>
                      </TableCell>

                      {/* Tempo por Fase */}
                      <TableCell className="py-3">
                        <div className="flex flex-col gap-1 min-w-[110px] text-xs">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-gray-500 font-medium">Fase 1:</span>
                            <span className={tempoFase1 > 0 ? "font-semibold text-blue-700 bg-blue-50/70 px-1.5 py-0.5 rounded" : "text-gray-400 font-normal"}>
                              {tempoFase1 > 0 ? formatFriendlyDuration(tempoFase1) : "—"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-gray-500 font-medium">Fase 2:</span>
                            <span className={tempoFase2 > 0 ? "font-semibold text-amber-700 bg-amber-50/70 px-1.5 py-0.5 rounded" : "text-gray-400 font-normal"}>
                              {tempoFase2 > 0 ? formatFriendlyDuration(tempoFase2) : "—"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-gray-500 font-medium">Fase 3:</span>
                            <span className={tempoFase3 > 0 ? "font-semibold text-purple-700 bg-purple-50/70 px-1.5 py-0.5 rounded" : "text-gray-400 font-normal"}>
                              {tempoFase3 > 0 ? formatFriendlyDuration(tempoFase3) : "—"}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      {/* Leitura e Avaliações */}
                      <TableCell className="py-3">
                        <div className="flex flex-col gap-1 min-w-[130px] text-xs">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="inline-flex items-center gap-1.5 text-gray-600 font-medium">
                              <BookOpen className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              Leitura:
                            </span>
                            <span className={tempoLeitura > 0 ? "font-semibold text-gray-900 bg-blue-50/50 px-1.5 py-0.5 rounded" : "text-gray-400 font-normal"}>
                              {tempoLeitura > 0 ? formatFriendlyDuration(tempoLeitura) : "—"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="inline-flex items-center gap-1.5 text-gray-600 font-medium">
                              <HelpCircle className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                              Avaliações:
                            </span>
                            <span className={tempoProvas > 0 ? "font-semibold text-gray-900 bg-purple-50/50 px-1.5 py-0.5 rounded" : "text-gray-400 font-normal"}>
                              {tempoProvas > 0 ? formatFriendlyDuration(tempoProvas) : "—"}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      {/* Total Cliques */}
                      <TableCell className="py-3 text-center">
                        <span className="font-semibold text-gray-700 text-sm">
                          {student.total_cliques?.toLocaleString() || 0}
                        </span>
                        <div className="text-[11px] text-gray-400">
                          {student.total_atividades_acessadas || 0} ativ.
                        </div>
                      </TableCell>

                      {/* Ação */}
                      <TableCell className="py-3 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenStudentLogs(student)}
                          className="h-8 px-2.5 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 font-medium cursor-pointer gap-1"
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
        </div>

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

      {/* Drawer / Modal Lateral: Detalhes de Atividades do Aluno */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            {/* Header do Drawer */}
            <div className="p-5 border-b border-gray-100 flex items-start justify-between bg-gray-50/50">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                    <Activity className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg">
                      {selectedStudent.aluno_nome}
                    </h3>
                    <p className="text-xs text-gray-500 font-mono">
                      Matrícula: {selectedStudent.matricula} • {selectedStudent.aluno_email}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-600 font-medium">
                  <span className="font-semibold">{selectedStudent.disciplina_nome}</span>
                  <span className="text-gray-400 font-mono">({selectedStudent.disciplina_codigo})</span>
                </div>
                {(selectedStudent.data_ultimo_acesso || selectedStudent.data_ultimo_login) && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                    {selectedStudent.data_ultimo_acesso && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-medium border border-indigo-100">
                        Último na disciplina: {formatDateTime(selectedStudent.data_ultimo_acesso)}
                      </span>
                    )}
                    {selectedStudent.data_ultimo_login && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-medium border border-gray-200">
                        Último login AVA: {formatDateTime(selectedStudent.data_ultimo_login)}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <button
                onClick={() => setSelectedStudent(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Resumo Rápido no Topo do Drawer */}
            <div className="grid grid-cols-3 gap-2 p-4 bg-gray-50/30 border-b border-gray-100 text-center">
              <div className="bg-white p-2.5 rounded-lg border border-gray-100 shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-gray-400 block">Tempo Total</span>
                <span className="text-base font-bold text-gray-900">
                  {formatFriendlyDuration(selectedStudent.tempo_total_minutos)}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-gray-100 shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-gray-400 block">Classificação</span>
                <div className="mt-0.5">{renderRiskBadge(selectedStudent.grupo_risco_calculado)}</div>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-gray-100 shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-gray-400 block">Total Cliques</span>
                <span className="text-base font-bold text-gray-900">
                  {selectedStudent.total_cliques?.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Central de Contato Ativo & Acolhimento Pedagógico */}
            <div className="p-4 bg-gradient-to-br from-indigo-50/40 via-white to-purple-50/20 border-b border-gray-100 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-indigo-100/70 text-indigo-700">
                    <MessageCircle className="w-4 h-4" />
                  </span>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-800">
                      Central de Contato Ativo & Acolhimento
                    </h4>
                    <p className="text-[11px] text-gray-500">
                      Dispare orientações personalizadas diretamente para o estudante via WhatsApp ou E-mail.
                    </p>
                  </div>
                </div>
              </div>

              {/* Dados Acadêmicos do Discente (Telefone, Curso, Polo) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 bg-white/80 p-2.5 rounded-lg border border-gray-100 text-xs">
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="text-gray-500">WhatsApp:</span>
                  <span className="font-semibold text-gray-900 font-mono truncate" title={studentDiscente?.telefone || ""}>
                    {studentDiscente?.telefone || (logsLoading ? "Buscando..." : "Não cadastrado")}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span className="text-gray-500">Curso:</span>
                  <span className="font-semibold text-gray-900 truncate" title={studentDiscente?.curso_nome || ""}>
                    {studentDiscente?.curso_nome || (logsLoading ? "Buscando..." : "—")}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <BookOpen className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                  <span className="text-gray-500">Polo:</span>
                  <span className="font-semibold text-gray-900 truncate" title={studentDiscente?.unidade_fisica || "EAD"}>
                    {studentDiscente?.unidade_fisica || "EAD"}
                  </span>
                </div>
              </div>

              {/* Seleção de Template Pedagógico */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-gray-600">
                  <span>Mensagem Pedagógica Sugerida:</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleSelectTemplate("critico")}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all cursor-pointer ${
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
                      className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all cursor-pointer ${
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
                      className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all cursor-pointer ${
                        activeTemplate === "autonomo"
                          ? "bg-emerald-600 text-white shadow-2xs"
                          : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      }`}
                    >
                      Incentivo (Em Dia)
                    </button>
                  </div>
                </div>

                {/* Textarea editável */}
                <textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  rows={3}
                  className="w-full text-xs p-2.5 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans leading-relaxed resize-none shadow-2xs"
                  placeholder="Escreva ou edite a mensagem antes de disparar..."
                />
              </div>

              {/* Botões de Ação Rápida de Envio */}
              <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyMessage}
                  className="h-8 px-3 text-xs font-semibold text-gray-700 border-gray-200 hover:bg-gray-100 cursor-pointer gap-1.5"
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
                  className="h-8 px-3 text-xs font-semibold text-blue-700 border-blue-200 bg-blue-50/70 hover:bg-blue-100 cursor-pointer gap-1.5"
                >
                  <Mail className="w-3.5 h-3.5 text-blue-600" />
                  Enviar E-mail
                </Button>

                <Button
                  type="button"
                  size="sm"
                  onClick={handleSendWhatsApp}
                  disabled={!studentDiscente?.telefone}
                  className="h-8 px-3 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed cursor-pointer gap-1.5 shadow-xs"
                  title={studentDiscente?.telefone ? "Chamar aluno no WhatsApp" : "Telefone não cadastrado na base acadêmica"}
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  Chamar no WhatsApp
                </Button>
              </div>
            </div>

            {/* Lista Detalhada de Atividades */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="text-xs font-bold uppercase text-gray-400 tracking-wider mb-2">
                Histórico de Materiais e Verificações Acessadas
              </div>

              {logsLoading ? (
                <div className="py-12 text-center text-gray-400 text-sm animate-pulse">
                  Carregando trilha de navegação do estudante...
                </div>
              ) : studentLogs.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-sm">
                  Nenhum log detalhado de atividade registrado para esta disciplina.
                </div>
              ) : (
                <div className="space-y-2">
                  {studentLogs.map((log) => {
                    return (
                      <div
                        key={log.id}
                        className="p-3 rounded-lg border border-gray-100 bg-white hover:border-indigo-100 transition-all flex items-start justify-between gap-3 shadow-2xs"
                      >
                        <div className="flex items-start gap-2.5">
                          <span className="p-1.5 rounded-md bg-gray-50 mt-0.5">
                            {renderModuleIcon(log.tipo_modulo)}
                          </span>
                          <div>
                            <div className="text-xs font-semibold text-gray-900">
                              {log.conteudo_nome || "Conteúdo sem título"}
                            </div>
                            <div className="text-[11px] text-gray-400 flex flex-wrap items-center gap-1.5 mt-1">
                              <span className="font-medium text-indigo-600 bg-indigo-50 px-1 rounded">
                                {log.unidade_tematica_nome || "Geral"}
                              </span>
                              <span>•</span>
                              <span className="capitalize">{log.tipo_modulo || "recurso"}</span>
                              {log.data_ultimo_acesso_conteudo && (
                                <>
                                  <span>•</span>
                                  <span className="text-gray-600 font-mono text-[10px]" title="Data do último clique nesta atividade">
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
                    )
                  })}
                </div>
              )}
            </div>

            {/* Footer do Drawer com CTA Pedagógico */}
            <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <span className="text-xs text-gray-500">
                Dados consolidados via SQL Adiado (ID 63)
              </span>
              <Button
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
