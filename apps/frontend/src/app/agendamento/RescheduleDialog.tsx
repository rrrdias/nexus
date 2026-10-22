"use client"

import React, { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  StudentBooking,
  StudentProfile,
  LocalOption,
  AvailableSlot,
  getPublicAvailableSlots,
  reschedulePublicBooking,
} from "@/app/actions/student-scheduling"
import {
  filterValidStartSlots,
  normalizeDateStr,
  getExamEndTime,
} from "@/lib/scheduling-utils"
import {
  Calendar,
  Clock,
  MapPin,
  RefreshCw,
  AlertCircle,
  X,
  CheckCircle,
} from "lucide-react"

interface RescheduleDialogProps {
  isOpen: boolean
  onClose: () => void
  student: StudentProfile
  booking: StudentBooking
  locals: LocalOption[]
  onSuccess: () => void
}

function formatDateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-")
  const dt = new Date(Number(y), Number(m) - 1, Number(d))
  return dt.toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  })
}

export function RescheduleDialog({
  isOpen,
  onClose,
  student,
  booking,
  locals,
  onSuccess,
}: RescheduleDialogProps) {
  const [selectedLocalId, setSelectedLocalId] = useState<string>(
    booking.localId || locals[0]?.id || ""
  )
  const [slots, setSlots] = useState<AvailableSlot[]>([])
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false)
  const [selectedDate, setSelectedDate] = useState<string>("")
  const [selectedSlotId, setSelectedSlotId] = useState<string>("")
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Quando o diálogo abre, reseta e busca vagas para o local selecionado
  useEffect(() => {
    if (isOpen) {
      setSelectedLocalId(booking.localId || locals[0]?.id || "")
      setSelectedDate("")
      setSelectedSlotId("")
      setErrorMsg(null)
    }
  }, [isOpen, booking.localId, locals])

  // Busca vagas sempre que o local mudar
  useEffect(() => {
    if (!isOpen || !selectedLocalId) return

    let cancelled = false
    setLoadingSlots(true)
    setErrorMsg(null)
    setSelectedDate("")
    setSelectedSlotId("")

    getPublicAvailableSlots(selectedLocalId, booking.periodo)
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
  }, [isOpen, selectedLocalId, booking.periodo])

  // Disciplinas para cálculo de horários consecutivos
  const disciplinasCount = student.disciplinas?.length || 1
  const disciplinesCount = disciplinasCount

  // Agrupa slots válidos por data
  const { datesList, slotsByDate } = React.useMemo(() => {
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

  // Seleciona automaticamente a primeira data se disponível
  useEffect(() => {
    if (datesList.length > 0 && (!selectedDate || !datesList.includes(selectedDate))) {
      setSelectedDate(datesList[0])
      setSelectedSlotId("")
    }
  }, [datesList, selectedDate])

  const handleConfirmReschedule = async () => {
    if (!selectedSlotId) return
    setSubmitting(true)
    setErrorMsg(null)

    try {
      const res = await reschedulePublicBooking({
        bookingId: booking.id,
        matricula: student.matricula,
        newOpcaoId: selectedSlotId,
        periodo: booking.periodo,
      })
      if (!res.success) {
        setErrorMsg(res.error)
      } else {
        onSuccess()
        onClose()
      }
    } catch (err: any) {
      console.error("Erro na remarcação:", err)
      setErrorMsg(err.message || "Não foi possível remarcar o agendamento.")
    } finally {
      setSubmitting(false)
    }
  }

  const selectedLocal = locals.find((l) => l.id === selectedLocalId)
  const availableStartSlots = selectedDate ? slotsByDate[selectedDate] || [] : []

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl bg-white border border-slate-200 rounded-2xl shadow-2xl p-0 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-[#1C2B4A] text-white px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-white">
                Remarcar Prova Presencial
              </DialogTitle>
              <p className="text-xs text-slate-300 mt-0.5">
                Escolha um novo polo, data ou horário para sua avaliação
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          {errorMsg && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Seleção do Polo */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-slate-600">
              1. Selecione o Polo
            </Label>
            <Select
              value={selectedLocalId}
              onValueChange={(val) => setSelectedLocalId(val || "")}
            >
              <SelectTrigger className="w-full bg-slate-50 border-slate-200 h-11 text-slate-800 font-medium">
                <SelectValue placeholder="Selecione um polo" />
              </SelectTrigger>
              <SelectContent>
                {locals.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedLocal?.endereco && (
              <p className="text-xs text-slate-500 flex items-center gap-1.5 pt-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                {selectedLocal.endereco}
              </p>
            )}
          </div>

          {/* Loading Vagas */}
          {loadingSlots ? (
            <div className="py-8 flex flex-col items-center justify-center text-slate-500 gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-emerald-600" />
              <span className="text-xs">Consultando datas e vagas disponíveis...</span>
            </div>
          ) : datesList.length === 0 ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-center text-xs text-amber-800 space-y-1">
              <div className="font-semibold text-amber-900">
                Nenhum horário disponível
              </div>
              <p>
                Não há vagas futuras com tempo suficiente ({disciplinasCount * 30} min)
                para este polo no momento.
              </p>
            </div>
          ) : (
            <>
              {/* Seleção da Data */}
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  2. Selecione a Nova Data
                </Label>
                <div className="flex flex-wrap gap-2">
                  {datesList.map((dStr) => {
                    const isSel = selectedDate === dStr
                    return (
                      <button
                        key={dStr}
                        type="button"
                        onClick={() => {
                          setSelectedDate(dStr)
                          setSelectedSlotId("")
                        }}
                        className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                          isSel
                            ? "bg-[#1C2B4A] text-white border-[#1C2B4A] shadow-sm"
                            : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {formatDateLabel(dStr)}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Seleção do Horário */}
              {selectedDate && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      3. Horário de Início
                    </Label>
                    <span className="text-[11px] text-slate-500">
                      Duração necessária: {disciplinasCount * 30} minutos
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {availableStartSlots.map((slot) => {
                      const isSel = selectedSlotId === slot.id
                      const startH = slot.hora.slice(0, 5)
                      const endH = getExamEndTime(startH, disciplinesCount)

                      return (
                        <button
                          key={slot.id}
                          type="button"
                          onClick={() => setSelectedSlotId(slot.id)}
                          className={`p-3 rounded-xl border text-left transition-all ${
                            isSel
                              ? "bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20 text-emerald-900"
                              : "bg-white border-slate-200 hover:border-slate-300 text-slate-800"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-sm">
                              {startH}
                            </span>
                            <span
                              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                                isSel
                                  ? "bg-emerald-200/80 text-emerald-800"
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
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submitting}
            className="text-slate-600 hover:text-slate-800"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleConfirmReschedule}
            disabled={!selectedSlotId || submitting}
            className="bg-[#2DCE6C] hover:bg-[#22A857] text-[#0A192F] font-semibold gap-2 shadow-sm"
          >
            {submitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Remarcando...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Confirmar Remarcação
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
