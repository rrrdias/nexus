"use client"

import React, { useState, useEffect, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { 
  concludeBooking, 
  markAbsentBooking, 
  cancelBooking, 
  getStudentProfile, 
  getOptions, 
  createBooking,
  importBookings,
  getBookings
} from "@/app/actions/scheduling"
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
  Search, 
  UserCheck, 
  UserX, 
  FileSpreadsheet, 
  PlusCircle, 
  RefreshCw, 
  User, 
  BookOpen, 
  Trash2,
  ChevronLeft,
  ChevronRight,
  Printer,
  AlertCircle,
  X
} from "lucide-react"
import { AttendanceListDialog } from "./AttendanceListDialog"
import { ExamDateCalendar } from "./ExamDateCalendar"
import {
  calculateDatesStatus,
  filterValidStartSlots,
  normalizeDateStr,
  getExamEndTime
} from "@/lib/scheduling-utils"

export function SchedulingDashboard({ 
  locals, 
  initialBookings,
  availablePeriods = ["2026-1", "2025-2"],
  defaultPeriod = "2026-1"
}: { 
  locals: any[], 
  initialBookings: any,
  availablePeriods?: string[],
  defaultPeriod?: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Filter States
  const [matricula, setMatricula] = useState(searchParams.get("matricula") || "")
  const [localId, setLocalId] = useState(searchParams.get("localId") || "all")
  const [periodo, setPeriodo] = useState(searchParams.get("periodo") || defaultPeriod)
  const [dataFiltro, setDataFiltro] = useState(searchParams.get("data") || "")
  const [status, setStatus] = useState(searchParams.get("status") || "all")
  const [page, setPage] = useState(parseInt(searchParams.get("page") || "1"))

  // Dynamic Metrics (calculated on screen data or can be enriched)
  const [bookingsData, setBookingsData] = useState(initialBookings.data || [])
  const [meta, setMeta] = useState({
    total_records: initialBookings.total_records || 0,
    total_pages: initialBookings.total_pages || 1,
    page: initialBookings.page || 1,
    size: initialBookings.size || 15
  })
  
  // Loading & Alert state
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | null }>({ message: "", type: null })

  // Booking Modal States
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMatricula, setModalMatricula] = useState("")
  const [modalPeriodo, setModalPeriodo] = useState(defaultPeriod)
  const [studentProfile, setStudentProfile] = useState<any>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  
  const [selectedLocal, setSelectedLocal] = useState("")
  const [selectedDate, setSelectedDate] = useState("")
  const [poloOptions, setPoloOptions] = useState<any[]>([])
  const [poloOptionsLoading, setPoloOptionsLoading] = useState(false)
  const [selectedSlotId, setSelectedSlotId] = useState("")
  const [submittingBooking, setSubmittingBooking] = useState(false)
  const [modalError, setModalError] = useState<string>("")

  // Import states
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [importing, setImporting] = useState(false)

  // Attendance list modal state
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false)

  // Confirm dialog state
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    actionType: "presence" | "absence" | "cancel" | null;
    bookingId: string;
    currentStatus?: string;
  }>({
    isOpen: false,
    title: "",
    description: "",
    actionType: null,
    bookingId: "",
  })

  // Auto trigger alerts
  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type })
    setTimeout(() => setToast({ message: "", type: null }), 4000)
  }

  // Fetch updated data from API
  const refreshData = async () => {
    setLoading(true)
    try {
      const filters: any = { page, size: 15 }
      if (matricula) filters.matricula = matricula
      if (localId !== "all") filters.localId = localId
      if (periodo) filters.periodo = periodo
      if (dataFiltro) filters.data = dataFiltro
      if (status !== "all") filters.status = status

      const result = await getBookings(filters)
      if (result) {
        setBookingsData(result.data)
        setMeta({
          total_records: result.total_records,
          total_pages: result.total_pages,
          page: result.page,
          size: result.size
        })
      }
    } catch (err: any) {
      showToast("Falha ao buscar agendamentos.", "error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshData()
  }, [page])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    refreshData()
  }

  const handleClearFilters = () => {
    window.location.href = "/admin/scheduling"
  }

  // Attendance actions
  const handleTogglePresence = (id: string, currentStatus: string) => {
    if (currentStatus === "presente") {
      showToast("Este agendamento já está concluído.", "error")
      return
    }
    setConfirmConfig({
      isOpen: true,
      title: "Confirmar Presença",
      description: "Deseja confirmar a presença deste aluno? Esta ação registrará a presença do estudante e atualizará o status do agendamento.",
      actionType: "presence",
      bookingId: id,
      currentStatus
    })
  }

  const handleToggleAbsence = (id: string, currentStatus: string) => {
    if (currentStatus === "ausente") {
      showToast("Este agendamento já está marcado como ausente.", "error")
      return
    }
    setConfirmConfig({
      isOpen: true,
      title: "Registrar Falta",
      description: "Deseja marcar falta para este aluno? Esta ação registrará a ausência do estudante e atualizará o status do agendamento.",
      actionType: "absence",
      bookingId: id,
      currentStatus
    })
  }

  const handleCancelBooking = (id: string) => {
    setConfirmConfig({
      isOpen: true,
      title: "Cancelar Agendamento",
      description: "ATENÇÃO: Deseja realmente CANCELAR este agendamento? Esta ação irá liberar as vagas ocupadas de volta ao sistema e é irreversível.",
      actionType: "cancel",
      bookingId: id
    })
  }

  const handleConfirmAction = async () => {
    const { actionType, bookingId } = confirmConfig
    setConfirmConfig(prev => ({ ...prev, isOpen: false }))
    
    if (!bookingId || !actionType) return

    setLoading(true)
    try {
      if (actionType === "presence") {
        const res = await concludeBooking(bookingId)
        if (res.success) {
          showToast("Presença registrada com sucesso!", "success")
          refreshData()
        } else {
          showToast(res.error || "Erro ao registrar presença.", "error")
        }
      } else if (actionType === "absence") {
        const res = await markAbsentBooking(bookingId)
        if (res.success) {
          showToast("Falta registrada com sucesso!", "success")
          refreshData()
        } else {
          showToast(res.error || "Erro ao registrar falta.", "error")
        }
      } else if (actionType === "cancel") {
        const res = await cancelBooking(bookingId)
        if (res.success) {
          showToast("Agendamento cancelado e vagas liberadas com sucesso!", "success")
          refreshData()
        } else {
          showToast(res.error || "Erro ao cancelar agendamento.", "error")
        }
      }
    } catch (err: any) {
      showToast(err.message || "Ocorreu um erro ao processar a ação.", "error")
    } finally {
      setLoading(false)
    }
  }

  // Handle student profile hydration in booking form
  const handleSearchStudent = async () => {
    if (!modalMatricula.trim()) {
      setModalError("Digite a matrícula do estudante.")
      showToast("Digite a matrícula do estudante.", "error")
      return
    }
    setProfileLoading(true)
    setStudentProfile(null)
    setSelectedLocal("")
    setSelectedDate("")
    setPoloOptions([])
    setSelectedSlotId("")
    setModalError("")
    try {
      const profile = await getStudentProfile(modalMatricula, modalPeriodo)
      setStudentProfile(profile)
      showToast(`Estudante ${profile.nome} carregado com sucesso!`, "success")
    } catch (err: any) {
      const errMsg = err.message || "Estudante não encontrado no banco sincronizado."
      setModalError(errMsg)
      showToast(errMsg, "error")
    } finally {
      setProfileLoading(false)
    }
  }

  // Load all polo options whenever campus selection changes
  useEffect(() => {
    if (!selectedLocal) {
      setPoloOptions([])
      setSelectedDate("")
      setSelectedSlotId("")
      return
    }
    const loadPoloOptions = async () => {
      setPoloOptionsLoading(true)
      setSelectedDate("")
      setSelectedSlotId("")
      setModalError("")
      try {
        const options = await getOptions({ localId: selectedLocal })
        setPoloOptions(Array.isArray(options) ? options : [])
      } catch (err: any) {
        showToast("Erro ao carregar opções do polo selecionado.", "error")
        setPoloOptions([])
      } finally {
        setPoloOptionsLoading(false)
      }
    }
    loadPoloOptions()
  }, [selectedLocal])

  const disciplinesCount = studentProfile?.totalDisciplinas || 1

  // Compute interactive calendar status indicators for every date
  const datesStatus = useMemo(() => {
    return calculateDatesStatus(poloOptions, disciplinesCount)
  }, [poloOptions, disciplinesCount])

  // Filter valid starting timeslots for selected date
  // Rule: only slots that can accommodate all consecutive disciplines with vacancies > 0 and are not in past
  const availableSlots = useMemo(() => {
    if (!selectedDate || !poloOptions.length) return []
    const slotsOnDate = poloOptions.filter(
      (opt) => normalizeDateStr(opt.data) === selectedDate
    )
    return filterValidStartSlots(
      slotsOnDate,
      disciplinesCount,
      selectedDate
    )
  }, [selectedDate, poloOptions, disciplinesCount])

  // Reset selected slot when selected date changes
  useEffect(() => {
    setSelectedSlotId("")
  }, [selectedDate])

  const handleConfirmNewBooking = async () => {
    if (!selectedSlotId) {
      setModalError("Selecione um horário disponível para a prova.")
      showToast("Selecione um horário disponível para a prova.", "error")
      return
    }
    setSubmittingBooking(true)
    setModalError("")
    try {
      const res = await createBooking({
        opcaoId: selectedSlotId,
        matricula: studentProfile?.matricula || modalMatricula.trim(),
        periodo: modalPeriodo || defaultPeriod
      })
      if (res.success) {
        showToast("Agendamento criado com sucesso!", "success")
        setIsModalOpen(false)
        // Reset modal inputs
        setModalMatricula("")
        setStudentProfile(null)
        setSelectedLocal("")
        setSelectedDate("")
        setPoloOptions([])
        setSelectedSlotId("")
        setModalError("")
        refreshData()
      } else {
        const errMsg = res.error || "Erro ao criar agendamento."
        setModalError(errMsg)
        showToast(errMsg, "error")
      }
    } catch (err: any) {
      const errMsg = err.message || "Erro ao criar agendamento."
      setModalError(errMsg)
      showToast(errMsg, "error")
    } finally {
      setSubmittingBooking(false)
    }
  }

  // Calculate quick metrics from full/current listing page
  const totalBookings = meta.total_records
  const totalPresent = bookingsData.filter((b: any) => b.status === "presente").length
  const totalAbsent = bookingsData.filter((b: any) => b.status === "ausente").length
  const totalCancelled = bookingsData.filter((b: any) => b.status === "cancelado").length

  const handleExportCSV = () => {
    const filters: any = {}
    if (matricula) filters.matricula = matricula
    if (localId !== "all") filters.localId = localId
    if (periodo) filters.periodo = periodo
    if (dataFiltro) filters.data = dataFiltro
    if (status !== "all") filters.status = status

    const params = new URLSearchParams()
    Object.entries(filters).forEach(([k, v]) => params.append(k, String(v)))
    
    window.open(`/nexus/api/scheduling/export?${params.toString()}`)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImporting(true)
    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string
        const lines = text.split('\n')
        if (lines.length < 2) {
          showToast("Arquivo vazio ou sem registros.", "error")
          return
        }

        const parseCSVLine = (line: string, sep: string) => {
          const result = []
          let cur = ''
          let inQuote = false
          for (let i = 0; i < line.length; i++) {
            const char = line[i]
            if (inQuote) {
              if (char === '"' && line[i+1] === '"') {
                cur += '"'
                i++
              } else if (char === '"') {
                inQuote = false
              } else {
                cur += char
              }
            } else {
              if (char === '"') {
                inQuote = true
              } else if (char === sep) {
                result.push(cur)
                cur = ''
              } else {
                cur += char
              }
            }
          }
          result.push(cur)
          return result.map(s => s.trim())
        }

        // Detect header row by scanning first 10 lines
        let headerLineIdx = -1
        let headersArr: string[] = []
        let separator = ','

        for (let i = 0; i < Math.min(10, lines.length); i++) {
          const line = lines[i].trim()
          if (!line) continue
          
          let sep = ','
          if (line.includes(';')) sep = ';'
          else if (line.includes('\t')) sep = '\t'

          // normalize to remove accents and spaces
          const arr = parseCSVLine(line, sep).map(h => 
            h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/[\s"']/g, '')
          )
          
          if (arr.some(h => h.includes('matricula')) && arr.some(h => h.includes('polo') || h.includes('campus'))) {
            headerLineIdx = i
            headersArr = arr
            separator = sep
            break
          }
        }

        if (headerLineIdx === -1) {
          showToast("Colunas 'Matricula' ou 'Polo'/'Campus' não encontradas no cabeçalho.", "error")
          return
        }
        
        const idxMatricula = headersArr.findIndex(h => h.includes('matricula'))
        const idxCampus = headersArr.findIndex(h => h.includes('polo') || h.includes('campus'))
        const idxData = headersArr.findIndex(h => h === 'data' || h.includes('dataprova'))
        const idxHoraInicio = headersArr.findIndex(h => h.includes('horainicio') || h === 'hora')
        const idxStatus = headersArr.findIndex(h => h === 'status')
        const idxDisciplinas = headersArr.findIndex(h => h.includes('disciplinas'))
        const idxPeriodo = headersArr.findIndex(h => h === 'periodo')

        const rows = []
        for (let i = headerLineIdx + 1; i < lines.length; i++) {
          const line = lines[i].trim()
          if (!line) continue
          
          const rowArr = parseCSVLine(line, separator)
          
          if (rowArr.length >= Math.max(idxMatricula, idxCampus)) {
            rows.push({
              matricula: rowArr[idxMatricula],
              campus: rowArr[idxCampus],
              dataProva: idxData !== -1 ? rowArr[idxData] : '',
              horaInicio: idxHoraInicio !== -1 ? rowArr[idxHoraInicio] : '',
              periodo: idxPeriodo !== -1 && rowArr[idxPeriodo] ? rowArr[idxPeriodo] : periodo, // Fallback to selected period
              status: idxStatus !== -1 && rowArr[idxStatus] ? rowArr[idxStatus] : 'Ativo',
              disciplinas: idxDisciplinas !== -1 ? rowArr[idxDisciplinas] : ''
            })
          }
        }

        if (rows.length === 0) {
          showToast("Nenhum dado válido encontrado no arquivo CSV. Verifique as colunas.", "error")
          return
        }

        const res = await importBookings(rows)
        if (res.success && res.data) {
          showToast(`Importação concluída! Registros processados: ${res.data.imported}. Falhas: ${res.data.errors}.`, "success")
          setIsImportModalOpen(false)
          refreshData()
        } else {
          showToast(res.error || "Erro ao importar arquivo.", "error")
        }
      } catch (err: any) {
        showToast(err.message || "Erro ao importar arquivo.", "error")
      } finally {
        setImporting(false)
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="space-y-6 relative">
      {/* Toast Alert Banner */}
      {toast.type && (
        <div className={`fixed top-4 right-4 z-[9999] p-4 rounded-xl shadow-lg border text-white transition-all flex items-center gap-3 ${
          toast.type === "success" ? "bg-green-dark border-green-brand" : "bg-[#E53935] border-[#D32F2F]"
        }`}>
          <span className="font-semibold text-sm">{toast.message}</span>
        </div>
      )}

      {/* Header and Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-navy tracking-tight">Painel de Agendamentos</h1>
          <p className="text-sm text-[#5F6775] mt-1">Gerenciamento administrativo, controle de presença e alocação de salas.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button 
            onClick={handleExportCSV}
            variant="outline" 
            className="border-gray-300 hover:bg-gray-50 text-navy gap-2"
          >
            <FileSpreadsheet className="w-4 h-4 text-green-dark" /> Exportar
          </Button>

          <Button 
            onClick={() => setIsAttendanceModalOpen(true)}
            variant="outline" 
            className="border-gray-300 hover:bg-gray-50 text-navy gap-2"
          >
            <Printer className="w-4 h-4 text-navy" /> Lista de Presença
          </Button>

          <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
            <DialogTrigger render={<Button variant="outline" className="border-gray-300 hover:bg-gray-50 text-navy gap-2" />}>
              <RefreshCw className="w-4 h-4 text-navy" /> Importar CSV
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden border border-slate-200/90 shadow-2xl rounded-2xl bg-white">
              {/* Header Fixo */}
              <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between bg-white select-none">
                <div className="flex items-center gap-3.5 pr-8">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-navy shrink-0 shadow-xs">
                    <FileSpreadsheet className="w-5 h-5 text-navy" />
                  </div>
                  <div>
                    <DialogTitle className="text-lg font-bold text-navy tracking-tight">
                      Importar Agendamentos
                    </DialogTitle>
                    <p className="text-xs text-[#5F6775] mt-0.5">
                      Sincronize agendamentos em lote a partir de uma planilha CSV.
                    </p>
                  </div>
                </div>
              </div>

              {/* Corpo */}
              <div className="px-6 py-5 space-y-4">
                <p className="text-xs text-[#5F6775] leading-relaxed">
                  Selecione um arquivo CSV gerado pelo sistema legado ou pelo próprio Nexus para sincronizar e atualizar os agendamentos na base de dados atual.
                </p>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-navy uppercase tracking-wider flex items-center gap-1.5">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-slate-400" />
                    Arquivo CSV <span className="text-red-500">*</span>
                  </Label>
                  <Input 
                    type="file" 
                    accept=".csv"
                    disabled={importing}
                    onChange={handleFileUpload}
                    className="h-10 rounded-xl border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-green-dark focus:ring-2 focus:ring-green-500/20 transition-all shadow-xs p-1.5 cursor-pointer file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-navy/10 file:text-navy hover:file:bg-navy/20"
                  />
                </div>
                {importing && (
                  <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-navy font-semibold animate-pulse">
                    <RefreshCw className="w-4 h-4 animate-spin text-green-dark shrink-0" />
                    <span>Importando e sincronizando registros...</span>
                  </div>
                )}
              </div>

              {/* Rodapé */}
              <div className="px-6 py-4 bg-slate-50/90 border-t border-slate-100 flex items-center justify-end gap-2.5 select-none">
                <Button 
                  type="button"
                  variant="outline" 
                  onClick={() => setIsImportModalOpen(false)}
                  className="border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium px-4 h-9 rounded-xl transition-all cursor-pointer"
                >
                  Fechar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          
          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogTrigger render={<Button className="bg-green-dark hover:bg-green-brand text-white gap-2" />}>
              <PlusCircle className="w-4 h-4" /> Novo Agendamento
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl md:max-w-2xl lg:max-w-3xl p-0 gap-0 overflow-hidden border border-slate-200/90 shadow-2xl rounded-2xl bg-white">
              {/* Header Fixo */}
              <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between bg-white select-none">
                <div className="flex items-center gap-3.5 pr-8">
                  <div className="w-10 h-10 rounded-xl bg-green-50 border border-green-100 flex items-center justify-center text-green-dark shrink-0 shadow-xs">
                    <Calendar className="w-5 h-5 text-green-dark" />
                  </div>
                  <div>
                    <DialogTitle className="text-lg font-bold text-navy tracking-tight">
                      Novo Agendamento de Prova
                    </DialogTitle>
                    <p className="text-xs text-[#5F6775] mt-0.5">
                      Localize o discente pelo número de matrícula e reserve o polo e horário desejados.
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Corpo Rolável */}
              <div className="px-6 py-5 max-h-[calc(85vh-140px)] overflow-y-auto overflow-x-hidden space-y-5 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-200 hover:[&::-webkit-scrollbar-thumb]:bg-slate-300">
                {/* Inline Error Alert inside modal */}
                {modalError && (
                  <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center justify-between gap-2 animate-in fade-in">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                      <span>{modalError}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setModalError("")}
                      className="text-red-500 hover:text-red-800 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* 1. Student Fetch */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-navy uppercase tracking-wider flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    Localizar Aluno por Matrícula <span className="text-red-500">*</span>
                  </Label>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="Digite a Matrícula do Aluno" 
                      value={modalMatricula}
                      onChange={(e) => {
                        setModalMatricula(e.target.value)
                        if (modalError) setModalError("")
                      }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSearchStudent(); } }}
                      className="h-10 rounded-xl border-slate-200 bg-white px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-green-dark focus:ring-2 focus:ring-green-500/20 transition-all shadow-xs flex-1"
                    />
                    <select
                      className="h-10 text-xs border border-slate-200 rounded-xl px-3 bg-white text-slate-800 focus:outline-none focus:border-green-dark focus:ring-2 focus:ring-green-500/20 transition-all shadow-xs"
                      value={modalPeriodo}
                      onChange={(e) => setModalPeriodo(e.target.value)}
                    >
                      {availablePeriods.map((p) => (
                        <option key={p} value={p}>
                          {p.includes("-") ? p.replace("-", "/") : p}
                        </option>
                      ))}
                    </select>
                    <Button 
                      type="button"
                      onClick={handleSearchStudent}
                      disabled={profileLoading}
                      className="bg-navy hover:bg-navy-light text-white font-bold h-10 px-4 rounded-xl shadow-xs shrink-0 transition-all cursor-pointer"
                    >
                      {profileLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                      <span className="hidden sm:inline sm:ml-1.5">Buscar</span>
                    </Button>
                  </div>
                </div>

                {/* 2. Hydrated Profile Details */}
                {studentProfile && (
                  <div className="bg-slate-50/90 rounded-2xl p-4 md:p-5 border border-slate-200/80 space-y-3.5 shadow-2xs animate-in fade-in">
                    <div className="flex items-start gap-3.5">
                      <div className="w-11 h-11 rounded-xl bg-navy text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
                        {studentProfile.nome?.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-navy text-sm truncate">{studentProfile.nome}</p>
                        <p className="text-xs text-[#5F6775] truncate mt-0.5">{studentProfile.email}</p>
                        {studentProfile.telefone && (
                          <p className="text-xs text-[#5F6775] mt-0.5 font-mono">📞 {studentProfile.telefone}</p>
                        )}
                      </div>
                    </div>

                    <div className="border-t border-slate-200/80 pt-3">
                      <p className="text-xs font-bold text-navy uppercase tracking-wider flex items-center gap-1.5 mb-2">
                        <BookOpen className="w-3.5 h-3.5 text-green-dark" /> Disciplinas Vinculadas ({studentProfile.totalDisciplinas})
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {studentProfile.disciplinas.map((disc: string, idx: number) => (
                          <Badge key={idx} variant="outline" className="text-[10px] bg-white border-navy/20 text-navy font-semibold py-0.5 px-2 rounded-lg">
                            {disc}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-[11px] text-[#5F6775] italic mt-2.5">
                        * O sistema reservará automaticamente {studentProfile.totalDisciplinas} blocos consecutivos de 30 minutos ({studentProfile.totalDisciplinas * 30} min no total).
                      </p>
                    </div>
                  </div>
                )}

                {/* 3. Slot Reservation Fields */}
                {studentProfile && (
                  <div className="space-y-4 pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-[#9AA0AC] uppercase tracking-wider">
                        Opções de Agendamento
                      </span>
                      <div className="flex-1 h-[1px] bg-slate-100" />
                    </div>
                    
                    {/* Campus Selector */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-navy uppercase tracking-wider flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        Campus / Polo <span className="text-red-500">*</span>
                      </Label>
                      <select 
                        className="w-full h-10 text-sm border border-slate-200 rounded-xl px-3 bg-white text-slate-800 focus:outline-none focus:border-green-dark focus:ring-2 focus:ring-green-500/20 transition-all shadow-xs cursor-pointer"
                        value={selectedLocal}
                        onChange={(e) => setSelectedLocal(e.target.value)}
                      >
                        <option value="">Selecione o polo...</option>
                        {locals.map((l: any) => (
                          <option key={l.id} value={l.id}>{l.nome}</option>
                        ))}
                      </select>
                    </div>

                    {/* Interactive Calendar with Vacancy Legend */}
                    {selectedLocal && (
                      <div className="space-y-2 pt-1 animate-in fade-in">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-bold text-navy uppercase tracking-wider flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            Data da Prova <span className="text-red-500">*</span>
                          </Label>
                          {selectedDate && (
                            <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                              Data selecionada: {selectedDate.split("-").reverse().join("/")}
                            </span>
                          )}
                        </div>

                        {poloOptionsLoading ? (
                          <div className="text-center py-10 text-xs text-[#9AA0AC] flex items-center justify-center gap-2 bg-slate-50 rounded-2xl border border-slate-100">
                            <RefreshCw className="w-4 h-4 animate-spin text-navy" />
                            Carregando calendário de datas e vagas do polo...
                          </div>
                        ) : (
                          <ExamDateCalendar
                            selectedDate={selectedDate}
                            onSelectDate={(dt) => {
                              setSelectedDate(dt)
                              setModalError("")
                            }}
                            datesStatus={datesStatus}
                            disciplinesCount={disciplinesCount}
                          />
                        )}
                      </div>
                    )}

                    {/* 4. Filtered Valid Start Slots (accommodates all disciplines, not in past) */}
                    {selectedLocal && selectedDate && (
                      <div className="space-y-2 pt-2 animate-in fade-in">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                          <Label className="text-xs font-bold text-navy uppercase tracking-wider flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            Horários Iniciais Disponíveis <span className="text-red-500">*</span>
                          </Label>
                          <span className="text-[11px] text-[#5F6775]">
                            Apenas horários com capacidade para {disciplinesCount} disciplina(s) ({disciplinesCount * 30} min)
                          </span>
                        </div>

                        {availableSlots.length === 0 ? (
                          <div className="p-4 bg-amber-50 border border-amber-200/80 rounded-xl text-amber-800 text-xs flex items-start gap-2.5 animate-in fade-in">
                            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                            <div>
                              <p className="font-bold">Nenhum horário inicial com capacidade suficiente para esta data</p>
                              <p className="text-[11px] text-amber-700 mt-0.5">
                                Não há sequência contínua de horários com vagas disponíveis para as {disciplinesCount} disciplinas do aluno ({disciplinesCount * 30} min) nesta data ou os horários já passaram hoje. Por favor, selecione outra data destacada em verde no calendário acima.
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto p-1 [scrollbar-width:thin]">
                            {availableSlots.map((slot) => {
                              const startTime = slot.hora?.slice(0, 5)
                              const endTime = getExamEndTime(startTime, disciplinesCount)
                              const isSelected = selectedSlotId === slot.id

                              return (
                                <button
                                  key={slot.id}
                                  type="button"
                                  onClick={() => setSelectedSlotId(slot.id)}
                                  className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                                    isSelected
                                      ? "bg-navy text-white border-navy shadow-md ring-2 ring-navy/20 scale-[1.01]"
                                      : "bg-white text-navy border-slate-200 hover:border-navy/40 hover:bg-slate-50 shadow-2xs"
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-1 w-full">
                                    <span className="font-bold text-sm font-mono flex items-center gap-1">
                                      <Clock className="w-3.5 h-3.5" /> {startTime}
                                    </span>
                                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                      isSelected ? "bg-white/20 text-white" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    }`}>
                                      {slot.vagas} vaga{slot.vagas !== 1 ? "s" : ""}
                                    </span>
                                  </div>
                                  <div className="mt-2 pt-2 border-t border-slate-100/60 flex items-center justify-between text-[11px]">
                                    <span className={isSelected ? "text-white/80" : "text-slate-500"}>
                                      Até {endTime}
                                    </span>
                                    <span className={`text-[10px] font-bold ${isSelected ? "text-white/90" : "text-navy"}`}>
                                      {disciplinesCount * 30} min
                                    </span>
                                  </div>
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Rodapé Fixo */}
              <div className="px-6 py-4 bg-slate-50/90 border-t border-slate-100 flex items-center justify-between gap-3 select-none">
                <p className="text-[11px] text-[#9AA0AC] hidden sm:block">
                  <span className="text-red-500 font-bold">*</span> Campos obrigatórios
                </p>
                <div className="flex items-center gap-2.5 ml-auto">
                  <Button 
                    type="button"
                    variant="outline" 
                    onClick={() => setIsModalOpen(false)}
                    className="border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium px-4 h-9 rounded-xl transition-all cursor-pointer"
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="button"
                    onClick={handleConfirmNewBooking}
                    disabled={submittingBooking || !selectedSlotId}
                    className="bg-green-dark hover:bg-green-brand text-white font-bold px-5 h-9 rounded-xl shadow-sm gap-2 transition-all cursor-pointer active:scale-98 disabled:opacity-50"
                  >
                    {submittingBooking ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Processando...</span>
                      </>
                    ) : (
                      <>
                        <PlusCircle className="w-4 h-4" />
                        <span>Confirmar Agendamento</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Metrics Quick Counters */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-[#9AA0AC] uppercase tracking-wider">Total Agendados</p>
              <h3 className="text-2xl font-extrabold text-navy mt-1">{totalBookings}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-navy/10 text-navy flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-[#9AA0AC] uppercase tracking-wider">Confirmados Presente</p>
              <h3 className="text-2xl font-extrabold text-blue mt-1">
                {bookingsData.filter((b: any) => b.status === "presente").length}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue/10 text-blue flex items-center justify-center">
              <UserCheck className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-[#9AA0AC] uppercase tracking-wider">Ausentes (Falta)</p>
              <h3 className="text-2xl font-extrabold text-amber mt-1">
                {bookingsData.filter((b: any) => b.status === "ausente").length}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber/10 text-amber flex items-center justify-center">
              <UserX className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-[#9AA0AC] uppercase tracking-wider">Cancelados</p>
              <h3 className="text-2xl font-extrabold text-red mt-1">
                {bookingsData.filter((b: any) => b.status === "cancelado").length}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-red/10 text-red flex items-center justify-center">
              <Trash2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modern Filter Card */}
      <Card className="bg-white border-gray-200 shadow-sm">
        <CardContent className="p-5">
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Matricula Input */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-navy uppercase">Matrícula</Label>
                <div className="relative">
                  <Input 
                    placeholder="Filtrar por Matrícula" 
                    value={matricula}
                    onChange={(e) => setMatricula(e.target.value)}
                    className="pl-8 text-xs border-gray-300 focus:border-navy"
                  />
                  <Search className="w-3.5 h-3.5 text-[#9AA0AC] absolute left-2.5 top-3" />
                </div>
              </div>

              {/* Campus Select */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-navy uppercase">Campus / Polo</Label>
                <select 
                  className="w-full text-xs border border-gray-300 rounded-lg p-2.5 bg-white focus:outline-none focus:ring-1 focus:ring-navy"
                  value={localId}
                  onChange={(e) => setLocalId(e.target.value)}
                >
                  <option value="all">Todos os Polos</option>
                  {locals.map((l: any) => (
                    <option key={l.id} value={l.id}>{l.nome}</option>
                  ))}
                </select>
              </div>

              {/* Periodo Select */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-navy uppercase">Período Semestre</Label>
                <select 
                  className="w-full text-xs border border-gray-300 rounded-lg p-2.5 bg-white focus:outline-none focus:ring-1 focus:ring-navy"
                  value={periodo}
                  onChange={(e) => setPeriodo(e.target.value)}
                >
                  {availablePeriods.map((p) => (
                    <option key={p} value={p}>
                      {p.includes("-") ? p.replace("-", "/") : p}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Filter */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-navy uppercase">Data da Prova</Label>
                <Input 
                  type="date"
                  value={dataFiltro}
                  onChange={(e) => setDataFiltro(e.target.value)}
                  className="text-xs border-gray-300 focus:border-navy"
                />
              </div>

              {/* Status Select */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-navy uppercase">Status</Label>
                <select 
                  className="w-full text-xs border border-gray-300 rounded-lg p-2.5 bg-white focus:outline-none focus:ring-1 focus:ring-navy"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="all">Todos</option>
                  <option value="ativo">Ativo</option>
                  <option value="presente">Presente</option>
                  <option value="ausente">Ausente</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>
            </div>

            {/* Filter actions */}
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <Button 
                type="button" 
                variant="ghost" 
                onClick={handleClearFilters}
                className="text-xs text-[#5F6775] hover:bg-gray-50"
              >
                Limpar Filtros
              </Button>
              <Button 
                type="submit" 
                className="bg-navy hover:bg-navy-light text-white text-xs gap-1.5"
              >
                <Search className="w-3.5 h-3.5" /> Filtrar Resultados
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Bookings Table Listing */}
      <Card className="bg-white border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="w-full text-sm">
            <TableHeader>
              <TableRow className="bg-[#F4F5F7] border-b border-gray-200">
                <TableHead className="px-5 py-3 text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider text-left">Estudante</TableHead>
                <TableHead className="px-5 py-3 text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider text-left hidden md:table-cell">Polo / Campus</TableHead>
                <TableHead className="px-5 py-3 text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider text-left">Data Prova</TableHead>
                <TableHead className="px-5 py-3 text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider text-left">Horário</TableHead>
                <TableHead className="px-5 py-3 text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider text-left hidden lg:table-cell">Disciplinas Agendadas</TableHead>
                <TableHead className="px-5 py-3 text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider text-center">Presença</TableHead>
                <TableHead className="px-5 py-3 text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider text-center">Falta</TableHead>
                <TableHead className="px-5 py-3 text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-gray-100">
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-[#9AA0AC] italic flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" /> Carregando agendamentos...
                  </TableCell>
                </TableRow>
              ) : bookingsData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-[#9AA0AC] italic">Nenhum agendamento ativo ou filtrado encontrado.</TableCell>
                </TableRow>
              ) : (
                bookingsData.map((row: any) => {
                  const disciplineList = row.descricao.split(";")
                  const totalDisciplines = disciplineList.length
                  const endTime = getExamEndTime(row.hora, totalDisciplines)

                  return (
                    <TableRow 
                      key={row.id} 
                      className={`transition-colors ${
                        row.status === "ativo" ? "bg-green-3/30 hover:bg-green-3/50" :
                        row.status === "presente" ? "bg-blue-50/20 hover:bg-blue-50/40" :
                        row.status === "ausente" ? "bg-amber-50/25 hover:bg-amber-50/45" :
                        row.status === "cancelado" ? "bg-red-50/20 hover:bg-red-50/40" : 
                        "hover:bg-gray-50"
                      }`}
                    >
                      {/* Name Card */}
                      <TableCell className={`px-5 py-3.5 ${
                        row.status === "ativo" ? "border-l-4 border-l-green-dark" :
                        row.status === "presente" ? "border-l-4 border-l-blue" :
                        row.status === "ausente" ? "border-l-4 border-l-amber" :
                        row.status === "cancelado" ? "border-l-4 border-l-red" : ""
                      }`}>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-navy text-white flex items-center justify-center font-bold text-xs shrink-0">
                            <User className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-semibold text-navy text-sm">{row.studentName}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] font-mono text-[#9AA0AC]">{row.matricula}</span>
                              <span className="text-[10px] text-gray-300">|</span>
                              <span className="text-[10px] text-[#9AA0AC]">{row.periodo}</span>
                            </div>
                          </div>
                        </div>
                      </TableCell>

                      {/* Polo */}
                      <TableCell className="px-5 py-3.5 hidden md:table-cell">
                        <div className="flex items-center gap-1.5 text-navy font-medium text-xs">
                          <MapPin className="w-3.5 h-3.5 text-[#9AA0AC]" /> {row.localNome}
                        </div>
                      </TableCell>

                      {/* Date */}
                      <TableCell className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5 text-navy text-xs">
                          <Calendar className="w-3.5 h-3.5 text-[#9AA0AC]" /> 
                          {new Date(row.data).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
                        </div>
                      </TableCell>

                      {/* Time */}
                      <TableCell className="px-5 py-3.5">
                        <div className="space-y-0.5 text-left">
                          <p className="font-semibold text-navy text-xs flex items-center gap-1">
                            <Clock className="w-3 h-3 text-[#9AA0AC]" /> {row.hora?.slice(0, 5)} - {endTime}
                          </p>
                          <p className="text-[9px] text-[#5F6775]">({totalDisciplines * 30} min total)</p>
                        </div>
                      </TableCell>

                      {/* Disciplines Modal Trigger */}
                      <TableCell className="px-5 py-3.5 hidden lg:table-cell">
                        <Dialog>
                          <DialogTrigger render={<button className="text-left text-xs text-navy hover:text-green-dark font-medium underline flex items-center gap-1 cursor-pointer" />}>
                            <BookOpen className="w-3.5 h-3.5 text-green-dark" /> Visualizar Disciplinas ({totalDisciplines})
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden border border-slate-200/90 shadow-2xl rounded-2xl bg-white">
                            {/* Header Fixo */}
                            <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between bg-white select-none">
                              <div className="flex items-center gap-3.5 pr-8">
                                <div className="w-10 h-10 rounded-xl bg-green-50 border border-green-100 flex items-center justify-center text-green-dark shrink-0 shadow-xs">
                                  <BookOpen className="w-5 h-5 text-green-dark" />
                                </div>
                                <div>
                                  <DialogTitle className="text-lg font-bold text-navy tracking-tight">
                                    Matérias Agendadas
                                  </DialogTitle>
                                  <p className="text-xs text-[#5F6775] mt-0.5 truncate max-w-sm">
                                    {row.studentName} • {totalDisciplines} disciplina(s)
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Corpo Rolável */}
                            <div className="px-6 py-5 max-h-[60vh] overflow-y-auto space-y-2.5 [scrollbar-width:thin]">
                              {disciplineList.map((disc: string, i: number) => (
                                <div key={i} className="flex items-center gap-3 p-3 bg-slate-50/80 rounded-xl border border-slate-200/80 text-navy text-xs font-semibold shadow-2xs">
                                  <Badge className="bg-green-dark text-white text-[10px] font-bold h-5 px-2 flex items-center justify-center rounded-md shrink-0">
                                    Prova {i + 1}
                                  </Badge>
                                  <span className="truncate">{disc}</span>
                                </div>
                              ))}
                            </div>

                            {/* Rodapé Fixo */}
                            <div className="px-6 py-3.5 bg-slate-50/90 border-t border-slate-100 flex justify-end select-none">
                              <DialogTrigger render={<Button variant="outline" className="border-slate-200 text-slate-600 hover:bg-slate-100 text-xs h-8 px-4 rounded-xl cursor-pointer" />}>
                                Fechar
                              </DialogTrigger>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </TableCell>

                      {/* Presence Checkbox */}
                      <TableCell className="px-5 py-3.5 text-center">
                        <div className="flex items-center justify-center">
                          <Checkbox
                            checked={row.status === "presente"}
                            disabled={row.status !== "ativo"}
                            onClick={() => handleTogglePresence(row.id, row.status)}
                            className={`w-4 h-4 border-gray-300 focus:ring-blue ${
                              row.status === "presente" ? "text-white bg-blue border-blue" : ""
                            }`}
                          />
                        </div>
                      </TableCell>

                      {/* Absence Checkbox */}
                      <TableCell className="px-5 py-3.5 text-center">
                        <div className="flex items-center justify-center">
                          <Checkbox
                            checked={row.status === "ausente"}
                            disabled={row.status !== "ativo"}
                            onClick={() => handleToggleAbsence(row.id, row.status)}
                            className={`w-4 h-4 border-gray-300 focus:ring-amber ${
                              row.status === "ausente" ? "text-white bg-amber border-amber" : ""
                            }`}
                          />
                        </div>
                      </TableCell>

                      {/* Action Cancel Row */}
                      <TableCell className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Badge 
                            className={`text-[9px] font-bold uppercase py-0.5 px-1.5 ${
                              row.status === "presente" ? "bg-blue hover:bg-blue/80 text-white" :
                              row.status === "ausente" ? "bg-amber hover:bg-amber/80 text-white" :
                              row.status === "cancelado" ? "bg-red hover:bg-red/80 text-white" :
                              "bg-green-dark hover:bg-green-brand text-white"
                            }`}
                          >
                            {row.status === "ativo" ? "Agendado" : row.status}
                          </Badge>
                          {row.status === "ativo" && (
                            <Button
                              onClick={() => handleCancelBooking(row.id)}
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-[#9AA0AC] hover:text-[#E53935]"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Dynamic Pagination Bar */}
        {meta.total_pages > 1 && (
          <div className="bg-[#F4F5F7] border-t border-gray-200 px-5 py-3 flex items-center justify-between">
            <p className="text-xs text-[#5F6775]">
              Mostrando página <span className="font-semibold">{meta.page}</span> de <span className="font-semibold">{meta.total_pages}</span> ({meta.total_records} registros total)
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={meta.page <= 1 || loading}
                onClick={() => setPage(meta.page - 1)}
                className="h-8 p-2 border-gray-300 text-navy"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={meta.page >= meta.total_pages || loading}
                onClick={() => setPage(meta.page + 1)}
                className="h-8 p-2 border-gray-300 text-navy"
              >
                Próximo <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      <AlertDialog 
        open={confirmConfig.isOpen} 
        onOpenChange={(open) => setConfirmConfig(prev => ({ ...prev, isOpen: open }))}
      >
        <AlertDialogContent className="rounded-2xl border-0 shadow-2xl p-6 bg-white max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-extrabold text-navy">
              {confirmConfig.title}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-4 text-[14px]">
              {confirmConfig.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-8 border-t-0 bg-transparent p-0 m-0 sm:justify-end gap-3 flex-row justify-end">
            <AlertDialogCancel className="border border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold rounded-lg h-11 px-6 mt-0 transition-colors">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmAction}
              className={`font-semibold rounded-lg h-11 px-6 text-white transition-colors ${
                confirmConfig.actionType === "cancel" 
                  ? "bg-[#E53935] hover:bg-[#D32F2F]" 
                  : confirmConfig.actionType === "absence" 
                    ? "bg-[#D97706] hover:bg-[#B45309]" 
                    : "bg-[#2563EB] hover:bg-[#1D4ED8]"
              }`}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AttendanceListDialog
        isOpen={isAttendanceModalOpen}
        onClose={() => setIsAttendanceModalOpen(false)}
        locals={locals}
        availablePeriods={availablePeriods}
        initialLocalId={localId}
        initialDate={dataFiltro}
        initialPeriod={periodo}
      />
    </div>
  )
}
