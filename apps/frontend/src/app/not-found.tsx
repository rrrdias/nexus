import React from "react"
import Link from "next/link"
import { FileQuestion, Home } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-4">
      <div className="bg-white border border-slate-200/90 rounded-2xl p-8 shadow-xl max-w-md w-full text-center space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-[#1C2B4A] mx-auto">
          <FileQuestion className="w-8 h-8 text-[#2DCE6C]" />
        </div>
        <div className="space-y-1.5">
          <span className="text-[11px] uppercase font-extrabold tracking-wider px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
            Erro 404
          </span>
          <h1 className="text-xl font-extrabold text-[#1C2B4A] mt-2">
            Página não encontrada
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            O endereço acessado não existe ou foi movido. Utilize o menu lateral ou volte para a página inicial.
          </p>
        </div>
        <div className="pt-2 flex justify-center">
          <Link
            href="/"
            className={cn(
              buttonVariants(),
              "bg-[#2DCE6C] hover:bg-[#22A857] text-[#0A192F] font-bold gap-2 min-h-[44px]"
            )}
          >
            <Home className="w-4 h-4" />
            Voltar ao Início
          </Link>
        </div>
      </div>
    </div>
  )
}
