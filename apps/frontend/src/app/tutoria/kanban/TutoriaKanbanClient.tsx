"use client"

import React, { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  Kanban,
  Search,
  Plus,
  RefreshCw,
  MessageCircle,
  Clock,
  ArrowLeft,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  XCircle,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  X,
  UserCheck,
  Send,
  Filter,
  TrendingUp,
  BarChart3,
  Users,
  ArrowRightLeft,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  getTutoriaKanbanCards,
  createTutoriaKanbanCard,
  updateTutoriaKanbanCard,
  deleteTutoriaKanbanCard,
  getTutoriaDisciplinas,
  lookupTutoriaDiscente,
} from "@/app/actions/tutoria"
import { BatonPassDialog } from "@/components/tutoria/BatonPassDialog"
import {
  getLeadTutorInfo,
  checkRecentIntervention,
} from "@/lib/tutoria-utils"

export { getLeadTutorInfo, checkRecentIntervention }

interface TutoriaKanbanClientProps {
  sessionUser: any
}

// Definição das colunas do Kanban
const KANBAN_COLUMNS = [
  {
    id: "pendente",
    title: "A Contatar",
    subtitle: "Alunos críticos / Sem acesso",
    color: "border-t-amber-500",
    headerBg: "bg-amber-50/80 text-amber-900 border-amber-200",
    badgeBg: "bg-amber-100 text-amber-800",
    icon: AlertTriangle,
  },
  {
    id: "em_contato",
    title: "Em Contato",
    subtitle: "Contato enviado / Aguardando",
    color: "border-t-blue-500",
    headerBg: "bg-blue-50/80 text-blue-900 border-blue-200",
    badgeBg: "bg-blue-100 text-blue-800",
    icon: Send,
  },
  {
    id: "em_recuperacao",
    title: "Em Acompanhamento",
    subtitle: "Em plano de recuperação",
    color: "border-t-purple-500",
    headerBg: "bg-purple-50/80 text-purple-900 border-purple-200",
    badgeBg: "bg-purple-100 text-purple-800",
    icon: Sparkles,
  },
  {
    id: "revertido",
    title: "Regularizado",
    subtitle: "Retomou engajamento",
    color: "border-t-emerald-500",
    headerBg: "bg-emerald-50/80 text-emerald-900 border-emerald-200",
    badgeBg: "bg-emerald-100 text-emerald-800",
    icon: CheckCircle2,
  },
  {
    id: "evadido",
    title: "Não Localizado",
    subtitle: "Sem retorno / Abandono",
    color: "border-t-gray-400",
    headerBg: "bg-gray-100 text-gray-800 border-gray-200",
    badgeBg: "bg-gray-200 text-gray-700",
    icon: XCircle,
  },
]

