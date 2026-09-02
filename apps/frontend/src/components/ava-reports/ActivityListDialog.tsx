"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CheckCircle2, Clock, Minus, Award, FileCheck, BookOpen, Calendar } from "lucide-react"

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

interface ActivityListDialogProps {
  fase: string
  faseLabel: string
  listaRaw: string | null | undefined
  fasePercent: string | null
  open: boolean
  onClose: () => void
}

export function ActivityListDialog({ fase, faseLabel, listaRaw, fasePercent, open, onClose }: ActivityListDialogProps) {
  const activities = parseActivities(listaRaw)
  const concluidas = activities.filter(a => {
    const lower = a.status.toLowerCase()
    return lower.includes("conclu") || lower.includes("feito") || lower.includes("avaliad") || lower.includes("realiz") || (a.nota !== null && a.nota !== "-")
  })
  const pendentes = activities.filter(a => {
    const lower = a.status.toLowerCase()
    return !lower.includes("conclu") && !lower.includes("feito") && !lower.includes("avaliad") && !lower.includes("realiz") && (a.nota === null || a.nota === "-")
  })

  const getStatusStyle = (activity: Activity) => {
    const lower = activity.status.toLowerCase()
    const isDone = lower.includes("conclu") || lower.includes("feito") || lower.includes("avaliad") || lower.includes("realiz") || (activity.nota !== null && activity.nota !== "-")

    if (isDone) {
      return {
        icon: <CheckCircle2 className="w-5 h-5 text-emerald-600" />,
        badge: "bg-emerald-50 text-emerald-700 border-emerald-300",
        label: activity.nota && activity.nota !== "-" ? `Nota: ${activity.nota}${activity.notaMax ? ` / ${activity.notaMax}` : ''}` : "Concluído",
        card: "bg-white border-slate-200/90 shadow-2xs hover:border-slate-300"
      }
    }
    if (lower === "-" || lower === "") {
      return {
        icon: <Clock className="w-5 h-5 text-amber-500" />,
        badge: "bg-amber-50 text-amber-700 border-amber-200",
        label: "Pendente",
        card: "bg-slate-50/70 border-slate-200/80"
      }
    }
    return {
      icon: <Clock className="w-5 h-5 text-amber-500" />,
      badge: "bg-amber-50 text-amber-700 border-amber-200",
      label: "Pendente",
      card: "bg-slate-50/70 border-slate-200/80"
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl w-[92vw] p-0 border-0 shadow-2xl rounded-2xl overflow-hidden bg-white select-none">
        <div className="p-6 md:p-8 max-h-[85vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] space-y-5">
          
          <DialogHeader className="border-b border-slate-100 pb-4">
            <div className="flex items-center justify-between gap-3">
              <DialogTitle className="text-2xl font-extrabold text-navy flex items-center gap-3">
                <span className="px-3 py-1 rounded-xl bg-navy text-white text-sm font-black shadow-xs">{fasePercent}%</span>
                {faseLabel}
              </DialogTitle>
            </div>
            <div className="flex items-center gap-4 mt-3 text-xs text-slate-500 font-medium">
              <span className="flex items-center gap-1.5"><span className="font-bold text-emerald-600 text-sm">{concluidas.length}</span> concluídas</span>
              <span className="text-slate-300">•</span>
              <span className="flex items-center gap-1.5"><span className="font-bold text-amber-600 text-sm">{pendentes.length}</span> pendentes</span>
              <span className="text-slate-300">•</span>
              <span className="flex items-center gap-1.5"><span className="font-bold text-navy text-sm">{activities.length}</span> total</span>
            </div>
          </DialogHeader>

          {activities.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs font-medium bg-slate-50/80 rounded-2xl border border-dashed border-slate-200">
              Nenhuma atividade registrada para esta fase no AVA.
            </div>
          ) : (
            <div className="space-y-3">
              {activities.map((activity, i) => {
                const style = getStatusStyle(activity)
                return (
                  <div key={i} className={`flex items-center justify-between gap-4 p-4 rounded-xl border transition-all ${style.card}`}>
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                      <div className="shrink-0 mt-0.5">{style.icon}</div>
                      <div className="space-y-1 min-w-0">
                        <span className="text-[13px] font-bold text-slate-900 leading-snug break-words">
                          {activity.nome}
                        </span>
                        {activity.data !== "-" && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>Concluído em: <strong className="text-slate-700">{activity.data}</strong></span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className={`text-xs font-mono font-bold px-3 py-1.5 rounded-lg border ${style.badge}`}>
                        {style.label}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
