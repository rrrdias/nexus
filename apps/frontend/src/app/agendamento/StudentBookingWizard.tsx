"use client"

import React, { useState, useEffect, useMemo } from "react"
import {
  StudentProfile,
  LocalOption,
  AvailableSlot,
  getPublicAvailableSlots,
  submitPublicBooking,
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
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  filterValidStartSlots,
  normalizeDateStr,
  getExamEndTime,
} from "@/lib/scheduling-utils"
import {
  CheckCircle2,
  Calendar,
  Clock,
  MapPin,
  BookOpen,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  Phone,
  ShieldCheck,
  Building2,
} from "lucide-react"

interface StudentBookingWizardProps {
  student: StudentProfile
  locals: LocalOption[]
  periodo: string
  onBookingCompleted: () => void
}

function formatDatePtBr(dateStr: string): string {
  if (!dateStr) return "—"
  const [y, m, d] = dateStr.split("-")
  const dateObj = new Date(Number(y), Number(m) - 1, Number(d))
  return dateObj.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  })
}

function formatDateChip(dateStr: string): { weekday: string; dayMonth: string } {
  const [y, m, d] = dateStr.split("-")
  const dt = new Date(Number(y), Number(m) - 1, Number(d))
  return {
    weekday: dt.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""),
    dayMonth: `${d}/${m}`,
  }
}

