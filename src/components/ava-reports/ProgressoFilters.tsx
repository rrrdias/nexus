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
  })

  const handleSearch = () => {
    const params = new URLSearchParams(searchParams.toString())
    
    if (filters.aluno) params.set("aluno", filters.aluno)
    else params.delete("aluno")
    
    if (filters.curso) params.set("curso", filters.curso)
    else params.delete("curso")
    
    if (filters.matricula) params.set("matricula", filters.matricula)
    else params.delete("matricula")
    
    params.set("page", "1") // Reset page on search

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`)
    })
  }

  const handleClear = () => {
    setFilters({ aluno: "", curso: "", matricula: "" })
    startTransition(() => {
      router.push(pathname)
    })
  }

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex flex-wrap gap-4 items-end mb-6">
      <div className="flex-1 min-w-[200px] space-y-1.5">
        <label className="text-[10px] font-bold uppercase text-[#9AA0AC] tracking-wider">Nome do Aluno</label>
        <Input 
          placeholder="Filtrar por nome..." 
          value={filters.aluno}
          onChange={(e) => setFilters({ ...filters, aluno: e.target.value })}
          className="h-9 text-sm"
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
      </div>
      
      <div className="flex-1 min-w-[200px] space-y-1.5">
        <label className="text-[10px] font-bold uppercase text-[#9AA0AC] tracking-wider">Disciplina/Curso</label>
        <Input 
          placeholder="Filtrar por curso..." 
          value={filters.curso}
          onChange={(e) => setFilters({ ...filters, curso: e.target.value })}
          className="h-9 text-sm"
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
      </div>

      <div className="w-40 space-y-1.5">
        <label className="text-[10px] font-bold uppercase text-[#9AA0AC] tracking-wider">Matrícula</label>
        <Input 
          placeholder="RA..." 
          value={filters.matricula}
          onChange={(e) => setFilters({ ...filters, matricula: e.target.value })}
          className="h-9 text-sm"
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
      </div>

      <div className="flex gap-2">
        <Button 
          size="sm" 
          onClick={handleSearch} 
          disabled={isPending}
          className="bg-navy hover:bg-navy-light text-white h-9"
        >
          <Search className="w-4 h-4 mr-2" />
          Filtrar
        </Button>
        
        <Button 
          size="sm" 
          variant="ghost" 
          onClick={handleClear}
          className="text-[#5F6775] hover:bg-gray-100 h-9"
        >
          <X className="w-4 h-4 mr-2" />
          Limpar
        </Button>
      </div>
    </div>
  )
}
