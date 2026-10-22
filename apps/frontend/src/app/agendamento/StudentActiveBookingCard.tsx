"use client"

import React, { useState } from "react"
import {
  StudentBooking,
  StudentProfile,
  LocalOption,
  cancelPublicBooking,
} from "@/app/actions/student-scheduling"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Calendar,
  Clock,
  MapPin,
  Printer,
  CalendarDays,
  Trash2,
  CheckCircle2,
  BookOpen,
  AlertCircle,
  ExternalLink,
  Phone,
  RefreshCw,
} from "lucide-react"
import { StudentVoucherDialog } from "./StudentVoucherDialog"
import { RescheduleDialog } from "./RescheduleDialog"
import { getExamEndTime, normalizeDateStr } from "@/lib/scheduling-utils"

interface StudentActiveBookingCardProps {
  student: StudentProfile
  booking: StudentBooking
  locals: LocalOption[]
  onReload: () => void
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

export function StudentActiveBookingCard({
  student,
  booking,
  locals,
  onReload,
}: StudentActiveBookingCardProps) {
  const [isVoucherOpen, setIsVoucherOpen] = useState(false)
  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false)
  const [isCancelAlertOpen, setIsCancelAlertOpen] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)

  const dataExtenso = formatDatePtBr(booking.data)
  const horaInicio = booking.hora.slice(0, 5)
  const disciplinas = booking.disciplinasSnapshot?.length
    ? booking.disciplinasSnapshot
    : student.disciplinas || []
  const horaFim = getExamEndTime(horaInicio, disciplinas.length)
  const protocolo = booking.protocolo || booking.id.slice(0, 8).toUpperCase()
  const isOnlinePolo = booking.localNome.toLowerCase().includes("belo horizonte")

  const handleCancel = async () => {
    setIsCancelling(true)
    setCancelError(null)
    try {
      const res = await cancelPublicBooking(booking.id, student.matricula)
      if (!res.success) {
        setCancelError(res.error)
      } else {
        setIsCancelAlertOpen(false)
        onReload()
      }
    } catch (err: any) {
      console.error("Erro ao cancelar agendamento:", err)
      setCancelError(err?.message || "Erro ao cancelar o agendamento.")
    } finally {
      setIsCancelling(false)
    }
  }

  return (
    <>
      <Card className="border border-slate-200/90 shadow-xl rounded-2xl overflow-hidden bg-white">
        {/* Banner de Status Superior */}
        <div className="bg-gradient-to-r from-[#1C2B4A] to-[#243355] text-white p-6 relative overflow-hidden">
          <div className="absolute right-0 top-0 -mt-6 -mr-6 w-36 h-36 bg-[#2DCE6C]/10 rounded-full blur-2xl pointer-events-none" />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-[#2DCE6C]/20 border border-[#2DCE6C]/30 flex items-center justify-center text-[#2DCE6C] shrink-0">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs uppercase font-extrabold tracking-wider px-2 py-0.5 rounded-full bg-[#2DCE6C]/20 text-[#2DCE6C] border border-[#2DCE6C]/30">
                    Agendamento Ativo
                  </span>
                  <span className="text-xs text-slate-300 font-mono">
                    Protocolo #{protocolo}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-white mt-1">
                  Sua Prova Presencial está Confirmada!
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
                  Período Letivo {booking.periodo.replace("-", "/")} • Graduação EaD
                </p>
              </div>
            </div>

            <Button
              type="button"
              onClick={() => setIsVoucherOpen(true)}
              className="bg-[#2DCE6C] hover:bg-[#22A857] text-[#0A192F] font-bold shadow-md gap-2 shrink-0 self-start sm:self-center"
            >
              <Printer className="w-4 h-4" />
              Imprimir Comprovante
            </Button>
          </div>
        </div>

        <CardContent className="p-6 sm:p-8 space-y-6">
          {cancelError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{cancelError}</span>
            </div>
          )}

          {/* Grid de Detalhes Principais */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Bloco Data e Horário */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-5 space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-slate-400" />
                Data e Horário da Avaliação
              </div>

              <div>
                <div className="text-base sm:text-lg font-bold text-slate-900 capitalize">
                  {dataExtenso}
                </div>
                <div className="flex items-center gap-2 mt-1.5 text-slate-700">
                  <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-bold text-slate-900 text-sm">
                    {horaInicio}
                    {horaFim ? ` às ${horaFim}` : ""}
                  </span>
                  <span className="text-xs text-slate-500">
                    ({disciplinas.length * 30} min total)
                  </span>
                </div>
              </div>
            </div>

            {/* Bloco Polo e Endereço */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-5 space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-slate-400" />
                Polo de Aplicação
              </div>

              <div>
                <div className="text-base sm:text-lg font-bold text-slate-900">
                  {booking.localNome}
                </div>
                <div className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {booking.localEndereco || "Endereço cadastrado na unidade"}
                </div>

                <div className="flex items-center gap-4 mt-2.5 pt-2 border-t border-slate-200/80 text-xs">
                  {booking.localTelefone && (
                    <span className="flex items-center gap-1 text-slate-600">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      {booking.localTelefone}
                    </span>
                  )}
                  {booking.localLink && (
                    <a
                      href={booking.localLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-semibold"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Ver no Mapa
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Polo Online Notice */}
          {isOnlinePolo && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3 text-xs text-blue-900">
              <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Aviso para o Polo Belo Horizonte:</span>
                <p className="mt-0.5 text-blue-800/90 leading-relaxed">
                  As avaliações deste polo são realizadas 100% online no Ambiente
                  Virtual de Aprendizagem (AVA). Fique atento aos prazos de
                  liberação da prova em sua sala de aula virtual.
                </p>
              </div>
            </div>
          )}

          {/* Disciplinas Avaliadas */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-slate-400" />
                Disciplinas Avaliadas nesta Sessão ({disciplinas.length})
              </span>
              <span className="text-xs text-slate-500">
                30 minutos por disciplina
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {disciplinas.map((disc, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between text-xs"
                >
                  <span className="font-medium text-slate-800">
                    {idx + 1}. {disc}
                  </span>
                  <Badge variant="secondary" className="text-[10px] bg-slate-100 text-slate-600">
                    Regular
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Orientações para o dia da prova */}
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-4 text-xs text-amber-900 space-y-1.5">
            <div className="font-bold flex items-center gap-1.5 text-amber-950">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              Orientações para o Dia da Avaliação:
            </div>
            <ul className="list-disc pl-5 space-y-1 text-amber-900/90 leading-relaxed text-[11.5px]">
              <li>Compareça ao polo com antecedência mínima de 15 minutos.</li>
              <li>Apresente documento oficial original com foto (RG, CNH, Passaporte ou CTPS Digital).</li>
              <li>Utilize caneta esferográfica de tinta azul ou preta em material transparente.</li>
              <li>Mantenha celulares e aparelhos eletrônicos totalmente desligados durante a avaliação.</li>
            </ul>
          </div>

          {/* Ações: Remarcar ou Cancelar */}
          <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              Precisa alterar o horário ou local da sua prova?
            </p>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsRescheduleOpen(true)}
                className="w-full sm:w-auto text-slate-700 hover:text-slate-900 border-slate-300 gap-1.5 text-xs font-semibold"
              >
                <CalendarDays className="w-4 h-4 text-slate-500" />
                Remarcar Prova
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCancelAlertOpen(true)}
                className="w-full sm:w-auto text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 gap-1.5 text-xs font-semibold"
              >
                <Trash2 className="w-4 h-4" />
                Cancelar Agendamento
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal de Comprovante de Agendamento */}
      <StudentVoucherDialog
        isOpen={isVoucherOpen}
        onClose={() => setIsVoucherOpen(false)}
        student={student}
        booking={booking}
      />

      {/* Modal de Remarcação */}
      <RescheduleDialog
        isOpen={isRescheduleOpen}
        onClose={() => setIsRescheduleOpen(false)}
        student={student}
        booking={booking}
        locals={locals}
        onSuccess={onReload}
      />

      {/* Confirmação de Cancelamento */}
      <AlertDialog
        open={isCancelAlertOpen}
        onOpenChange={(open) => !open && setIsCancelAlertOpen(false)}
      >
        <AlertDialogContent className="bg-white rounded-2xl border border-slate-200 p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-900 text-lg font-bold">
              Confirmar Cancelamento do Agendamento?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600 text-xs sm:text-sm mt-2 leading-relaxed">
              Ao cancelar seu agendamento, sua vaga no polo{" "}
              <strong>{booking.localNome}</strong> será liberada e você precisará
              escolher uma nova data e horário para realizar sua avaliação
              presencial.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-5">
            <AlertDialogCancel
              disabled={isCancelling}
              className="text-slate-600 hover:text-slate-800"
            >
              Voltar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={isCancelling}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold gap-2"
            >
              {isCancelling ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Cancelando...
                </>
              ) : (
                "Sim, Cancelar Agendamento"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
