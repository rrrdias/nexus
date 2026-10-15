"use client"

import React, { useState, useMemo } from "react"
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Check, XCircle } from "lucide-react"

export interface DateStatusInfo {
  status: "available" | "full" | "none"
  slotsCount: number
  validStartSlotsCount: number
  totalVagas: number
}

interface ExamDateCalendarProps {
  selectedDate: string // YYYY-MM-DD
  onSelectDate: (dateStr: string) => void
  datesStatus: Record<string, DateStatusInfo>
  loading?: boolean
  disciplinesCount?: number
}

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
]

import { getTodayDateStr } from "@/lib/scheduling-utils"

const WEEK_DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

export function ExamDateCalendar({
  selectedDate,
  onSelectDate,
  datesStatus,
  loading = false,
  disciplinesCount = 1
}: ExamDateCalendarProps) {
  const todayStr = useMemo(() => getTodayDateStr(), [])

  // Initial month based on selectedDate or today
  const [viewDate, setViewDate] = useState(() => {
    if (selectedDate && selectedDate.includes("-")) {
      const [y, m] = selectedDate.split("-").map(Number)
      return new Date(y, m - 1, 1)
    }
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const handlePrevMonth = () => {
    setViewDate(new Date(year, month - 1, 1))
  }

  const handleNextMonth = () => {
    setViewDate(new Date(year, month + 1, 1))
  }

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay()
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate()
    const prevMonthDays = new Date(year, month, 0).getDate()

    const days: Array<{
      dayNumber: number
      dateStr: string
      isCurrentMonth: boolean
      isPast: boolean
      statusInfo?: DateStatusInfo
    }> = []

    // Previous month trailing days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = prevMonthDays - i
      const prevM = month === 0 ? 12 : month
      const prevY = month === 0 ? year - 1 : year
      const dateStr = `${prevY}-${String(prevM).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`
      days.push({
        dayNumber: dayNum,
        dateStr,
        isCurrentMonth: false,
        isPast: dateStr < todayStr
      })
    }

    // Current month days
    for (let day = 1; day <= totalDaysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
      const isPast = dateStr < todayStr
      const statusInfo = datesStatus[dateStr]
      days.push({
        dayNumber: day,
        dateStr,
        isCurrentMonth: true,
        isPast,
        statusInfo
      })
    }

    // Next month leading days (to complete the 7-day row)
    const remaining = (7 - (days.length % 7)) % 7
    for (let day = 1; day <= remaining; day++) {
      const nextM = month === 11 ? 1 : month + 2
      const nextY = month === 11 ? year + 1 : year
      const dateStr = `${nextY}-${String(nextM).padStart(2, "0")}-${String(day).padStart(2, "0")}`
      days.push({
        dayNumber: day,
        dateStr,
        isCurrentMonth: false,
        isPast: dateStr < todayStr
      })
    }

    return days
  }, [year, month, todayStr, datesStatus])

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 sm:p-5 space-y-4">
      {/* Month Navigation Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-green-50 text-green-dark flex items-center justify-center border border-green-100 shadow-2xs">
            <CalendarIcon className="w-4 h-4 text-green-dark" />
          </div>
          <div>
            <span className="text-sm font-bold text-navy">
              {MONTH_NAMES[month]} {year}
            </span>
            <p className="text-[10px] text-[#5F6775]">
              Selecione o dia da aplicação da prova
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-1 rounded-lg hover:bg-white text-slate-600 hover:text-navy transition-all cursor-pointer shadow-2xs"
            title="Mês anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1 rounded-lg hover:bg-white text-slate-600 hover:text-navy transition-all cursor-pointer shadow-2xs"
            title="Próximo mês"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Weekday Names Header */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEK_DAYS.map((w, idx) => (
          <div
            key={w}
            className={`text-[11px] font-bold uppercase py-1 ${
              idx === 0 || idx === 6 ? "text-slate-400" : "text-navy"
            }`}
          >
            {w}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-1.5">
        {calendarDays.map((item, idx) => {
          const isSelected = selectedDate === item.dateStr
          const isToday = item.dateStr === todayStr
          const status = item.statusInfo?.status || "none"

          // Determine button state and styles
          let cellCls = "relative h-12 sm:h-14 rounded-xl flex flex-col items-center justify-center text-xs font-semibold transition-all select-none "

          if (!item.isCurrentMonth) {
            cellCls += "text-slate-300 opacity-40 cursor-not-allowed bg-transparent"
            return (
              <div key={idx} className={cellCls}>
                <span className="text-xs font-normal">{item.dayNumber}</span>
              </div>
            )
          }

          if (item.isPast) {
            cellCls += "text-slate-300 bg-slate-50/60 cursor-not-allowed border border-transparent"
            return (
              <div key={idx} className={cellCls} title="Data no passado">
                <span className="text-xs font-normal">{item.dayNumber}</span>
                {isToday && (
                  <span className="text-[9px] font-bold text-slate-400 uppercase">Hoje</span>
                )}
              </div>
            )
          }

          // Future or Today
          if (isSelected) {
            cellCls += status === "full"
              ? "bg-rose-700 text-white font-bold ring-2 ring-rose-300 shadow-md border-rose-700 cursor-pointer scale-[1.02]"
              : "bg-navy text-white font-bold ring-2 ring-navy/30 shadow-md border-navy cursor-pointer scale-[1.02]"
          } else if (status === "available") {
            cellCls += "bg-emerald-50 text-emerald-900 border border-emerald-300/80 hover:bg-emerald-100/90 hover:border-emerald-500 cursor-pointer shadow-2xs active:scale-95"
          } else if (status === "full") {
            cellCls += "bg-rose-50/80 text-rose-700 border border-rose-200/80 hover:bg-rose-100/90 cursor-pointer"
          } else {
            // "none" -> sem horários cadastrados
            cellCls += "text-slate-400 bg-slate-50/40 border border-slate-100/60 cursor-not-allowed hover:bg-slate-50"
          }

          const canSelect = status === "available" || status === "full"

          return (
            <button
              key={idx}
              type="button"
              disabled={!canSelect}
              onClick={() => canSelect && onSelectDate(item.dateStr)}
              className={cellCls}
              title={
                status === "available"
                  ? `${item.statusInfo?.validStartSlotsCount} horário(s) disponível(is) para ${disciplinesCount} disciplina(s)`
                  : status === "full"
                  ? "Esgotado / Sem horários consecutivos suficientes"
                  : "Sem horários cadastrados para este polo"
              }
            >
              <div className="flex items-center gap-1">
                <span className={`text-xs ${isSelected ? "font-black" : "font-semibold"}`}>
                  {item.dayNumber}
                </span>
                {isToday && (
                  <span className={`text-[8px] font-black uppercase px-1 py-0.2 rounded ${
                    isSelected ? "bg-white/20 text-white" : "bg-blue-100 text-blue-700"
                  }`}>
                    Hoje
                  </span>
                )}
              </div>

              {/* Status Indicator Dot/Badge */}
              {status === "available" && (
                <div className="flex items-center gap-1 mt-0.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-emerald-300" : "bg-emerald-600 animate-pulse"}`} />
                  <span className={`text-[9px] font-mono leading-none ${isSelected ? "text-white/90" : "text-emerald-700 font-bold"}`}>
                    {item.statusInfo?.totalVagas}v
                  </span>
                </div>
              )}

              {status === "full" && (
                <div className="flex items-center gap-0.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  <span className="text-[8.5px] text-rose-600 font-bold leading-none">
                    Esgotado
                  </span>
                </div>
              )}

              {status === "none" && !item.isPast && (
                <span className="text-[8px] text-slate-300 mt-0.5 font-normal">
                  —
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Visual Legend */}
      <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5 text-[11px] text-slate-600 select-none">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-200" />
          <span className="font-semibold text-emerald-900">Vagas Disponíveis</span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-rose-200" />
          <span className="font-semibold text-rose-900">Esgotado / Indisponível</span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-200 border border-slate-300" />
          <span className="text-slate-400">Sem Horários</span>
        </div>
      </div>
    </div>
  )
}
