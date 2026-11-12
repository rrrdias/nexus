"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { RefreshCw, Download, CheckCircle2, Clock } from "lucide-react"
import { exportConsolidatedAvaData } from "@/app/actions/ava-reports"

function formatTimePtBr(dateIso?: string | null) {
  if (!dateIso) return null
  try {
    const d = new Date(dateIso)
    if (isNaN(d.getTime())) return null
    return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
  } catch {
    return null
  }
}

function formatHourPtBr(dateIso?: string | null) {
  if (!dateIso) return null
  try {
    const d = new Date(dateIso)
    if (isNaN(d.getTime())) return null
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  } catch {
    return null
  }
}

export function ConsolidatedActions({
  filters,
  institution = "ead",
  lastSync,
  nextSync,
}: {
  filters: any
  institution?: string
  lastSync?: string | null
  nextSync?: string | null
}) {
  const router = useRouter()
  const [isRefreshing, startTransition] = useTransition()
  const [justRefreshed, setJustRefreshed] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const handleRefreshData = () => {
    setJustRefreshed(false)
    startTransition(() => {
      router.refresh()
      setJustRefreshed(true)
      setTimeout(() => setJustRefreshed(false), 3000)
    })
  }

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const rawData = await exportConsolidatedAvaData(filters)
      if (!rawData || rawData.length === 0) {
        alert("Nenhum dado encontrado para exportação.")
        return
      }

      const exportRows = rawData.map((item: any) => ({
        "Matrícula": item.matricula || "-",
        "Aluno": item.aluno || "-",
        "WhatsApp/Telefone": item.userPhone1 || "-",
        "Curso": item.curso || "-",
        "Polo": item.unidadeFisica || "-",
        "Status Matrícula": item.enrolmentStatus || "-",
        "Último Acesso": item.lastaccess || "-",
        "Dias Sem Acesso": item.diasSemAcesso || "-",
        "Progresso Fase 1 (%)": item.progressoFase1 || "0",
        "Nota Fase 1": item.notaFase1 || "-",
        "Progresso Fase 2 (%)": item.progressoFase2 || "0",
        "Nota Fase 2": item.notaFase2 || "-",
        "Progresso Fase 3 (%)": item.progressoFase3 || "0",
        "Nota Fase 3": item.notaFase3 || "-",
        "Progresso Total (%)": item.progressoTotal || "0",
        "Média Final": item.mediaFinal || "-",
      }))

      const instLabel = institution.toUpperCase()
      const csv = toCsv(exportRows)
      const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `Relatorio_Consolidado_${instLabel}_${new Date().toISOString().split("T")[0]}.csv`
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Erro ao exportar:", error)
      alert("Ocorreu um erro ao gerar o arquivo consolidado.")
    } finally {
      setIsExporting(false)
    }
  }

  const formattedLastSync = formatTimePtBr(lastSync)
  const formattedNextSync = formatHourPtBr(nextSync)

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 select-none">
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] text-slate-600">
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <div className="flex flex-col leading-tight">
          <span className="font-bold text-navy flex items-center gap-1">
            Sincronização Automática (60 min)
          </span>
          <span className="text-[10px] text-slate-500 flex items-center gap-1">
            <Clock className="w-2.5 h-2.5 text-slate-400 shrink-0" />
            {formattedLastSync ? `Atualizado em ${formattedLastSync}` : "Sincronização em segundo plano ativa"}
            {formattedNextSync ? ` • Próxima às ${formattedNextSync}` : ""}
          </span>
        </div>
      </div>

      <div className="flex gap-2">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRefreshData} 
          disabled={isRefreshing}
          className="text-navy border-navy/20 hover:bg-navy/5 font-semibold text-xs h-10 px-3 rounded-lg"
        >
          {justRefreshed ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
              Dados Atualizados!
            </>
          ) : (
            <>
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRefreshing ? "animate-spin" : ""}`} />
              {isRefreshing ? "Atualizando..." : "Atualizar Dados"}
            </>
          )}
        </Button>
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleExport}
          disabled={isExporting}
          className="text-green-dark border-green-brand/30 hover:bg-green-brand/10 font-semibold text-xs h-10 px-3 rounded-lg"
        >
          <Download className={`w-3.5 h-3.5 mr-1.5 ${isExporting ? "animate-pulse" : ""}`} />
          {isExporting ? "Exportando..." : "Exportar Planilha"}
        </Button>
      </div>
    </div>
  )
}

function toCsv(rows: Record<string, unknown>[]) {
  const headers = Object.keys(rows[0] ?? {})
  const lines = [
    headers.map(escapeCsvCell).join(";"),
    ...rows.map(row => headers.map(header => escapeCsvCell(row[header])).join(";")),
  ]

  return lines.join("\r\n")
}

function escapeCsvCell(value: unknown) {
  const text = String(value ?? "")
  const safeText = /^[=+\-@]/.test(text) ? `'${text}` : text

  return `"${safeText.replace(/"/g, '""')}"`
}
