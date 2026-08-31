"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { 
  Award, 
  CheckCircle2, 
  AlertCircle, 
  User, 
  GraduationCap, 
  MapPin, 
  Clock, 
  FileCheck, 
  Calendar,
  Sparkles,
  BookOpen
} from "lucide-react"

interface Activity {
  nome: string
  status: string
  nota?: string | null
  notaMax?: string | null
  data: string
}

function parseActivities(raw: string | null | undefined): Activity[] {
  if (!raw) return []
  return raw.split("|").map(item => {
    const parts = item.split(":")
    const nome = parts[0]?.trim() || ""
    const second = parts[1]?.trim() || "-"
    const third = parts[2]?.trim() || "-"
    const fourth = parts[3]?.trim() || "-"

    // Formato 4 partes: Nome : Nota : NotaMax : Data
    if (parts.length >= 4) {
      const isNum = !isNaN(parseFloat(second.replace(",", ".")))
      return {
        nome,
        status: isNum ? "Avaliado" : second,
        nota: isNum ? second : null,
        notaMax: third !== "-" ? third : "100",
        data: fourth !== "-" ? fourth : "-",
      }
    }

    // Formato 3 partes: (Nome : Nota : NotaMax) ou (Nome : Status : Data)
    if (parts.length === 3) {
      const isSecondNum = !isNaN(parseFloat(second.replace(",", ".")))
      if (isSecondNum) {
        return {
          nome,
          status: "Avaliado",
          nota: second,
          notaMax: third !== "-" ? third : "100",
          data: "-",
        }
      }
      return {
        nome,
        status: second,
        nota: null,
        notaMax: null,
        data: third !== "-" ? third : "-",
      }
    }

    // Formato 2 partes: Nome : Status ou Nota
    const isNum = !isNaN(parseFloat(second.replace(",", ".")))
    return {
      nome,
      status: isNum ? "Avaliado" : second,
      nota: isNum ? second : null,
      notaMax: null,
      data: "-",
    }
  }).filter(a => a.nome)
}

function isEvaluativeActivity(name: string): boolean {
  const lower = name.toLowerCase()
  return (
    lower.includes("prova") ||
    lower.includes("verificação") ||
    lower.includes("verificacao") ||
    lower.includes("avaliação") ||
    lower.includes("avaliacao") ||
    lower.includes("quiz") ||
    lower.includes("questionário") ||
    lower.includes("questionario") ||
    lower.includes("trabalho") ||
    lower.includes("entrega") ||
    lower.includes("fase") ||
    lower.includes("subjetiva") ||
    lower.includes("objetiva") ||
    lower.includes("fórum") ||
    lower.includes("forum")
  )
}

interface GradeDetailDialogProps {
  open: boolean
  onClose: () => void
  studentName: string
  matricula: string
  curso: string
  polo: string
  lastaccess: string
  diasSemAcesso: string
  faseActive?: "fase1" | "fase2" | "fase3" | "media" | "all"
  fase1Nota: string
  fase2Nota: string
  fase3Nota: string
  mediaFinal: string
  fase1Prog: string
  fase2Prog: string
  fase3Prog: string
  progTotal: string
  listaFase1?: string | null
  listaFase2?: string | null
  listaFase3?: string | null
}

function parseNum(val: string | null | undefined): number {
  if (!val || val === "-" || val === "null") return 0
  const n = parseFloat(String(val).replace("%", "").replace(",", "."))
  return isNaN(n) ? 0 : n
}

