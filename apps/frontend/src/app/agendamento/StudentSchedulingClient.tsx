"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import {
  StudentFlowData,
  getPublicStudentFlow,
} from "@/app/actions/student-scheduling"
import { StudentLandingPage } from "./StudentLandingPage"
import { StudentLoadingPage } from "./StudentLoadingPage"
import { StudentActiveBookingCard } from "./StudentActiveBookingCard"
import { StudentBookingWizard } from "./StudentBookingWizard"
import { Button } from "@/components/ui/button"
import {
  AlertCircle,
  ShieldAlert,
  User,
  ArrowLeft,
  ExternalLink,
  ShieldCheck,
} from "lucide-react"

interface StudentSchedulingClientProps {
  initialMatricula?: string
}

export function StudentSchedulingClient({
  initialMatricula = "",
}: StudentSchedulingClientProps) {
  const searchParams = useSearchParams()
  const router = useRouter()

  const urlMatricula =
    searchParams.get("matricula") || searchParams.get("userid") || initialMatricula

  const [currentMatricula, setCurrentMatricula] = useState<string>(urlMatricula)
  const [flowData, setFlowData] = useState<StudentFlowData | null>(null)
  const [showLoadingScreen, setShowLoadingScreen] = useState<boolean>(
    () => Boolean(urlMatricula && urlMatricula.trim())
  )
  const [isDataReady, setIsDataReady] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<"landing" | "wizard" | "details">("landing")

  // Consulta o fluxo do estudante
  const loadFlow = useCallback(async (mat: string) => {
    if (!mat || !mat.trim()) {
      setShowLoadingScreen(false)
      setIsDataReady(true)
      return
    }

    setShowLoadingScreen(true)
    setIsDataReady(false)
    setErrorMessage(null)

    try {
      const res = await getPublicStudentFlow(mat.trim())
      if (!res.success) {
        setFlowData(null)
        setErrorMessage(res.error)
      } else {
        setFlowData(res.data)
        setCurrentMatricula(res.data.student.matricula || mat.trim().toUpperCase())
      }
    } catch (err: any) {
      console.error("[StudentSchedulingClient] Erro ao carregar dados:", err)
      setFlowData(null)
      setErrorMessage(
        err?.message ||
          "Não foi possível localizar as informações para a matrícula informada."
      )
    } finally {
      setIsDataReady(true)
    }
  }, [])

  // Auto-consulta com a matrícula recebida
  useEffect(() => {
    if (urlMatricula && urlMatricula.trim()) {
      loadFlow(urlMatricula.trim())
    }
  }, [urlMatricula, loadFlow])

  // Se a tela de carregamento estiver ativa, exibe a Loading Page com transição
  if (showLoadingScreen) {
    return (
      <StudentLoadingPage
        matricula={urlMatricula}
        isReady={isDataReady}
        onComplete={() => setShowLoadingScreen(false)}
      />
    )
  }

  return (
    <div className="min-h-screen bg-[#F4F5F7] flex flex-col justify-between selection:bg-[#2DCE6C] selection:text-[#0A192F]">
      {/* Topo Institucional */}
      <header className="bg-[#1C2B4A] text-white border-b border-slate-800 shadow-md sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-[#2DCE6C] to-[#22A857] flex items-center justify-center text-[#0A192F] font-black text-xl shadow-lg shadow-[#2DCE6C]/20">
              U
            </div>
            <div>
              <div className="font-extrabold text-base sm:text-lg tracking-tight flex items-center gap-2">
                <span>UniEVANGÉLICA</span>
                <span className="hidden sm:inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/10 text-slate-300">
                  Graduação EaD
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-300 tracking-wide font-medium">
                Portal de Agendamento de Provas Presenciais
              </p>
            </div>
          </div>

          {/* Badge do Estudante Identificado */}
          {flowData && (
            <div className="flex items-center gap-2.5 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-right">
              <div className="w-8 h-8 rounded-lg bg-[#2DCE6C]/20 border border-[#2DCE6C]/30 flex items-center justify-center text-[#2DCE6C] shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xs font-bold text-white truncate max-w-[180px] sm:max-w-[240px]">
                  {flowData.student.nome}
                </span>
                <span className="text-[10px] text-slate-300 font-mono">
                  Matrícula: {flowData.student.matricula}
                </span>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Conteúdo Central */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* Error State */}
        {errorMessage && (
          <div className="max-w-2xl mx-auto space-y-4">
            <div className="p-6 bg-red-50 border border-red-200/90 rounded-2xl shadow-sm text-red-900 space-y-3">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h3 className="font-bold text-base text-red-950">
                    Não foi possível carregar seu agendamento
                  </h3>
                  <p className="text-xs sm:text-sm text-red-800 leading-relaxed">
                    {errorMessage}
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-red-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <span className="text-red-700">
                  Dúvidas sobre sua matrícula ou disciplinas?
                </span>
                <a
                  href="https://avaead.unievangelica.edu.br"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-300 text-red-900 hover:bg-red-100 font-semibold"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Acessar Tutoria no AVA
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Sem Matrícula e Sem Sessão Ativa (Proteção contra Acesso Direto sem AVA) */}
        {!flowData && !errorMessage && (
          <div className="max-w-md mx-auto my-10 sm:my-16 text-center space-y-5 bg-white border border-slate-200 rounded-3xl p-8 sm:p-10 shadow-xl">
            <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-700 border border-amber-200 flex items-center justify-center mx-auto shadow-sm">
              <ShieldAlert className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                Acesso Restrito via AVA
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-sm mx-auto">
                Para garantir a segurança e a integridade do seu agendamento, o
                acesso deve ser iniciado através do link disponibilizado na sua sala
                de aula virtual no AVA.
              </p>
              <p className="text-[11.5px] text-slate-400 pt-1">
                Se você já estava agendando, sua sessão temporária de 30 minutos
                expirou.
              </p>
            </div>

            <div className="pt-3">
              <a
                href="https://avaead.unievangelica.edu.br"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#1C2B4A] hover:bg-[#243355] text-white text-xs sm:text-sm font-bold transition-all shadow-md"
              >
                <ExternalLink className="w-4 h-4" />
                Ir para o AVA EaD UniEVANGÉLICA
              </a>
            </div>
          </div>
        )}

        {/* Estudante Identificado */}
        {flowData && (
          <div>
            {/* MODO 1: LANDING PAGE DE BOAS-VINDAS */}
            {viewMode === "landing" && (
              <StudentLandingPage
                student={flowData.student}
                activeBooking={flowData.activeBooking}
                periodo={flowData.periodo}
                onStartBooking={() => setViewMode("wizard")}
                onViewBooking={() => setViewMode("details")}
              />
            )}

            {/* MODO 2: WIZARD DE NOVO AGENDAMENTO */}
            {viewMode === "wizard" && (
              <div className="space-y-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setViewMode("landing")}
                  className="gap-1.5 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 font-semibold"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Voltar ao Início
                </Button>

                <StudentBookingWizard
                  student={flowData.student}
                  locals={flowData.locals}
                  periodo={flowData.periodo}
                  onBookingCompleted={() => {
                    loadFlow(currentMatricula)
                    setViewMode("landing")
                  }}
                />
              </div>
            )}

            {/* MODO 3: DETALHES DO AGENDAMENTO ATIVO */}
            {viewMode === "details" && flowData.activeBooking && (
              <div className="space-y-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setViewMode("landing")}
                  className="gap-1.5 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 font-semibold"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Voltar ao Início
                </Button>

                <StudentActiveBookingCard
                  student={flowData.student}
                  booking={flowData.activeBooking}
                  locals={flowData.locals}
                  onReload={() => {
                    loadFlow(currentMatricula)
                    setViewMode("landing")
                  }}
                />
              </div>
            )}
          </div>
        )}
      </main>

      {/* Rodapé Institucional */}
      <footer className="bg-white border-t border-slate-200 py-6 text-xs text-slate-500 mt-auto">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#1C2B4A]">UniEVANGÉLICA</span>
            <span>•</span>
            <span>Centro Universitário de Anápolis</span>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Sessão segura de agendamento (30 minutos)</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
