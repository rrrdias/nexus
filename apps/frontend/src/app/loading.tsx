import React from "react"
import { RefreshCw } from "lucide-react"

export default function RootLoading() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white border border-slate-200/90 rounded-2xl p-8 shadow-xl flex flex-col items-center max-w-sm w-full text-center space-y-4 animate-in fade-in-50 duration-300">
        <div className="w-14 h-14 rounded-2xl bg-[#1C2B4A]/5 border border-[#1C2B4A]/10 flex items-center justify-center text-[#1C2B4A]">
          <RefreshCw className="w-7 h-7 animate-spin text-[#2DCE6C]" />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-bold text-[#1C2B4A]">Carregando aplicação...</h2>
          <p className="text-xs text-slate-500">Por favor, aguarde alguns instantes.</p>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
          <div className="bg-[#2DCE6C] h-full w-2/3 rounded-full animate-pulse" />
        </div>
      </div>
    </div>
  )
}
