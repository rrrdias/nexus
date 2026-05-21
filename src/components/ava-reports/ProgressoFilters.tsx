"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useState, useTransition } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, X } from "lucide-react"

export function ProgressoFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const [filters, setFilters] = useState({
    aluno: searchParams.get("aluno") || "",
    curso: searchParams.get("curso") || "",
    matricula: searchParams.get("matricula") || "",
    lastaccess: searchParams.get("lastaccess") || "",
    dias_sem_acesso: searchParams.get("dias_sem_acesso") || "",
    curso_perfil: searchParams.get("curso_perfil") || "",
    periodo_perfil: searchParams.get("periodo_perfil") || "",
    enrolment_status: searchParams.get("enrolment_status") || "",
    periodo: searchParams.get("periodo") !== null ? searchParams.get("periodo")! : "2026-1",
  })

  const handleSearch = () => {
    const params = new URLSearchParams(searchParams.toString())
    
    if (filters.aluno) params.set("aluno", filters.aluno)
    else params.delete("aluno")
    
    if (filters.curso) params.set("curso", filters.curso)
    else params.delete("curso")
    
    if (filters.matricula) params.set("matricula", filters.matricula)
    else params.delete("matricula")

    if (filters.lastaccess) params.set("lastaccess", filters.lastaccess)
    else params.delete("lastaccess")

    if (filters.dias_sem_acesso) params.set("dias_sem_acesso", filters.dias_sem_acesso)
    else params.delete("dias_sem_acesso")

    if (filters.curso_perfil) params.set("curso_perfil", filters.curso_perfil)
    else params.delete("curso_perfil")

    if (filters.periodo_perfil) params.set("periodo_perfil", filters.periodo_perfil)
    else params.delete("periodo_perfil")

    if (filters.enrolment_status) params.set("enrolment_status", filters.enrolment_status)
    else params.delete("enrolment_status")

    if (filters.periodo) params.set("periodo", filters.periodo)
    else params.delete("periodo")
    
    params.set("page", "1") // Reset page on search

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`)
    })
  }

  const handleClear = () => {
    setFilters({
      aluno: "",
      curso: "",
      matricula: "",
      lastaccess: "",
      dias_sem_acesso: "",
      curso_perfil: "",
      periodo_perfil: "",
      enrolment_status: "",
      periodo: "2026-1",
    })
    startTransition(() => {
      router.push(pathname)
    })
  }

  const selectCls = "flex h-9 w-full rounded-md border border-gray-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-navy disabled:cursor-not-allowed disabled:opacity-50"

  return (
    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 mb-6 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 items-end">
        {/* Nome do Aluno */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase text-[#9AA0AC] tracking-wider">Nome do Aluno</label>
          <Input 
            placeholder="Filtrar por nome..." 
            value={filters.aluno}
            onChange={(e) => setFilters({ ...filters, aluno: e.target.value })}
            className="h-9 text-sm border-gray-200 focus:border-navy"
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
        </div>
        
        {/* Disciplina */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase text-[#9AA0AC] tracking-wider">Disciplina Moodle</label>
          <Input 
            placeholder="Filtrar por disciplina..." 
            value={filters.curso}
            onChange={(e) => setFilters({ ...filters, curso: e.target.value })}
            className="h-9 text-sm border-gray-200 focus:border-navy"
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
        </div>

        {/* Matrícula */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase text-[#9AA0AC] tracking-wider">Matrícula (RA)</label>
          <Input 
            placeholder="RA..." 
            value={filters.matricula}
            onChange={(e) => setFilters({ ...filters, matricula: e.target.value })}
            className="h-9 text-sm border-gray-200 focus:border-navy"
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
        </div>

        {/* Acesso */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase text-[#9AA0AC] tracking-wider">Acesso</label>
          <select 
            value={filters.lastaccess}
            onChange={(e) => setFilters({ ...filters, lastaccess: e.target.value })}
            className={selectCls}
          >
            <option value="">Todos</option>
            <option value="com_acesso">Com Acesso</option>
            <option value="sem_acesso">Sem Acesso</option>
          </select>
        </div>

        {/* Inatividade (Dias sem acesso) */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase text-[#9AA0AC] tracking-wider">Dias Sem Acesso</label>
          <select 
            value={filters.dias_sem_acesso}
            onChange={(e) => setFilters({ ...filters, dias_sem_acesso: e.target.value })}
            className={selectCls}
          >
            <option value="">Todos</option>
            <option value="7-19">De 7 a 19 dias</option>
            <option value="20-29">De 20 a 29 dias</option>
            <option value="30-39">De 30 a 39 dias</option>
            <option value=">=30">Acima de 30 dias</option>
          </select>
        </div>

        {/* Curso Perfil (Curso Acadêmico) */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase text-[#9AA0AC] tracking-wider">Curso Acadêmico</label>
          <Input 
            placeholder="Ex: Direito, Medicina..." 
            value={filters.curso_perfil}
            onChange={(e) => setFilters({ ...filters, curso_perfil: e.target.value })}
            className="h-9 text-sm border-gray-200 focus:border-navy"
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
        </div>

        {/* Período Perfil (Período do Aluno) */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase text-[#9AA0AC] tracking-wider">Período Aluno</label>
          <Input 
            placeholder="Ex: 1, 2, 3..." 
            value={filters.periodo_perfil}
            onChange={(e) => setFilters({ ...filters, periodo_perfil: e.target.value })}
            className="h-9 text-sm border-gray-200 focus:border-navy"
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
        </div>

        {/* Status */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase text-[#9AA0AC] tracking-wider">Status / Vínculo</label>
          <select 
            value={filters.enrolment_status}
            onChange={(e) => setFilters({ ...filters, enrolment_status: e.target.value })}
            className={selectCls}
          >
            <option value="">Todos</option>
            <option value="Ativo">Ativo</option>
            <option value="Suspenso">Suspenso</option>
          </select>
        </div>

        {/* Período Letivo */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase text-[#9AA0AC] tracking-wider">Período Letivo</label>
          <select 
            value={filters.periodo}
            onChange={(e) => setFilters({ ...filters, periodo: e.target.value })}
            className={selectCls}
          >
            <option value="2026-1">2026-1</option>
            <option value="">Todos</option>
          </select>
        </div>

        {/* Botões de Ação */}
        <div className="flex gap-2 justify-end sm:col-span-2 md:col-span-3 lg:col-span-1 xl:col-span-1">
          <Button 
            size="sm" 
            onClick={handleSearch} 
            disabled={isPending}
            className="bg-navy hover:bg-navy-light text-white h-9 flex-1 shrink-0 font-semibold"
          >
            <Search className="w-4 h-4 mr-2" />
            Filtrar
          </Button>
          
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={handleClear}
            className="text-[#5F6775] hover:bg-gray-100 h-9 shrink-0 font-semibold border border-gray-100"
          >
            <X className="w-4 h-4 mr-2" />
            Limpar
          </Button>
        </div>
      </div>
    </div>
  )
}
