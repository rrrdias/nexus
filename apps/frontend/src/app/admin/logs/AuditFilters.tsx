"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useState, useTransition } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, X, RotateCcw, Download, Filter } from "lucide-react"
import { exportAuditLogs } from "@/app/actions/audit"

export function AuditFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [isExporting, setIsExporting] = useState(false)

  const [filters, setFilters] = useState({
    search: searchParams.get("search") || "",
    category: searchParams.get("category") || "ALL",
    status: searchParams.get("status") || "ALL",
    period: searchParams.get("period") || "7d",
  })

  const calculateDateRange = (period: string) => {
    const now = new Date()
    let startDate: string | undefined
    let endDate: string | undefined = now.toISOString()

    if (period === "today") {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      startDate = today.toISOString()
    } else if (period === "7d") {
      const past7 = new Date()
      past7.setDate(past7.getDate() - 7)
      past7.setHours(0, 0, 0, 0)
      startDate = past7.toISOString()
    } else if (period === "30d") {
      const past30 = new Date()
      past30.setDate(past30.getDate() - 30)
      past30.setHours(0, 0, 0, 0)
      startDate = past30.toISOString()
    } else if (period === "all") {
      startDate = undefined
      endDate = undefined
    }

    return { startDate, endDate }
  }

  const handleApply = () => {
    const params = new URLSearchParams()

    if (filters.search) params.set("search", filters.search)
    if (filters.category && filters.category !== "ALL") params.set("category", filters.category)
    if (filters.status && filters.status !== "ALL") params.set("status", filters.status)
    if (filters.period) params.set("period", filters.period)

    const { startDate, endDate } = calculateDateRange(filters.period)
    if (startDate) params.set("startDate", startDate)
    if (endDate) params.set("endDate", endDate)

    params.set("page", "1")

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`)
    })
  }

  const handleClear = () => {
    setFilters({
      search: "",
      category: "ALL",
      status: "ALL",
      period: "7d",
    })
    startTransition(() => {
      router.push(pathname)
    })
  }

  const handleExport = async () => {
    try {
      setIsExporting(true)
      const { startDate, endDate } = calculateDateRange(filters.period)
      const data = await exportAuditLogs({
        search: filters.search || undefined,
        category: filters.category !== "ALL" ? filters.category : undefined,
        status: filters.status !== "ALL" ? filters.status : undefined,
        startDate,
        endDate,
      })

      if (!data || data.length === 0) {
        alert("Nenhum registro encontrado para exportar com os filtros atuais.")
        return
      }

      // Converte array de objetos para CSV
      const headers = Object.keys(data[0])
      const csvRows = [
        headers.join(";"),
        ...data.map((row: any) =>
          headers
            .map((field) => {
              const val = row[field] ?? ""
              const escaped = String(val).replace(/"/g, '""')
              return `"${escaped}"`
            })
            .join(";")
        ),
      ]

      const csvContent = "\uFEFF" + csvRows.join("\n") // UTF-8 BOM
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.setAttribute("href", url)
      link.setAttribute("download", `nexus-audit-logs-${new Date().toISOString().slice(0, 10)}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err: any) {
      alert("Falha ao exportar logs: " + (err.message || "Erro desconhecido"))
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="bg-white p-4 rounded-xl border border-gray-2 shadow-sm space-y-3">
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Busca rápida */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Buscar por usuário, e-mail, ação, IP ou detalhes..."
            value={filters.search}
            onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
            onKeyDown={(e) => e.key === "Enter" && handleApply()}
            className="pl-9 pr-8 text-xs bg-slate-50 border-gray-2 focus:bg-white h-10 rounded-lg"
          />
          {filters.search && (
            <button
              onClick={() => setFilters((prev) => ({ ...prev, search: "" }))}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filtros em linha */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Categoria */}
          <select
            value={filters.category}
            onChange={(e) => setFilters((prev) => ({ ...prev, category: e.target.value }))}
            className="text-xs rounded-lg border border-gray-2 bg-slate-50 h-10 px-3 text-slate-700 focus:outline-none focus:border-green-brand"
          >
            <option value="ALL">Todas as Categorias</option>
            <option value="AUTH">Autenticação (Acessos)</option>
            <option value="USERS">Gestão de Usuários</option>
            <option value="GROUPS">Grupos e Permissões</option>
            <option value="SCHEDULING">Agendamento de Provas</option>
            <option value="AVA_SYNC">Sincronização AVA</option>
            <option value="SYSTEM">Sistema & Geral</option>
          </select>

          {/* Status */}
          <select
            value={filters.status}
            onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
            className="text-xs rounded-lg border border-gray-2 bg-slate-50 h-10 px-3 text-slate-700 focus:outline-none focus:border-green-brand"
          >
            <option value="ALL">Todos os Status</option>
            <option value="SUCCESS">Sucesso</option>
            <option value="FAILURE">Falha / Bloqueado</option>
            <option value="WARNING">Atenção</option>
          </select>

          {/* Período */}
          <select
            value={filters.period}
            onChange={(e) => setFilters((prev) => ({ ...prev, period: e.target.value }))}
            className="text-xs rounded-lg border border-gray-2 bg-slate-50 h-10 px-3 text-slate-700 focus:outline-none focus:border-green-brand"
          >
            <option value="today">Hoje</option>
            <option value="7d">Últimos 7 dias</option>
            <option value="30d">Últimos 30 dias</option>
            <option value="all">Todo o Período</option>
          </select>

          {/* Botão Buscar */}
          <Button
            onClick={handleApply}
            disabled={isPending}
            className="bg-navy hover:bg-navy-light text-white text-xs font-bold h-10 px-4 rounded-lg shadow-sm gap-1.5"
          >
            <Filter className="w-3.5 h-3.5" />
            {isPending ? "Filtrando..." : "Filtrar"}
          </Button>

          {/* Botão Limpar */}
          <Button
            variant="ghost"
            onClick={handleClear}
            className="text-xs text-slate-500 hover:text-rose-600 font-medium h-10 px-2.5"
            title="Limpar Filtros"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            Limpar
          </Button>

          {/* Botão Exportar CSV */}
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={isExporting}
            className="border-gray-2 text-slate-700 hover:text-navy text-xs font-semibold h-10 px-3 gap-1.5 rounded-lg"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            {isExporting ? "Exportando..." : "Exportar CSV"}
          </Button>
        </div>
      </div>
    </div>
  )
}