export function GradeDetailDialog({
  open,
  onClose,
  studentName,
  matricula,
  curso,
  polo,
  lastaccess,
  diasSemAcesso,
  faseActive = "all",
  fase1Nota,
  fase2Nota,
  fase3Nota,
  mediaFinal,
  fase1Prog,
  fase2Prog,
  fase3Prog,
  progTotal,
  listaFase1,
  listaFase2,
  listaFase3,
}: GradeDetailDialogProps) {
  const [selectedTab, setSelectedTab] = useState<"fase1" | "fase2" | "fase3" | "all">(
    faseActive === "media" ? "all" : faseActive || "all"
  )

  const nMedia = parseNum(mediaFinal)
  const isAprovado = nMedia >= 6.0 || nMedia >= 60

  const f1Activities = parseActivities(listaFase1)
  const f2Activities = parseActivities(listaFase2)
  const f3Activities = parseActivities(listaFase3)

  const getStatusBadge = (gradeStr: string) => {
    const grade = parseNum(gradeStr)
    if (grade >= 60 || (grade >= 6.0 && grade <= 10.0)) {
      return {
        label: "Apto / Aprovado",
        color: "bg-green-50 text-green-700 border-green-200",
        icon: <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
      }
    }
    if (grade > 0) {
      return {
        label: "Abaixo da Média",
        color: "bg-red-50 text-red-700 border-red-200",
        icon: <AlertCircle className="w-3.5 h-3.5 text-red-600" />
      }
    }
    return {
      label: "Sem Nota / Pendente",
      color: "bg-gray-50 text-gray-500 border-gray-200",
      icon: <Clock className="w-3.5 h-3.5 text-gray-400" />
    }
  }

  const renderActivityItem = (activity: Activity, idx: number, phaseNota: string) => {
    const lowerStatus = activity.status.toLowerCase()
    const isConcluido = lowerStatus.includes("conclu") || lowerStatus.includes("feito") || lowerStatus.includes("realiz") || lowerStatus.includes("avaliad")
    const isEval = isEvaluativeActivity(activity.nome)

    return (
      <div 
        key={idx}
        className={`flex items-center justify-between gap-3 p-3.5 rounded-xl border transition-all hover:shadow-xs ${
          isConcluido ? "bg-white border-slate-200" : "bg-slate-50/70 border-slate-200/80"
        }`}
      >
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="mt-0.5 shrink-0">
            {isConcluido ? (
              <CheckCircle2 className="w-4 h-4 text-green-600" />
            ) : (
              <Clock className="w-4 h-4 text-amber-500" />
            )}
          </div>
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-navy leading-snug break-words">
                {activity.nome}
              </span>
              {isEval && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-black bg-blue-50 text-blue-700 border border-blue-200/80 uppercase tracking-tight">
                  <FileCheck className="w-2.5 h-2.5" /> Item Avaliativo
                </span>
              )}
            </div>

            {/* Informações adicionais de entrega/avaliação */}
            <div className="flex items-center gap-2 text-[11px] text-gray-400">
              {activity.data !== "-" && (
                <span className="flex items-center gap-1 font-mono text-gray-500">
                  <Calendar className="w-3 h-3 text-gray-400" /> Concluído em: {activity.data}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Bloco de Nota e Status */}
        <div className="flex items-center gap-2 shrink-0">
          {activity.nota ? (
            <div className="flex flex-col items-end">
              <span className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-mono font-black text-xs shadow-2xs">
                Nota: {activity.nota} {activity.notaMax ? `/ ${activity.notaMax}` : ""}
              </span>
            </div>
          ) : isEval && isConcluido && phaseNota && phaseNota !== "-" && phaseNota !== "0" ? (
            <div className="flex flex-col items-end">
              <span className="px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-blue-800 font-mono font-bold text-[11px]">
                Nota Etapa: {phaseNota}
              </span>
            </div>
          ) : (
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
              isConcluido ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
            }`}>
              {isConcluido ? "Concluído" : "Pendente"}
            </span>
          )}
        </div>
      </div>
    )
  }

  const renderPhaseSection = (
    title: string, 
    nota: string, 
    progresso: string, 
    activities: Activity[],
    badgeColor: string
  ) => {
    const concluidas = activities.filter(a => {
      const s = a.status.toLowerCase()
      return s.includes("conclu") || s.includes("feito") || s.includes("avaliad") || s.includes("realiz")
    })
    const status = getStatusBadge(nota)

    return (
      <div className="space-y-3 bg-white p-4 rounded-xl border border-gray-2 shadow-2xs">
        {/* Cabeçalho da Fase */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-0.5 rounded-lg text-xs font-black uppercase text-white shadow-2xs ${badgeColor}`}>
              {title}
            </span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${status.color}`}>
              {status.icon}
              {status.label}
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="text-gray-500">
              Progresso: <strong className="text-navy font-black">{progresso || "0"}%</strong>
            </span>
            <span className="text-gray-300">|</span>
            <span className="text-gray-500">
              Nota da Etapa: <strong className="text-navy font-black text-sm">{nota || "-"}</strong>
            </span>
          </div>
        </div>

        {/* Resumo de Atividades */}
        <div className="flex items-center gap-3 text-[11px] text-gray-500 font-medium">
          <span className="flex items-center gap-1 text-green-700 font-bold">
            <CheckCircle2 className="w-3.5 h-3.5" /> {concluidas.length} concluída{concluidas.length !== 1 ? 's' : ''}
          </span>
          <span className="text-gray-300">•</span>
          <span className="flex items-center gap-1 text-amber-700 font-bold">
            <Clock className="w-3.5 h-3.5" /> {activities.length - concluidas.length} pendente{activities.length - concluidas.length !== 1 ? 's' : ''}
          </span>
          <span className="text-gray-300">•</span>
          <span>{activities.length} atividades no total</span>
        </div>

        {/* Lista de Atividades e Notas */}
        {activities.length === 0 ? (
          <div className="text-center py-6 text-xs text-gray-400 italic bg-gray-50/70 rounded-lg">
            Nenhuma atividade vinculada a esta etapa no AVA.
          </div>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {activities.map((a, i) => renderActivityItem(a, i, nota))}
          </div>
        )}
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl p-0 border-0 shadow-2xl rounded-2xl overflow-hidden bg-white select-none">
        <div className="p-6 max-h-[85vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] space-y-5">
          
          {/* Header */}
          <DialogHeader className="border-b border-gray-100 pb-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-black uppercase tracking-wider">
                  Extrato de Notas e Atividades
                </span>
                <span className="text-[11px] text-gray-400 font-mono">Moodle EaD</span>
              </div>
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[11px] font-bold ${
                isAprovado ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"
              }`}>
                {isAprovado ? "Média Aprovada" : "Abaixo da Média"}
              </span>
            </div>

            <DialogTitle className="text-xl font-extrabold text-navy flex items-center gap-2 mt-1">
              <Award className="w-5 h-5 text-blue-600" />
              Detalhamento de Notas e Atividades do Aluno
            </DialogTitle>
          </DialogHeader>

          {/* Card de Identificação do Aluno */}
          <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-xl space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-extrabold text-navy flex items-center gap-1.5">
                  <User className="w-4 h-4 text-navy/50" />
                  <span>{studentName}</span>
                </div>
                <div className="text-xs text-gray-500 font-mono mt-0.5">
                  Matrícula: <strong className="text-navy">{matricula || "-"}</strong>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-gray-400 uppercase font-bold">Média Consolidada</div>
                <div className="text-lg font-black font-mono text-navy">{mediaFinal || "-"}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 text-xs text-gray-600">
              <div className="flex items-center gap-1.5 truncate">
                <GraduationCap className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span className="truncate" title={curso}>{curso}</span>
              </div>
              <div className="flex items-center gap-1.5 truncate">
                <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span className="truncate">{polo || "Polo Principal"}</span>
              </div>
            </div>
          </div>

          {/* Navegação por Abas (Fase 1, Fase 2, Fase 3, Todas) */}
          <div className="flex items-center justify-between gap-1 bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => setSelectedTab("all")}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                selectedTab === "all" ? "bg-white text-navy shadow-xs" : "text-gray-500 hover:text-gray-800"
              }`}
            >
              Visão Geral
            </button>
            <button
              onClick={() => setSelectedTab("fase1")}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                selectedTab === "fase1" ? "bg-white text-blue-700 shadow-xs" : "text-gray-500 hover:text-gray-800"
              }`}
            >
              Fase 1 ({fase1Nota || "-"})
            </button>
            <button
              onClick={() => setSelectedTab("fase2")}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                selectedTab === "fase2" ? "bg-white text-indigo-700 shadow-xs" : "text-gray-500 hover:text-gray-800"
              }`}
            >
              Fase 2 ({fase2Nota || "-"})
            </button>
            <button
              onClick={() => setSelectedTab("fase3")}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                selectedTab === "fase3" ? "bg-white text-purple-700 shadow-xs" : "text-gray-500 hover:text-gray-800"
              }`}
            >
              Fase 3 ({fase3Nota || "-"})
            </button>
          </div>

          {/* Conteúdo das Fases com Itens e Notas */}
          <div className="space-y-4">
            {(selectedTab === "all" || selectedTab === "fase1") && (
              renderPhaseSection("Fase 1", fase1Nota, fase1Prog, f1Activities, "bg-blue-600")
            )}

            {(selectedTab === "all" || selectedTab === "fase2") && (
              renderPhaseSection("Fase 2", fase2Nota, fase2Prog, f2Activities, "bg-indigo-600")
            )}

            {(selectedTab === "all" || selectedTab === "fase3") && (
              renderPhaseSection("Fase 3", fase3Nota, fase3Prog, f3Activities, "bg-purple-600")
            )}
          </div>

          {/* Card Final Consolidado */}
          <div className="bg-emerald-50/70 border border-emerald-200 p-4 rounded-xl flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-[11px] font-extrabold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                <Award className="w-4 h-4 text-emerald-700" />
                Média Final das Avaliações
              </div>
              <div className="text-2xl font-black text-emerald-950 font-mono">
                {mediaFinal || "-"}
                <span className="text-xs font-sans font-normal text-emerald-700 ml-1">/ 100</span>
              </div>
            </div>

            <div className="text-right space-y-0.5">
              <div className="text-[10px] font-bold text-emerald-800 uppercase">Progresso Geral</div>
              <div className="text-xl font-black text-navy font-mono">{progTotal || "0"}%</div>
              <div className="text-[10px] text-emerald-700 font-medium">Todas as etapas</div>
            </div>
          </div>

          {/* Rodapé com Informações de Acesso */}
          <div className="text-xs text-gray-400 flex items-center justify-between border-t border-gray-100 pt-3">
            <span>Último Acesso ao AVA: <strong className="text-gray-700">{lastaccess || "Nunca acessou"}</strong></span>
            <span>Inatividade: <strong className="text-gray-700">{diasSemAcesso === "-" ? "Sem registro" : `${diasSemAcesso} dias`}</strong></span>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  )
}