export function TutoriaKanbanClient({ sessionUser }: TutoriaKanbanClientProps) {
  const [cards, setCards] = useState<any[]>([])
  const [summary, setSummary] = useState<any>({
    pendente: 0,
    em_contato: 0,
    em_recuperacao: 0,
    revertido: 0,
    evadido: 0,
    total: 0,
  })
  const [disciplinas, setDisciplinas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Filtros
  const [periodo, setPeriodo] = useState("2026-2")
  const [grupoRisco, setGrupoRisco] = useState<string>("todos")
  const [search, setSearch] = useState("")

  // Modais
  const [selectedCard, setSelectedCard] = useState<any | null>(null)
  const [batonPassCard, setBatonPassCard] = useState<any | null>(null)
  const [isNewModalOpen, setIsNewModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Estados de busca acadêmica do discente
  const [lookupLoading, setLookupLoading] = useState(false)
  const [studentLookupResult, setStudentLookupResult] = useState<any | null>(null)
  const [studentDisciplinas, setStudentDisciplinas] = useState<any[]>([])

  // Formulário de Novo Atendimento
  const [newCardForm, setNewCardForm] = useState({
    matricula: "",
    alunoNome: "",
    alunoEmail: "",
    disciplinaCodigo: "",
    disciplinaNome: "",
    statusKanban: "pendente",
    observacoes: "",
    canalContatoUtilizado: "whatsapp",
  })

  // Formulário de Edição do Card
  const [editForm, setEditForm] = useState({
    statusKanban: "pendente",
    observacoes: "",
    canalContatoUtilizado: "whatsapp",
  })

  // Notificações Toast simples
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | null }>({
    message: "",
    type: null,
  })

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type })
    setTimeout(() => {
      setToast({ message: "", type: null })
    }, 4000)
  }

  // Carregar lista de disciplinas disponíveis
  useEffect(() => {
    let isMounted = true
    getTutoriaDisciplinas(periodo, "ead")
      .then((res: any) => {
        if (isMounted) {
          const list = Array.isArray(res) ? res : res?.data || []
          setDisciplinas(list)
        }
      })
      .catch((err) => console.error("Erro ao carregar disciplinas:", err))
    return () => {
      isMounted = false
    }
  }, [periodo])

  // Buscar cartões do Kanban
  const fetchKanban = useCallback(async () => {
    try {
      setLoading(true)
      const res: any = await getTutoriaKanbanCards({
        periodo,
        institution: "ead",
        search: search.trim() || undefined,
      })

      if (res && res.success === false) {
        showToast(res.error || "Erro ao carregar atendimentos do Kanban.", "error")
        return
      }

      const cardsList = res?.cards || res?.data?.cards || []
      const summaryData = res?.summary || res?.data?.summary || {
        pendente: 0,
        em_contato: 0,
        em_recuperacao: 0,
        revertido: 0,
        evadido: 0,
        total: 0,
        critico: 0,
        atencao: 0,
        autonomo: 0,
      }

      setCards(cardsList)
      setSummary(summaryData)
    } catch (err: any) {
      console.error("Erro ao carregar cartões do Kanban:", err)
      showToast(err?.message || "Erro ao carregar atendimentos do Kanban.", "error")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [periodo, search])

  useEffect(() => {
    fetchKanban()
  }, [fetchKanban])

  // Mover cartão para outro status
  const handleMoveCard = async (cardId: string, newStatus: string, canal?: string) => {
    // Otimista
    setCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, status_kanban: newStatus } : c))
    )

    try {
      const payload: any = { statusKanban: newStatus }
      if (canal) payload.canalContatoUtilizado = canal
      const res: any = await updateTutoriaKanbanCard(cardId, payload)
      if (res && res.success === false) {
        showToast(res.error || "Erro ao atualizar status do atendimento.", "error")
      } else {
        showToast(`Status atualizado com sucesso.`, "success")
      }
      fetchKanban()
    } catch (err: any) {
      console.error("Erro ao mover cartão:", err)
      showToast(err?.message || "Erro ao mover cartão de atendimento.", "error")
      fetchKanban()
    }
  }

  // Abrir modal de edição
  const handleOpenEdit = (card: any) => {
    setSelectedCard(card)
    setEditForm({
      statusKanban: card.status_kanban || "pendente",
      observacoes: card.observacoes || "",
      canalContatoUtilizado: card.canal_contato_utilizado || "whatsapp",
    })
  }

  // Salvar alterações do modal de edição
  const handleSaveEdit = async () => {
    if (!selectedCard) return
    setIsSaving(true)
    try {
      const res: any = await updateTutoriaKanbanCard(selectedCard.id, {
        statusKanban: editForm.statusKanban,
        observacoes: editForm.observacoes,
        canalContatoUtilizado: editForm.canalContatoUtilizado,
      })
      if (res && res.success === false) {
        showToast(res.error || "Falha ao atualizar atendimento.", "error")
        return
      }
      showToast("Atendimento atualizado com sucesso!", "success")
      setSelectedCard(null)
      fetchKanban()
    } catch (err: any) {
      console.error("Erro ao salvar atendimento:", err)
      showToast(err?.message || "Falha ao atualizar atendimento.", "error")
    } finally {
      setIsSaving(false)
    }
  }

  // Excluir cartão
  const handleDeleteCard = async () => {
    if (!selectedCard) return
    if (!confirm("Deseja realmente remover este atendimento do Kanban?")) return
    setIsDeleting(true)
    try {
      const res: any = await deleteTutoriaKanbanCard(selectedCard.id)
      if (res && res.success === false) {
        showToast(res.error || "Falha ao excluir atendimento.", "error")
        return
      }
      showToast("Atendimento removido com sucesso.", "success")
      setSelectedCard(null)
      fetchKanban()
    } catch (err: any) {
      console.error("Erro ao excluir cartão:", err)
      showToast(err?.message || "Falha ao excluir atendimento.", "error")
    } finally {
      setIsDeleting(false)
    }
  }

  // Passagem de bastão concluída com sucesso (F12)
  const handleBatonPassSuccess = (result: any) => {
    const { novoTutorId, novoTutorNome } = result
    if (batonPassCard) {
      setCards((prev) =>
        prev.map((c) =>
          c.id === batonPassCard.id
            ? {
                ...c,
                tutor_responsavel_id: novoTutorId,
                tutor_nome: novoTutorNome || c.tutor_nome,
                ultima_intervencao_em: new Date().toISOString(),
                qtd_intervencoes: (Number(c.qtd_intervencoes) || 0) + 1,
              }
            : c
        )
      )
      if (selectedCard && selectedCard.id === batonPassCard.id) {
        setSelectedCard((prev: any) => ({
          ...prev,
          tutor_responsavel_id: novoTutorId,
          tutor_nome: novoTutorNome || prev?.tutor_nome,
          ultima_intervencao_em: new Date().toISOString(),
          qtd_intervencoes: (Number(prev?.qtd_intervencoes) || 0) + 1,
        }))
      }
    }
    setBatonPassCard(null)
    showToast(
      novoTutorNome
        ? `Atendimento transferido com sucesso para ${novoTutorNome}!`
        : "Atendimento transferido com sucesso!",
      "success"
    )
    fetchKanban()
  }

  // Buscar dados acadêmicos do aluno pela matrícula
  const handleLookupStudent = useCallback(
    async (matriculaInput?: string) => {
      const mat = (matriculaInput ?? newCardForm.matricula).trim()
      if (!mat || mat.length < 3) {
        setStudentLookupResult(null)
        setStudentDisciplinas([])
        return
      }

      setLookupLoading(true)
      try {
        const res = await lookupTutoriaDiscente(mat, periodo, "ead")
        if (res && res.found) {
          setStudentLookupResult(res)
          setNewCardForm((prev) => ({
            ...prev,
            matricula: mat,
            alunoNome: res.nome || prev.alunoNome,
            alunoEmail: res.email || prev.alunoEmail,
            disciplinaCodigo: res.disciplinas?.[0]?.codigo || prev.disciplinaCodigo,
            disciplinaNome: res.disciplinas?.[0]?.nome || prev.disciplinaNome,
          }))
          setStudentDisciplinas(res.disciplinas || [])
        } else {
          setStudentLookupResult({ found: false })
          setStudentDisciplinas([])
        }
      } catch (err: any) {
        console.error("Erro ao buscar dados do estudante:", err)
        setStudentLookupResult({ found: false })
        setStudentDisciplinas([])
      } finally {
        setLookupLoading(false)
      }
    },
    [newCardForm.matricula, periodo],
  )

  // Criar novo atendimento manual
  const handleCreateNewCard = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanMat = newCardForm.matricula.trim()
    if (!cleanMat) {
      showToast("Informe a matrícula do aluno.", "error")
      return
    }

    setIsSaving(true)
    try {
      const res: any = await createTutoriaKanbanCard({
        periodo,
        institution: "ead",
        matricula: cleanMat,
        alunoNome: newCardForm.alunoNome.trim() || undefined,
        alunoEmail: newCardForm.alunoEmail.trim() || undefined,
        disciplinaCodigo: newCardForm.disciplinaCodigo.trim() || undefined,
        disciplinaNome: newCardForm.disciplinaNome.trim() || undefined,
        statusKanban: newCardForm.statusKanban,
        observacoes: newCardForm.observacoes.trim() || undefined,
        canalContatoUtilizado: newCardForm.canalContatoUtilizado,
      })

      if (res && res.success === false) {
        showToast(res.error || "Erro ao cadastrar atendimento.", "error")
        return
      }

      if (res && res.created === false) {
        showToast(res.message || "Discente já possui atendimento nesta disciplina.", "error")
      } else {
        showToast("Atendimento cadastrado no Kanban com sucesso!", "success")
        setIsNewModalOpen(false)
        setStudentLookupResult(null)
        setStudentDisciplinas([])
        setNewCardForm({
          matricula: "",
          alunoNome: "",
          alunoEmail: "",
          disciplinaCodigo: "",
          disciplinaNome: "",
          statusKanban: "pendente",
          observacoes: "",
          canalContatoUtilizado: "whatsapp",
        })
        fetchKanban()
      }
    } catch (err: any) {
      console.error("Erro ao criar atendimento:", err)
      showToast(err?.message || "Erro ao criar atendimento.", "error")
    } finally {
      setIsSaving(false)
    }
  }

  // Disparar WhatsApp
  const handleOpenWhatsApp = (card: any, e: React.MouseEvent) => {
    e.stopPropagation()
    const rawPhone = card.telefone || card.aluno_telefone || ""
    const cleanPhone = rawPhone.replace(/\D/g, "")
    if (!cleanPhone) {
      showToast("Discente não possui número de WhatsApp cadastrado.", "error")
      return
    }

    const fullPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`
    const alunoFirstName = card.aluno_nome?.split(" ")[0] || "Estudante"
    const disciplinaStr = card.disciplina_nome ? ` na disciplina *${card.disciplina_nome}*` : ""
    const message = `Olá, ${alunoFirstName}! Sou da Tutoria da UniEVANGÉLICA${disciplinaStr}. Notei que você pode estar com dificuldades de acesso ao ambiente virtual. Como podemos te ajudar em seus estudos?`

    const url = `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`
    window.open(url, "_blank")

    // Atualiza status para 'em_contato' se estiver pendente
    if (card.status_kanban === "pendente") {
      handleMoveCard(card.id, "em_contato", "whatsapp")
    }
  }

  // Formatador de tempo amigável
  const formatFriendlyDuration = (minutes: number | null | undefined) => {
    if (!minutes || minutes <= 0) return "0 min"
    const roundedMins = Math.round(minutes)
    if (roundedMins < 60) return `${roundedMins} min`
    const hours = Math.floor(roundedMins / 60)
    const remMins = roundedMins % 60
    return remMins === 0 ? `${hours}h` : `${hours}h ${remMins}m`
  }

  // Suporte a HTML5 Drag & Drop
  const handleDragStart = (e: React.DragEvent, cardId: string) => {
    e.dataTransfer.setData("text/plain", cardId)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault()
    const cardId = e.dataTransfer.getData("text/plain")
    if (cardId) {
      handleMoveCard(cardId, targetStatus)
    }
  }

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast.message && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-xl border text-sm font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top-4 ${
            toast.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-red-50 text-red-800 border-red-200"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          ) : (
            <AlertOctagon className="w-4 h-4 text-red-600" />
          )}
          {toast.message}
        </div>
      )}

      {/* Header Principal */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2 border-b border-gray-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-purple-500/10 text-purple-600">
              <Kanban className="w-6 h-6" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                  Quadro Kanban da Tutoria
                </h1>
                <Badge variant="outline" className="text-purple-700 bg-purple-50 border-purple-200 text-xs">
                  Busca Ativa & Atendimentos
                </Badge>
              </div>
              <p className="text-sm text-gray-500">
                Gestão ágil de intervenções individuais, acolhimento pelo WhatsApp e reversão de risco de evasão.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/tutoria">
            <Button variant="outline" size="sm" className="h-9 gap-1.5 cursor-pointer">
              <ArrowLeft className="w-4 h-4" />
              Voltar ao Acompanhamento
            </Button>
          </Link>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setRefreshing(true)
              fetchKanban()
            }}
            disabled={refreshing}
            className="h-9 gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            Atualizar
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => setIsNewModalOpen(true)}
            className="h-9 bg-purple-600 hover:bg-purple-700 text-white font-medium gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Novo Atendimento
          </Button>
        </div>
      </div>

      {/* SEÇÃO 1: Cards de FILTRO por Situação de Risco */}
      {(() => {
        const totalCardsCount = cards.length
        const criticosCount = cards.filter(
          (c) => (c.grupo_risco_calculado || c.eng_grupo_risco || "critico") === "critico"
        ).length
        const atencaoCount = cards.filter(
          (c) => (c.grupo_risco_calculado || c.eng_grupo_risco) === "atencao"
        ).length
        const autonomoCount = cards.filter(
          (c) => (c.grupo_risco_calculado || c.eng_grupo_risco) === "autonomo"
        ).length

        // Dados do Funil / Etapas do Kanban
        const totalPipeline = summary.total || totalCardsCount || 1
        const pendentes = summary.pendente || 0
        const emContato = summary.em_contato || 0
        const emRecup = summary.em_recuperacao || 0
        const revertidos = summary.revertido || 0
        const evadidos = summary.evadido || 0

        // Percentuais de cada etapa
        const pendentePct = totalPipeline > 0 ? (pendentes / totalPipeline) * 100 : 0
        const emContatoPct = totalPipeline > 0 ? (emContato / totalPipeline) * 100 : 0
        const emRecupPct = totalPipeline > 0 ? (emRecup / totalPipeline) * 100 : 0
        const revertidoPct = totalPipeline > 0 ? (revertidos / totalPipeline) * 100 : 0
        const evadidoPct = totalPipeline > 0 ? (evadidos / totalPipeline) * 100 : 0

        // Taxa de Reversão / Sucesso de Evasão
        const taxaReversao = totalPipeline > 0 ? Math.round((revertidos / totalPipeline) * 100) : 0
        const emAtendimentoAtivo = pendentes + emContato + emRecup

        return (
          <div className="space-y-4">
            {/* 1. CARDS DE FILTRO (Situação de Risco Pedagógico) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded-md bg-purple-100 text-purple-700">
                    <Filter className="w-3.5 h-3.5" />
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-700">
                    Filtros de Situação de Risco
                  </span>
                  <span className="text-[11px] text-gray-400 hidden sm:inline">
                    (Clique no card para filtrar os atendimentos do quadro)
                  </span>
                </div>
                {grupoRisco !== "todos" && (
                  <button
                    type="button"
                    onClick={() => setGrupoRisco("todos")}
                    className="text-xs text-purple-600 hover:text-purple-800 font-semibold cursor-pointer flex items-center gap-1.5"
                  >
                    <span>Limpar Filtro</span>
                    <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.2 rounded font-bold uppercase">
                      {grupoRisco}
                    </span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Total em Carteira */}
                <Card
                  onClick={() => setGrupoRisco("todos")}
                  className={`border shadow-2xs rounded-xl cursor-pointer transition-all hover:scale-[1.01] ${
                    grupoRisco === "todos"
                      ? "border-purple-500 ring-2 ring-purple-400/30 shadow-md bg-purple-50/20"
                      : "border-gray-200/80 bg-white hover:border-gray-300"
                  }`}
                  title="Clique para ver todos os atendimentos"
                >
                  <CardContent className="p-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block">
                        Todos os Alunos
                      </span>
                      <span className="p-1.5 rounded-lg bg-purple-100/70 text-purple-600">
                        <Kanban className="w-3.5 h-3.5" />
                      </span>
                    </div>
                    <div className="mt-1 flex items-baseline justify-between">
                      <span className="text-2xl font-bold text-gray-900">{totalCardsCount}</span>
                      <span className="text-xs text-gray-500">Atendimentos</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[10px]">
                      <span className="text-gray-400">Total cadastrado</span>
                      {grupoRisco === "todos" && (
                        <span className="text-purple-700 font-bold bg-purple-100/80 px-1.5 py-0.2 rounded">
                          Ativo
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Risco Crítico */}
                <Card
                  onClick={() => setGrupoRisco("critico")}
                  className={`border shadow-2xs rounded-xl cursor-pointer transition-all hover:scale-[1.01] bg-red-50/20 ${
                    grupoRisco === "critico"
                      ? "border-red-500 ring-2 ring-red-400/30 shadow-md bg-red-50/40"
                      : "border-red-200/70 hover:border-red-300"
                  }`}
                  title="Clique para filtrar apenas alunos em Risco Crítico"
                >
                  <CardContent className="p-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-red-700 uppercase tracking-wider block">
                        Risco Crítico
                      </span>
                      <span className="p-1.5 rounded-lg bg-red-100/80 text-red-600">
                        <AlertOctagon className="w-3.5 h-3.5" />
                      </span>
                    </div>
                    <div className="mt-1 flex items-baseline justify-between">
                      <span className="text-2xl font-bold text-red-700">{criticosCount}</span>
                      <span className="text-[11px] text-red-500 font-medium">&lt; 15 min</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[10px]">
                      <span className="text-red-600/70">Ação prioritária</span>
                      {grupoRisco === "critico" && (
                        <span className="text-red-700 font-bold bg-red-100 px-1.5 py-0.2 rounded">
                          Ativo
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Em Atenção */}
                <Card
                  onClick={() => setGrupoRisco("atencao")}
                  className={`border shadow-2xs rounded-xl cursor-pointer transition-all hover:scale-[1.01] bg-amber-50/20 ${
                    grupoRisco === "atencao"
                      ? "border-amber-500 ring-2 ring-amber-400/30 shadow-md bg-amber-50/40"
                      : "border-amber-200/70 hover:border-amber-300"
                  }`}
                  title="Clique para filtrar apenas alunos Em Atenção"
                >
                  <CardContent className="p-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider block">
                        Em Atenção
                      </span>
                      <span className="p-1.5 rounded-lg bg-amber-100/80 text-amber-600">
                        <AlertTriangle className="w-3.5 h-3.5" />
                      </span>
                    </div>
                    <div className="mt-1 flex items-baseline justify-between">
                      <span className="text-2xl font-bold text-amber-700">{atencaoCount}</span>
                      <span className="text-[11px] text-amber-600 font-medium">15 a 60 min</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[10px]">
                      <span className="text-amber-600/70">Incentivo aos estudos</span>
                      {grupoRisco === "atencao" && (
                        <span className="text-amber-700 font-bold bg-amber-100 px-1.5 py-0.2 rounded">
                          Ativo
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Em Dia (Autônomo) */}
                <Card
                  onClick={() => setGrupoRisco("autonomo")}
                  className={`border shadow-2xs rounded-xl cursor-pointer transition-all hover:scale-[1.01] bg-emerald-50/20 ${
                    grupoRisco === "autonomo"
                      ? "border-emerald-500 ring-2 ring-emerald-400/30 shadow-md bg-emerald-50/40"
                      : "border-emerald-200/70 hover:border-emerald-300"
                  }`}
                  title="Clique para filtrar apenas alunos Em Dia"
                >
                  <CardContent className="p-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wider block">
                        Em Dia
                      </span>
                      <span className="p-1.5 rounded-lg bg-emerald-100/80 text-emerald-600">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </span>
                    </div>
                    <div className="mt-1 flex items-baseline justify-between">
                      <span className="text-2xl font-bold text-emerald-700">{autonomoCount}</span>
                      <span className="text-[11px] text-emerald-600 font-medium">&gt; 60 min</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[10px]">
                      <span className="text-emerald-600/70">Engajamento sustentado</span>
                      {grupoRisco === "autonomo" && (
                        <span className="text-emerald-700 font-bold bg-emerald-100 px-1.5 py-0.2 rounded">
                          Ativo
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* 2. SEÇÃO INFORMATIVA: CARDS DAS 5 ETAPAS DO FLUXO + GRÁFICO DE MÉTRICAS */}
            <div className="bg-white rounded-2xl border border-gray-200/80 p-4 shadow-2xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700">
                    <BarChart3 className="w-4 h-4" />
                  </span>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800">
                      Métricas das Etapas do Fluxo & Pipeline de Intervenção
                    </h3>
                    <p className="text-[11px] text-gray-500">
                      Volume de alunos distribuídos nas 5 etapas do atendimento e indicadores de conversão.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="text-gray-500">Em Atendimento Ativo:</span>
                  <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                    {emAtendimentoAtivo} discentes
                  </span>
                </div>
              </div>

              {/* Cards Informativos das 5 Etapas do Kanban */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {/* 1. A Contatar */}
                <div className="p-3 rounded-xl border border-amber-200/80 bg-amber-50/40 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">
                      A Contatar
                    </span>
                    <span className="p-1 rounded-md bg-amber-100 text-amber-700">
                      <AlertTriangle className="w-3.5 h-3.5" />
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-bold text-amber-900">{pendentes}</span>
                    <span className="text-xs font-semibold text-amber-700">{Math.round(pendentePct)}%</span>
                  </div>
                  <div className="text-[10px] text-amber-700/80 flex items-center justify-between">
                    <span>Aguardando 1º contato</span>
                    <span className="font-semibold text-amber-800">Etapa 1</span>
                  </div>
                </div>

                {/* 2. Em Contato */}
                <div className="p-3 rounded-xl border border-blue-200/80 bg-blue-50/40 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">
                      Em Contato
                    </span>
                    <span className="p-1 rounded-md bg-blue-100 text-blue-700">
                      <Send className="w-3.5 h-3.5" />
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-bold text-blue-900">{emContato}</span>
                    <span className="text-xs font-semibold text-blue-700">{Math.round(emContatoPct)}%</span>
                  </div>
                  <div className="text-[10px] text-blue-700/80 flex items-center justify-between">
                    <span>Mensagem enviada</span>
                    <span className="font-semibold text-blue-800">Etapa 2</span>
                  </div>
                </div>

                {/* 3. Em Acompanhamento */}
                <div className="p-3 rounded-xl border border-purple-200/80 bg-purple-50/40 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-purple-800 uppercase tracking-wider">
                      Acompanhamento
                    </span>
                    <span className="p-1 rounded-md bg-purple-100 text-purple-700">
                      <Sparkles className="w-3.5 h-3.5" />
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-bold text-purple-900">{emRecup}</span>
                    <span className="text-xs font-semibold text-purple-700">{Math.round(emRecupPct)}%</span>
                  </div>
                  <div className="text-[10px] text-purple-700/80 flex items-center justify-between">
                    <span>Em plano pedagógico</span>
                    <span className="font-semibold text-purple-800">Etapa 3</span>
                  </div>
                </div>

                {/* 4. Regularizados */}
                <div className="p-3 rounded-xl border border-emerald-200/80 bg-emerald-50/40 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                      Regularizados
                    </span>
                    <span className="p-1 rounded-md bg-emerald-100 text-emerald-700">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-bold text-emerald-900">{revertidos}</span>
                    <span className="text-xs font-semibold text-emerald-700">{Math.round(revertidoPct)}%</span>
                  </div>
                  <div className="text-[10px] text-emerald-700/80 flex items-center justify-between">
                    <span>Retomaram acesso</span>
                    <span className="font-semibold text-emerald-800">Etapa 4</span>
                  </div>
                </div>

                {/* 5. Não Localizados */}
                <div className="p-3 rounded-xl border border-gray-200 bg-gray-50/60 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-gray-700 uppercase tracking-wider">
                      Não Localizados
                    </span>
                    <span className="p-1 rounded-md bg-gray-200 text-gray-600">
                      <XCircle className="w-3.5 h-3.5" />
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-bold text-gray-900">{evadidos}</span>
                    <span className="text-xs font-semibold text-gray-600">{Math.round(evadidoPct)}%</span>
                  </div>
                  <div className="text-[10px] text-gray-500 flex items-center justify-between">
                    <span>Sem retorno / Abandono</span>
                    <span className="font-semibold text-gray-600">Etapa 5</span>
                  </div>
                </div>
              </div>

              {/* GRÁFICO E INDICADORES DE CONVERSÃO / TAXA DE REVERSÃO */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-gray-100 items-center">
                {/* Indicador 1: Taxa de Reversão com Donut SVG */}
                <div className="flex items-center gap-3.5 p-3 rounded-xl bg-gray-50/60 border border-gray-100">
                  <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
                    <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 72 72">
                      <circle
                        cx="36"
                        cy="36"
                        r="30"
                        className="text-gray-200 stroke-current"
                        strokeWidth="6"
                        fill="transparent"
                      />
                      <circle
                        cx="36"
                        cy="36"
                        r="30"
                        className="text-emerald-500 stroke-current transition-all duration-700 ease-out"
                        strokeWidth="6"
                        strokeDasharray={2 * Math.PI * 30}
                        strokeDashoffset={2 * Math.PI * 30 * (1 - taxaReversao / 100)}
                        strokeLinecap="round"
                        fill="transparent"
                      />
                    </svg>
                    <span className="absolute text-xs font-bold text-gray-900 font-mono">
                      {taxaReversao}%
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">
                      Taxa de Reversão
                    </span>
                    <span className="text-sm font-bold text-emerald-800 block">
                      {revertidos} de {totalPipeline} regularizados
                    </span>
                    <span className="text-[10px] text-gray-400 mt-0.5 block">
                      Eficácia do acolhimento pedagógico
                    </span>
                  </div>
                </div>

                {/* Indicador 2: Barra de Pipeline Contínua (Funil de Distribuição) */}
                <div className="md:col-span-2 p-3 rounded-xl bg-gray-50/60 border border-gray-100 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-gray-700">
                    <span className="flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
                      Distribuição do Pipeline de Atendimento
                    </span>
                    <span className="text-[11px] text-gray-500">
                      Total: {totalPipeline} alunos
                    </span>
                  </div>

                  {/* Barra Segmentada Visual */}
                  <div className="h-4 w-full bg-gray-200 rounded-full overflow-hidden flex shadow-inner">
                    {pendentePct > 0 && (
                      <div
                        style={{ width: `${pendentePct}%` }}
                        className="h-full bg-amber-500 transition-all duration-500 hover:opacity-90"
                        title={`A Contatar: ${pendentes} (${Math.round(pendentePct)}%)`}
                      />
                    )}
                    {emContatoPct > 0 && (
                      <div
                        style={{ width: `${emContatoPct}%` }}
                        className="h-full bg-blue-500 transition-all duration-500 hover:opacity-90"
                        title={`Em Contato: ${emContato} (${Math.round(emContatoPct)}%)`}
                      />
                    )}
                    {emRecupPct > 0 && (
                      <div
                        style={{ width: `${emRecupPct}%` }}
                        className="h-full bg-purple-500 transition-all duration-500 hover:opacity-90"
                        title={`Acompanhamento: ${emRecup} (${Math.round(emRecupPct)}%)`}
                      />
                    )}
                    {revertidoPct > 0 && (
                      <div
                        style={{ width: `${revertidoPct}%` }}
                        className="h-full bg-emerald-500 transition-all duration-500 hover:opacity-90"
                        title={`Regularizados: ${revertidos} (${Math.round(revertidoPct)}%)`}
                      />
                    )}
                    {evadidoPct > 0 && (
                      <div
                        style={{ width: `${evadidoPct}%` }}
                        className="h-full bg-gray-400 transition-all duration-500 hover:opacity-90"
                        title={`Não Localizados: ${evadidos} (${Math.round(evadidoPct)}%)`}
                      />
                    )}
                  </div>

                  {/* Legendas Compactas */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-gray-500 font-medium pt-0.5">
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      <span>A Contatar: <strong>{pendentes}</strong></span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      <span>Em Contato: <strong>{emContato}</strong></span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-purple-500" />
                      <span>Acompanhamento: <strong>{emRecup}</strong></span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>Regularizados: <strong>{revertidos}</strong></span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-gray-400" />
                      <span>Não Localiz.: <strong>{evadidos}</strong></span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

            {/* Barra de Filtros */}
            <Card className="border border-gray-100 shadow-2xs rounded-xl">
              <CardContent className="p-4 flex flex-col md:flex-row items-center justify-between gap-3">
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Buscar por nome, matrícula ou e-mail..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 h-9 text-xs"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                  {/* Pílulas de filtro rápido por situação (igual ao Acompanhamento) */}
                  <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg text-xs font-medium">
                    {[
                      { id: "todos", label: "Todas as Situações" },
                      { id: "critico", label: "Críticos" },
                      { id: "atencao", label: "Atenção" },
                      { id: "autonomo", label: "Em Dia" },
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setGrupoRisco(item.id)}
                        className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                          grupoRisco === item.id
                            ? "bg-white text-gray-900 shadow-xs font-semibold"
                            : "text-gray-500 hover:text-gray-900"
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>

                  {/* Seletor de Período */}
                  <select
                    value={periodo}
                    onChange={(e) => setPeriodo(e.target.value)}
                    className="h-9 px-3 rounded-lg border border-gray-200 text-xs bg-white text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
                    title="Período acadêmico"
                  >
                    <option value="2026-2">2026-2</option>
                    <option value="2026-1">2026-1</option>
                    <option value="2025-2">2025-2</option>
                  </select>
                </div>
              </CardContent>
            </Card>

      {/* Board Kanban com as 5 Colunas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-start">
        {KANBAN_COLUMNS.map((col, colIndex) => {
          const colCards = cards.filter((c) => {
            const matchesStatus = (c.status_kanban || "pendente") === col.id
            const cardRisk = c.grupo_risco_calculado || c.eng_grupo_risco || "critico"
            const matchesRisk = grupoRisco === "todos" || cardRisk === grupoRisco
            return matchesStatus && matchesRisk
          })
          const ColIcon = col.icon

          return (
            <div
              key={col.id}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.id)}
              className={`flex flex-col bg-gray-50/70 border border-gray-200 rounded-xl min-h-[580px] shadow-2xs border-t-4 ${col.color}`}
            >
              {/* Header da Coluna */}
              <div className={`p-3 border-b flex items-center justify-between ${col.headerBg} rounded-t-lg`}>
                <div className="flex items-center gap-2">
                  <ColIcon className="w-4 h-4" />
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider">{col.title}</h3>
                    <p className="text-[10px] opacity-80">{col.subtitle}</p>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${col.badgeBg}`}>
                  {colCards.length}
                </span>
              </div>

              {/* Lista de Cartões */}
              <div className="p-2 space-y-2.5 flex-1 overflow-y-auto max-h-[calc(100vh-280px)]">
                {loading ? (
                  <div className="p-4 text-center text-xs text-gray-400">Carregando...</div>
                ) : colCards.length === 0 ? (
                  <div className="p-6 text-center text-xs text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
                    {grupoRisco !== "todos"
                      ? "Nenhum aluno com esta situação nesta coluna"
                      : "Nenhum aluno nesta coluna"}
                  </div>
                ) : (
                  colCards.map((card) => {
                    const hasPhone = !!(card.telefone || card.aluno_telefone)
                    const rawRisk = card.grupo_risco_calculado || card.eng_grupo_risco || "critico"
                    const riskLabelsMap: Record<string, string> = {
                      critico: "Crítico",
                      atencao: "Atenção",
                      procrastinacao: "Atenção",
                      autonomo: "Em Dia",
                    }
                    const riskLabel = riskLabelsMap[rawRisk] || "Crítico"
                    const riskColorsMap: Record<string, string> = {
                      critico: "bg-red-50 text-red-700 border-red-200",
                      atencao: "bg-amber-50 text-amber-700 border-amber-200",
                      procrastinacao: "bg-orange-50 text-orange-700 border-orange-200",
                      autonomo: "bg-emerald-50 text-emerald-700 border-emerald-200",
                    }
                    const riskColors = riskColorsMap[rawRisk] || "bg-gray-50 text-gray-700 border-gray-200"

                    return (
                      <div
                        key={card.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, card.id)}
                        onClick={() => handleOpenEdit(card)}
                        className="p-3 bg-white rounded-lg border border-gray-200 shadow-2xs hover:shadow-md hover:border-purple-300 transition-all cursor-pointer space-y-2 group"
                      >
                        {/* Topo do Card */}
                        <div className="flex items-start justify-between gap-1">
                          <div>
                            <h4 className="text-xs font-bold text-gray-900 group-hover:text-purple-700 transition-colors line-clamp-1">
                              {card.aluno_nome}
                            </h4>
                            <p className="text-[10px] text-gray-400 font-mono">
                              Matr: {card.matricula}
                            </p>
                          </div>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold border ${riskColors}`}>
                            {riskLabel}
                          </span>
                        </div>

                        {/* BADGES DE GOVERNANÇA: TUTOR RESPONSÁVEL (F10) & INTERVENÇÃO RECENTE (F11) */}
                        {(() => {
                          const tutorInfo = getLeadTutorInfo(card, sessionUser)
                          const recency = checkRecentIntervention(card)

                          return (
                            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                              {/* F10: Lead Tutor Badge */}
                              {tutorInfo.isMe ? (
                                <span
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/80 shadow-2xs"
                                  title="Você é o tutor responsável titular deste estudante"
                                >
                                  <UserCheck className="w-3 h-3 text-indigo-600 shrink-0" />
                                  <span>Você (Titular)</span>
                                </span>
                              ) : tutorInfo.hasTutor ? (
                                <span
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-50 text-slate-700 border border-slate-200/80 shadow-2xs"
                                  title={`Tutor Titular: ${tutorInfo.tutorName}`}
                                >
                                  <Users className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span className="truncate max-w-[110px]">{tutorInfo.tutorName}</span>
                                </span>
                              ) : (
                                <span
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] italic text-amber-700 bg-amber-50/60 border border-amber-200/60 border-dashed"
                                  title="Nenhum tutor responsável atribuído"
                                >
                                  <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                                  <span>Sem tutor</span>
                                </span>
                              )}

                              {/* F11: Recent Intervention Pulse Badge */}
                              {recency.isRecent && (
                                <span
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/90 shadow-2xs"
                                  title={`Atividade recente registrada ${recency.formattedRelative}`}
                                >
                                  <span className="relative flex h-1.5 w-1.5 shrink-0">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                                  </span>
                                  <span>&lt;48h</span>
                                  {recency.interventionCount > 0 && (
                                    <span
                                      className="text-[9px] px-1 py-0.2 rounded-full bg-emerald-200/70 text-emerald-800 font-mono font-bold"
                                      title={`${recency.interventionCount} intervenções`}
                                    >
                                      {recency.interventionCount}
                                    </span>
                                  )}
                                </span>
                              )}
                            </div>
                          )
                        })()}

                        {/* Disciplina e Polo */}
                        <div className="space-y-1 text-[11px] text-gray-600">
                          <p className="font-medium text-gray-800 line-clamp-1" title={card.disciplina_nome}>
                            {card.disciplina_nome || card.disciplina_codigo || "Disciplina AVA"}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-gray-500">
                            <span className="truncate max-w-[120px]" title={card.curso_nome || card.aluno_curso || ""}>
                              {card.curso_nome || card.aluno_curso || "Graduação EAD"}
                            </span>
                            <span>•</span>
                            <span>{card.unidade_fisica || card.aluno_polo || "EAD"}</span>
                          </div>
                        </div>

                        {/* Tempo em Tela */}
                        <div className="flex items-center justify-between text-[10px] bg-gray-50 p-1.5 rounded text-gray-600">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-gray-400" />
                            Tempo AVA:
                          </span>
                          <span className="font-semibold text-gray-800">
                            {formatFriendlyDuration(card.tempo_total_minutos || card.eng_tempo_total_minutos)}
                          </span>
                        </div>

                        {/* Observações Rápidas */}
                        {card.observacoes && (
                          <p className="text-[10px] text-gray-500 italic bg-amber-50/50 p-1.5 rounded border border-amber-100 line-clamp-2">
                            &quot;{card.observacoes}&quot;
                          </p>
                        )}

                        {/* Rodapé com Ações Rápidas */}
                        <div className="pt-1 border-t border-gray-100 flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            {/* Botão de WhatsApp */}
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={(e) => handleOpenWhatsApp(card, e)}
                              disabled={!hasPhone}
                              className={`h-7 px-2 text-[10px] font-semibold rounded cursor-pointer ${
                                hasPhone
                                  ? "text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                                  : "text-gray-300 cursor-not-allowed"
                              }`}
                              title={hasPhone ? `WhatsApp: ${card.aluno_telefone}` : "Sem telefone cadastrado"}
                            >
                              <MessageCircle className="w-3 h-3 mr-1 text-emerald-600" />
                              WhatsApp
                            </Button>

                            {/* Botão Transferir Atendimento */}
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation()
                                setBatonPassCard(card)
                              }}
                              className="h-7 px-2 text-[10px] font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded cursor-pointer gap-1"
                              title="Transferir atendimento para outro tutor"
                            >
                              <ArrowRightLeft className="w-3 h-3 text-purple-600" />
                              Transferir
                            </Button>
                          </div>

                          {/* Movimentação rápida de coluna */}
                          <div className="flex items-center gap-0.5">
                            {colIndex > 0 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleMoveCard(card.id, KANBAN_COLUMNS[colIndex - 1].id)
                                }}
                                className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                                title={`Mover para ${KANBAN_COLUMNS[colIndex - 1].title}`}
                              >
                                <ChevronLeft className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {colIndex < KANBAN_COLUMNS.length - 1 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleMoveCard(card.id, KANBAN_COLUMNS[colIndex + 1].id)
                                }}
                                className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                                title={`Mover para ${KANBAN_COLUMNS[colIndex + 1].title}`}
                              >
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal / Drawer de Detalhes e Edição do Card */}
      {selectedCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-100 flex items-start justify-between bg-gray-50/70">
              <div>
                <h3 className="font-bold text-gray-900 text-base">{selectedCard.aluno_nome}</h3>
                <p className="text-xs text-gray-500 font-mono">
                  Matrícula: {selectedCard.matricula} • {selectedCard.aluno_email || "E-mail não cadastrado"}
                </p>
                <div className="mt-1 text-xs text-purple-700 font-medium">
                  {selectedCard.disciplina_nome} ({selectedCard.disciplina_codigo})
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCard(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 text-xs">
              {/* Telefone e Polo */}
              <div className="grid grid-cols-2 gap-2 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                <div>
                  <span className="text-[10px] text-gray-400 uppercase font-semibold block">Telefone</span>
                  <span className="font-mono font-semibold text-gray-800">
                    {selectedCard.aluno_telefone || "Não cadastrado"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 uppercase font-semibold block">Polo / Curso</span>
                  <span className="text-gray-800 truncate block">
                    {selectedCard.aluno_polo || "EAD"} • {selectedCard.aluno_curso || "Graduação"}
                  </span>
                </div>
              </div>

              {/* Tutor Titular Responsável & Passagem de Bastão (F12) */}
              <div className="p-3 bg-purple-50/60 border border-purple-100 rounded-lg flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-purple-900 uppercase font-bold block">
                    Tutor Titular Responsável
                  </span>
                  <span className="text-xs font-semibold text-purple-950 flex items-center gap-1.5 mt-0.5">
                    <UserCheck className="w-3.5 h-3.5 text-purple-600" />
                    {selectedCard.tutor_nome || "Nenhum tutor atribuído"}
                  </span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setBatonPassCard(selectedCard)}
                  className="h-8 text-xs font-semibold text-purple-700 border-purple-200 bg-white hover:bg-purple-100 cursor-pointer gap-1.5 shadow-2xs"
                  title="Transferir responsabilidade deste atendimento para outro tutor"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  Transferir Atendimento
                </Button>
              </div>

              {/* Status no Kanban */}
              <div className="space-y-1">
                <label className="font-semibold text-gray-700 block">Status / Coluna do Atendimento:</label>
                <select
                  value={editForm.statusKanban}
                  onChange={(e) => setEditForm({ ...editForm, statusKanban: e.target.value })}
                  className="w-full h-9 px-3 rounded-md border border-gray-200 text-xs bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="pendente">📥 A Contatar (Pendente)</option>
                  <option value="em_contato">💬 Em Contato (Mensagem Enviada)</option>
                  <option value="em_recuperacao">🔄 Em Acompanhamento (Plano de Estudo)</option>
                  <option value="revertido">✅ Regularizado (Revertido)</option>
                  <option value="evadido">⚠️ Não Localizado (Sem Retorno)</option>
                </select>
              </div>

              {/* Canal de Contato */}
              <div className="space-y-1">
                <label className="font-semibold text-gray-700 block">Canal de Contato Utilizado:</label>
                <select
                  value={editForm.canalContatoUtilizado}
                  onChange={(e) => setEditForm({ ...editForm, canalContatoUtilizado: e.target.value })}
                  className="w-full h-9 px-3 rounded-md border border-gray-200 text-xs bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">E-mail Institucional</option>
                  <option value="telefone">Ligação Telefônica</option>
                  <option value="ava_mensagem">Mensagem no AVA / Moodle</option>
                  <option value="outro">Outro canal</option>
                </select>
              </div>

              {/* Observações / Histórico do Tutor */}
              <div className="space-y-1">
                <label className="font-semibold text-gray-700 block">
                  Anotações Pedagógicas & Parecer do Tutor:
                </label>
                <textarea
                  value={editForm.observacoes}
                  onChange={(e) => setEditForm({ ...editForm, observacoes: e.target.value })}
                  rows={4}
                  className="w-full p-2.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 leading-relaxed"
                  placeholder="Registre o retorno do estudante, combinados de entrega ou motivos de ausência..."
                />
              </div>

              {/* Ação rápida WhatsApp */}
              {selectedCard.aluno_telefone && (
                <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-lg flex items-center justify-between">
                  <div>
                    <span className="font-bold text-emerald-900 block">Chamar no WhatsApp</span>
                    <span className="text-[11px] text-emerald-700">
                      Dispare a mensagem padrão de acolhimento agora mesmo.
                    </span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={(e) => handleOpenWhatsApp(selectedCard, e)}
                    className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer gap-1.5"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    Abrir Chat
                  </Button>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleDeleteCard}
                disabled={isDeleting}
                className="h-8 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 cursor-pointer gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remover
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedCard(null)}
                  className="h-8 text-xs cursor-pointer"
                >
                  Cancelar
                </Button>

                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveEdit}
                  disabled={isSaving}
                  className="h-8 text-xs bg-purple-600 hover:bg-purple-700 text-white font-semibold cursor-pointer"
                >
                  {isSaving ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Novo Atendimento Manual */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-gray-100 flex items-start justify-between bg-gray-50/70">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-purple-50 text-purple-600">
                  <UserCheck className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">Novo Atendimento Kanban</h3>
                  <p className="text-xs text-gray-500">Cadastrar discente no fluxo de tutoria e busca ativa.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsNewModalOpen(false)
                  setStudentLookupResult(null)
                  setStudentDisciplinas([])
                }}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNewCard}>
              <div className="p-5 space-y-3.5 text-xs max-h-[75vh] overflow-y-auto">
                {/* Campo Matrícula + Botão de Busca */}
                <div className="space-y-1">
                  <label className="font-semibold text-gray-700 block">Matrícula do Discente *</label>
                  <div className="flex items-center gap-2">
                    <Input
                      required
                      placeholder="Ex: 2420000"
                      value={newCardForm.matricula}
                      onChange={(e) => {
                        const val = e.target.value
                        setNewCardForm((prev) => ({ ...prev, matricula: val }))
                        if (val.trim().length >= 5) {
                          handleLookupStudent(val)
                        } else if (val.trim().length === 0) {
                          setStudentLookupResult(null)
                          setStudentDisciplinas([])
                        }
                      }}
                      onBlur={() => handleLookupStudent()}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          handleLookupStudent()
                        }
                      }}
                      className="h-9 text-xs flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleLookupStudent()}
                      disabled={lookupLoading || !newCardForm.matricula.trim()}
                      className="h-9 px-3 text-xs gap-1.5 cursor-pointer bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200"
                    >
                      {lookupLoading ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Search className="w-3.5 h-3.5" />
                      )}
                      Buscar
                    </Button>
                  </div>
                  <p className="text-[10px] text-gray-400">
                    Digite a matrícula e clique em Buscar (ou pressione Enter) para preencher os dados automaticamente.
                  </p>
                </div>

                {/* Banner de Feedback da Busca */}
                {lookupLoading && (
                  <div className="p-3 bg-purple-50 border border-purple-100 rounded-lg text-xs text-purple-700 flex items-center gap-2 animate-pulse">
                    <RefreshCw className="w-4 h-4 animate-spin text-purple-600" />
                    Buscando dados acadêmicos e disciplinas do estudante...
                  </div>
                )}

                {studentLookupResult?.found && (
                  <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-lg space-y-1.5 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-900 text-xs flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        {studentLookupResult.nome}
                      </span>
                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]">
                        Discente Localizado
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-gray-600 pt-1 border-t border-emerald-100">
                      <div>
                        <span className="text-gray-400">Curso:</span>{" "}
                        <span className="font-semibold text-gray-800">{studentLookupResult.cursoNome || "EAD"}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Polo:</span>{" "}
                        <span className="font-semibold text-gray-800">{studentLookupResult.unidadeFisica || "EAD"}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-gray-400">E-mail:</span>{" "}
                        <span className="font-semibold text-gray-800">{studentLookupResult.email || "Não informado"}</span>
                      </div>
                      {studentLookupResult.telefone && (
                        <div className="col-span-2 flex items-center gap-1 text-emerald-700 font-semibold">
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>WhatsApp: {studentLookupResult.telefone}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {studentLookupResult && !studentLookupResult.found && !lookupLoading && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800 space-y-1 animate-in fade-in">
                    <div className="flex items-center gap-1.5 font-semibold">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      Discente não encontrado automaticamente
                    </div>
                    <p className="text-gray-600">
                      Você pode informar o nome e e-mail abaixo para cadastrar o atendimento manualmente.
                    </p>
                  </div>
                )}

                {/* Campos de Nome e E-mail */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="font-semibold text-gray-700">Nome do Discente</label>
                    <Input
                      placeholder="Nome do discente"
                      value={newCardForm.alunoNome}
                      onChange={(e) => setNewCardForm({ ...newCardForm, alunoNome: e.target.value })}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-gray-700">E-mail do Discente</label>
                    <Input
                      type="email"
                      placeholder="aluno@email.com"
                      value={newCardForm.alunoEmail}
                      onChange={(e) => setNewCardForm({ ...newCardForm, alunoEmail: e.target.value })}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                {/* Seletor de Disciplina (específica do discente ou geral) */}
                <div className="space-y-1">
                  <label className="font-semibold text-gray-700">
                    Disciplina Associada{" "}
                    {studentDisciplinas.length > 0 && (
                      <span className="text-emerald-700 font-normal">
                        ({studentDisciplinas.length} matriculadas no AVA)
                      </span>
                    )}
                  </label>
                  <select
                    value={newCardForm.disciplinaCodigo}
                    onChange={(e) => {
                      const code = e.target.value
                      const selStudent = studentDisciplinas.find((d) => d.codigo === code)
                      const selGeneral = disciplinas.find((d) => d.codigo === code)
                      setNewCardForm({
                        ...newCardForm,
                        disciplinaCodigo: code,
                        disciplinaNome: selStudent?.nome || selGeneral?.nome || "",
                      })
                    }}
                    className="w-full h-8 px-2.5 rounded-md border border-gray-200 text-xs bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Selecione uma disciplina (opcional)</option>
                    {studentDisciplinas.length > 0 && (
                      <optgroup label="Disciplinas do Estudante">
                        {studentDisciplinas.map((disc) => (
                          <option key={disc.codigo || disc.nome} value={disc.codigo || ""}>
                            {disc.nome} ({disc.codigo || "AVA"}){" "}
                            {disc.grupoRisco ? `[${disc.grupoRisco.toUpperCase()}]` : ""}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    <optgroup label="Todas as Disciplinas">
                      {disciplinas.map((disc) => (
                        <option key={disc.codigo || disc.nome} value={disc.codigo || ""}>
                          {disc.nome} ({disc.codigo || "AVA"})
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                {/* Status Inicial e Canal de Contato */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="font-semibold text-gray-700">Status Inicial</label>
                    <select
                      value={newCardForm.statusKanban}
                      onChange={(e) => setNewCardForm({ ...newCardForm, statusKanban: e.target.value })}
                      className="w-full h-8 px-2.5 rounded-md border border-gray-200 text-xs bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="pendente">📥 A Contatar (Pendente)</option>
                      <option value="em_contato">💬 Em Contato</option>
                      <option value="em_recuperacao">🔄 Em Acompanhamento</option>
                      <option value="revertido">✅ Regularizado</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-gray-700">Canal de Contato</label>
                    <select
                      value={newCardForm.canalContatoUtilizado}
                      onChange={(e) =>
                        setNewCardForm({ ...newCardForm, canalContatoUtilizado: e.target.value })
                      }
                      className="w-full h-8 px-2.5 rounded-md border border-gray-200 text-xs bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="whatsapp">WhatsApp</option>
                      <option value="email">E-mail Institucional</option>
                      <option value="telefone">Ligação Telefônica</option>
                      <option value="ava_mensagem">Mensagem AVA</option>
                    </select>
                  </div>
                </div>

                {/* Observações Iniciais */}
                <div className="space-y-1">
                  <label className="font-semibold text-gray-700">Observações Iniciais / Motivo do Contato</label>
                  <textarea
                    rows={3}
                    placeholder="Motivo da abertura do atendimento ou diagnóstico prévio..."
                    value={newCardForm.observacoes}
                    onChange={(e) => setNewCardForm({ ...newCardForm, observacoes: e.target.value })}
                    className="w-full p-2.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsNewModalOpen(false)
                    setStudentLookupResult(null)
                    setStudentDisciplinas([])
                  }}
                  className="h-8 text-xs cursor-pointer"
                >
                  Cancelar
                </Button>

                <Button
                  type="submit"
                  size="sm"
                  disabled={isSaving}
                  className="h-8 text-xs bg-purple-600 hover:bg-purple-700 text-white font-semibold cursor-pointer"
                >
                  {isSaving ? "Cadastrando..." : "Cadastrar Atendimento"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Passagem de Bastão (F12) */}
      {batonPassCard && (
        <BatonPassDialog
          open={Boolean(batonPassCard)}
          onOpenChange={(open) => {
            if (!open) setBatonPassCard(null)
          }}
          card={batonPassCard}
          onSuccess={handleBatonPassSuccess}
          onCancel={() => setBatonPassCard(null)}
        />
      )}
    </div>
  )
}
