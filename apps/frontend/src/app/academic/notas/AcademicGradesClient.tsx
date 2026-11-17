"use client"

import React, { useCallback, useEffect, useState } from "react"
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  GraduationCap,
  Layers,
  Lock,
  RefreshCw,
  Search,
  Users,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  exportAcademicGradesAction,
  getOnlineTurmasAction,
  getTurmaGradesWithStudentsAction,
  OnlineTurmaItem,
  StudentGradeRowItem,
  triggerSyncAvaCorrelateAction,
  triggerSyncGradesMirrorAction,
} from "@/app/actions/academic-grades"
import { DEFAULT_PERIOD } from "@/lib/academic-config"

interface AcademicGradesClientProps {
  embedded?: boolean
}

function formatGradeValue(val: number | null | undefined, status: string) {
  if (val === null || val === undefined || status === "Pendente") {
    return null
  }
  return val.toFixed(2).replace(".", ",")
}

function getStatusMatriculaBadge(status: string, bloqueio: boolean) {
  const norm = (status || "").toLowerCase()
  if (norm === "matriculado") {
    return (
      <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 font-bold text-[10px] uppercase">
        Matriculado
      </Badge>
    )
  }
  if (norm === "suspenso") {
    return (
      <div className="inline-flex flex-col items-center gap-1">
        <Badge className="bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 font-bold text-[10px] uppercase">
          Suspenso
        </Badge>
        {bloqueio && (
          <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-amber-700">
            <Lock className="w-2.5 h-2.5" /> Bloqueio Lançamento
          </span>
        )}
      </div>
    )
  }
  return (
    <div className="inline-flex flex-col items-center gap-1">
      <Badge className="bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 font-bold text-[10px] uppercase">
        Cancelado
      </Badge>
      {bloqueio && (
        <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-rose-700">
          <Lock className="w-2.5 h-2.5" /> Bloqueio Lançamento
        </span>
      )}
    </div>
  )
}

