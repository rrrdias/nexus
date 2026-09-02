"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CheckCircle2, Clock, Minus, Award, FileCheck } from "lucide-react"

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
    return lower.includes("conclu") || lower.includes("avaliad") || a.nota !== null
  })
  const pendentes = activities.filter(a => {
    const lower = a.status.toLowerCase()
    return !lower.includes("conclu") && !lower.includes("avaliad") && a.nota === null
  })

  const getStatusStyle = (activity: Activity) => {
    const lower = activity.status.toLowerCase()
    const isDone = lower.includes("conclu") || lower.includes("avaliad") || activity.nota !== null

    if (isDone) {
      return {
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
        badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
        label: activity.nota ? `Nota: ${activity.nota}${activity.notaMax ? ` / ${activity.notaMax}` : ''}` : "Concluído",
        card: "bg-white border-emerald-100 shadow-2xs hover:border-emerald-200"
      }
    }
    if (lower === "-" || lower === "") {
      return {
        icon: <Minus className="w-4 h-4 text-gray-300" />,
        badge: "bg-gray-100 text-gray-500 border-gray-200",
        label: "Pendente",
        card: "bg-slate-50/70 border-slate-200/80"
      }
    }
    return {
      icon: <Clock className="w-4 h-4 text-amber-500" />,
      badge: "bg-amber-50 text-amber-700 border-amber-200",
      label: "Pendente",
      card: "bg-slate-50/70 border-slate-200/80"
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl p-0 border-0 shadow-2xl rounded-2xl overflow-hidden bg-white">
        <div className="p-6 max-h-[85vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl font-extrabold text-navy flex items-center gap-3">
              <span className="px-2.5 py-1 rounded-full bg-navy text-white text-xs font-bold shadow-sm">{fasePercent}%</span>
              {faseLabel}
            </DialogTitle>
            <div className="flex gap-4 mt-2 text-sm text-gray-500 font-medium border-b border-gray-100 pb-4">
              <span className="flex items-center gap-1.5"><span className="font-bold text-emerald-600 text-base">{concluidas.length}</span> concluídas</span>
              <span className="text-gray-300">•</span>
              <span className="flex items-center gap-1.5"><span className="font-bold text-amber-600 text-base">{pendentes.length}</span> pendentes</span>
              <span className="text-gray-300">•</span>
              <span className="flex items-center gap-1.5"><span className="font-bold text-navy text-base">{activities.length}</span> total</span>
            </div>
          </DialogHeader>

          {activities.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm font-medium bg-slate-50 rounded-xl border border-dashed border-slate-200">
              Nenhuma atividade registrada para esta fase.
            </div>
          ) : (
            <div className="space-y-2">
              {activities.map((activity, i) => {
                const style = getStatusStyle(activity)
                return (
                  <div key={i} className={`flex items-center justify-between gap-3 p-3.5 rounded-xl border transition-all ${style.card}`}>
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="shrink-0 mt-0.5">{style.icon}</div>
                      <span className="text-[13px] font-bold text-slate-800 leading-snug break-words">
                        {activity.nome}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[11px] font-mono font-bold px-2.5 py-1 rounded-md border ${style.badge}`}>
                        {style.label}
                      </span>
                      {activity.data !== "-" && (
                        <span className="text-[11px] text-gray-500 font-mono font-medium bg-slate-100 border border-slate-200 px-2 py-1 rounded-md">
                          {activity.data}
                        </span>
                      )}
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
