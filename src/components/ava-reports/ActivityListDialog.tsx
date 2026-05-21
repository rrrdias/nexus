"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CheckCircle2, Clock, Minus } from "lucide-react"

interface Activity {
  nome: string
  status: string
  data: string
}

function parseActivities(raw: string | null): Activity[] {
  if (!raw) return []
  return raw.split("|").map(item => {
    const parts = item.split(":")
    return {
      nome: parts[0]?.trim() || "",
      status: parts[1]?.trim() || "-",
      data: parts[2]?.trim() || "-",
    }
  }).filter(a => a.nome)
}

interface ActivityListDialogProps {
  fase: string
  faseLabel: string
  listaRaw: string | null
  fasePercent: string | null
  open: boolean
  onClose: () => void
}

export function ActivityListDialog({ fase, faseLabel, listaRaw, fasePercent, open, onClose }: ActivityListDialogProps) {
  const activities = parseActivities(listaRaw)
  const concluidas = activities.filter(a => a.status.toLowerCase().includes("conclu"))
  const pendentes = activities.filter(a => !a.status.toLowerCase().includes("conclu"))

  const getStatusStyle = (status: string) => {
    const lower = status.toLowerCase()
    if (lower.includes("conclu")) return {
      icon: <CheckCircle2 className="w-4 h-4 text-green-dark" />,
      badge: "bg-green-3 text-green-dark",
      label: "Concluído",
      card: "bg-white border-green-3/50"
    }
    if (lower === "-" || lower === "") return {
      icon: <Minus className="w-4 h-4 text-gray-3" />,
      badge: "bg-gray-2 text-gray-4",
      label: "-",
      card: "bg-white border-gray-2"
    }
    return {
      icon: <Clock className="w-4 h-4 text-amber" />,
      badge: "bg-amber/10 text-amber",
      label: "Pendente",
      card: "bg-white border-amber/20"
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
            <div className="flex gap-4 mt-2 text-sm text-gray-4 font-medium border-b border-gray-2 pb-4">
              <span className="flex items-center gap-1"><span className="font-bold text-green-dark text-base">{concluidas.length}</span> concluídas</span>
              <span className="text-gray-2">•</span>
              <span className="flex items-center gap-1"><span className="font-bold text-amber text-base">{pendentes.length}</span> pendentes</span>
              <span className="text-gray-2">•</span>
              <span className="flex items-center gap-1"><span className="font-bold text-navy-light text-base">{activities.length}</span> total</span>
            </div>
          </DialogHeader>

          {activities.length === 0 ? (
            <div className="text-center py-10 text-gray-3 text-sm font-medium bg-gray-1 rounded-xl">
              Nenhuma atividade registrada para esta fase.
            </div>
          ) : (
            <div className="space-y-2">
              {activities.map((activity, i) => {
                const style = getStatusStyle(activity.status)
                return (
                  <div key={i} className={`flex items-center justify-between gap-3 p-3.5 rounded-xl border transition-all hover:shadow-md ${style.card}`}>
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="shrink-0">{style.icon}</div>
                      <span className="text-[13px] font-semibold text-gray-9 truncate" title={activity.nome}>
                        {activity.nome}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`text-[11px] font-bold px-3 py-1 rounded-full ${style.badge}`}>
                        {style.label}
                      </span>
                      {activity.data !== "-" && (
                        <span className="text-[11px] text-gray-4 font-mono font-medium bg-gray-1 px-2 py-1 rounded-md">{activity.data}</span>
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