function GradeCellPill({
  value,
  raw,
  status,
  highlight = false,
}: {
  value: number | null | undefined
  raw?: string | null
  status: string
  highlight?: boolean
}) {
  const formatted = formatGradeValue(value, status)
  if (formatted === null) {
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-500 border border-slate-200"
        title="Nota ainda não lançada no AVA"
      >
        Pendente
      </span>
    )
  }

  const numeric = value ?? 0
  const isPassing = numeric >= 6
  const colorClass = highlight
    ? isPassing
      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
      : "bg-rose-50 text-rose-700 border-rose-200"
    : isPassing
      ? "bg-blue-50 text-blue-700 border-blue-200"
      : "bg-rose-50 text-rose-700 border-rose-200"

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-mono font-bold border ${colorClass}`}
      title={raw ? `Bruto no AVA: ${raw}` : undefined}
    >
      {formatted}
    </span>
  )
}

export function AcademicGradesClient({ embedded = false }: AcademicGradesClientProps) {
  const [periodo, setPeriodo] = useState<string>(DEFAULT_PERIOD)
  const [instituicao, setInstituicao] = useState<string>("")
  const [turmaSearchInput, setTurmaSearchInput] = useState<string>("")
  const [turmaSearchQuery, setTurmaSearchQuery] = useState<string>("")
  const [turmasPage, setTurmasPage] = useState<number>(1)

  const [turmas, setTurmas] = useState<OnlineTurmaItem[]>([])
  const [turmasMeta, setTurmasMeta] = useState({ total: 0, page: 1, pageSize: 50, totalPages: 1 })
  const [loadingTurmas, setLoadingTurmas] = useState<boolean>(true)

  // Selected turma detail state
  const [selectedTurma, setSelectedTurma] = useState<OnlineTurmaItem | null>(null)
  const [students, setStudents] = useState<StudentGradeRowItem[]>([])
  const [studentsMeta, setStudentsMeta] = useState({ total: 0, page: 1, pageSize: 100, totalPages: 1 })
  const [loadingStudents, setLoadingStudents] = useState<boolean>(false)
  const [statusMatriculaFilter, setStatusMatriculaFilter] = useState<string>("todos")
  const [statusNotaFilter, setStatusNotaFilter] = useState<string>("todas")
  const [studentSearchInput, setStudentSearchInput] = useState<string>("")
  const [studentSearchQuery, setStudentSearchQuery] = useState<string>("")
  const [studentsPage, setStudentsPage] = useState<number>(1)

  // Sync & export states
  const [syncingMirror, setSyncingMirror] = useState<boolean>(false)
  const [correlatingTurmaId, setCorrelatingTurmaId] = useState<string | null>(null)
  const [exportingCsv, setExportingCsv] = useState<boolean>(false)

  // Feedback banner
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | null }>({
    message: "",
    type: null,
  })

  // Modal de atividades analíticas VA1/VA2/VA3
  const [detailStudent, setDetailStudent] = useState<StudentGradeRowItem | null>(null)
  const [detailPhaseTab, setDetailPhaseTab] = useState<1 | 2 | 3>(1)

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type })
    setTimeout(() => setToast({ message: "", type: null }), 4500)
  }, [])

  const loadTurmas = useCallback(async () => {
    setLoadingTurmas(true)
    try {
      const res = await getOnlineTurmasAction({
        periodo: periodo || undefined,
        instituicao: instituicao || undefined,
        search: turmaSearchQuery || undefined,
        page: turmasPage,
        pageSize: 50,
      })
      if (res.success && res.data) {
        setTurmas(res.data.data || [])
        setTurmasMeta(
          res.data.meta || { total: 0, page: 1, pageSize: 50, totalPages: 1 },
        )
      } else {
        showToast(res.error || "Erro ao carregar turmas 100% online.", "error")
        setTurmas([])
      }
    } catch {
      showToast("Falha de comunicação ao listar turmas espelhadas.", "error")
      setTurmas([])
    } finally {
      setLoadingTurmas(false)
    }
  }, [periodo, instituicao, turmaSearchQuery, turmasPage, showToast])

  useEffect(() => {
    loadTurmas()
  }, [loadTurmas])

  const loadTurmaStudents = useCallback(
    async (turmaId: string) => {
      setLoadingStudents(true)
      try {
        const res = await getTurmaGradesWithStudentsAction(turmaId, {
          statusMatricula: statusMatriculaFilter,
          statusNota: statusNotaFilter,
          search: studentSearchQuery || undefined,
          page: studentsPage,
          pageSize: 100,
        })
        if (res.success && res.data) {
          if (res.data.turma) setSelectedTurma(res.data.turma)
          setStudents(res.data.alunos || [])
          setStudentsMeta(
            res.data.meta || { total: 0, page: 1, pageSize: 100, totalPages: 1 },
          )
        } else {
          showToast(res.error || "Erro ao carregar alunos e notas da turma.", "error")
        }
      } catch {
        showToast("Falha de comunicação ao consultar alunos da turma.", "error")
      } finally {
        setLoadingStudents(false)
      }
    },
    [statusMatriculaFilter, statusNotaFilter, studentSearchQuery, studentsPage, showToast],
  )

  useEffect(() => {
    if (selectedTurma?.id) {
      loadTurmaStudents(selectedTurma.id)
    }
  }, [selectedTurma?.id, loadTurmaStudents])

  const handleSyncMirrorAll = async () => {
    setSyncingMirror(true)
    try {
      const res = await triggerSyncGradesMirrorAction({
        periodo: periodo || undefined,
        correlateAfter: true,
        async: false,
      })
      if (!res.success) {
        throw new Error(res.error)
      }
      const mirror = res.data?.mirror
      const corr = res.data?.correlation
      showToast(
        `Espelhamento concluído: ${mirror?.turmasEspelhadas || 0} turmas, ${mirror?.matriculasSincronizadas || 0} matrículas e ${corr?.registrosAtualizados || 0} notas correlacionadas.`,
        "success",
      )
      await loadTurmas()
      if (selectedTurma?.id) {
        await loadTurmaStudents(selectedTurma.id)
      }
    } catch (err: any) {
      showToast(err?.message || "Erro ao executar espelhamento de notas.", "error")
    } finally {
      setSyncingMirror(false)
    }
  }

  const handleCorrelateSingleTurma = async (turmaId: string) => {
    setCorrelatingTurmaId(turmaId)
    try {
      const res = await triggerSyncAvaCorrelateAction({ turmaId, async: false })
      if (!res.success) {
        throw new Error(res.error)
      }
      showToast(
        `Notas AVA atualizadas: ${res.data?.updatedCount || 0} estudantes correlacionados.`,
        "success",
      )
      await loadTurmas()
      if (selectedTurma?.id === turmaId) {
        await loadTurmaStudents(turmaId)
      }
    } catch (err: any) {
      showToast(err?.message || "Falha ao buscar notas no AVA para a turma.", "error")
    } finally {
      setCorrelatingTurmaId(null)
    }
  }

  const handleExportCsv = async () => {
    setExportingCsv(true)
    try {
      const res = await exportAcademicGradesAction({
        periodo: periodo || undefined,
        turmaId: selectedTurma?.id,
        statusMatricula: selectedTurma ? statusMatriculaFilter : undefined,
        search: selectedTurma ? studentSearchQuery : turmaSearchQuery,
      })
      if (!res.success) {
        throw new Error(res.error)
      }
      const rows = res.data || []
      if (rows.length === 0) {
        showToast("Não há registros para exportar com os filtros atuais.", "error")
        return
      }

      const headers = [
        "Turma",
        "Disciplina",
        "Período",
        "Matrícula",
        "Aluno",
        "E-mail",
        "Situação Lyceum",
        "Status Normalizado",
        "Bloqueio Lançamento",
        "VA1",
        "Status VA1",
        "VA2",
        "Status VA2",
        "VA3",
        "Status VA3",
        "Média Final",
        "Consolidação",
        "Observação",
      ]

      const escapeCsv = (value: unknown) => {
        const s = value === null || value === undefined ? "" : String(value)
        return `"${s.replace(/"/g, '""')}"`
      }

      const csvLines = [
        headers.map(escapeCsv).join(";"),
        ...rows.map((r: any) =>
          [
            r.turma,
            r.disciplina,
            r.periodo,
            r.matricula,
            r.nomeAluno,
            r.emailAluno || "",
            r.situacaoLyceum || "",
            r.statusMatricula,
            r.bloqueioLancamento ? "SIM" : "NÃO",
            r.va1Nota ?? "",
            r.va1Status,
            r.va2Nota ?? "",
            r.va2Status,
            r.va3Nota ?? "",
            r.va3Status,
            r.mediaFinalNota ?? "",
            r.statusConsolidacao,
            r.divergenciaMotivo || "",
          ]
            .map(escapeCsv)
            .join(";"),
        ),
      ]

      const blob = new Blob(["\uFEFF" + csvLines.join("\r\n")], {
        type: "text/csv;charset=utf-8;",
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      const suffix = selectedTurma ? selectedTurma.turma : periodo || "todas"
      a.download = `notas-online-${suffix}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      showToast(`Exportação concluída (${rows.length} registros).`, "success")
    } catch (err: any) {
      showToast(err?.message || "Falha ao gerar arquivo CSV.", "error")
    } finally {
      setExportingCsv(false)
    }
  }

  // Totais exibidos nos cards executivos da página atual
  const sumAlunos = turmas.reduce((acc, t) => acc + (t.totalAlunos || 0), 0)
  const sumMatriculados = turmas.reduce((acc, t) => acc + (t.totalMatriculados || 0), 0)
  const sumSuspensos = turmas.reduce((acc, t) => acc + (t.totalSuspensos || 0), 0)

  const handleOpenTurma = (t: OnlineTurmaItem) => {
    setSelectedTurma(t)
    setStudentsPage(1)
    setStatusMatriculaFilter("todos")
    setStatusNotaFilter("todas")
    setStudentSearchInput("")
    setStudentSearchQuery("")
  }

  const phaseItems = detailStudent
    ? detailPhaseTab === 1
      ? detailStudent.notas.itensVa1
      : detailPhaseTab === 2
        ? detailStudent.notas.itensVa2
        : detailStudent.notas.itensVa3
    : []

  return (
    <div className="space-y-6 relative">
      {toast.type && (
        <div
          className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-lg border text-white transition-all flex items-center gap-3 ${
            toast.type === "success"
              ? "bg-green-dark border-green-brand"
              : "bg-[#E53935] border-[#D32F2F]"
          }`}
        >
          <span className="font-semibold text-sm">{toast.message}</span>
        </div>
      )}

      {/* Cabeçalho */}
      {!embedded ? (
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 select-none">
          <div>
            <h1 className="text-2xl font-extrabold text-navy tracking-tight flex items-center gap-2.5">
              <Award className="w-7 h-7 text-[#5E35B1]" /> Integração de Notas (Turmas 100% Online)
            </h1>
            <p className="text-sm text-[#5F6775] mt-1">
              Espelhamento de turmas 100% online do Lyceum com status de matrícula e busca de notas VA1, VA2 e VA3 no AVA.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={exportingCsv}
              className="h-9 text-xs font-bold rounded-lg border-gray-300 text-navy hover:bg-gray-50 gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              {exportingCsv ? "Exportando..." : "Exportar CSV"}
            </Button>
            <Button
              size="sm"
              onClick={handleSyncMirrorAll}
              disabled={syncingMirror}
              className="h-9 text-xs font-bold rounded-lg bg-[#5E35B1] hover:bg-[#4E2A96] text-white gap-1.5 shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingMirror ? "animate-spin" : ""}`} />
              {syncingMirror ? "Espelhando & Buscando Notas..." : "Espelhar Turmas & Buscar Notas AVA"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#F4F5F7]/70 p-4 rounded-xl border border-gray-200">
          <div>
            <h2 className="text-sm font-extrabold text-navy flex items-center gap-2">
              <Award className="w-4 h-4 text-[#5E35B1]" /> Submódulo de Integração de Notas (100% Online)
            </h2>
            <p className="text-xs text-[#5F6775] mt-0.5">
              Espelho de turmas online com situação de matrícula (Matriculado/Suspenso) e notas VA1, VA2 e VA3 do Moodle.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={exportingCsv}
              className="h-8 text-xs font-bold rounded-lg border-gray-300 text-navy hover:bg-white gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              {exportingCsv ? "Exportando..." : "Exportar CSV"}
            </Button>
            <Button
              size="sm"
              onClick={handleSyncMirrorAll}
              disabled={syncingMirror}
              className="h-8 text-xs font-bold rounded-lg bg-[#5E35B1] hover:bg-[#4E2A96] text-white gap-1.5 shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingMirror ? "animate-spin" : ""}`} />
              {syncingMirror ? "Sincronizando..." : "Espelhar Turmas & Notas AVA"}
            </Button>
          </div>
        </div>
      )}

      {/* Cards Executivos */}
      {!selectedTurma && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#9AA0AC]">
                  Turmas 100% Online
                </p>
                <p className="text-2xl font-extrabold text-navy mt-1">{turmasMeta.total}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#5E35B1]/10 text-[#5E35B1] flex items-center justify-center">
                <Layers className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-gray-200 shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#9AA0AC]">
                  Vínculos na Página
                </p>
                <p className="text-2xl font-extrabold text-navy mt-1">{sumAlunos}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-gray-200 shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#9AA0AC]">
                  Matriculados (Aptos)
                </p>
                <p className="text-2xl font-extrabold text-emerald-700 mt-1">{sumMatriculados}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-gray-200 shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#9AA0AC]">
                  Suspensos (Bloqueio)
                </p>
                <p className="text-2xl font-extrabold text-amber-700 mt-1">{sumSuspensos}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Lock className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {!selectedTurma ? (
        <>
          {/* Filtros de Turmas 100% Online */}
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardContent className="p-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  setTurmasPage(1)
                  setTurmaSearchQuery(turmaSearchInput)
                }}
                className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
              >
                <div className="md:col-span-5">
                  <label className="text-[11px] font-bold text-[#5F6775] uppercase tracking-wider block mb-1">
                    Buscar Turma ou Disciplina
                  </label>
                  <div className="relative">
                    <Input
                      placeholder="Código da turma, disciplina ou curso..."
                      value={turmaSearchInput}
                      onChange={(e) => setTurmaSearchInput(e.target.value)}
                      className="pl-9 h-10 text-xs border-gray-300"
                    />
                    <Search className="w-4 h-4 text-[#9AA0AC] absolute left-3 top-3" />
                  </div>
                </div>

                <div className="md:col-span-3">
                  <label className="text-[11px] font-bold text-[#5F6775] uppercase tracking-wider block mb-1">
                    Período Letivo
                  </label>
                  <select
                    value={periodo}
                    onChange={(e) => {
                      setPeriodo(e.target.value)
                      setTurmasPage(1)
                    }}
                    className="w-full h-10 text-xs rounded-lg border border-gray-300 bg-white px-3 text-navy focus:outline-none focus:border-[#5E35B1]"
                  >
                    <option value="">Todos os Períodos</option>
                    <option value="2026-2">2026-2 (Atual)</option>
                    <option value="2026-1">2026-1</option>
                    <option value="2025-2">2025-2</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="text-[11px] font-bold text-[#5F6775] uppercase tracking-wider block mb-1">
                    Instituição AVA
                  </label>
                  <select
                    value={instituicao}
                    onChange={(e) => {
                      setInstituicao(e.target.value)
                      setTurmasPage(1)
                    }}
                    className="w-full h-10 text-xs rounded-lg border border-gray-300 bg-white px-3 text-navy focus:outline-none focus:border-[#5E35B1]"
                  >
                    <option value="">Todas</option>
                    <option value="uni">UniEVANGÉLICA</option>
                    <option value="ead">EaD</option>
                    <option value="uniego">UNIEGO</option>
                    <option value="raizes">Raízes</option>
                    <option value="eefn">EEFN</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <Button
                    type="submit"
                    className="w-full h-10 bg-[#5E35B1] hover:bg-[#4E2A96] text-white text-xs font-bold rounded-lg"
                  >
                    Filtrar Turmas
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Tabela de Turmas Espelhadas */}
          <Card className="bg-white border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table className="w-full text-sm">
                <TableHeader>
                  <TableRow className="bg-[#F4F5F7] border-b border-gray-200 select-none">
                    <TableHead className="px-4 py-3 text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider">
                      Turma / Disciplina 100% Online
                    </TableHead>
                    <TableHead className="px-4 py-3 text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider hidden md:table-cell">
                      Instituição / Período
                    </TableHead>
                    <TableHead className="px-4 py-3 text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider text-center">
                      Situação Matrículas
                    </TableHead>
                    <TableHead className="px-4 py-3 text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider text-center">
                      Notas VA1 / VA2 / VA3
                    </TableHead>
                    <TableHead className="px-4 py-3 text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider text-right">
                      Ações
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-100">
                  {loadingTurmas ? (
                    Array.from({ length: 5 }).map((_, idx) => (
                      <TableRow key={idx} className="animate-pulse">
                        <TableCell colSpan={5} className="py-5 px-4">
                          <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
                          <div className="h-3 bg-gray-100 rounded w-1/5" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : turmas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-14 px-4">
                        <div className="flex flex-col items-center justify-center max-w-md mx-auto space-y-3">
                          <GraduationCap className="w-10 h-10 text-[#5E35B1]/50" />
                          <p className="text-sm font-bold text-navy">
                            Nenhuma turma 100% online espelhada para os filtros selecionados
                          </p>
                          <p className="text-xs text-[#5F6775]">
                            Clique em &quot;Espelhar Turmas &amp; Buscar Notas AVA&quot; para gerar o espelho das turmas 100% online a partir da base integrada do Lyceum.
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    turmas.map((t) => (
                      <TableRow key={t.id} className="hover:bg-slate-50/80 transition-colors">
                        <TableCell className="px-4 py-3.5">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-bold text-xs text-[#5E35B1] bg-[#5E35B1]/10 px-2 py-0.5 rounded">
                                {t.turma}
                              </span>
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                {t.modelagem}
                              </span>
                            </div>
                            <p className="font-bold text-navy text-xs">{t.nomeDisciplina}</p>
                            <p className="text-[11px] text-[#5F6775]">
                              {t.cursoNome || `Cód. Disciplina: ${t.disciplina}`}
                            </p>
                          </div>
                        </TableCell>

                        <TableCell className="px-4 py-3.5 hidden md:table-cell">
                          <p className="font-semibold text-navy text-xs">
                            {t.cursoInstituicao || t.sourceInstitution.toUpperCase()}
                          </p>
                          <span className="text-[11px] font-mono text-[#5F6775]">
                            Período: {t.periodo} • AVA: {t.sourceInstitution.toUpperCase()}
                          </span>
                        </TableCell>

                        <TableCell className="px-4 py-3.5 text-center">
                          <div className="flex flex-wrap items-center justify-center gap-1.5">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              Total: {t.totalAlunos}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Matric.: {t.totalMatriculados}
                            </span>
                            {t.totalSuspensos > 0 && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                Susp.: {t.totalSuspensos}
                              </span>
                            )}
                          </div>
                        </TableCell>

                        <TableCell className="px-4 py-3.5 text-center">
                          <div className="inline-flex items-center gap-1.5 font-mono text-[11px]">
                            <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-bold">
                              VA1: {t.totalNotasLancadasVa1}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold">
                              VA2: {t.totalNotasLancadasVa2}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 font-bold">
                              VA3: {t.totalNotasLancadasVa3}
                            </span>
                          </div>
                        </TableCell>

                        <TableCell className="px-4 py-3.5 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={correlatingTurmaId === t.id}
                              onClick={() => handleCorrelateSingleTurma(t.id)}
                              className="h-8 px-2.5 text-[11px] font-semibold rounded-lg border-gray-300 text-navy"
                              title="Atualizar notas VA1, VA2 e VA3 desta turma a partir do AVA"
                            >
                              <RefreshCw
                                className={`w-3.5 h-3.5 ${
                                  correlatingTurmaId === t.id ? "animate-spin" : ""
                                }`}
                              />
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleOpenTurma(t)}
                              className="h-8 px-3 text-[11px] font-bold rounded-lg bg-[#5E35B1] hover:bg-[#4E2A96] text-white gap-1.5"
                            >
                              <Eye className="w-3.5 h-3.5" /> Alunos e Notas
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {turmasMeta.totalPages > 1 && (
              <div className="bg-[#F4F5F7] border-t border-gray-200 px-5 py-3 flex items-center justify-between">
                <p className="text-xs text-[#5F6775]">
                  Página <strong>{turmasMeta.page}</strong> de <strong>{turmasMeta.totalPages}</strong> ({turmasMeta.total} turmas)
                </p>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={turmasMeta.page <= 1 || loadingTurmas}
                    onClick={() => setTurmasPage(turmasMeta.page - 1)}
                    className="h-8 px-3 text-xs rounded-lg"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={turmasMeta.page >= turmasMeta.totalPages || loadingTurmas}
                    onClick={() => setTurmasPage(turmasMeta.page + 1)}
                    className="h-8 px-3 text-xs rounded-lg"
                  >
                    Próximo <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </>
      ) : (
        /* Visão Detalhada da Turma Selecionada */
        <div className="space-y-4">
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardContent className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedTurma(null)}
                    className="h-8 px-2.5 text-xs font-bold text-[#5E35B1] hover:bg-[#5E35B1]/10 -ml-2"
                  >
                    <ArrowLeft className="w-4 h-4 mr-1" /> Voltar às Turmas
                  </Button>
                  <span className="font-mono font-bold text-xs bg-[#5E35B1]/10 text-[#5E35B1] px-2 py-0.5 rounded">
                    {selectedTurma.turma}
                  </span>
                  <span className="text-xs font-mono text-[#5F6775]">
                    {selectedTurma.periodo} • AVA: {selectedTurma.sourceInstitution.toUpperCase()}
                  </span>
                </div>
                <h2 className="text-base font-extrabold text-navy">
                  {selectedTurma.nomeDisciplina}
                </h2>
                <p className="text-xs text-[#5F6775]">
                  Total: <strong>{selectedTurma.totalAlunos}</strong> • Matriculados:{" "}
                  <strong className="text-emerald-700">{selectedTurma.totalMatriculados}</strong> •
                  Suspensos:{" "}
                  <strong className="text-amber-700">{selectedTurma.totalSuspensos}</strong>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={correlatingTurmaId === selectedTurma.id}
                  onClick={() => handleCorrelateSingleTurma(selectedTurma.id)}
                  className="h-9 text-xs font-bold rounded-lg border-gray-300 text-navy gap-1.5"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${
                      correlatingTurmaId === selectedTurma.id ? "animate-spin" : ""
                    }`}
                  />
                  Buscar Notas no AVA
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Filtros de Alunos da Turma */}
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardContent className="p-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  setStudentsPage(1)
                  setStudentSearchQuery(studentSearchInput)
                }}
                className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
              >
                <div className="md:col-span-5">
                  <label className="text-[11px] font-bold text-[#5F6775] uppercase tracking-wider block mb-1">
                    Buscar Aluno ou Matrícula
                  </label>
                  <div className="relative">
                    <Input
                      placeholder="Nome do aluno, matrícula ou e-mail..."
                      value={studentSearchInput}
                      onChange={(e) => setStudentSearchInput(e.target.value)}
                      className="pl-9 h-10 text-xs border-gray-300"
                    />
                    <Search className="w-4 h-4 text-[#9AA0AC] absolute left-3 top-3" />
                  </div>
                </div>

                <div className="md:col-span-3">
                  <label className="text-[11px] font-bold text-[#5F6775] uppercase tracking-wider block mb-1">
                    Situação da Matrícula
                  </label>
                  <select
                    value={statusMatriculaFilter}
                    onChange={(e) => {
                      setStatusMatriculaFilter(e.target.value)
                      setStudentsPage(1)
                    }}
                    className="w-full h-10 text-xs rounded-lg border border-gray-300 bg-white px-3 text-navy focus:outline-none focus:border-[#5E35B1]"
                  >
                    <option value="todos">Todas as Situações</option>
                    <option value="matriculado">Matriculado (Ativo)</option>
                    <option value="suspenso">Suspenso / Trancado</option>
                    <option value="cancelado">Cancelado / Evadido</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="text-[11px] font-bold text-[#5F6775] uppercase tracking-wider block mb-1">
                    Notas AVA
                  </label>
                  <select
                    value={statusNotaFilter}
                    onChange={(e) => {
                      setStatusNotaFilter(e.target.value)
                      setStudentsPage(1)
                    }}
                    className="w-full h-10 text-xs rounded-lg border border-gray-300 bg-white px-3 text-navy focus:outline-none focus:border-[#5E35B1]"
                  >
                    <option value="todas">Todas</option>
                    <option value="lancada">Com Nota Lançada</option>
                    <option value="pendente">Pendentes</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <Button
                    type="submit"
                    className="w-full h-10 bg-[#5E35B1] hover:bg-[#4E2A96] text-white text-xs font-bold rounded-lg"
                  >
                    Filtrar Alunos
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Tabela de Alunos e Notas VA1/VA2/VA3 */}
          <Card className="bg-white border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table className="w-full text-sm">
                <TableHeader>
                  <TableRow className="bg-[#F4F5F7] border-b border-gray-200 select-none">
                    <TableHead className="px-4 py-3 text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider">
                      Aluno / Matrícula
                    </TableHead>
                    <TableHead className="px-4 py-3 text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider text-center">
                      Situação
                    </TableHead>
                    <TableHead className="px-4 py-3 text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider text-center">
                      VA1 (0–10)
                    </TableHead>
                    <TableHead className="px-4 py-3 text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider text-center">
                      VA2 (0–10)
                    </TableHead>
                    <TableHead className="px-4 py-3 text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider text-center">
                      VA3 (0–10)
                    </TableHead>
                    <TableHead className="px-4 py-3 text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider text-center">
                      Média Final
                    </TableHead>
                    <TableHead className="px-4 py-3 text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider text-right">
                      Detalhamento
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-100">
                  {loadingStudents ? (
                    Array.from({ length: 5 }).map((_, idx) => (
                      <TableRow key={idx} className="animate-pulse">
                        <TableCell colSpan={7} className="py-4 px-4">
                          <div className="h-4 bg-gray-200 rounded w-1/3 mb-1.5" />
                          <div className="h-3 bg-gray-100 rounded w-1/4" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : students.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12 text-xs text-[#9AA0AC] italic">
                        Nenhum estudante encontrado nesta turma com os filtros aplicados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    students.map((st) => (
                      <TableRow key={st.matriculaId} className="hover:bg-slate-50/80 transition-colors">
                        <TableCell className="px-4 py-3">
                          <div className="space-y-0.5">
                            <p className="font-bold text-navy text-xs">{st.nomeAluno}</p>
                            <div className="flex items-center gap-2 text-[11px] text-[#5F6775] font-mono">
                              <span className="bg-slate-100 px-1.5 py-0.5 rounded text-navy font-bold">
                                {st.matricula}
                              </span>
                              {st.emailAluno && <span className="truncate max-w-[220px]">{st.emailAluno}</span>}
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="px-4 py-3 text-center">
                          {getStatusMatriculaBadge(st.statusMatricula, st.bloqueioLancamento)}
                        </TableCell>

                        <TableCell className="px-4 py-3 text-center">
                          <GradeCellPill
                            value={st.notas.va1}
                            raw={st.notas.va1Raw}
                            status={st.notas.va1Status}
                          />
                        </TableCell>

                        <TableCell className="px-4 py-3 text-center">
                          <GradeCellPill
                            value={st.notas.va2}
                            raw={st.notas.va2Raw}
                            status={st.notas.va2Status}
                          />
                        </TableCell>

                        <TableCell className="px-4 py-3 text-center">
                          <GradeCellPill
                            value={st.notas.va3}
                            raw={st.notas.va3Raw}
                            status={st.notas.va3Status}
                          />
                        </TableCell>

                        <TableCell className="px-4 py-3 text-center">
                          <GradeCellPill
                            value={st.notas.mediaFinal}
                            raw={st.notas.mediaRaw}
                            status={
                              st.notas.mediaFinal !== null ? "Lançada" : "Pendente"
                            }
                            highlight
                          />
                        </TableCell>

                        <TableCell className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {st.notas.divergenciaMotivo === "lista_notas_truncada" && (
                              <span
                                className="text-amber-600"
                                title="Lista analítica truncada na origem do Moodle (>1024 caracteres)"
                              >
                                <AlertTriangle className="w-4 h-4" />
                              </span>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setDetailStudent(st)
                                setDetailPhaseTab(1)
                              }}
                              className="h-8 px-2.5 text-xs font-semibold text-[#5E35B1] hover:bg-[#5E35B1]/10 rounded-lg gap-1"
                            >
                              <BookOpen className="w-3.5 h-3.5" /> Itens
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {studentsMeta.totalPages > 1 && (
              <div className="bg-[#F4F5F7] border-t border-gray-200 px-5 py-3 flex items-center justify-between">
                <p className="text-xs text-[#5F6775]">
                  Página <strong>{studentsMeta.page}</strong> de <strong>{studentsMeta.totalPages}</strong> ({studentsMeta.total} alunos)
                </p>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={studentsMeta.page <= 1 || loadingStudents}
                    onClick={() => setStudentsPage(studentsMeta.page - 1)}
                    className="h-8 px-3 text-xs rounded-lg"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={studentsMeta.page >= studentsMeta.totalPages || loadingStudents}
                    onClick={() => setStudentsPage(studentsMeta.page + 1)}
                    className="h-8 px-3 text-xs rounded-lg"
                  >
                    Próximo <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Modal Analítico de Itens de Nota (VA1, VA2, VA3) */}
      <Dialog open={Boolean(detailStudent)} onOpenChange={(open) => !open && setDetailStudent(null)}>
        <DialogContent className="sm:max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="bg-navy text-white px-6 py-4">
            <DialogTitle className="text-base font-extrabold flex items-center gap-2">
              <Award className="w-5 h-5 text-green-brand" />
              Extrato de Itens Avaliativos — {detailStudent?.nomeAluno}
            </DialogTitle>
            <p className="text-xs text-white/70 font-mono">
              Matrícula: {detailStudent?.matricula} • Situação:{" "}
              {detailStudent?.situacaoLyceum || detailStudent?.statusMatricula}
            </p>
          </DialogHeader>

          {detailStudent && (
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {detailStudent.notas.divergenciaMotivo === "lista_notas_truncada" && (
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    A lista detalhada de atividades excedeu o limite de buffer do Moodle (1.024 caracteres) e foi sinalizada como truncada. As notas consolidada de VA1, VA2 e VA3 continuam preservadas.
                  </span>
                </div>
              )}

              <div className="flex border-b border-gray-200 gap-2">
                {([1, 2, 3] as const).map((fase) => {
                  const count =
                    fase === 1
                      ? detailStudent.notas.itensVa1.length
                      : fase === 2
                        ? detailStudent.notas.itensVa2.length
                        : detailStudent.notas.itensVa3.length
                  const notaFase =
                    fase === 1
                      ? formatGradeValue(detailStudent.notas.va1, detailStudent.notas.va1Status)
                      : fase === 2
                        ? formatGradeValue(detailStudent.notas.va2, detailStudent.notas.va2Status)
                        : formatGradeValue(detailStudent.notas.va3, detailStudent.notas.va3Status)
                  return (
                    <button
                      key={fase}
                      type="button"
                      onClick={() => setDetailPhaseTab(fase)}
                      className={`pb-2.5 px-4 text-xs font-bold border-b-2 transition-colors ${
                        detailPhaseTab === fase
                          ? "border-[#5E35B1] text-[#5E35B1]"
                          : "border-transparent text-[#5F6775] hover:text-navy"
                      }`}
                    >
                      VA{fase} ({count}) {notaFase !== null ? `• ${notaFase}` : "• Pendente"}
                    </button>
                  )
                })}
              </div>

              {phaseItems.length === 0 ? (
                <div className="text-center py-8 text-xs text-[#9AA0AC] italic">
                  Nenhum item avaliativo detalhado localizado para a VA{detailPhaseTab} no snapshot atual do AVA.
                </div>
              ) : (
                <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
                  {phaseItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="px-4 py-3 flex items-center justify-between gap-4 bg-white hover:bg-slate-50"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <p className="font-semibold text-navy text-xs break-words">{item.nome}</p>
                        <p className="text-[11px] text-[#5F6775] font-mono">
                          Status: {item.status} {item.data && item.data !== "-" ? `• Data: ${item.data}` : ""}
                        </p>
                      </div>
                      <div className="shrink-0 font-mono text-xs font-bold text-[#5E35B1] bg-[#5E35B1]/10 px-2.5 py-1 rounded-md">
                        {item.nota !== null && item.nota !== undefined
                          ? `${item.nota}${item.notaMax ? ` / ${item.notaMax}` : ""}`
                          : "—"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
