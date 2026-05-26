"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { createOption, updateOption, getOptions } from "@/app/actions/scheduling"
import { 
  Clock, 
  Calendar, 
  PlusCircle, 
  Edit2, 
  Power, 
  RefreshCw, 
  Search,
  AlertCircle,
  Inbox,
  Sparkles
} from "lucide-react"

export function SlotsManagement({ locals }: { locals: any[] }) {
  const [selectedLocal, setSelectedLocal] = useState("")
  const [selectedDate, setSelectedDate] = useState("")
  const [slotsList, setSlotsList] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | null }>({ message: "", type: null })

  // Modal forms states
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<"create" | "edit">("create")
  const [selectedSlotId, setSelectedSlotId] = useState("")
  const [horaInicio, setHoraInicio] = useState("")
  const [horaFim, setHoraFim] = useState("")
  const [vagas, setVagas] = useState(20)
  const [submitting, setSubmitting] = useState(false)

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type })
    setTimeout(() => setToast({ message: "", type: null }), 4000)
  }

  const loadSlots = async () => {
    if (!selectedLocal || !selectedDate) {
      setSlotsList([])
      return
    }
    setLoading(true)
    try {
      const res = await getOptions({
        localId: selectedLocal,
        data: selectedDate,
        incluirInativos: true
      })
      setSlotsList(res)
    } catch (err) {
      showToast("Erro ao carregar a lista de horários.", "error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSlots()
  }, [selectedLocal, selectedDate])

  const handleOpenCreate = () => {
    if (!selectedLocal || !selectedDate) {
      showToast("Selecione um Polo e uma Data primeiro.", "error")
      return
    }
    setModalMode("create")
    setSelectedSlotId("")
    setHoraInicio("")
    setHoraFim("")
    setVagas(20)
    setIsModalOpen(true)
  }

  const handleOpenEdit = (slot: any) => {
    setModalMode("edit")
    setSelectedSlotId(slot.id)
    setHoraInicio(slot.hora.slice(0, 5))
    setHoraFim("")
    setVagas(slot.vagas)
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (modalMode === "create") {
      if (!horaInicio.trim() || !horaFim.trim() || vagas === undefined || vagas < 0) {
        showToast("Insira horários válidos e número de vagas maior ou igual a 0.", "error")
        return
      }
    } else {
      if (vagas === undefined || vagas < 0) {
        showToast("Insira um número de vagas maior ou igual a 0.", "error")
        return
      }
    }

    setSubmitting(true)
    try {
      if (modalMode === "create") {
        await createOption({
          localId: selectedLocal,
          data: selectedDate,
          horaInicio: horaInicio.trim(),
          horaFim: horaFim.trim(),
          vagas: Number(vagas)
        })
        showToast("Horário e vagas cadastrados com sucesso!", "success")
      } else {
        await updateOption(selectedSlotId, {
          vagas: Number(vagas)
        })
        showToast("Vagas atualizadas com sucesso!", "success")
      }
      setIsModalOpen(false)
      loadSlots()
    } catch (err: any) {
      showToast(err.message || "Erro ao salvar horário.", "error")
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleStatus = async (slot: any) => {
    const actionWord = slot.status ? "desativar" : "ativar"
    const confirm = window.confirm(`Deseja realmente ${actionWord} o horário ${slot.hora.slice(0, 5)}?`)
    if (!confirm) return

    setLoading(true)
    try {
      await updateOption(slot.id, { status: !slot.status })
      showToast(`Horário ${slot.status ? "desativado" : "ativado"} com sucesso!`, "success")
      loadSlots()
    } catch (err: any) {
      showToast(err.message || "Erro ao alterar status do horário.", "error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 relative">
      {/* Toast Alert Banner */}
      {toast.type && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-lg border text-white transition-all flex items-center gap-3 ${
          toast.type === "success" ? "bg-green-dark border-green-brand" : "bg-[#E53935] border-[#D32F2F]"
        }`}>
          <span className="font-semibold text-sm">{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-navy tracking-tight">Gerenciamento de Datas e Vagas</h1>
          <p className="text-sm text-[#5F6775] mt-1">Configure horários e controle a capacidade máxima de vagas para exames presenciais por polo.</p>
        </div>
        <div>
          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <Button 
              onClick={handleOpenCreate}
              disabled={!selectedLocal || !selectedDate}
              className="bg-green-dark hover:bg-green-brand text-white gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <PlusCircle className="w-4 h-4" /> Novo Horário
            </Button>
            <DialogContent className="sm:max-w-[400px] bg-white rounded-xl shadow-xl">
              <DialogHeader>
                <DialogTitle className="text-navy font-bold text-lg">
                  {modalMode === "create" ? "Criar Novo Horário" : "Ajustar Vagas Disponíveis"}
                </DialogTitle>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4 py-4">
                {modalMode === "create" ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="horaInicio" className="text-xs font-bold text-navy uppercase">Hora de Início (HH:MM)</Label>
                      <Input
                        id="horaInicio"
                        type="time"
                        placeholder="Ex: 08:00"
                        value={horaInicio}
                        onChange={(e) => setHoraInicio(e.target.value)}
                        className="border-gray-300 focus:border-navy"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="horaFim" className="text-xs font-bold text-navy uppercase">Hora Final (HH:MM)</Label>
                      <Input
                        id="horaFim"
                        type="time"
                        placeholder="Ex: 10:00"
                        value={horaFim}
                        onChange={(e) => setHoraFim(e.target.value)}
                        className="border-gray-300 focus:border-navy"
                      />
                    </div>
                    <p className="col-span-2 text-[10px] text-[#5F6775] italic">* O sistema cadastrará blocos de 30 minutos desde a hora de início até a hora final.</p>
                  </div>
                ) : (
                  <div className="space-y-1.5 bg-[#F4F5F7] p-3 rounded-lg border border-gray-200">
                    <p className="text-xs text-navy font-semibold">Horário selecionado: <span className="font-bold">{horaInicio}</span></p>
                    <p className="text-[10px] text-[#5F6775] mt-1">Data: {new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="vagas" className="text-xs font-bold text-navy uppercase">Total de Vagas</Label>
                  <Input
                    id="vagas"
                    type="number"
                    min="0"
                    placeholder="Ex: 20"
                    value={vagas}
                    onChange={(e) => setVagas(Number(e.target.value))}
                    className="border-gray-300 focus:border-navy"
                  />
                  <p className="text-[10px] text-[#5F6775] italic">* Capacidade máxima de alunos simultâneos.</p>
                </div>

                {/* Modal Footer Actions */}
                <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                  <Button 
                    type="button"
                    variant="ghost" 
                    onClick={() => setIsModalOpen(false)}
                    className="text-[#5F6775] hover:bg-gray-100"
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit"
                    disabled={submitting}
                    className="bg-green-dark hover:bg-green-brand text-white"
                  >
                    {submitting ? "Processando..." : modalMode === "create" ? "Criar Horário" : "Atualizar Vagas"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filter Selector Card */}
      <Card className="bg-white border-gray-200 shadow-sm">
        <CardContent className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-navy uppercase">1. Selecione o Polo / Campus</Label>
              <select 
                className="w-full text-sm border border-gray-300 rounded-lg p-2.5 bg-white focus:outline-none focus:ring-1 focus:ring-navy"
                value={selectedLocal}
                onChange={(e) => setSelectedLocal(e.target.value)}
              >
                <option value="">Selecione um Polo...</option>
                {locals.map((l: any) => (
                  <option key={l.id} value={l.id}>{l.nome}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-navy uppercase">2. Selecione a Data da Prova</Label>
              <Input 
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="text-sm border-gray-300 focus:border-navy p-2.5"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Slots Table Listing */}
      {!selectedLocal || !selectedDate ? (
        <div className="text-center py-20 bg-white border border-gray-200 rounded-xl shadow-sm space-y-3">
          <Sparkles className="w-12 h-12 text-[#9AA0AC] mx-auto opacity-50" />
          <div>
            <h3 className="font-bold text-navy text-sm uppercase">Selecione um Polo e Data</h3>
            <p className="text-xs text-[#5F6775] mt-1">Escolha os filtros acima para listar, criar ou ajustar vagas de horários.</p>
          </div>
        </div>
      ) : (
        <Card className="bg-white border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-bold text-navy text-sm uppercase flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-green-dark" /> Horários Cadastrados
            </h2>
            <Button 
              onClick={loadSlots} 
              variant="ghost" 
              size="sm"
              disabled={loading}
              className="text-[#5F6775]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
          
          <div className="overflow-x-auto">
            <Table className="w-full text-sm">
              <TableHeader>
                <TableRow className="bg-[#F4F5F7] border-b border-gray-200">
                  <TableHead className="px-5 py-3 text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider text-left">Horário de Início</TableHead>
                  <TableHead className="px-5 py-3 text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider text-left">Data Vinculada</TableHead>
                  <TableHead className="px-5 py-3 text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider text-center">Vagas Totais</TableHead>
                  <TableHead className="px-5 py-3 text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider text-center">Status</TableHead>
                  <TableHead className="px-5 py-3 text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100">
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-[#9AA0AC] italic">
                      <RefreshCw className="w-4 h-4 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : slotsList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-[#9AA0AC] italic">
                      Nenhum horário ou vaga cadastrado para esta data neste polo.
                    </TableCell>
                  </TableRow>
                ) : (
                  slotsList.map((slot) => (
                    <TableRow key={slot.id} className="hover:bg-gray-50 transition-colors">
                      <TableCell className="px-5 py-3.5">
                        <div className="flex items-center gap-2 font-bold text-navy text-sm">
                          <Clock className="w-4 h-4 text-[#9AA0AC]" />
                          {slot.hora?.slice(0, 5)}
                        </div>
                      </TableCell>

                      <TableCell className="px-5 py-3.5">
                        <div className="flex items-center gap-2 text-xs text-[#5F6775]">
                          <Calendar className="w-4 h-4 text-[#9AA0AC]" />
                          {new Date(slot.data).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
                        </div>
                      </TableCell>

                      <TableCell className="px-5 py-3.5 text-center">
                        <div className="inline-flex items-center justify-center">
                          <Badge 
                            variant="outline" 
                            className={`font-mono text-xs font-bold py-0.5 px-2.5 ${
                              slot.vagas === 0 
                                ? "bg-red-50 border-red-300 text-[#E53935]" 
                                : slot.vagas < 5 
                                ? "bg-amber-50 border-amber-300 text-amber-600" 
                                : "bg-green-dark/5 border-green-brand/30 text-green-dark"
                            }`}
                          >
                            {slot.vagas} vagas
                          </Badge>
                        </div>
                      </TableCell>

                      <TableCell className="px-5 py-3.5 text-center">
                        <div className="inline-flex items-center justify-center">
                          <Badge 
                            className={`text-[9px] font-bold uppercase py-0.5 px-1.5 ${
                              slot.status ? "bg-green-dark text-white" : "bg-gray-200 text-gray-500"
                            }`}
                          >
                            {slot.status ? "Ativo" : "Desativado"}
                          </Badge>
                        </div>
                      </TableCell>

                      <TableCell className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            onClick={() => handleOpenEdit(slot)}
                            variant="outline"
                            size="sm"
                            className="h-8 border-gray-300 hover:bg-gray-50 text-navy gap-1 text-xs"
                          >
                            <Edit2 className="w-3.5 h-3.5" /> Vagas
                          </Button>
                          <Button
                            onClick={() => handleToggleStatus(slot)}
                            variant="outline"
                            size="sm"
                            className={`h-8 w-8 p-0 border ${
                              slot.status 
                                ? "border-red-200 hover:bg-red-50 text-[#E53935]" 
                                : "border-green-200 hover:bg-green-50 text-green-dark"
                            }`}
                            title={slot.status ? "Desativar horário" : "Ativar horário"}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  )
}
