"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { createLocal, updateLocal, getLocals } from "@/app/actions/scheduling"
import { 
  Building2, 
  MapPin, 
  Phone, 
  ExternalLink, 
  PlusCircle, 
  Edit2, 
  Power, 
  RefreshCw, 
  Search,
  CheckCircle,
  XCircle
} from "lucide-react"

export function LocalsManagement({ initialLocals }: { initialLocals: any[] }) {
  const router = useRouter()
  const [localsList, setLocalsList] = useState<any[]>(initialLocals || [])
  const [searchTerm, setSearchTerm] = useState("")
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | null }>({ message: "", type: null })

  // Modal form states
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<"create" | "edit">("create")
  const [selectedLocalId, setSelectedLocalId] = useState("")
  const [nome, setNome] = useState("")
  const [endereco, setEndereco] = useState("")
  const [linkLocal, setLinkLocal] = useState("")
  const [telefone, setTelefone] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type })
    setTimeout(() => setToast({ message: "", type: null }), 4000)
  }

  const refreshData = async () => {
    setLoading(true)
    try {
      const data = await getLocals({ todos: true })
      setLocalsList(data)
    } catch (err) {
      showToast("Erro ao recarregar a lista de polos.", "error")
    } finally {
      setLoading(false)
    }
  }

  const handleOpenCreate = () => {
    setModalMode("create")
    setSelectedLocalId("")
    setNome("")
    setEndereco("")
    setLinkLocal("")
    setTelefone("")
    setIsModalOpen(true)
  }

  const handleOpenEdit = (local: any) => {
    setModalMode("edit")
    setSelectedLocalId(local.id)
    setNome(local.nome)
    setEndereco(local.endereco)
    setLinkLocal(local.linkLocal || "")
    setTelefone(local.telefone || "")
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim() || !endereco.trim()) {
      showToast("Nome e endereço são obrigatórios.", "error")
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        nome,
        endereco,
        linkLocal: linkLocal.trim() || undefined,
        telefone: telefone.trim() || undefined
      }

      if (modalMode === "create") {
        await createLocal(payload)
        showToast("Polo criado com sucesso!", "success")
      } else {
        await updateLocal(selectedLocalId, payload)
        showToast("Polo atualizado com sucesso!", "success")
      }
      setIsModalOpen(false)
      refreshData()
    } catch (err: any) {
      showToast(err.message || "Erro ao salvar polo.", "error")
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleStatus = async (local: any) => {
    const actionWord = local.status ? "desativar" : "ativar"
    const confirm = window.confirm(`Deseja realmente ${actionWord} o polo ${local.nome}?`)
    if (!confirm) return

    setLoading(true)
    try {
      await updateLocal(local.id, { status: !local.status })
      showToast(`Polo ${local.status ? "desativado" : "ativado"} com sucesso!`, "success")
      refreshData()
    } catch (err: any) {
      showToast(err.message || "Erro ao alterar status do polo.", "error")
    } finally {
      setLoading(false)
    }
  }

  const filteredLocals = localsList.filter(
    (l) =>
      l.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.endereco.toLowerCase().includes(searchTerm.toLowerCase())
  )

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

      {/* Header and Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-navy tracking-tight">Gerenciamento de Polos</h1>
          <p className="text-sm text-[#5F6775] mt-1">Cadastro e controle de polos físicos de atendimento para realização de provas.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            onClick={refreshData} 
            variant="outline" 
            disabled={loading}
            className="border-gray-300 hover:bg-gray-50 text-navy gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>

          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <Button 
              onClick={handleOpenCreate}
              className="bg-green-dark hover:bg-green-brand text-white gap-2"
            >
              <PlusCircle className="w-4 h-4" /> Novo Polo
            </Button>
            <DialogContent className="sm:max-w-xl md:max-w-2xl p-0 gap-0 overflow-hidden border border-slate-200/90 shadow-2xl rounded-2xl bg-white">
              {/* Header Fixo */}
              <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between bg-white select-none">
                <div className="flex items-center gap-3.5 pr-8">
                  <div className="w-10 h-10 rounded-xl bg-green-50 border border-green-100 flex items-center justify-center text-green-dark shrink-0 shadow-xs">
                    <Building2 className="w-5 h-5 text-green-dark" />
                  </div>
                  <div>
                    <DialogTitle className="text-lg font-bold text-navy tracking-tight">
                      {modalMode === "create" ? "Cadastrar Novo Polo" : "Editar Polo de Atendimento"}
                    </DialogTitle>
                    <p className="text-xs text-[#5F6775] mt-0.5">
                      {modalMode === "create" 
                        ? "Cadastre um novo polo físico de atendimento para aplicação de exames presenciais." 
                        : "Atualize os dados cadastrais, endereço e canais de contato deste polo."}
                    </p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col m-0">
                {/* Corpo Rolável */}
                <div className="px-6 py-5 max-h-[calc(85vh-140px)] overflow-y-auto overflow-x-hidden space-y-4 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-200 hover:[&::-webkit-scrollbar-thumb]:bg-slate-300">
                  <div className="space-y-1.5">
                    <Label htmlFor="nome" className="text-xs font-bold text-navy uppercase tracking-wider flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      Nome do Polo <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="nome"
                      placeholder="Ex: Polo Anápolis (UniEvangélica)"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      required
                      className="h-10 rounded-xl border-slate-200 bg-white px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-green-dark focus:ring-2 focus:ring-green-500/20 transition-all shadow-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="endereco" className="text-xs font-bold text-navy uppercase tracking-wider flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      Endereço Completo <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="endereco"
                      placeholder="Av, Rua, Número, Bairro, Cidade - UF"
                      value={endereco}
                      onChange={(e) => setEndereco(e.target.value)}
                      required
                      className="h-10 rounded-xl border-slate-200 bg-white px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-green-dark focus:ring-2 focus:ring-green-500/20 transition-all shadow-xs"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="telefone" className="text-xs font-bold text-navy uppercase tracking-wider flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        Telefone de Contato
                      </Label>
                      <Input
                        id="telefone"
                        placeholder="(62) 3310-0000"
                        value={telefone}
                        onChange={(e) => setTelefone(e.target.value)}
                        className="h-10 rounded-xl border-slate-200 bg-white px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-green-dark focus:ring-2 focus:ring-green-500/20 transition-all shadow-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="linkLocal" className="text-xs font-bold text-navy uppercase tracking-wider flex items-center gap-1.5">
                        <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                        Link Localização (Google Maps)
                      </Label>
                      <Input
                        id="linkLocal"
                        placeholder="https://goo.gl/maps/..."
                        value={linkLocal}
                        onChange={(e) => setLinkLocal(e.target.value)}
                        className="h-10 rounded-xl border-slate-200 bg-white px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-green-dark focus:ring-2 focus:ring-green-500/20 transition-all shadow-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Rodapé Fixo de Ações */}
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
                      type="submit"
                      disabled={submitting}
                      className="bg-green-dark hover:bg-green-brand text-white font-bold px-5 h-9 rounded-xl shadow-sm gap-2 transition-all cursor-pointer active:scale-98"
                    >
                      {submitting ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Processando...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          <span>{modalMode === "create" ? "Cadastrar Polo" : "Salvar Alterações"}</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filter Card */}
      <Card className="bg-white border-gray-200 shadow-sm">
        <CardContent className="p-4">
          <div className="relative">
            <Input 
              placeholder="Buscar polo por nome ou endereço..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 border-gray-300 focus:border-navy text-sm h-10"
            />
            <Search className="w-4 h-4 text-[#9AA0AC] absolute left-3 top-3" />
          </div>
        </CardContent>
      </Card>

      {/* Polos Grid */}
      {filteredLocals.length === 0 ? (
        <div className="text-center py-16 bg-white border border-gray-200 rounded-xl shadow-sm">
          <Building2 className="w-12 h-12 text-[#9AA0AC] mx-auto opacity-50" />
          <p className="text-sm font-medium text-[#5F6775] mt-4">Nenhum polo de atendimento encontrado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredLocals.map((local) => (
            <Card 
              key={local.id} 
              className={`bg-white border transition-all duration-300 hover:shadow-md ${
                local.status ? "border-gray-200" : "border-red-200 bg-red-50/5"
              }`}
            >
              <CardContent className="p-5 flex flex-col h-full justify-between space-y-4">
                <div className="space-y-3">
                  {/* Title and status badge */}
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-bold text-navy text-base tracking-tight leading-tight">
                      {local.nome}
                    </h3>
                    <Badge 
                      variant="outline" 
                      className={`text-[9px] font-extrabold uppercase shrink-0 py-0.5 px-2 ${
                        local.status 
                          ? "bg-green-dark/10 border-green-brand text-green-dark" 
                          : "bg-red-50 border-red-300 text-[#E53935]"
                      }`}
                    >
                      {local.status ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>

                  {/* Address info */}
                  <div className="flex items-start gap-2 text-xs text-[#5F6775] leading-relaxed">
                    <MapPin className="w-4 h-4 text-[#9AA0AC] shrink-0 mt-0.5" />
                    <span>{local.endereco}</span>
                  </div>

                  {/* Phone and location links */}
                  <div className="flex flex-col gap-2.5 pt-2 border-t border-gray-100">
                    {local.telefone && (
                      <div className="flex items-center gap-2 text-xs text-[#5F6775]">
                        <Phone className="w-3.5 h-3.5 text-[#9AA0AC] shrink-0" />
                        <span>{local.telefone}</span>
                      </div>
                    )}
                    {local.linkLocal && (
                      <a 
                        href={local.linkLocal} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs text-green-dark hover:text-green-brand font-semibold select-none underline"
                      >
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" /> Visualizar Mapa
                      </a>
                    )}
                  </div>
                </div>

                {/* Edit and Toggle actions */}
                <div className="flex gap-2 pt-4 border-t border-gray-100">
                  <Button 
                    onClick={() => handleOpenEdit(local)}
                    variant="outline" 
                    size="sm"
                    className="flex-1 border-gray-300 hover:bg-gray-50 text-navy gap-1 text-xs h-9"
                  >
                    <Edit2 className="w-3.5 h-3.5" /> Editar
                  </Button>
                  <Button
                    onClick={() => handleToggleStatus(local)}
                    variant="outline"
                    size="sm"
                    className={`flex-1 gap-1 text-xs h-9 border ${
                      local.status 
                        ? "border-red-200 hover:bg-red-50 text-[#E53935] hover:text-[#E53935]" 
                        : "border-green-200 hover:bg-green-50/50 text-green-dark hover:text-green-dark"
                    }`}
                  >
                    <Power className="w-3.5 h-3.5" /> {local.status ? "Desativar" : "Ativar"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
