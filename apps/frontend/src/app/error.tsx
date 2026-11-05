"use client"

import React, { useEffect } from "react"
import { AlertCircle, RotateCcw, Home } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[RootError Caught]:", error)
  }, [error])

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white border border-slate-200/90 rounded-2xl p-8 shadow-xl max-w-md w-full text-center space-y-5 animate-in fade-in-50 duration-300">
        <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600 mx-auto">
          <AlertCircle className="w-8 h-8" />
        </div>

        <div className="space-y-1.5">
          <h1 className="text-xl font-extrabold text-[#1C2B4A]">
            Algo não ocorreu como esperado
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Ocorreu uma instabilidade inesperada no processamento desta página. Você pode tentar recarregar ou retornar ao início.
          </p>
          {error?.digest && (
            <p className="text-[11px] font-mono text-slate-400 bg-slate-100 py-1 px-2 rounded-lg inline-block">
              Código de rastreio: {error.digest}
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
              window.location.href = "/nexus"
            }}
            className="w-full sm:w-auto border-slate-300 text-slate-700 hover:bg-slate-50 gap-2 min-h-[44px]"
          >
            <Home className="w-4 h-4" />
            Página Inicial
          </Button>
        </div>
      </div>
    </div>
  )
}
