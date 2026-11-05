"use client"

import React, { useEffect } from "react"
import { AlertCircle, RotateCcw, Home, GraduationCap } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function AgendamentoError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[AgendamentoError Caught]:", error)
  }, [error])

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white border border-slate-200/90 rounded-3xl p-8 sm:p-10 shadow-xl max-w-lg w-full text-center space-y-6 animate-in fade-in-50 duration-300">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mx-auto">
          <AlertCircle className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <span className="text-xs uppercase font-extrabold tracking-wider px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 inline-block">
            Portal de Agendamento
          </span>
          <h1 className="text-xl sm:text-2xl font-bold text-[#1C2B4A]">
            Não foi possível carregar seu agendamento
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
            Houve uma falha na consulta dos seus dados acadêmicos ou horários do polo. Por favor, tente recarregar ou acesse novamente pelo Ambiente Virtual de Aprendizagem.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Button
            type="button"
            onClick={() => reset()}
            className="w-full sm:w-auto bg-[#2DCE6C] hover:bg-[#22A857] text-[#0A192F] font-bold gap-2 min-h-[44px]"
          >
            <RotateCcw className="w-4 h-4" />
            Recarregar Página
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => {
              window.location.href = "/nexus/agendamento"
            }}
            className="w-full sm:w-auto border-slate-300 text-slate-700 hover:bg-slate-50 gap-2 min-h-[44px]"
          >
            <GraduationCap className="w-4 h-4" />
            Início do Agendamento
          </Button>
        </div>
      </div>
    </div>
  )
}
