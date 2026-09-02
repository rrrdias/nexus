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
    lower.includes("subjetiva") ||
    lower.includes("objetiva") ||
    lower.includes("exame")
  )
}

function classifyActivityPhase(name: string): 1 | 2 | 3 {
  const lower = name.toLowerCase()

  // Regras Fase 2
  if (
    lower.includes("fase 2") || lower.includes("fase2") ||
    lower.includes("2ª verificação") || lower.includes("2ª va") || lower.includes("2a verif") ||
    lower.includes("unidade temática 03") || lower.includes("unidade temática 3") ||
    lower.includes("unidade 03") || lower.includes("unidade 3") ||
    lower.includes("unidade temática 04") || lower.includes("unidade temática 4") ||
    lower.includes("unidade 04") || lower.includes("unidade 4") ||
    lower.includes("fixação - unidade temática 03") || lower.includes("fixacao - unidade tematica 03") ||
    lower.includes("fixação - unidade temática 04") || lower.includes("fixacao - unidade tematica 04") ||
    lower.includes("entrega 2")
  ) {
    return 2
  }

  // Regras Fase 3
  if (
    lower.includes("fase 3") || lower.includes("fase3") ||
    lower.includes("3ª verificação") || lower.includes("3ª va") || lower.includes("3a verif") ||
    lower.includes("unidade temática 05") || lower.includes("unidade temática 5") ||
    lower.includes("unidade 05") || lower.includes("unidade 5") ||
    lower.includes("unidade temática 06") || lower.includes("unidade temática 6") ||
    lower.includes("unidade 06") || lower.includes("unidade 6") ||
    lower.includes("fixação - unidade temática 05") || lower.includes("fixacao - unidade tematica 05") ||
    lower.includes("fixação - unidade temática 06") || lower.includes("fixacao - unidade tematica 06") ||
    lower.includes("exame") || lower.includes("final") || lower.includes("substitutiva") ||
    lower.includes("entrega 3") || lower.includes("entrega 4")
  ) {
    return 3
  }

  // Padrão Fase 1 (Unidade 1, 2, Verificação 1, etc.)
  return 1
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
  listaNotas?: string | null
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
  listaNotas,
}: GradeDetailDialogProps) {
  const [selectedTab, setSelectedTab] = useState<"fase1" | "fase2" | "fase3" | "all">(
    faseActive === "media" ? "all" : faseActive || "all"
  )

  const nMedia = parseNum(mediaFinal)
  const isAprovado = nMedia >= 6.0 || nMedia >= 60

  const allGradedActivities = parseActivities(listaNotas)
  const rawF1 = parseActivities(listaFase1)
  const rawF2 = parseActivities(listaFase2)
  const rawF3 = parseActivities(listaFase3)

  // Mapas para agrupar todas as atividades dentro das 3 Fases sem deixar nenhuma solta
  const f1Map = new Map<string, Activity>()
  const f2Map = new Map<string, Activity>()
  const f3Map = new Map<string, Activity>()

  // 1. Adiciona atividades explícitas das fases
  rawF1.forEach(a => f1Map.set(a.nome, a))
  rawF2.forEach(a => f2Map.set(a.nome, a))
  rawF3.forEach(a => f3Map.set(a.nome, a))

  // 2. Classifica todas as atividades de listaNotas dentro das Fases correspondentes
  allGradedActivities.forEach(act => {
    if (f1Map.has(act.nome)) {
      f1Map.set(act.nome, { ...f1Map.get(act.nome)!, ...act })
    } else if (f2Map.has(act.nome)) {
      f2Map.set(act.nome, { ...f2Map.get(act.nome)!, ...act })
    } else if (f3Map.has(act.nome)) {
      f3Map.set(act.nome, { ...f3Map.get(act.nome)!, ...act })
    } else {
      // Classificação automática baseada no nome (Unidade 1/2 -> Fase 1, Unidade 3/4 -> Fase 2, etc.)
      const phase = classifyActivityPhase(act.nome)
      if (phase === 1) f1Map.set(act.nome, act)
      else if (phase === 2) f2Map.set(act.nome, act)
      else f3Map.set(act.nome, act)
    }
  })

  const f1Activities = Array.from(f1Map.values())
  const f2Activities = Array.from(f2Map.values())
  const f3Activities = Array.from(f3Map.values())

  const getStatusBadge = (gradeStr: string) => {
    const grade = parseNum(gradeStr)
    if (grade >= 60 || (grade >= 6.0 && grade <= 10.0)) {
      return {
        label: "Apto / Aprovado",
        color: "bg-emerald-50 text-emerald-700 border-emerald-200",
        icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
      }
    }
    if (grade > 0) {
      return {
        label: "Abaixo da Média",
        color: "bg-rose-50 text-rose-700 border-rose-200",
        icon: <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
      }
    }
    return {
      label: "Sem Nota / Pendente",
      color: "bg-slate-100 text-slate-600 border-slate-200",
      icon: <Clock className="w-3.5 h-3.5 text-slate-400" />
    }
  }

  const renderActivityItem = (activity: Activity, idx: number, phaseNota: string) => {
    const lowerStatus = activity.status.toLowerCase()
    const isConcluido = lowerStatus.includes("conclu") || lowerStatus.includes("feito") || lowerStatus.includes("realiz") || lowerStatus.includes("avaliad") || activity.nota !== null && activity.nota !== "-"
    const isEval = isEvaluativeActivity(activity.nome)

    return (
      <div 
        key={idx}
        className={`flex items-center justify-between gap-4 p-4 rounded-xl border transition-all ${
          isConcluido ? "bg-white border-slate-200/90 shadow-2xs hover:border-slate-300" : "bg-slate-50/70 border-slate-200/80"
        }`}
      >
        <div className="flex items-start gap-3.5 flex-1 min-w-0">
          <div className="mt-0.5 shrink-0">
            {isConcluido ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            ) : (
              <Clock className="w-5 h-5 text-amber-500" />
            )}
          </div>
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[13px] font-bold text-slate-900 leading-snug break-words">
                {activity.nome}
              </span>
              {isEval ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-200/80 uppercase tracking-tight">
                  <FileCheck className="w-3 h-3 text-blue-600" /> Item Avaliativo
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                  <BookOpen className="w-3 h-3 text-slate-400" /> Fixação / Estudo
                </span>
              )}
            </div>

            {/* Informações adicionais de entrega/avaliação */}
            {activity.data !== "-" && (
              <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Concluído em: <strong className="text-slate-700">{activity.data}</strong></span>
              </div>
            )}
          </div>
        </div>

        {/* Bloco de Nota e Status */}
        <div className="flex items-center gap-2.5 shrink-0">
          {activity.nota && activity.nota !== "-" ? (
            <div className="flex flex-col items-end">
              <span className="px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-800 font-mono font-black text-sm shadow-2xs">
                Nota: {activity.nota} {activity.notaMax ? `/ ${activity.notaMax}` : ""}
              </span>
            </div>
          ) : isEval && isConcluido && phaseNota && phaseNota !== "-" && phaseNota !== "0" ? (
            <div className="flex flex-col items-end">
              <span className="px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 font-mono font-bold text-xs">
                Nota Etapa: {phaseNota}
              </span>
            </div>
          ) : (
            <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
              isConcluido ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
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
      return s.includes("conclu") || s.includes("feito") || s.includes("avaliad") || s.includes("realiz") || (a.nota !== null && a.nota !== "-")
    })
    const status = getStatusBadge(nota)

    return (
      <div className="space-y-3.5 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
        {/* Cabeçalho da Fase */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
          <div className="flex items-center gap-2.5">
            <span className={`px-3 py-1 rounded-xl text-xs font-black uppercase text-white shadow-xs ${badgeColor}`}>
              {title}
            </span>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-bold ${status.color}`}>
              {status.icon}
              {status.label}
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
            <span className="text-slate-600">
              Progresso: <strong className="text-navy font-black text-sm">{progresso || "0"}%</strong>
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-600">
              Nota da Etapa: <strong className="text-navy font-black text-sm">{nota || "-"}</strong>
            </span>
          </div>
        </div>

        {/* Resumo de Atividades */}
        <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
          <span className="flex items-center gap-1.5 text-emerald-700 font-bold">
            <CheckCircle2 className="w-4 h-4" /> {concluidas.length} concluída{concluidas.length !== 1 ? 's' : ''}
          </span>
          <span className="text-slate-300">•</span>
          <span className="flex items-center gap-1.5 text-amber-700 font-bold">
            <Clock className="w-4 h-4" /> {activities.length - concluidas.length} pendente{activities.length - concluidas.length !== 1 ? 's' : ''}
          </span>
          <span className="text-slate-300">•</span>
          <span className="font-semibold text-slate-700">{activities.length} atividades no total</span>
        </div>

        {/* Lista de Atividades e Notas */}
        {activities.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400 italic bg-slate-50/80 rounded-xl border border-dashed border-slate-200">
            Nenhuma atividade vinculada a esta etapa no AVA.
          </div>
        ) : (
          <div className="space-y-2.5 pt-1">
            {activities.map((a, i) => renderActivityItem(a, i, nota))}
          </div>
        )}
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl sm:max-w-4xl md:max-w-4xl lg:max-w-4xl w-[94vw] p-0 border-0 shadow-2xl rounded-2xl overflow-hidden bg-white select-none">
        <div className="p-6 md:p-8 max-h-[88vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] space-y-6">

          
          {/* Header */}
          <DialogHeader className="border-b border-slate-100 pb-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-black uppercase tracking-wider border border-blue-200/60">
                  Extrato Consolidado de Notas e Atividades
                </span>
                <span className="text-xs text-slate-400 font-mono">Moodle EaD</span>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold ${
                isAprovado ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"
              }`}>
                {isAprovado ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <AlertCircle className="w-3.5 h-3.5 text-rose-600" />}
                {isAprovado ? "Média Aprovada" : "Abaixo da Média"}
              </span>
            </div>

            <DialogTitle className="text-2xl font-extrabold text-navy flex items-center gap-2.5 mt-2">
              <Award className="w-6 h-6 text-blue-600" />
              Detalhamento de Notas e Atividades do Aluno
            </DialogTitle>
          </DialogHeader>

          {/* Card de Identificação do Aluno */}
          <div className="bg-slate-50/90 border border-slate-200 p-4 md:p-5 rounded-2xl space-y-3 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="text-base font-extrabold text-navy flex items-center gap-2">
                  <User className="w-5 h-5 text-navy/60" />
                  <span>{studentName}</span>
                </div>
                <div className="text-xs text-slate-500 font-mono mt-1">
                  Matrícula / ID: <strong className="text-navy font-bold">{matricula || "-"}</strong>
                </div>
              </div>
              <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-xl border border-slate-200/80 shadow-2xs">
                <div className="text-right">
                  <div className="text-[10px] text-slate-400 uppercase font-black">Média Final</div>
                  <div className="text-xl font-black font-mono text-navy">{mediaFinal || "-"}</div>
                </div>
                <div className="w-px h-8 bg-slate-200" />
                <div className="text-right">
                  <div className="text-[10px] text-slate-400 uppercase font-black">Progresso Geral</div>
                  <div className="text-xl font-black font-mono text-emerald-600">{progTotal || "0"}%</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-3 border-t border-slate-200/60 text-xs text-slate-600">
              <div className="flex items-center gap-2 truncate">
                <GraduationCap className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="truncate font-medium" title={curso}>{curso}</span>
              </div>
              <div className="flex items-center gap-2 truncate">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="truncate font-medium">{polo || "Polo Principal"}</span>
              </div>
            </div>
          </div>

          {/* Navegação por Abas (Fase 1, Fase 2, Fase 3, Todas) */}
          <div className="flex items-center justify-between gap-1.5 bg-slate-100 p-1.5 rounded-xl">
            <button
              onClick={() => setSelectedTab("all")}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                selectedTab === "all" ? "bg-white text-navy shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Visão Completa (Todas as Fases)
            </button>
            <button
              onClick={() => setSelectedTab("fase1")}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                selectedTab === "fase1" ? "bg-white text-blue-700 shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Fase 1 ({fase1Nota || "-"})
            </button>
            <button
              onClick={() => setSelectedTab("fase2")}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                selectedTab === "fase2" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Fase 2 ({fase2Nota || "-"})
            </button>
            <button
              onClick={() => setSelectedTab("fase3")}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                selectedTab === "fase3" ? "bg-white text-purple-700 shadow-xs" : "text-slate-500 hover:text-slate-800"
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

          {/* Rodapé com Informações de Acesso */}
          <div className="text-xs text-slate-400 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-slate-100 pt-3.5">
            <span>Último Acesso ao AVA: <strong className="text-slate-700">{lastaccess || "Nunca acessou"}</strong></span>
            <span>Inatividade: <strong className="text-slate-700">{diasSemAcesso === "-" ? "Sem registro" : `${diasSemAcesso} dias`}</strong></span>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  )
}
