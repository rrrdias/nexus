"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { RefreshCw, Download, CheckCircle2, AlertCircle } from "lucide-react"
import { syncMoodleData, exportConsolidatedAvaData } from "@/app/actions/ava-reports"
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

export function ConsolidatedActions({ filters, institution = "ead" }: { filters: any, institution?: string }) {
  const [syncStatus, setSyncStatus] = useState<"idle" | "confirming" | "syncing" | "success" | "error">("idle")
  const [syncError, setSyncError] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  const confirmSync = async () => {
    setSyncStatus("syncing")
    try {
      await syncMoodleData(institution, "progress")
      await syncMoodleData(institution, "grades")
      setSyncStatus("success")
    } catch (error: any) {
      console.error(error)
      setSyncError(error.message || "Falha na sincronização")
      setSyncStatus("error")
    }
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

      const csv = toCsv(exportRows)
      const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `Relatorio_Consolidado_EaD_${new Date().toISOString().split("T")[0]}.csv`
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Erro ao exportar:", error)
      alert("Ocorreu um erro ao gerar o arquivo consolidado.")
    } finally {
      setIsExporting(false)
    }
  }

  const isSyncing = syncStatus === "syncing"

  return (
    <>
      <div className="flex gap-2 select-none">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setSyncStatus("confirming")} 
          disabled={isSyncing}
          className="text-navy border-navy/20 hover:bg-navy/5 font-semibold text-xs h-10 px-3 rounded-lg"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isSyncing ? "animate-spin" : ""}`} />
          {isSyncing ? "Sincronizando..." : "Sincronizar AVA"}
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

      <AlertDialog 
        open={syncStatus !== "idle"} 
        onOpenChange={(open) => {
          if (syncStatus === "syncing") return
          if (!open) setSyncStatus("idle")
        }}
      >
        <AlertDialogContent className="rounded-2xl border-0 shadow-2xl p-6 bg-white max-w-md">
          {syncStatus === "confirming" && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle className="text-xl font-extrabold text-navy">
                  Sincronização Completa AVA EaD
                </AlertDialogTitle>
                <AlertDialogDescription className="text-gray-4 text-[14px]">
                  Deseja sincronizar tanto o <strong>Progresso das Atividades</strong> quanto as <strong>Notas das Fases</strong> com o Moodle EaD?
                  <br/><br/>
                  Os dados do relatório consolidado serão atualizados instantaneamente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="mt-6 border-t-0 bg-transparent p-0 m-0 flex justify-end gap-3">
                <AlertDialogCancel className="border border-red/40 text-red hover:bg-red/10 font-semibold rounded-lg h-10 px-5">
                  Cancelar
                </AlertDialogCancel>
                <AlertDialogAction 
                  onClick={confirmSync}
                  className="bg-green-dark hover:bg-green-brand text-white font-semibold rounded-lg h-10 px-5 transition-colors"
                >
                  Confirmar Sincronização
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}

          {syncStatus === "syncing" && (
            <div className="flex flex-col items-center text-center py-6">
              <div className="relative mb-4">
                <div className="w-16 h-16 rounded-full border-4 border-t-green-brand border-r-green-brand/30 border-b-green-brand/10 border-l-green-brand/60 animate-spin flex items-center justify-center">
                  <RefreshCw className="w-6 h-6 text-green-dark" />
                </div>
              </div>
              <AlertDialogTitle className="text-lg font-extrabold text-navy mb-1">
                Sincronizando Progresso e Notas...
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-gray-5">
                Buscando os dados em tempo real no Moodle. Por favor, aguarde alguns instantes.
              </AlertDialogDescription>
            </div>
          )}

          {syncStatus === "success" && (
            <div className="flex flex-col items-center text-center py-4">
              <CheckCircle2 className="w-12 h-12 text-green-brand mb-3" />
              <AlertDialogTitle className="text-lg font-extrabold text-navy mb-1">
                Sincronização Concluída!
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-gray-5 mb-4">
                Os dados de progresso e notas foram atualizados com sucesso no Nexus.
              </AlertDialogDescription>
              <AlertDialogAction 
                onClick={() => {
                  setSyncStatus("idle")
                  window.location.reload()
                }}
                className="w-full bg-green-dark hover:bg-green-brand text-white font-semibold rounded-lg h-10"
              >
                Atualizar Tela
              </AlertDialogAction>
            </div>
          )}

          {syncStatus === "error" && (
            <div className="flex flex-col items-center text-center py-4">
              <AlertCircle className="w-12 h-12 text-red mb-3" />
              <AlertDialogTitle className="text-lg font-extrabold text-red mb-1">
                Erro na Sincronização
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-gray-5 mb-4">
                {syncError || "Não foi possível sincronizar com o AVA."}
              </AlertDialogDescription>
              <AlertDialogAction 
                onClick={() => setSyncStatus("idle")}
                className="w-full bg-navy text-white font-semibold rounded-lg h-10"
              >
                Fechar
              </AlertDialogAction>
            </div>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </>
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
