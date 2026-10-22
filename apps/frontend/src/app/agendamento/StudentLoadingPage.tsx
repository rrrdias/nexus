"use client"

import React, { useEffect, useState } from "react"
import { GraduationCap, ShieldCheck, CheckCircle2, Sparkles } from "lucide-react"

interface StudentLoadingPageProps {
  matricula?: string
  onComplete?: () => void
  isReady?: boolean
}

const LOADING_STEPS = [
  { label: "Validando credenciais acadêmicas...", progress: 30 },
  { label: "Localizando disciplinas regulares no AVA...", progress: 65 },
  { label: "Carregando polos e horários disponíveis...", progress: 90 },
  { label: "Preparando sua experiência...", progress: 100 },
]

export function StudentLoadingPage({
  matricula,
  onComplete,
  isReady = false,
}: StudentLoadingPageProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [progress, setProgress] = useState(15)

  useEffect(() => {
    // Animação de progresso suave
    const stepInterval = setInterval(() => {
      setCurrentStepIndex((prev) => {
        if (prev < LOADING_STEPS.length - 1) {
          return prev + 1
        }
        return prev
      })
    }, 600)

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        // Se ainda não estiver pronto pelo backend, segura em 88%
        const maxProgress = isReady ? 100 : 88
        if (prev < maxProgress) {
          return Math.min(prev + Math.floor(Math.random() * 8) + 4, maxProgress)
        }
        return prev
      })
    }, 120)

    return () => {
      clearInterval(stepInterval)
      clearInterval(progressInterval)
    }
  }, [isReady])

  // Notifica o componente pai quando atinge 100% e o backend está pronto
  useEffect(() => {
    if (progress >= 100 && isReady && onComplete) {
      const timer = setTimeout(() => {
        onComplete()
      }, 400)
      return () => clearTimeout(timer)
    }
  }, [progress, isReady, onComplete])

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-[#0A192F] via-[#1C2B4A] to-[#0A192F] text-white px-4 select-none overflow-hidden">
      {/* Luzes de fundo / Efeito Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#2DCE6C]/10 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-md w-full flex flex-col items-center text-center space-y-7">
        {/* Logo / Badge UniEVANGÉLICA com Pulso */}
        <div className="relative">
          <div className="absolute inset-0 rounded-3xl bg-[#2DCE6C] blur-xl opacity-30 animate-pulse" />
          <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-br from-[#2DCE6C] to-[#1E8E49] p-0.5 shadow-2xl flex items-center justify-center">
            <div className="w-full h-full bg-[#1C2B4A] rounded-[22px] flex items-center justify-center text-[#2DCE6C]">
              <GraduationCap className="w-10 h-10 sm:w-12 sm:h-12 animate-bounce transition-transform duration-700" />
            </div>
          </div>
          <div className="absolute -bottom-1 -right-1 bg-[#2DCE6C] text-[#0A192F] p-1.5 rounded-full shadow-lg">
            <Sparkles className="w-4 h-4 fill-current" />
          </div>
        </div>

        {/* Título e Subtítulo */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs text-[#2DCE6C] font-semibold tracking-wider uppercase backdrop-blur-sm">
            <ShieldCheck className="w-3.5 h-3.5" />
            Portal de Provas Presenciais
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            UniEVANGÉLICA <span className="text-[#2DCE6C]">EaD</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 font-medium">
            Carregando sua experiência de agendamento...
          </p>
        </div>

        {/* Barra de Progresso Customizada */}
        <div className="w-full space-y-3 bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md shadow-xl">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-300 font-medium flex items-center gap-1.5 truncate max-w-[260px]">
              <span className="inline-block w-2 h-2 rounded-full bg-[#2DCE6C] animate-ping" />
              {LOADING_STEPS[currentStepIndex]?.label || "Processando..."}
            </span>
            <span className="font-mono font-bold text-[#2DCE6C] text-sm">
              {progress}%
            </span>
          </div>

          {/* Barra Track */}
          <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden p-0.5">
            <div
              className="h-full bg-gradient-to-r from-[#22A857] via-[#2DCE6C] to-[#74E39E] rounded-full transition-all duration-200 shadow-md shadow-[#2DCE6C]/50"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Indicador de Matrícula Identificada */}
          {matricula && (
            <div className="pt-1 flex items-center justify-center gap-1.5 text-[11px] text-slate-400 font-mono">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#2DCE6C]" />
              Matrícula identificada: <strong className="text-slate-200">{matricula.toUpperCase()}</strong>
            </div>
          )}
        </div>

        {/* Mensagem Institucional de Rodapé */}
        <p className="text-[11px] text-slate-400 max-w-xs leading-relaxed">
          Sessão segura de 30 minutos vinculada ao Ambiente Virtual de Aprendizagem (AVA EaD).
        </p>
      </div>
    </div>
  )
}
