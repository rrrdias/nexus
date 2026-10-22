"use client"

import React from "react"
import {
  StudentProfile,
  StudentBooking,
} from "@/app/actions/student-scheduling"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  FileCheck2,
  IdCard,
  AlertCircle,
  GraduationCap,
} from "lucide-react"
import { getExamEndTime, normalizeDateStr } from "@/lib/scheduling-utils"

interface StudentLandingPageProps {
  student: StudentProfile
  activeBooking: StudentBooking | null
  periodo: string
  onStartBooking: () => void
  onViewBooking: () => void
}

function formatDatePtBr(dateVal: string | Date): string {
  const norm = normalizeDateStr(dateVal)
  if (!norm) return "—"
  const [y, m, d] = norm.split("-")
  const dateObj = new Date(Number(y), Number(m) - 1, Number(d))
  return dateObj.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
}

export function StudentLandingPage({
  student,
  activeBooking,
  periodo,
  onStartBooking,
  onViewBooking,
}: StudentLandingPageProps) {
  const disciplinasCount = student.disciplinas?.length || 0
  const totalMinutes = disciplinasCount * 30

  const hasBooking = !!activeBooking

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Card Principal de Boas-Vindas */}
      <Card className="border border-slate-200/90 shadow-xl rounded-3xl overflow-hidden bg-white">
        {/* Banner Superior com Identidade UniEVANGÉLICA */}
        <div className="bg-gradient-to-r from-[#1C2B4A] via-[#243355] to-[#1C2B4A] text-white p-7 sm:p-10 relative overflow-hidden">
          <div className="absolute right-0 top-0 -mt-10 -mr-10 w-52 h-52 bg-[#2DCE6C]/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-[#2DCE6C]/20 text-[#2DCE6C] border-[#2DCE6C]/30 text-xs px-3 py-1 font-bold uppercase tracking-wider">
                Graduação EaD • Período {periodo.replace("-", "/")}
              </Badge>
              <span className="text-xs text-slate-300 font-mono">
                Matrícula: {student.matricula}
              </span>
            </div>

            <div className="flex items-start gap-4 pt-1">
              <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-[#2DCE6C] shrink-0 shadow-inner">
                {hasBooking ? (
                  <CheckCircle2 className="w-8 h-8" />
                ) : (
                  <GraduationCap className="w-8 h-8" />
                )}
              </div>

              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
                  {hasBooking
                    ? `Bem-vindo(a) de volta, ${student.nome.split(" ")[0]}!`
                    : `Olá, ${student.nome.split(" ")[0]}!`}
                </h1>
                <p className="text-sm sm:text-base text-slate-200/90 mt-1 max-w-xl leading-relaxed">
                  {hasBooking
                    ? "Você já possui uma avaliação presencial agendada para este período letivo. Confira os detalhes abaixo ou gerencie seu agendamento."
                    : "Este é o seu portal para o agendamento de provas presenciais. Escolha o polo, data e horário para realizar sua avaliação de forma simples e rápida."}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Corpo do Card com Resumo e Ação de Destaque */}
        <CardContent className="p-6 sm:p-8 space-y-6">
          {hasBooking ? (
            /* CENÁRIO COM AGENDAMENTO ATIVO */
            <div className="space-y-6">
              <div className="bg-emerald-50/70 border border-emerald-200/90 rounded-2xl p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-emerald-200/80 pb-3">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Agendamento Ativo e Confirmado
                  </span>
                  <span className="text-xs text-emerald-700 font-mono font-bold">
                    Protocolo #{activeBooking.protocolo || activeBooking.id.slice(0, 8).toUpperCase()}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                      Local / Polo
                    </span>
                    <div className="font-bold text-slate-900 text-base">
                      {activeBooking.localNome}
                    </div>
                    <div className="text-xs text-slate-600 leading-relaxed">
                      {activeBooking.localEndereco || "Conforme cadastro da unidade"}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-slate-800">
                      <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="font-semibold capitalize text-sm">
                        {formatDatePtBr(activeBooking.data)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-slate-800">
                      <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="font-bold text-emerald-900 text-sm">
                        {activeBooking.hora.slice(0, 5)} às{" "}
                        {getExamEndTime(
                          activeBooking.hora.slice(0, 5),
                          activeBooking.disciplinasSnapshot?.length || disciplinasCount
                        )}
                      </span>
                      <span className="text-xs text-slate-500">
                        ({disciplinasCount} disciplinas)
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Botão de Ação Principal */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                <div className="text-xs text-slate-500">
                  Precisa emitir o comprovante, alterar o polo ou data?
                </div>

                <Button
                  type="button"
                  onClick={onViewBooking}
                  className="w-full sm:w-auto bg-[#2DCE6C] hover:bg-[#22A857] text-[#0A192F] font-extrabold px-8 h-12 text-sm gap-2 shadow-md transition-all"
                >
                  <FileCheck2 className="w-4 h-4" />
                  Ver Meu Agendamento Completo
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ) : (
            /* CENÁRIO SEM AGENDAMENTO (NOVO) */
            <div className="space-y-6">
              {/* Card com Resumo das Disciplinas */}
              <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-slate-400" />
                    Disciplinas Regulares Matriculadas ({disciplinasCount})
                  </span>
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                    Duração total: {totalMinutes} minutos
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {student.disciplinas?.map((disc, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 bg-white border border-slate-200 rounded-lg text-slate-800 font-medium"
                    >
                      {idx + 1}. {disc}
                    </div>
                  ))}
                </div>

                <div className="p-3.5 bg-blue-50 border border-blue-200/90 rounded-xl text-xs text-blue-900 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    <strong>Importante:</strong> Você fará um único agendamento
                    para todas as suas disciplinas regulares. Elas serão realizadas
                    em blocos sequenciais de 30 minutos cada na data escolhida.
                  </p>
                </div>
              </div>

              {/* Botão de Início do Agendamento */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                <div className="text-xs text-slate-500">
                  Pronto para reservar seu horário de prova?
                </div>

                <Button
                  type="button"
                  onClick={onStartBooking}
                  className="w-full sm:w-auto bg-[#2DCE6C] hover:bg-[#22A857] text-[#0A192F] font-extrabold px-8 h-12 text-sm gap-2 shadow-md transition-all"
                >
                  Começar Meu Agendamento
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Grid com Orientações Gerais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4.5 space-y-2 shadow-xs">
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
            <MapPin className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-slate-900 text-sm">Polo de Aplicação</h3>
          <p className="text-slate-600 leading-relaxed text-[11.5px]">
            Você pode escolher o polo mais conveniente entre as unidades
            presenciais ou online (para o Polo BH).
          </p>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-4.5 space-y-2 shadow-xs">
          <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
            <IdCard className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-slate-900 text-sm">Documento Obrigatório</h3>
          <p className="text-slate-600 leading-relaxed text-[11.5px]">
            No dia da avaliação, apresente documento oficial original com foto
            (RG, CNH, Passaporte ou CTPS Digital).
          </p>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-4.5 space-y-2 shadow-xs">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-slate-900 text-sm">Sessão Segura (30 min)</h3>
          <p className="text-slate-600 leading-relaxed text-[11.5px]">
            Sua navegação é temporizada para 30 minutos a partir do link do AVA,
            protegendo a sua matrícula e seus agendamentos.
          </p>
        </div>
      </div>
    </div>
  )
}
