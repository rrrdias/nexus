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
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />,
      badge: "bg-green-100 text-green-700",
      label: "Concluído"
    }
    if (lower === "-" || lower === "") return {
      icon: <Minus className="w-3.5 h-3.5 text-gray-400" />,
      badge: "bg-gray-100 text-gray-500",
      label: "-"
    }
    return {
      icon: <Clock className="w-3.5 h-3.5 text-amber-500" />,
      badge: "bg-amber-100 text-amber-700",
      label: "Pendente"
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-extrabold text-navy flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-navy text-white text-xs font-bold">{fasePercent}%</span>
            {faseLabel}
          </DialogTitle>
          <div className="flex gap-3 mt-1 text-xs text-[#5F6775]">
            <span><span className="font-bold text-green-600">{concluidas.length}</span> concluídas</span>
            <span>·</span>
            <span><span className="font-bold text-amber-600">{pendentes.length}</span> pendentes</span>
            <span>·</span>
            <span><span className="font-bold">{activities.length}</span> total</span>
          </div>
        </DialogHeader>

        {activities.length === 0 ? (
          <div className="text-center py-8 text-[#9AA0AC] text-sm italic">
            Nenhuma atividade registrada para esta fase.
          </div>
        ) : (
          <div className="mt-2 space-y-1.5">
            {activities.map((activity, i) => {
              const style = getStatusStyle(activity.status)
              return (
                <div key={i} className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-[#F8F9FA] hover:bg-[#F0F1F3] transition-colors">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {style.icon}
                    <span className="text-xs font-medium text-gray-700 truncate" title={activity.nome}>
                      {activity.nome}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${style.badge}`}>
                      {style.label}
                    </span>
                    {activity.data !== "-" && (
                      <span className="text-[10px] text-[#9AA0AC] font-mono">{activity.data}</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