export function StudentBookingWizard({
  student,
  locals,
  periodo,
  onBookingCompleted,
}: StudentBookingWizardProps) {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1)
  const [selectedLocalId, setSelectedLocalId] = useState<string>("")
  const [slots, setSlots] = useState<AvailableSlot[]>([])
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false)
  const [selectedDate, setSelectedDate] = useState<string>("")
  const [selectedSlotId, setSelectedSlotId] = useState<string>("")
  const [agreedTerms, setAgreedTerms] = useState<boolean>(false)
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const disciplinasCount = student.disciplinas?.length || 1
  const disciplinesCount = disciplinasCount
  const totalMinutes = disciplinasCount * 30

  // Ao selecionar um polo, carrega as vagas disponíveis
  useEffect(() => {
    if (!selectedLocalId) return

    let cancelled = false
    setLoadingSlots(true)
    setErrorMsg(null)
    setSelectedDate("")
    setSelectedSlotId("")

    getPublicAvailableSlots(selectedLocalId, periodo)
      .then((res) => {
        if (!cancelled) {
          setSlots(res || [])
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Erro ao buscar vagas do polo:", err)
          setErrorMsg(err.message || "Erro ao carregar horários disponíveis.")
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false)
      })

    return () => {
      cancelled = true
    }
  }, [selectedLocalId, periodo])

  // Agrupa slots válidos por data
  const { datesList, slotsByDate } = useMemo(() => {
    const map: Record<string, AvailableSlot[]> = {}

    for (const slot of slots) {
      const dStr = normalizeDateStr(slot.data)
      if (!dStr) continue
      if (!map[dStr]) map[dStr] = []
      map[dStr].push(slot)
    }

    const validDates: string[] = []
    const filteredSlotsMap: Record<string, AvailableSlot[]> = {}

    for (const [dStr, daySlots] of Object.entries(map)) {
      const validStart = filterValidStartSlots(
        daySlots.map((s) => ({
          ...s,
          data: s.data,
          status: s.status,
        })),
        disciplinesCount,
        dStr
      )

      if (validStart.length > 0) {
        validDates.push(dStr)
        filteredSlotsMap[dStr] = validStart as AvailableSlot[]
      }
    }

    validDates.sort()
    return { datesList: validDates, slotsByDate: filteredSlotsMap }
  }, [slots, disciplinesCount])

  // Seleciona automaticamente a primeira data quando datesList carregar
  useEffect(() => {
    if (datesList.length > 0 && (!selectedDate || !datesList.includes(selectedDate))) {
      setSelectedDate(datesList[0])
      setSelectedSlotId("")
    }
  }, [datesList, selectedDate])

  const selectedLocal = locals.find((l) => l.id === selectedLocalId)
  const availableSlotsOnDate = selectedDate ? slotsByDate[selectedDate] || [] : []
  const selectedSlot = slots.find((s) => s.id === selectedSlotId)

  // Submissão do agendamento
  const handleConfirmBooking = async () => {
    if (!selectedSlotId || !agreedTerms) return
    setSubmitting(true)
    setErrorMsg(null)

    try {
      const res = await submitPublicBooking({
        opcaoId: selectedSlotId,
        matricula: student.matricula,
        periodo,
      })
      if (!res.success) {
        setErrorMsg(res.error)
        setSubmitting(false)
      } else {
        onBookingCompleted()
      }
    } catch (err: any) {
      console.error("Erro ao confirmar agendamento:", err)
      setErrorMsg(err?.message || "Não foi possível confirmar seu agendamento.")
      setSubmitting(false)
    }
  }

  return (
    <Card className="border border-slate-200/90 shadow-xl rounded-2xl overflow-hidden bg-white">
      {/* Stepper Header */}
      <div className="bg-[#1C2B4A] text-white px-6 py-6 border-b border-slate-700/60">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-extrabold tracking-wider px-2 py-0.5 rounded-full bg-[#2DCE6C]/20 text-[#2DCE6C] border border-[#2DCE6C]/30">
                Agendamento de Provas
              </span>
              <span className="text-xs text-slate-300">
                Período {periodo.replace("-", "/")}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mt-1">
              {currentStep === 1 && "Passo 1: Confirme suas Disciplinas"}
              {currentStep === 2 && "Passo 2: Escolha o Polo de Prova"}
              {currentStep === 3 && "Passo 3: Escolha Data e Horário"}
              {currentStep === 4 && "Passo 4: Revise e Confirme seu Agendamento"}
            </h2>
          </div>

          {/* Indicador de passos */}
          <div className="flex items-center gap-1.5 shrink-0">
            {[1, 2, 3, 4].map((step) => {
              const isActive = currentStep === step
              const isDone = currentStep > step
              return (
                <div
                  key={step}
                  className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all ${
                    isActive
                      ? "bg-[#2DCE6C] text-[#0A192F] ring-4 ring-[#2DCE6C]/20"
                      : isDone
                      ? "bg-slate-700 text-[#2DCE6C]"
                      : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {isDone ? <CheckCircle2 className="w-4 h-4" /> : step}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <CardContent className="p-6 sm:p-8 space-y-6">
        {errorMsg && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs sm:text-sm text-red-700 flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-semibold text-red-900">Atenção:</div>
              <div>{errorMsg}</div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* PASSO 1: DADOS E DISCIPLINAS */}
        {/* ======================================================== */}
        {currentStep === 1 && (
          <div className="space-y-6">
            {/* Dados do Aluno */}
            <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-slate-400 uppercase font-bold text-[10px] block">
                  Estudante
                </span>
                <span className="font-bold text-slate-900 text-sm">
                  {student.nome}
                </span>
              </div>
              <div>
                <span className="text-slate-400 uppercase font-bold text-[10px] block">
                  Matrícula
                </span>
                <span className="font-bold text-slate-900 text-sm font-mono">
                  {student.matricula}
                </span>
              </div>
              <div>
                <span className="text-slate-400 uppercase font-bold text-[10px] block">
                  Modalidade
                </span>
                <span className="font-bold text-emerald-800 text-sm flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Graduação EaD • Regulares
                </span>
              </div>
            </div>

            {/* Disciplinas Regulares */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-slate-400" />
                  Disciplinas que você realizará nesta prova ({student.disciplinas?.length || 0})
                </span>
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  Duração total: {totalMinutes} minutos
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {student.disciplinas?.map((disc, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between text-xs hover:border-slate-300 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-[11px] shrink-0">
                        {idx + 1}
                      </span>
                      <span className="font-medium text-slate-800">
                        {disc}
                      </span>
                    </div>
                    <Badge variant="secondary" className="text-[10px] bg-slate-100 text-slate-600 shrink-0">
                      30 min
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Aviso Explicativo */}
            <div className="p-4 bg-emerald-50/60 border border-emerald-200/80 rounded-xl text-xs text-emerald-950 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold">Como funciona a sua prova presencial:</span>
                <p className="text-emerald-900/90 leading-relaxed text-[11.5px]">
                  Todas as suas {disciplinasCount} disciplinas regulares serão
                  realizadas na mesma data, em blocos consecutivos de 30 minutos
                  (total de {totalMinutes} minutos). No próximo passo, você poderá
                  escolher o polo de sua preferência.
                </p>
              </div>
            </div>

            {/* Ação Próximo */}
            <div className="pt-2 flex justify-end">
              <Button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="bg-[#2DCE6C] hover:bg-[#22A857] text-[#0A192F] font-bold px-6 h-11 gap-2 shadow-md"
              >
                Escolher Polo de Prova
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* PASSO 2: ESCOLHA DO POLO */}
        {/* ======================================================== */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600">
                Selecione onde deseja realizar sua prova presencial:
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Você pode optar pelo polo mais próximo da sua residência.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {locals.map((loc) => {
                const isSelected = selectedLocalId === loc.id
                const isOnline = loc.nome.toLowerCase().includes("belo horizonte")

                return (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => setSelectedLocalId(loc.id)}
                    className={`p-4 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                      isSelected
                        ? "bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-500/30 shadow-sm"
                        : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs"
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                              isSelected
                                ? "bg-emerald-600 text-white"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            <Building2 className="w-4 h-4" />
                          </div>
                          <span className="font-bold text-sm text-slate-900">
                            {loc.nome}
                          </span>
                        </div>

                        {isOnline ? (
                          <Badge className="bg-blue-100 text-blue-800 text-[10px] font-semibold border-0">
                            100% Online AVA
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-slate-600">
                            Presencial
                          </Badge>
                        )}
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed mb-3">
                        {loc.endereco || "Endereço cadastrado na unidade"}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                      {loc.telefone ? (
                        <span className="text-slate-500 flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {loc.telefone}
                        </span>
                      ) : (
                        <span />
                      )}
                      {loc.linkLocal && (
                        <a
                          href={loc.linkLocal}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1 text-[11px]"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Ver Mapa
                        </a>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Botões Voltar / Avançar */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCurrentStep(1)}
                className="gap-2 text-slate-600"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </Button>

              <Button
                type="button"
                disabled={!selectedLocalId}
                onClick={() => setCurrentStep(3)}
                className="bg-[#2DCE6C] hover:bg-[#22A857] text-[#0A192F] font-bold px-6 h-11 gap-2 shadow-md"
              >
                Escolher Data e Horário
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* PASSO 3: DATA E HORÁRIO */}
        {/* ======================================================== */}
        {currentStep === 3 && (
          <div className="space-y-6">
            {/* Polo Escolhido */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                <div>
                  <span className="text-slate-500">Polo Selecionado:</span>
                  <span className="font-bold text-slate-900 ml-1.5">
                    {selectedLocal?.nome}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="text-emerald-700 hover:underline font-semibold"
              >
                Alterar polo
              </button>
            </div>

            {loadingSlots ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-500 gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
                <span className="text-xs">Consultando calendário e vagas em tempo real...</span>
              </div>
            ) : datesList.length === 0 ? (
              <div className="p-6 bg-amber-50 border border-amber-200 rounded-xl text-center text-xs sm:text-sm text-amber-900 space-y-2">
                <AlertCircle className="w-6 h-6 text-amber-600 mx-auto" />
                <div className="font-bold text-base">Nenhum horário disponível para este polo</div>
                <p className="max-w-md mx-auto text-amber-800 leading-relaxed">
                  Não foram encontradas vagas abertas com tempo consecutivo suficiente
                  ({totalMinutes} minutos) no polo <strong>{selectedLocal?.nome}</strong>.
                  Por favor, selecione outro polo ou contate a coordenação do seu curso.
                </p>
                <div className="pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCurrentStep(2)}
                    className="border-amber-300 text-amber-900 hover:bg-amber-100"
                  >
                    Escolher Outro Polo
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {/* Seleção de Data */}
                <div className="space-y-2.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    1. Selecione a Data da Prova
                  </Label>

                  <div className="flex flex-wrap gap-2">
                    {datesList.map((dStr) => {
                      const isSel = selectedDate === dStr
                      const { weekday, dayMonth } = formatDateChip(dStr)
                      return (
                        <button
                          key={dStr}
                          type="button"
                          onClick={() => {
                            setSelectedDate(dStr)
                            setSelectedSlotId("")
                          }}
                          className={`px-4 py-2.5 rounded-xl border transition-all text-center min-w-[90px] ${
                            isSel
                              ? "bg-[#1C2B4A] text-white border-[#1C2B4A] shadow-md"
                              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          <div className="text-[10px] uppercase font-bold tracking-wider opacity-80">
                            {weekday}
                          </div>
                          <div className="text-sm font-extrabold mt-0.5">
                            {dayMonth}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Seleção de Horário */}
                {selectedDate && (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                        2. Selecione o Horário de Início
                      </Label>
                      <span className="text-xs text-slate-500">
                        Sessão de {totalMinutes} minutos ({disciplinasCount} disciplinas)
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                      {availableSlotsOnDate.map((slot) => {
                        const isSel = selectedSlotId === slot.id
                        const startH = slot.hora.slice(0, 5)
                        const endH = getExamEndTime(startH, disciplinesCount)

                        return (
                          <button
                            key={slot.id}
                            type="button"
                            onClick={() => setSelectedSlotId(slot.id)}
                            className={`p-3.5 rounded-xl border text-left transition-all ${
                              isSel
                                ? "bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/30 text-emerald-950 shadow-sm"
                                : "bg-white border-slate-200 hover:border-slate-300 text-slate-800"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-extrabold text-base">
                                {startH}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                  isSel
                                    ? "bg-emerald-200 text-emerald-900"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {slot.vagas} vaga{slot.vagas !== 1 ? "s" : ""}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500">
                              até {endH}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Botões de Ação */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCurrentStep(2)}
                className="gap-2 text-slate-600"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </Button>

              <Button
                type="button"
                disabled={!selectedSlotId}
                onClick={() => setCurrentStep(4)}
                className="bg-[#2DCE6C] hover:bg-[#22A857] text-[#0A192F] font-bold px-6 h-11 gap-2 shadow-md"
              >
                Avançar para Confirmação
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* PASSO 4: RESUMO E CONFIRMAÇÃO */}
        {/* ======================================================== */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600">
                Confira os detalhes antes de finalizar sua reserva:
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Certifique-se de que poderá comparecer na data e horário selecionados.
              </p>
            </div>

            {/* Card Resumo Consolidado */}
            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-5 sm:p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Estudante
                  </span>
                  <div className="font-bold text-slate-900 text-sm sm:text-base">
                    {student.nome}
                  </div>
                  <div className="text-xs text-slate-500 font-mono">
                    Matrícula: {student.matricula}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Polo Selecionado
                  </span>
                  <div className="font-bold text-slate-900 text-sm sm:text-base">
                    {selectedLocal?.nome}
                  </div>
                  <div className="text-xs text-slate-500">
                    {selectedLocal?.endereco}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-200">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Data da Prova
                    </span>
                    <span className="font-bold text-slate-900 text-sm capitalize">
                      {formatDatePtBr(selectedDate)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Horário
                    </span>
                    <span className="font-bold text-slate-900 text-sm">
                      {selectedSlot?.hora.slice(0, 5)} às{" "}
                      {getExamEndTime(selectedSlot?.hora.slice(0, 5) || "", disciplinesCount)}{" "}
                      <span className="text-xs text-slate-500 font-normal">
                        ({totalMinutes} min)
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Lista de Disciplinas */}
              <div className="pt-4 border-t border-slate-200 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Disciplinas Avaliadas ({disciplinesCount})
                </span>
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
              </div>
            </div>

            {/* Checkbox Termos */}
            <div className="p-4 bg-emerald-50/50 border border-emerald-200/80 rounded-xl flex items-start gap-3">
              <Checkbox
                id="terms"
                checked={agreedTerms}
                onCheckedChange={(checked) => setAgreedTerms(!!checked)}
                className="mt-0.5 data-[state=checked]:bg-[#2DCE6C] data-[state=checked]:border-[#2DCE6C] data-[state=checked]:text-[#0A192F]"
              />
              <Label
                htmlFor="terms"
                className="text-xs text-slate-700 leading-relaxed cursor-pointer font-normal"
              >
                Declaro que estou ciente das normas de aplicação de provas da{" "}
                <strong>UniEVANGÉLICA</strong>, comprometendo-me a comparecer ao polo
                com documento oficial original com foto e antecedência de 15 minutos.
              </Label>
            </div>

            {/* Botões Voltar / Confirmar Reserva */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
              <Button
                type="button"
                variant="outline"
                disabled={submitting}
                onClick={() => setCurrentStep(3)}
                className="gap-2 text-slate-600"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </Button>

              <Button
                type="button"
                disabled={!agreedTerms || submitting}
                onClick={handleConfirmBooking}
                className="bg-[#2DCE6C] hover:bg-[#22A857] text-[#0A192F] font-bold px-8 h-12 gap-2 shadow-md text-sm"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Reservando Vaga...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    Confirmar Agendamento
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
