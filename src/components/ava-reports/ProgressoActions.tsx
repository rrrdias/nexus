"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { RefreshCw, Download } from "lucide-react"

import { syncMoodleData, getProgressExportData } from "@/app/actions/ava-reports"

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

export async function exportProgressData({
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
    const rawData = await getProgressExportData(filters)
    if (!rawData || rawData.length === 0) {
      alert("Nenhum dado encontrado para exportação.")
      return
    }

    const hoje = new Date()
    const termosSemAcesso = ["nunca acessou", "sem acesso", "", "none", "nulo", "-"]

    let filtered = rawData

    if (type === "below_expected") {
      if (phase) {
        filtered = rawData.filter(row => isBelowExpectedOnPhase(row, phase, hoje))
      } else {
        filtered = rawData.filter(row => isBelowExpectedOverall(row, hoje))
      }
    } else if (type === "critical") {
      const critCourses = phase 
        ? getCriticalCoursesForPhase(rawData, phase, hoje)
        : getCriticalCourses(rawData, hoje)
      filtered = rawData.filter(row => row.curso && critCourses.has(row.curso))
    } else if (type === "no_access") {
      filtered = rawData.filter(row => termosSemAcesso.includes((row.lastaccess || "").toLowerCase().trim()))
    } else if (type === "general" && phase) {
      filtered = rawData
    }

    if (filtered.length === 0) {
      alert("Nenhum registro atende aos critérios da exportação.")
      return
    }

    const exportRows = filtered.map(item => ({
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
      "Fase 1 (%)": item.fase1 || "-",
      "Fase 2 (%)": item.fase2 || "-",
      "Fase 3 (%)": item.fase3 || "-",
      "Progresso Total (%)": item.progressoTotal || "-"
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

export function ProgressoActions({ filters, institution }: { filters: any, institution?: string }) {
  const [isSyncing, setIsSyncing] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const handleSync = async () => {
    const msg = institution 
      ? `Deseja iniciar a sincronização de ${institution.toUpperCase()} com o Moodle? Isso pode levar alguns minutos.`
      : "Deseja iniciar a sincronização GLOBAL com o Moodle? Isso pode levar alguns minutos."

    if (!confirm(msg)) return
    
    setIsSyncing(true)
    try {
      const result = await syncMoodleData(institution, "progress")
      alert("Sincronização de progresso concluída com sucesso!")
      window.location.reload()
    } catch (error: any) {
      console.error(error)
      alert(`Erro: ${error.message || "Falha na sincronização"}`)
    } finally {
      setIsSyncing(false)
    }
  }

  const handleExport = async () => {
    setIsExporting(true)
    try {
      await exportProgressData({
        filters,
        type: "general",
        title: `Relatorio_Progresso_${institution || "Geral"}`
      })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="flex gap-2">
      <Button 
        variant="outline" 
        size="sm" 
        onClick={handleSync} 
        disabled={isSyncing}
        className="text-navy border-navy/20 hover:bg-navy/5 font-semibold"
      >
        <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? "animate-spin" : ""}`} />
        {isSyncing ? "Sincronizando..." : "Sincronizar Moodle"}
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
  )
}
