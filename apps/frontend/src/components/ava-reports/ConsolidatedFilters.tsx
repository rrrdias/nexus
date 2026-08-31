"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useState, useTransition, useRef, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, X, Filter, RotateCcw } from "lucide-react"

interface ConsolidatedFiltersProps {
  uniquePeriodos?: string[]
  uniquePolos?: string[]
  uniqueCursos?: string[]
}

export function ConsolidatedFilters({ 
  uniquePeriodos = ["2026-2", "2026-1", "2025-2", "2025-1"], 
  uniquePolos = [], 
  uniqueCursos = [] 
}: ConsolidatedFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [isOpen, setIsOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  const [filters, setFilters] = useState({
    search: searchParams.get("search") || "",
    periodo: searchParams.get("periodo") !== null ? searchParams.get("periodo")! : "2026-2",
    unidade_fisica: searchParams.get("unidade_fisica") || "",
    curso: searchParams.get("curso") || "",
    enrolment_status: searchParams.get("enrolment_status") || "",
    lastaccess: searchParams.get("lastaccess") || "",
  })

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleApply = () => {
    const params = new URLSearchParams(searchParams.toString())

    if (filters.search) params.set("search", filters.search)
    else params.delete("search")

    if (filters.periodo) params.set("periodo", filters.periodo)
    else params.delete("periodo")

    if (filters.unidade_fisica) params.set("unidade_fisica", filters.unidade_fisica)
    else params.delete("unidade_fisica")

    if (filters.curso) params.set("curso", filters.curso)
    else params.delete("curso")

    if (filters.enrolment_status) params.set("enrolment_status", filters.enrolment_status)
    else params.delete("enrolment_status")

    if (filters.lastaccess) params.set("lastaccess", filters.lastaccess)
    else params.delete("lastaccess")

    params.set("page", "1") // Reset to page 1 on filter
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`)
      setIsOpen(false)
    })
  }

  const handleClear = () => {
    setFilters({
      search: "",
      periodo: "2026-2",
      unidade_fisica: "",
      curso: "",
      enrolment_status: "",
      lastaccess: "",
    })
    startTransition(() => {
      router.push(pathname)
      setIsOpen(false)
    })
  }

  const activeFiltersCount = [
    filters.unidade_fisica,
    filters.curso,
    filters.enrolment_status,
    filters.lastaccess,
    filters.periodo && filters.periodo !== "2026-2" ? filters.periodo : null,
  ].filter(Boolean).length


  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-gray-2 shadow-sm select-none">
      {/* Busca Rápida */}
      <div className="relative flex-1 min-w-[260px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-4" />
        <Input
          placeholder="Buscar por aluno, matrícula, e-mail ou curso..."
          value={filters.search}
          onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
          onKeyDown={(e) => e.key === "Enter" && handleApply()}
          className="pl-9 pr-8 text-xs bg-gray-50/50 border-gray-2 focus:bg-white h-10 rounded-lg"
        />
        {filters.search && (
          <button 
            onClick={() => { setFilters(prev => ({ ...prev, search: "" })); }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-4 hover:text-gray-6"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Botões de Ação & Filtros Avançados */}
      <div className="flex items-center gap-2">
        <Button
          onClick={handleApply}
          disabled={isPending}
          className="bg-navy hover:bg-navy-light text-white text-xs font-bold h-10 px-4 rounded-lg shadow-sm"
        >
          {isPending ? "Buscando..." : "Buscar"}
        </Button>

        {/* Popover de Filtros Avançados */}
        <div className="relative" ref={popoverRef}>
          <Button
            variant="outline"
            onClick={() => setIsOpen(!isOpen)}
            className={`h-10 px-3 text-xs font-semibold rounded-lg border-gray-2 gap-1.5 ${
              activeFiltersCount > 0 ? "border-green-brand text-green-dark bg-green-50/40" : "text-gray-6"
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filtros</span>
            {activeFiltersCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-green-brand text-navy text-[10px] font-black flex items-center justify-center">
                {activeFiltersCount}
              </span>
            )}
          </Button>

          {isOpen && (
            <div className="absolute right-0 top-12 w-80 bg-white border border-gray-2 shadow-2xl rounded-2xl p-5 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-4">
              <div className="flex items-center justify-between border-b border-gray-1 pb-3">
                <h4 className="text-sm font-extrabold text-navy">Filtros Avançados</h4>
                <button onClick={() => setIsOpen(false)} className="text-gray-4 hover:text-gray-6">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Período */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Período Letivo</label>
                <select
                  value={filters.periodo}
                  onChange={(e) => setFilters(prev => ({ ...prev, periodo: e.target.value }))}
                  className="w-full text-xs rounded-lg border border-gray-2 bg-gray-50 p-2 text-gray-8 focus:outline-none focus:border-green-brand"
                >
                  <option value="">Todos os Períodos</option>
                  {uniquePeriodos.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              {/* Polo / Unidade Física */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Polo (Unidade Física)</label>
                <select
                  value={filters.unidade_fisica}
                  onChange={(e) => setFilters(prev => ({ ...prev, unidade_fisica: e.target.value }))}
                  className="w-full text-xs rounded-lg border border-gray-2 bg-gray-50 p-2 text-gray-8 focus:outline-none focus:border-green-brand"
                >
                  <option value="">Todos os Polos</option>
                  {uniquePolos.map(polo => (
                    <option key={polo} value={polo}>{polo}</option>
                  ))}
                </select>
              </div>

              {/* Status de Matrícula */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Status da Matrícula</label>
                <select
                  value={filters.enrolment_status}
                  onChange={(e) => setFilters(prev => ({ ...prev, enrolment_status: e.target.value }))}
                  className="w-full text-xs rounded-lg border border-gray-2 bg-gray-50 p-2 text-gray-8 focus:outline-none focus:border-green-brand"
                >
                  <option value="">Todos os Status</option>
                  <option value="Ativo">Ativo</option>
                  <option value="Suspenso">Suspenso / Trancado</option>
                </select>
              </div>

              {/* Acesso */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Engajamento / Acesso</label>
                <select
                  value={filters.lastaccess}
                  onChange={(e) => setFilters(prev => ({ ...prev, lastaccess: e.target.value }))}
                  className="w-full text-xs rounded-lg border border-gray-2 bg-gray-50 p-2 text-gray-8 focus:outline-none focus:border-green-brand"
                >
                  <option value="">Todos os Alunos</option>
                  <option value="sem_acesso">Nunca Acessaram</option>
                  <option value="com_acesso">Já Acessaram</option>
                </select>
              </div>

              {/* Botões do Popover */}
              <div className="pt-2 flex items-center justify-between border-t border-gray-1 gap-2">
                <Button
                  variant="ghost"
                  onClick={handleClear}
                  className="text-xs text-gray-5 hover:text-red-500 font-bold h-9 px-3"
                >
                  <RotateCcw className="w-3 h-3 mr-1" /> Limpar
                </Button>
                <Button
                  onClick={handleApply}
                  className="bg-navy hover:bg-navy-light text-white text-xs font-bold h-9 px-4 rounded-lg"
                >
                  Aplicar
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
