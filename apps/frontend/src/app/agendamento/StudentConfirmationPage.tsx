"use client"

import React, { useState } from "react"
import {
  StudentProfile,
  StudentBooking,
  LocalOption,
} from "@/app/actions/student-scheduling"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  CheckCircle2,
  Calendar,
  Clock,
  MapPin,
  Printer,
  ArrowRight,
  BookOpen,
  Home,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
} from "lucide-react"
import { getExamEndTime, normalizeDateStr } from "@/lib/scheduling-utils"
import { StudentVoucherDialog } from "./StudentVoucherDialog"

interface StudentConfirmationPageProps {
  student: StudentProfile
  booking: StudentBooking
  locals: LocalOption[]
  isReschedule?: boolean
  onViewBooking: () => void
  onGoHome: () => void
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

export function StudentConfirmationPage({
  student,
  booking,
  locals,
  isReschedule = false,
  onViewBooking,
  onGoHome,
}: StudentConfirmationPageProps) {
  const [isVoucherOpen, setIsVoucherOpen] = useState(false)

  const dataExtenso = formatDatePtBr(booking.data)
  const horaInicio = booking.hora.slice(0, 5)
  const disciplinas = booking.disciplinasSnapshot?.length
    ? booking.disciplinasSnapshot
    : student.disciplinas || []
  const horaFim = getExamEndTime(horaInicio, disciplinas.length)
  const totalMinutes = disciplinas.length * 30
  const isOnlinePolo = booking.localNome.toLowerCase().includes("belo horizonte")

  const matchedLocal = locals.find((l) => l.id === booking.localId)
  const endereco = booking.localEndereco || matchedLocal?.endereco || ""
  const linkLocal = booking.localLink || matchedLocal?.linkLocal

  return (
    <div className="space-y-6 max-w-3xl mx-auto animate-in fade-in-50 duration-500">
      {/* Banner Principal de Sucesso */}
      <Card className="border border-emerald-200 shadow-xl rounded-3xl overflow-hidden bg-white text-center">
        <div className="bg-gradient-to-b from-emerald-50 via-white to-white pt-10 pb-8 px-6 sm:px-10 flex flex-col items-center">
          {/* Ícone de Sucesso Animado */}
          <div className="relative mb-4">
            <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-inner">
              <CheckCircle2 className="w-12 h-12" />
            </div>
            <div className="absolute inset-0 rounded-full bg-emerald-400 blur-lg opacity-25 animate-pulse" />
          </div>

          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 px-3 py-1 text-xs font-bold uppercase tracking-wider mb-2">
            {isReschedule ? "Agendamento Atualizado" : "Agendamento Confirmado"}
          </Badge>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {isReschedule
              ? "Agendamento Atualizado com Sucesso!"
              : "Agendamento Realizado com Sucesso!"}
          </h1>
          <p className="text-sm sm:text-base text-slate-600 mt-2 max-w-lg leading-relaxed">
            {isReschedule
              ? `Parabéns, ${student.nome.split(" ")[0]}! Sua prova presencial foi remarcada para o novo polo, data e horário selecionados.`
              : `Parabéns, ${student.nome.split(" ")[0]}! Sua vaga para a avaliação presencial foi garantida no sistema integrado.`}
          </p>
        </div>

        {/* Detalhes da Prova Agendada */}
        <CardContent className="px-6 sm:px-10 pb-8 pt-0">
          <div className="border border-slate-200 rounded-2xl p-5 sm:p-6 bg-slate-50/70 text-left space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Polo */}
              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                  Polo de Prova
                </span>
                <p className="text-sm font-extrabold text-slate-900">
                  {booking.localNome}
                </p>
                {endereco && (
                  <p className="text-xs text-slate-500">{endereco}</p>
                )}
                {linkLocal && (
                  <a
                    href={linkLocal}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline pt-0.5"
                  >
                    Ver no Google Maps <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              {/* Data e Horário */}
              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                  Data e Horário
                </span>
                <p className="text-sm font-extrabold text-slate-900 capitalize">
                  {dataExtenso}
                </p>
                <p className="text-xs text-slate-700 font-semibold flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  {horaInicio} às {horaFim} ({totalMinutes} minutos)
                </p>
              </div>
            </div>

            {/* Disciplinas */}
            <div className="pt-4 border-t border-slate-200">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 mb-2">
                <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
                Disciplinas Avaliadas nesta Sessão ({disciplinas.length})
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {disciplinas.map((disc, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800"
                  >
                    {idx + 1}. {disc}
                  </div>
                ))}
              </div>
            </div>

            {/* Aviso Informativo */}
            <div className="p-3.5 bg-blue-50/80 border border-blue-200/80 rounded-xl flex items-start gap-3 text-xs text-blue-900">
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <strong>Lembrete importante:</strong> No dia da avaliação, compareça ao polo com <strong>documento oficial original com foto</strong> e antecedência mínima de 15 minutos.
              </div>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              type="button"
              onClick={() => setIsVoucherOpen(true)}
              className="w-full sm:w-auto px-6 py-6 bg-[#1C2B4A] hover:bg-[#243355] text-white font-bold rounded-xl gap-2 shadow-md"
            >
              <Printer className="w-4 h-4 text-[#2DCE6C]" />
              Imprimir Comprovante
            </Button>

            <Button
              type="button"
              onClick={onViewBooking}
              className="w-full sm:w-auto px-6 py-6 bg-[#2DCE6C] hover:bg-[#25B85E] text-[#0A192F] font-bold rounded-xl gap-2 shadow-md"
            >
              Meus Agendamentos
              <ArrowRight className="w-4 h-4" />
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={onGoHome}
              className="w-full sm:w-auto px-5 py-6 border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl gap-2"
            >
              <Home className="w-4 h-4" />
              Início
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Diálogo de Comprovante de Impressão */}
      <StudentVoucherDialog
        isOpen={isVoucherOpen}
        onClose={() => setIsVoucherOpen(false)}
        student={student}
        booking={booking}
      />
    </div>
  )
}
