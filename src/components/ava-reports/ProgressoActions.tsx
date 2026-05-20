"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { RefreshCw, Download, Filter } from "lucide-react"
import { toast } from "sonner" // Assumindo que temos sonner ou similar, senão uso alert
import * as XLSX from "xlsx"

import { syncMoodleData } from "@/app/actions/ava-reports"

export function ProgressoActions({ data, institution }: { data: any[], institution?: string }) {
  const [isSyncing, setIsSyncing] = useState(false)

  const handleSync = async () => {
    const msg = institution 
      ? `Deseja iniciar a sincronização de ${institution.toUpperCase()} com o Moodle? Isso pode levar alguns minutos.`
      : "Deseja iniciar a sincronização GLOBAL com o Moodle? Isso pode levar alguns minutos."

    if (!confirm(msg)) return
    
    setIsSyncing(true)
    try {
      const result = await syncMoodleData(institution, 'progress')
      alert("Sincronização de progresso concluída com sucesso!")
      window.location.reload()
    } catch (error: any) {
      console.error(error)
      alert(`Erro: ${error.message || "Falha na sincronização"}`)
    } finally {
      setIsSyncing(false)
    }
  }

  const handleExport = () => {
    if (!data || data.length === 0) return
    
    const worksheet = XLSX.utils.json_to_sheet(data.map(item => ({
      Matrícula: item.matricula,
      Aluno: item.aluno,
      Disciplina: item.curso,
      Curso: item.cursoPerfil,
      Polo: item.unidadeFisica,
      Acesso: item.lastaccess,
      Status: item.enrolmentStatus,
      Fase1: item.fase1,
      Fase2: item.fase2,
      Fase3: item.fase3,
      Total: item.progressoTotal
    })))
    
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Progresso")
    XLSX.writeFile(workbook, `Relatorio_Progresso_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  return (
    <div className="flex gap-2">
      <Button 
        variant="outline" 
        size="sm" 
        onClick={handleSync} 
        disabled={isSyncing}
        className="text-navy border-navy/20 hover:bg-navy/5"
      >
        <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
        {isSyncing ? "Sincronizando..." : "Sincronizar Moodle"}
      </Button>
      
      <Button 
        variant="outline" 
        size="sm" 
        onClick={handleExport}
        className="text-green-dark border-green-dark/20 hover:bg-green-dark/5"
      >
        <Download className="w-4 h-4 mr-2" />
        Exportar Excel
      </Button>
    </div>
  )
}
