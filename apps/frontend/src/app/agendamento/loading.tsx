import React from "react"
import { Calendar, RefreshCw } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

export default function AgendamentoLoading() {
  return (
    <div className="min-h-screen bg-slate-50/60 p-4 sm:p-8 flex flex-col items-center justify-center">
      <div className="max-w-3xl w-full space-y-6">
        <Card className="border border-slate-200/90 shadow-xl rounded-2xl overflow-hidden bg-white">
          {/* Header Skeleton */}
          <div className="bg-[#1C2B4A] p-6 text-white flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-4 w-32 bg-slate-700 rounded-full animate-pulse" />
              <div className="h-6 w-64 bg-slate-700 rounded-lg animate-pulse" />
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-700/60 flex items-center justify-center text-[#2DCE6C]">
              <RefreshCw className="w-5 h-5 animate-spin" />
            </div>
          </div>

          {/* Body Skeleton */}
          <CardContent className="p-6 sm:p-8 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="h-16 bg-slate-100 rounded-xl animate-pulse" />
              <div className="h-16 bg-slate-100 rounded-xl animate-pulse" />
              <div className="h-16 bg-slate-100 rounded-xl animate-pulse" />
            </div>

            <div className="space-y-3 pt-2">
              <div className="h-4 w-48 bg-slate-200 rounded animate-pulse" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="h-24 bg-slate-50 border border-slate-100 rounded-xl animate-pulse" />
                <div className="h-24 bg-slate-50 border border-slate-100 rounded-xl animate-pulse" />
              </div>
            </div>

            <div className="pt-4 flex justify-between items-center border-t border-slate-100">
              <div className="h-10 w-24 bg-slate-100 rounded-xl animate-pulse" />
              <div className="h-10 w-44 bg-slate-200 rounded-xl animate-pulse" />
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-slate-500 flex items-center justify-center gap-2">
          <Calendar className="w-4 h-4 text-[#2DCE6C]" />
          Carregando portal de agendamento presencial EaD...
        </p>
      </div>
    </div>
  )
}
