"use client"

import React, { useEffect } from "react"
import { AlertCircle, RotateCcw, LayoutDashboard, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[AdminError Caught]:", error)
  }, [error])

  return (
    <div className="p-6 sm:p-12 max-w-xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
      <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600 shadow-sm">
        <ShieldAlert className="w-8 h-8" />
      </div>

      <div className="space-y-2">
        <span className="text-xs uppercase font-extrabold tracking-wider px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 inline-block">
          Módulo Administrativo
        </span>
        <h1 className="text-xl sm:text-2xl font-bold text-[#1C2B4A]">
          Falha ao carregar dados do painel
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
          Ocorreu um erro na recuperação ou renderização dos dados administrativos. Verifique sua conexão e permissões ou tente recarregar.
        </p>
        {error?.digest && (
          <p className="text-[11px] font-mono text-slate-400 bg-slate-100 py-1 px-2.5 rounded-lg inline-block">
            Digest: {error.digest}
          </p>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
        <Button
          type="button"
          onClick={() => reset()}
          className="w-full sm:w-auto bg-[#2DCE6C] hover:bg-[#22A857] text-[#0A192F] font-bold gap-2 min-h-[44px]"
        >
          <RotateCcw className="w-4 h-4" />
          Tentar Novamente
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={() => {
            window.location.href = "/nexus/admin/users"
          }}
          className="w-full sm:w-auto border-slate-300 text-slate-700 hover:bg-slate-50 gap-2 min-h-[44px]"
        >
          <LayoutDashboard className="w-4 h-4" />
          Painel Principal
        </Button>
      </div>
    </div>
  )
}
