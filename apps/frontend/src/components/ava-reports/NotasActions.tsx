"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { RefreshCw, Download, CheckCircle2, AlertCircle } from "lucide-react"

import { syncMoodleData, exportGradesData as exportGradesDataFn } from "@/app/actions/ava-reports"

// Helper functions for math and filtering
function parseProgressNum(value: any): number | null {
  if (value === null || value === undefined || value === "" || value === "-") return null
  const parsed = parseFloat(String(value).replace("%", "").replace(",", "."))
  return isNaN(parsed) ? null : parsed
}

function isBelowExpectedOnPhase(row: any, phase: 1 | 2 | 3, hoje: Date): boolean {
  const f1 = parseProgressNum(row.fase1) || 0
  const f2 = parseProgressNum(row.fase2) || 0
  const f3 = parseProgressNum(row.fase3) || 0

  const inicio_f1 = new Date(2026, 1, 13) // Feb 13
  const fim_f1 = new Date(2026, 2, 29)    // Mar 29
  const inicio_f2 = new Date(2026, 2, 30)  // Mar 30
  const fim_f2 = new Date(2026, 4, 11)    // May 11
  const inicio_f3 = new Date(2026, 4, 12)  // May 12
  const fim_f3 = new Date(2026, 5, 19)    // Jun 19

  if (phase === 1) {
    return (hoje > fim_f1 && f1 < 100) || (hoje >= inicio_f1 && hoje <= fim_f1 && f1 < 40)
  }
  if (phase === 2) {
    return (hoje > fim_f2 && f2 < 100) || (hoje >= inicio_f2 && hoje <= fim_f2 && f2 < 40)
  }
  if (phase === 3) {
    return (hoje > fim_f3 && f3 < 100) || (hoje >= inicio_f3 && hoje <= fim_f3 && f3 < 40)
  }
  return false
}

function isBelowExpectedOverall(row: any, hoje: Date): boolean {
  return isBelowExpectedOnPhase(row, 1, hoje) ||
         isBelowExpectedOnPhase(row, 2, hoje) ||
         isBelowExpectedOnPhase(row, 3, hoje)
}

function getCriticalCourses(allData: any[], hoje: Date): Set<string> {
  const courseMap: Record<string, any[]> = {}
  allData.forEach(row => {
    if (row.curso) {
      if (!courseMap[row.curso]) courseMap[row.curso] = []
      courseMap[row.curso].push(row)
    }
  })

  const criticalCourses = new Set<string>()
  const inicio_f1 = new Date(2026, 1, 13)
  const fim_f1 = new Date(2026, 2, 29)
  const inicio_f2 = new Date(2026, 2, 30)
  const fim_f2 = new Date(2026, 4, 11)
  const inicio_f3 = new Date(2026, 4, 12)
  const fim_f3 = new Date(2026, 5, 19)

  Object.entries(courseMap).forEach(([curso, rows]) => {
    const f1Vals = rows.map(r => parseProgressNum(r.fase1) || 0)
    const f2Vals = rows.map(r => parseProgressNum(r.fase2) || 0)
    const f3Vals = rows.map(r => parseProgressNum(r.fase3) || 0)

    const avgF1 = f1Vals.reduce((a, b) => a + b, 0) / Math.max(f1Vals.length, 1)
    const avgF2 = f2Vals.reduce((a, b) => a + b, 0) / Math.max(f2Vals.length, 1)
    const avgF3 = f3Vals.reduce((a, b) => a + b, 0) / Math.max(f3Vals.length, 1)

    let isCrit = false
    if (hoje >= inicio_f1 && avgF1 < (hoje > fim_f1 ? 100 : 40)) isCrit = true
    if (hoje >= inicio_f2 && avgF2 < (hoje > fim_f2 ? 100 : 40)) isCrit = true
    if (hoje >= inicio_f3 && avgF3 < (hoje > fim_f3 ? 100 : 40)) isCrit = true

    if (isCrit) {
      criticalCourses.add(curso)
    }
  })

  return criticalCourses
}

