"use client"

import { useState, useEffect } from "react"
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
  BookOpen,
  Layers
} from "lucide-react"

import {
  parseActivities,
  isEvaluativeActivity,
  classifyActivityPhase,
  normalizeName,
  Activity
} from "@/lib/activity-utils"
import { splitCourseAndCode } from "@/lib/course-utils"

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
  notasListaFase1?: string | null
  notasListaFase2?: string | null
  notasListaFase3?: string | null
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
  notasListaFase1,
  notasListaFase2,
  notasListaFase3,
  listaNotas,
}: GradeDetailDialogProps) {
  const isSinglePhase = faseActive === "fase1" || faseActive === "fase2" || faseActive === "fase3"

  const [selectedTab, setSelectedTab] = useState<"fase1" | "fase2" | "fase3" | "all">(
    isSinglePhase ? faseActive : "all"
  )

  useEffect(() => {
    if (isSinglePhase) {
      setSelectedTab(faseActive)
    } else {
      setSelectedTab("all")
    }
  }, [faseActive, isSinglePhase, open])

  // Identificação do título e nota de referência para o badge de status
  let referenceNota = mediaFinal
  let referenceLabel = "Média Consolidada"
  let modalTitle = "Detalhamento de Notas e Atividades"
  let modalSubtitle = "Extrato Geral Consolidado"
  let activeMetricTitle = "Média Final"
  let activeMetricValue = mediaFinal || "-"
  let activeProgTitle = "Progresso Geral"
  let activeProgValue = `${progTotal || "0"}%`

  if (faseActive === "fase1") {
    referenceNota = fase1Nota
    referenceLabel = "Fase 1"
    modalTitle = "Detalhamento de Notas e Atividades — Fase 1"
    modalSubtitle = "Extrato Específico da Fase 1"
    activeMetricTitle = "Nota Fase 1"
    activeMetricValue = fase1Nota || "-"
    activeProgTitle = "Progresso Fase 1"
    activeProgValue = `${fase1Prog || "0"}%`
  } else if (faseActive === "fase2") {
    referenceNota = fase2Nota
    referenceLabel = "Fase 2"
    modalTitle = "Detalhamento de Notas e Atividades — Fase 2"
    modalSubtitle = "Extrato Específico da Fase 2"
    activeMetricTitle = "Nota Fase 2"
    activeMetricValue = fase2Nota || "-"
    activeProgTitle = "Progresso Fase 2"
    activeProgValue = `${fase2Prog || "0"}%`
  } else if (faseActive === "fase3") {
    referenceNota = fase3Nota
    referenceLabel = "Fase 3"
    modalTitle = "Detalhamento de Notas e Atividades — Fase 3"
    modalSubtitle = "Extrato Específico da Fase 3"
    activeMetricTitle = "Nota Fase 3"
    activeMetricValue = fase3Nota || "-"
    activeProgTitle = "Progresso Fase 3"
    activeProgValue = `${fase3Prog || "0"}%`
  }

  const nRef = parseNum(referenceNota)
  const isAprovado = nRef >= 6.0 || nRef >= 60

  const rawF1 = parseActivities(listaFase1)
  const rawF2 = parseActivities(listaFase2)
  const rawF3 = parseActivities(listaFase3)

  const allGradedActivities: Array<{ act: Activity; sourcePhase?: 1 | 2 | 3 }> = [
    ...parseActivities(notasListaFase1).map(act => ({ act, sourcePhase: 1 as const })),
    ...parseActivities(notasListaFase2).map(act => ({ act, sourcePhase: 2 as const })),
    ...parseActivities(notasListaFase3).map(act => ({ act, sourcePhase: 3 as const })),
    ...parseActivities(listaNotas).map(act => ({ act })),
  ]

  // Mapas normalizados para agrupar todas as atividades dentro das 3 Fases com matching flexível
  const f1Map = new Map<string, Activity>()
  const f2Map = new Map<string, Activity>()
  const f3Map = new Map<string, Activity>()

  // Índice autoritativo de qual fase cada atividade do progresso pertence (mesmo se o nome for atípico)
  const authoritativeProgressMap = new Map<string, { phase: 1 | 2 | 3; act: Activity }>()
  rawF1.forEach(a => authoritativeProgressMap.set(normalizeName(a.nome), { phase: 1, act: a }))
  rawF2.forEach(a => authoritativeProgressMap.set(normalizeName(a.nome), { phase: 2, act: a }))
  rawF3.forEach(a => authoritativeProgressMap.set(normalizeName(a.nome), { phase: 3, act: a }))

  const isCompletedStatus = (status: string | null | undefined) => {
    if (!status) return false
    const s = status.trim().toLowerCase()
    if (!s || s === "-" || s.includes("pend") || s.includes("sem") || s.includes("nunca")) return false
    return s.includes("conclu") || s.includes("feito") || s.includes("realiz") || s.includes("avaliad")
  }

  const addOrMergeToMap = (map: Map<string, Activity>, act: Activity, overrideKey?: string) => {
    const key = overrideKey || normalizeName(act.nome)
    if (!map.has(key)) {
      map.set(key, act)
    } else {
      const existing = map.get(key)!
      const isActDone = isCompletedStatus(act.status)
      const isExistingDone = isCompletedStatus(existing.status)

      map.set(key, {
        nome: existing.nome.length >= act.nome.length ? existing.nome : act.nome,
        status: isActDone ? act.status : (isExistingDone ? existing.status : (existing.status && existing.status !== "-" ? existing.status : act.status)),
        nota: existing.nota || act.nota,
        notaMax: existing.notaMax || act.notaMax,
        data: (existing.data && existing.data !== "-") ? existing.data : act.data,
      })
    }
  }

  const findPrefixMatchInMap = (map: Map<string, Activity>, key: string): string | null => {
    if (key.length < 4) return null
    for (const existingKey of map.keys()) {
      if (existingKey.startsWith(key)) {
        const nextChar = existingKey.slice(key.length, key.length + 1)
        if (!/^\d$/.test(nextChar)) return existingKey
      } else if (key.startsWith(existingKey)) {
        const nextChar = key.slice(existingKey.length, existingKey.length + 1)
        if (!/^\d$/.test(nextChar)) return existingKey
      }
    }
    return null
  }

  // 1. Popula cada fase com as atividades estruturadas pelo progresso do Moodle (mdl_course_sections)
  // Filtrando para manter apenas atividades avaliativas / com nota
  rawF1.filter(a => isEvaluativeActivity(a.nome) || (a.nota !== null && a.nota !== "-")).forEach(act => addOrMergeToMap(f1Map, act))
  rawF2.filter(a => isEvaluativeActivity(a.nome) || (a.nota !== null && a.nota !== "-")).forEach(act => addOrMergeToMap(f2Map, act))
  rawF3.filter(a => isEvaluativeActivity(a.nome) || (a.nota !== null && a.nota !== "-")).forEach(act => addOrMergeToMap(f3Map, act))

  const hasAuthoritativePhases = authoritativeProgressMap.size > 0

  // 2. Reconcilia as notas detalhadas vindas de notasListaFase1..3 e listaNotas nas fases reais onde cada atividade está alocada
  allGradedActivities.forEach(({ act, sourcePhase }) => {
    if (!isEvaluativeActivity(act.nome) && (act.nota === null || act.nota === "-")) return

    const key = normalizeName(act.nome)

    // Match exato em alguma das fases reais do curso
    if (f1Map.has(key)) {
      addOrMergeToMap(f1Map, act, key)
      return
    }
    if (f2Map.has(key)) {
      addOrMergeToMap(f2Map, act, key)
      return
    }
    if (f3Map.has(key)) {
      addOrMergeToMap(f3Map, act, key)
      return
    }

    // Se a atividade consta no progresso bruto mas ainda não entrou no mapa por nome atípico, usa a fase real do progresso
    const authEntry = authoritativeProgressMap.get(key)
    if (authEntry) {
      const targetMap = authEntry.phase === 1 ? f1Map : authEntry.phase === 2 ? f2Map : f3Map
      addOrMergeToMap(targetMap, authEntry.act, key)
      addOrMergeToMap(targetMap, act, key)
      return
    }

    // Match por prefixo seguro (protege contra nomes truncados sem colidir ex: APS1 com APS10)
    const p1 = findPrefixMatchInMap(f1Map, key)
    if (p1) {
      addOrMergeToMap(f1Map, act, p1)
      return
    }
    const p2 = findPrefixMatchInMap(f2Map, key)
    if (p2) {
      addOrMergeToMap(f2Map, act, p2)
      return
    }
    const p3 = findPrefixMatchInMap(f3Map, key)
    if (p3) {
      addOrMergeToMap(f3Map, act, p3)
      return
    }

    // Se já temos fases autoritativas do progresso, só adicionamos atividade inédita se ela tiver nota lançada ou for Exame Final / Substitutiva
    const hasGrade = act.nota !== null && act.nota !== "-"
    const isExam = key.includes("exame") || key.includes("substitutiva")
    if (!hasAuthoritativePhases || hasGrade || isExam) {
      const phase = classifyActivityPhase(act.nome, sourcePhase || 1)
      if (phase === 1) addOrMergeToMap(f1Map, act)
      else if (phase === 2) addOrMergeToMap(f2Map, act)
      else addOrMergeToMap(f3Map, act)
    }
  })

  // Ordena atividades de forma cronológica / numérica dentro de cada fase
  const sortActivities = (activities: Activity[]) => {
    return activities.sort((a, b) => {
      const aNorm = normalizeName(a.nome)
      const bNorm = normalizeName(b.nome)
      
      const aNumMatch = aNorm.match(/\d+/)
      const bNumMatch = bNorm.match(/\d+/)
      const aNum = aNumMatch ? parseInt(aNumMatch[0], 10) : 999
      const bNum = bNumMatch ? parseInt(bNumMatch[0], 10) : 999
      
      if (aNum !== bNum) return aNum - bNum
      return a.nome.localeCompare(b.nome)
    })
  }

  const f1Activities = sortActivities(Array.from(f1Map.values()))
  const f2Activities = sortActivities(Array.from(f2Map.values()))
  const f3Activities = sortActivities(Array.from(f3Map.values()))

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

  const renderActivityItem = (activity: Activity, idx: number) => {
    const lowerStatus = activity.status.toLowerCase()
    const isConcluido = lowerStatus.includes("conclu") || lowerStatus.includes("feito") || lowerStatus.includes("realiz") || lowerStatus.includes("avaliad") || (activity.nota !== null && activity.nota !== "-")
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
            {activities.map((a, i) => renderActivityItem(a, i))}
          </div>
        )}
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl sm:max-w-4xl md:max-w-4xl lg:max-w-4xl w-[94vw] p-0 border-0 shadow-2xl rounded-2xl overflow-hidden bg-white select-text">
        <div className="p-6 md:p-8 max-h-[88vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] space-y-6">
          
          {/* Header */}
          <DialogHeader className="border-b border-slate-100 pb-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-black uppercase tracking-wider border border-blue-200/60">
                  {modalSubtitle}
                </span>
                <span className="text-xs text-slate-400 font-mono">Moodle EaD</span>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold ${
                isAprovado ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"
              }`}>
                {isAprovado ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <AlertCircle className="w-3.5 h-3.5 text-rose-600" />}
                {isAprovado ? "Apto / Aprovado" : "Abaixo da Média"}
              </span>
            </div>

            <DialogTitle className="text-2xl font-extrabold text-navy flex items-center gap-2.5 mt-2">
              {isSinglePhase ? <Layers className="w-6 h-6 text-blue-600" /> : <Award className="w-6 h-6 text-blue-600" />}
              {modalTitle}
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
                  <div className="text-[10px] text-slate-400 uppercase font-black">{activeMetricTitle}</div>
                  <div className="text-xl font-black font-mono text-navy">{activeMetricValue}</div>
                </div>
                <div className="w-px h-8 bg-slate-200" />
                <div className="text-right">
                  <div className="text-[10px] text-slate-400 uppercase font-black">{activeProgTitle}</div>
                  <div className="text-xl font-black font-mono text-emerald-600">{activeProgValue}</div>
                </div>
              </div>
            </div>

            {(() => {
              const parsedCourse = splitCourseAndCode(curso)
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-3 border-t border-slate-200/60 text-xs text-slate-600">
                  <div className="flex items-center gap-2 min-w-0">
                    <GraduationCap className="w-4 h-4 text-blue-600 shrink-0" />
                    <span className="font-bold text-slate-900 truncate" title={parsedCourse.name}>{parsedCourse.name}</span>
                    {parsedCourse.code && (
                      <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200/70 font-mono font-bold text-[10px] shrink-0">
                        {parsedCourse.code}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 truncate">
                    <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="truncate font-medium">{polo || "Polo Principal"}</span>
                  </div>
                </div>
              )
            })()}
          </div>

          {/* Navegação por Abas SOMENTE quando for o modal Consolidado / Total */}
          {!isSinglePhase && (
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
          )}

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
