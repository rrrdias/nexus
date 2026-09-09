"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { 
  CheckCircle2, 
  Clock, 
  User, 
  GraduationCap, 
  MapPin, 
  Calendar, 
  ListChecks
} from "lucide-react"

import { parseActivities, classifyActivityPhase, normalizeName, Activity } from "@/lib/activity-utils"
import { splitCourseAndCode } from "@/lib/course-utils"

interface ActivityListDialogProps {
  open: boolean
  onClose: () => void
  studentName?: string
  matricula?: string
  curso?: string
  polo?: string
  lastaccess?: string
  diasSemAcesso?: string
  fase: string
  faseLabel: string
  listaRaw: string | null | undefined
  fasePercent: string | null
  listaFase1?: string | null
  listaFase2?: string | null
  listaFase3?: string | null
  progFase1?: string | null
  progFase2?: string | null
  progFase3?: string | null
}

export function ActivityListDialog({
  open,
  onClose,
  studentName,
  matricula,
  curso,
  polo,
  lastaccess,
  diasSemAcesso,
  fase = "all",
  faseLabel,
  listaRaw,
  fasePercent,
  listaFase1,
  listaFase2,
  listaFase3,
  progFase1,
  progFase2,
  progFase3,
}: ActivityListDialogProps) {
  const isSinglePhase = fase === "fase1" || fase === "fase2" || fase === "fase3"
  const [selectedTab, setSelectedTab] = useState<"fase1" | "fase2" | "fase3" | "all">(
    isSinglePhase ? (fase as any) : "all"
  )

  useEffect(() => {
    if (isSinglePhase) {
      setSelectedTab(fase as any)
    } else {
      setSelectedTab("all")
    }
  }, [fase, isSinglePhase, open])

  // Parse activities for individual phases
  const rawF1 = parseActivities(listaFase1 || (fase === "fase1" ? listaRaw : null))
  const rawF2 = parseActivities(listaFase2 || (fase === "fase2" ? listaRaw : null))
  const rawF3 = parseActivities(listaFase3 || (fase === "fase3" ? listaRaw : null))
  const rawAll = parseActivities(listaRaw)

  // Map to deduplicate activities
  const f1Map = new Map<string, Activity>()
  const f2Map = new Map<string, Activity>()
  const f3Map = new Map<string, Activity>()

  const addOrMerge = (map: Map<string, Activity>, act: Activity) => {
    const key = normalizeName(act.nome)
    if (!map.has(key)) {
      map.set(key, act)
    } else {
      const existing = map.get(key)!
      const isActDone = act.status && !act.status.toLowerCase().includes("pend") && !act.status.toLowerCase().includes("sem")
      const isExistingDone = existing.status && !existing.status.toLowerCase().includes("pend") && !existing.status.toLowerCase().includes("sem")
      map.set(key, {
        nome: existing.nome || act.nome,
        status: isActDone ? act.status : (isExistingDone ? existing.status : act.status || existing.status),
        nota: null,
        notaMax: null,
        data: (act.data && act.data !== "-") ? act.data : existing.data,
      })
    }
  }

  rawF1.forEach(a => addOrMerge(f1Map, a))
  rawF2.forEach(a => addOrMerge(f2Map, a))
  rawF3.forEach(a => addOrMerge(f3Map, a))

  if (f1Map.size === 0 && f2Map.size === 0 && f3Map.size === 0) {
    rawAll.forEach(act => {
      const p = classifyActivityPhase(act.nome)
      if (p === 1) addOrMerge(f1Map, act)
      else if (p === 2) addOrMerge(f2Map, act)
      else addOrMerge(f3Map, act)
    })
  }

  const sortActivities = (activities: Activity[]) => {
    return activities.sort((a, b) => {
      const aNorm = normalizeName(a.nome)
      const bNorm = normalizeName(b.nome)
      const aNum = aNorm.match(/\d+/) ? parseInt(aNorm.match(/\d+/)![0], 10) : 999
      const bNum = bNorm.match(/\d+/) ? parseInt(bNorm.match(/\d+/)![0], 10) : 999
      if (aNum !== bNum) return aNum - bNum
      return a.nome.localeCompare(b.nome)
    })
  }

  const f1Activities = sortActivities(Array.from(f1Map.values()))
  const f2Activities = sortActivities(Array.from(f2Map.values()))
  const f3Activities = sortActivities(Array.from(f3Map.values()))

  const allActivities = isSinglePhase 
    ? (fase === "fase1" ? f1Activities : fase === "fase2" ? f2Activities : f3Activities)
    : [...f1Activities, ...f2Activities, ...f3Activities]

  const totalConcluidas = allActivities.filter(a => {
    const s = a.status.toLowerCase()
    return s.includes("conclu") || s.includes("feito") || s.includes("avaliad") || s.includes("realiz") || (a.data && a.data !== "-")
  }).length

  const renderActivityItem = (activity: Activity, idx: number) => {
    const lower = activity.status.toLowerCase()
    const isDone = lower.includes("conclu") || lower.includes("feito") || lower.includes("avaliad") || lower.includes("realiz") || (activity.data && activity.data !== "-")

    return (
      <div 
        key={idx}
        className={`flex items-center justify-between gap-4 p-4 rounded-xl border transition-all ${
          isDone ? "bg-white border-slate-200/90 shadow-2xs hover:border-slate-300" : "bg-slate-50/70 border-slate-200/80"
        }`}
      >
        <div className="flex items-start gap-3.5 flex-1 min-w-0">
          <div className="shrink-0 mt-0.5">
            {isDone ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            ) : (
              <Clock className="w-5 h-5 text-amber-500" />
            )}
          </div>
          <div className="space-y-1 min-w-0">
            <span className="text-[13px] font-bold text-slate-900 leading-snug break-words">
              {activity.nome}
            </span>
            {activity.data && activity.data !== "-" && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Concluído em: <strong className="text-slate-700">{activity.data}</strong></span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
            isDone ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
          }`}>
            {isDone ? "Concluído" : "Pendente"}
          </span>
        </div>
      </div>
    )
  }

  const renderPhaseSection = (title: string, percent: string, activities: Activity[], badgeColor: string) => {
    const doneCount = activities.filter(a => {
      const s = a.status.toLowerCase()
      return s.includes("conclu") || s.includes("feito") || s.includes("avaliad") || s.includes("realiz") || (a.data && a.data !== "-")
    }).length

    return (
      <div className="space-y-3.5 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <span className={`px-3 py-1 rounded-xl text-xs font-black uppercase text-white shadow-xs ${badgeColor}`}>
              {title}
            </span>
            <span className="text-xs text-slate-500 font-medium">
              <strong className="text-emerald-700 font-bold">{doneCount}</strong> de {activities.length} concluídas
            </span>
          </div>
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1 rounded-xl border border-slate-100 text-xs font-mono">
            <span className="text-slate-500">Progresso:</span>
            <strong className="text-navy font-black text-sm">{percent || "0"}%</strong>
          </div>
        </div>

        {activities.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-400 italic bg-slate-50/80 rounded-xl border border-dashed border-slate-200">
            Nenhuma atividade registrada para esta fase no AVA.
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
      <DialogContent className="max-w-4xl sm:max-w-4xl md:max-w-4xl w-[94vw] p-0 border-0 shadow-2xl rounded-2xl overflow-hidden bg-white select-none">
        <div className="p-6 md:p-8 max-h-[88vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] space-y-6">
          
          {/* Header */}
          <DialogHeader className="border-b border-slate-100 pb-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 text-xs font-black uppercase tracking-wider border border-emerald-200/60">
                  Progresso das Atividades
                </span>
                <span className="text-xs text-slate-400 font-mono">Moodle EaD</span>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold bg-emerald-50 text-emerald-700 border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                {totalConcluidas} de {allActivities.length} concluídas
              </span>
            </div>

            <DialogTitle className="text-2xl font-extrabold text-navy flex items-center gap-2.5 mt-2">
              <ListChecks className="w-6 h-6 text-emerald-600" />
              {faseLabel || "Progresso das Atividades"}
            </DialogTitle>
          </DialogHeader>

          {/* Student Info Card (se fornecido) */}
          {studentName && (
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
                    <div className="text-[10px] text-slate-400 uppercase font-black">Progresso</div>
                    <div className="text-xl font-black font-mono text-emerald-600">{fasePercent || "0"}%</div>
                  </div>
                </div>
              </div>

              {curso && (() => {
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
          )}

          {/* Abas quando for Total / Consolidado */}
          {!isSinglePhase && (
            <div className="flex items-center justify-between gap-1.5 bg-slate-100 p-1.5 rounded-xl">
              <button
                onClick={() => setSelectedTab("all")}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  selectedTab === "all" ? "bg-white text-navy shadow-xs" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Visão Completa ({fasePercent || "0"}%)
              </button>
              <button
                onClick={() => setSelectedTab("fase1")}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  selectedTab === "fase1" ? "bg-white text-blue-700 shadow-xs" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Fase 1 ({progFase1 || "0"}%)
              </button>
              <button
                onClick={() => setSelectedTab("fase2")}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  selectedTab === "fase2" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Fase 2 ({progFase2 || "0"}%)
              </button>
              <button
                onClick={() => setSelectedTab("fase3")}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  selectedTab === "fase3" ? "bg-white text-purple-700 shadow-xs" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Fase 3 ({progFase3 || "0"}%)
              </button>
            </div>
          )}

          {/* Seções de Atividades por Fase */}
          <div className="space-y-4">
            {isSinglePhase ? (
              <div className="space-y-2.5">
                {allActivities.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400 italic bg-slate-50/80 rounded-xl border border-dashed border-slate-200">
                    Nenhuma atividade registrada para esta fase no AVA.
                  </div>
                ) : (
                  allActivities.map((a, i) => renderActivityItem(a, i))
                )}
              </div>
            ) : (
              <>
                {(selectedTab === "all" || selectedTab === "fase1") && (
                  renderPhaseSection("Fase 1", progFase1 || "0", f1Activities, "bg-blue-600")
                )}
                {(selectedTab === "all" || selectedTab === "fase2") && (
                  renderPhaseSection("Fase 2", progFase2 || "0", f2Activities, "bg-indigo-600")
                )}
                {(selectedTab === "all" || selectedTab === "fase3") && (
                  renderPhaseSection("Fase 3", progFase3 || "0", f3Activities, "bg-purple-600")
                )}
              </>
            )}
          </div>

          {/* Rodapé com Informações de Acesso */}
          {studentName && (
            <div className="text-xs text-slate-400 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-slate-100 pt-3.5">
              <span>Último Acesso ao AVA: <strong className="text-slate-700">{lastaccess || "Nunca acessou"}</strong></span>
              <span>Inatividade: <strong className="text-slate-700">{diasSemAcesso === "-" ? "Sem registro" : `${diasSemAcesso} dias`}</strong></span>
            </div>
          )}

        </div>
      </DialogContent>
    </Dialog>
  )
}