function getCriticalCoursesForPhase(allData: any[], phase: 1 | 2 | 3, hoje: Date): Set<string> {
  const courseMap: Record<string, any[]> = {}
  allData.forEach(row => {
    if (row.curso) {
      if (!courseMap[row.curso]) courseMap[row.curso] = []
      courseMap[row.curso].push(row)
    }
  })

  const criticalCourses = new Set<string>()
  const inicio_f1 = new Date(2026, 1, 13)
  const fim_f1 = new Date(2026, 2, 29)
  const inicio_f2 = new Date(2026, 2, 30)
  const fim_f2 = new Date(2026, 4, 11)
  const inicio_f3 = new Date(2026, 4, 12)
  const fim_f3 = new Date(2026, 5, 19)

  Object.entries(courseMap).forEach(([curso, rows]) => {
    if (phase === 1) {
      const f1Vals = rows.map(r => parseProgressNum(r.fase1) || 0)
      const avgF1 = f1Vals.reduce((a, b) => a + b, 0) / Math.max(f1Vals.length, 1)
      if (hoje >= inicio_f1 && avgF1 < (hoje > fim_f1 ? 100 : 40)) criticalCourses.add(curso)
    } else if (phase === 2) {
      const f2Vals = rows.map(r => parseProgressNum(r.fase2) || 0)
      const avgF2 = f2Vals.reduce((a, b) => a + b, 0) / Math.max(f2Vals.length, 1)
      if (hoje >= inicio_f2 && avgF2 < (hoje > fim_f2 ? 100 : 40)) criticalCourses.add(curso)
    } else if (phase === 3) {
      const f3Vals = rows.map(r => parseProgressNum(r.fase3) || 0)
      const avgF3 = f3Vals.reduce((a, b) => a + b, 0) / Math.max(f3Vals.length, 1)
      if (hoje >= inicio_f3 && avgF3 < (hoje > fim_f3 ? 100 : 40)) criticalCourses.add(curso)
    }
  })

  return criticalCourses
}

export async function exportGradesData({
  filters,
  type,
  phase,
  title
}: {
  filters: any
  type: "general" | "below_expected" | "critical" | "no_access"
  phase?: 1 | 2 | 3
  title: string
}) {
  try {
    const rawData = await exportGradesDataFn(filters)
    if (!rawData || rawData.length === 0) {
      alert("Nenhum dado encontrado para exportação.")
      return
    }

    const hoje = new Date()
    const termosSemAcesso = ["nunca acessou", "sem acesso", "", "none", "nulo", "-"]

    let filtered = rawData

    if (type === "below_expected") {
      if (phase) {
        filtered = rawData.filter((row: any) => isBelowExpectedOnPhase(row, phase, hoje))
      } else {
        filtered = rawData.filter((row: any) => isBelowExpectedOverall(row, hoje))
      }
    } else if (type === "critical") {
      const critCourses = phase 
        ? getCriticalCoursesForPhase(rawData, phase, hoje)
        : getCriticalCourses(rawData, hoje)
      filtered = rawData.filter((row: any) => row.curso && critCourses.has(row.curso))
    } else if (type === "no_access") {
      filtered = rawData.filter((row: any) => termosSemAcesso.includes((row.lastaccess || "").toLowerCase().trim()))
    } else if (type === "general" && phase) {
      filtered = rawData
    }

    if (filtered.length === 0) {
      alert("Nenhum registro atende aos critérios da exportação.")
      return
    }

    const exportRows = filtered.map((item: any) => ({
      Matrícula: item.matricula || "-",
      Aluno: item.aluno || "-",
      "Telefone (WhatsApp)": item.userPhone1 || "-",
      Disciplina: item.curso || "-",
      "Curso (Perfil)": item.cursoPerfil || "-",
      "Período (Perfil)": item.periodoPerfil || "-",
      Polo: item.unidadeFisica || "-",
      "Último Acesso": item.lastaccess || "-",
      "Dias Sem Acesso": item.diasSemAcesso || "-",
      Status: item.enrolmentStatus || "-",
      "Fase 1 (Nota)": item.fase1 || "-",
      "Fase 2 (Nota)": item.fase2 || "-",
      "Fase 3 (Nota)": item.fase3 || "-",
      "Média Final": item.media || "-"
    }))

    const csv = toCsv(exportRows)
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${safeFilename(title)}_${new Date().toISOString().split("T")[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error("Erro ao exportar:", error)
    alert("Ocorreu um erro ao gerar o arquivo.")
  }
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

function safeFilename(value: string) {
  return value.replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "") || "relatorio"
}

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

export function NotasActions({ filters, institution }: { filters: any, institution?: string }) {
  const [syncStatus, setSyncStatus] = useState<"idle" | "confirming" | "syncing" | "success" | "error">("idle")
  const [syncError, setSyncError] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  const confirmSync = async () => {
    setSyncStatus("syncing")
    try {
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
      await exportGradesData({
        filters,
        type: "general",
        title: `Relatorio_Notas_${institution || "Geral"}`
      })
    } finally {
      setIsExporting(false)
    }
  }

  const isSyncing = syncStatus === "syncing"

  return (
    <>
      <div className="flex gap-2">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setSyncStatus("confirming")} 
          disabled={isSyncing}
          className="text-navy border-navy/20 hover:bg-navy/5 font-semibold"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? "animate-spin" : ""}`} />
          {isSyncing ? "Sincronizando..." : "Sincronizar AVA"}
        </Button>
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleExport}
          disabled={isExporting}
          className="text-green-brand border-green-brand/20 hover:bg-green-brand/5 font-semibold"
        >
          <Download className={`w-4 h-4 mr-2 ${isExporting ? "animate-pulse" : ""}`} />
          {isExporting ? "Exportando..." : "Exportar CSV"}
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
                  Iniciar Sincronização
                </AlertDialogTitle>
                <AlertDialogDescription className="text-gray-4 text-[14px]">
                  Deseja iniciar a sincronização de dados {institution ? `de ${institution.toUpperCase()}` : 'GLOBAL'} com o AVA? 
                  <br/><br/>
                  Este processo trará as <strong>médias das notas das fases e a média final</strong> em tempo real, mas pode levar alguns minutos dependendo do volume de dados.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="mt-8 border-t-0 bg-transparent p-0 m-0 sm:justify-end gap-3 flex-row justify-end">
                <AlertDialogCancel className="border border-red/40 text-red hover:bg-red/10 hover:border-red hover:text-red font-semibold rounded-lg h-11 px-6 mt-0 transition-colors">
                  Cancelar
                </AlertDialogCancel>
                <AlertDialogAction 
                  onClick={confirmSync}
                  className="bg-green-dark hover:bg-green-brand text-white font-semibold rounded-lg h-11 px-6 transition-colors border border-transparent font-sans"
                >
                  Confirmar Sincronização
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}

          {syncStatus === "syncing" && (
            <div className="flex flex-col items-center text-center py-6">
              <div className="relative mb-6">
                <div className="absolute inset-0 rounded-full bg-green-brand/20 blur-xl animate-pulse" />
                <div className="relative flex items-center justify-center w-20 h-20 rounded-full border-4 border-t-green-brand border-r-green-brand/30 border-b-green-brand/10 border-l-green-brand/60 animate-spin">
                  <RefreshCw className="w-8 h-8 text-green-dark" />
                </div>
              </div>
              <AlertDialogTitle className="text-xl font-extrabold text-navy mb-2">
                Sincronizando Dados...
              </AlertDialogTitle>
              <AlertDialogDescription className="text-gray-4 text-[14px] leading-relaxed max-w-sm">
                Buscando os dados em tempo real no AVA. Este processo pode levar alguns minutos.
                <br />
                <strong className="text-navy font-bold mt-2 block">Por favor, não feche ou atualize esta página.</strong>
              </AlertDialogDescription>
            </div>
          )}

          {syncStatus === "success" && (
            <div className="flex flex-col items-center text-center py-4">
              <div className="relative mb-6">
                <div className="absolute inset-0 rounded-full bg-green-brand/10 blur-lg animate-ping duration-1000" />
                <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-green-3 text-green-brand">
                  <CheckCircle2 className="w-12 h-12 text-green-brand" />
                </div>
              </div>
              <AlertDialogTitle className="text-xl font-extrabold text-navy mb-2">
                Sincronização Concluída!
              </AlertDialogTitle>
              <AlertDialogDescription className="text-gray-4 text-[14px] leading-relaxed max-w-sm mb-6">
                As médias das notas e a média final foram sincronizadas e atualizadas com sucesso no sistema Nexus.
              </AlertDialogDescription>
              <AlertDialogAction 
                onClick={() => {
                  setSyncStatus("idle")
                  window.location.reload()
                }}
                className="w-full bg-green-dark hover:bg-green-brand text-white font-semibold rounded-lg h-11 px-6 transition-colors border border-transparent font-sans"
              >
                Concluir e Atualizar Página
              </AlertDialogAction>
            </div>
          )}

          {syncStatus === "error" && (
            <div className="flex flex-col items-center text-center py-4">
              <div className="relative mb-6">
                <div className="absolute inset-0 rounded-full bg-red/10 blur-lg" />
                <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-red/10 text-red">
                  <AlertCircle className="w-12 h-12 text-red" />
                </div>
              </div>
              <AlertDialogTitle className="text-xl font-extrabold text-red mb-2">
                Falha na Sincronização
              </AlertDialogTitle>
              <AlertDialogDescription className="text-gray-4 text-[14px] leading-relaxed max-w-sm mb-6">
                Ocorreu um problema ao sincronizar os dados com o AVA.
                {syncError && (
                  <div className="mt-3 p-3 bg-red/5 rounded-lg border border-red/10 text-left font-mono text-[12px] text-red/80 break-words max-h-32 overflow-y-auto">
                    {syncError}
                  </div>
                )}
              </AlertDialogDescription>
              <AlertDialogAction 
                onClick={() => setSyncStatus("idle")}
                className="w-full bg-navy hover:bg-navy-light text-white font-semibold rounded-lg h-11 px-6 transition-colors border border-transparent font-sans"
              >
                Fechar e Tentar Novamente
              </AlertDialogAction>
            </div>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
