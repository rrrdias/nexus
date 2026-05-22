"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, AlertTriangle, BookOpen, Clock, PlayCircle, Filter, TrendingUp, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { NotasTable } from "./NotasTable"
import { NotasActions, exportGradesData } from "./NotasActions"
import { NotasFilters } from "./NotasFilters"
import { NotasPagination } from "./NotasPagination"

function DonutChart({ percent, color, label }: { percent: number, color: string, label: string }) {
  const radius = 24
  const circ = 2 * Math.PI * radius
  const strokeDashoffset = circ - (circ * Math.min(Math.max(percent, 0), 100)) / 100

  return (
    <div className="flex flex-col items-center justify-center shrink-0 w-20 h-20 relative select-none">
      <svg className="w-18 h-18 transform -rotate-90">
        <circle
          cx="36"
          cy="36"
          r={radius}
          stroke="#F2F4F7"
          strokeWidth="5"
          fill="transparent"
        />
        <circle
          cx="36"
          cy="36"
          r={radius}
          stroke={color}
          strokeWidth="5"
          fill="transparent"
          strokeDasharray={circ}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-500 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-[13px] font-black text-navy leading-none font-mono">{percent}%</span>
        <span className="text-[6px] font-extrabold text-[#9AA0AC] uppercase mt-0.5 tracking-wider">{label}</span>
      </div>
    </div>
  )
}

function PhaseBar({ 
  label, 
  avg, 
  status, 
  onDownload 
}: { 
  label: string
  avg: number
  status: string
  onDownload?: () => void 
}) {
  const barColor =
    status === 'success' ? 'bg-[#27AE60]' : // brand green
    status === 'danger' ? 'bg-red-500' :
    status === 'warning' ? 'bg-amber-500' : 'bg-gray-300'

  const textColor =
    status === 'success' ? 'text-green-700' :
    status === 'danger' ? 'text-red-600' :
    status === 'warning' ? 'text-amber-600' : 'text-gray-400'

  return (
    <div className="flex items-center gap-1.5 text-[10px] py-0.5">
      <PlayCircle className="w-3 h-3 text-[#9AA0AC] shrink-0" />
      <span className="text-[#5F6775] w-12 shrink-0 font-medium">{label}</span>
      
      {onDownload && (
        <button 
          onClick={onDownload}
          title={`Exportar dados da ${label}`}
          className="text-gray-400 hover:text-navy transition-colors shrink-0 p-0.5"
        >
          <Download className="w-3 h-3" />
        </button>
      )}

      <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden ml-0.5">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${avg}%` }} />
      </div>
      <span className={`font-bold w-8 text-right font-mono ${textColor}`}>{avg}%</span>
    </div>
  )
}

export function DashboardNotas({ title, metrics, institution }: { title: string, metrics: any, institution?: string }) {
  const [showFilters, setShowFilters] = useState(false)
  const searchParams = useSearchParams()

  const currentFilters = {
    sourceInstitution: institution,
    aluno: searchParams.get("aluno") || "",
    curso: searchParams.get("curso") || "",
    matricula: searchParams.get("matricula") || "",
    lastaccess: searchParams.get("lastaccess") || "",
    dias_sem_acesso: searchParams.get("dias_sem_acesso") || "",
    curso_perfil: searchParams.get("curso_perfil") || "",
    periodo_perfil: searchParams.get("periodo_perfil") || "",
    enrolment_status: searchParams.get("enrolment_status") || "",
    periodo: searchParams.get("periodo") !== null ? searchParams.get("periodo")! : "2026-1",
  }

  // Card 3 percentage of critical disciplines
  const critical_percent = metrics.total_disciplines > 0 
    ? Math.round((metrics.critical_disciplines / metrics.total_disciplines) * 100)
    : 0

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-navy tracking-tight">{title}</h1>
          <p className="text-[#5F6775] text-sm mt-1">Dashboard gerencial unificado de métricas de alunos.</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={showFilters ? "default" : "outline"}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={showFilters ? "bg-navy text-white font-semibold" : "text-navy border-navy/20 font-semibold"}
          >
            <Filter className="w-4 h-4 mr-2" />
            Filtros
          </Button>
          <NotasActions filters={currentFilters} institution={institution} />
        </div>
      </div>

      {showFilters && <NotasFilters />}

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">

        {/* Card 1: Progresso Médio Total */}
        <Card className="border-t-4 border-[#1976D2] shadow-sm flex flex-col justify-between">
          <div>
            <CardHeader className="flex flex-row items-center justify-between pb-1">
              <CardTitle className="text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider">Média Global</CardTitle>
              <button
                onClick={() => exportGradesData({ filters: currentFilters, type: 'general', title: `Media_Global_${institution || 'Geral'}` })}
                className="text-[10px] font-bold text-[#9AA0AC] hover:text-navy border border-gray-200 hover:bg-gray-50 h-5 px-1.5 py-0.5 rounded flex items-center gap-1 transition-colors"
                title="Exportar dados do card"
              >
                <Download className="w-2.5 h-2.5" /> Exportar
              </button>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="flex items-center gap-3">
                <DonutChart percent={metrics.average_media} color="#1976D2" label="MÉDIA" />
                <div className="flex-1 space-y-0.5">
                  <PhaseBar 
                    label="Fase 01" 
                    avg={metrics.average_fase1} 
                    status="neutral" 
                    onDownload={() => exportGradesData({ filters: currentFilters, type: 'general', phase: 1, title: `Media_Fase1_${institution || 'Geral'}` })}
                  />
                  <PhaseBar 
                    label="Fase 02" 
                    avg={metrics.average_fase2} 
                    status="neutral" 
                    onDownload={() => exportGradesData({ filters: currentFilters, type: 'general', phase: 2, title: `Media_Fase2_${institution || 'Geral'}` })}
                  />
                  <PhaseBar 
                    label="Fase 03" 
                    avg={metrics.average_fase3} 
                    status="neutral" 
                    onDownload={() => exportGradesData({ filters: currentFilters, type: 'general', phase: 3, title: `Media_Fase3_${institution || 'Geral'}` })}
                  />
                </div>
              </div>
            </CardContent>
          </div>
          <div className="px-6 py-2 border-t border-gray-100 flex justify-between items-center bg-gray-50/50">
            <span className="text-[9px] text-[#9AA0AC] font-bold uppercase tracking-wider">Matrículas em dia</span>
            <span className="text-xs font-black text-[#1976D2] font-mono">{metrics.percent_matriculas_em_dia}%</span>
          </div>
        </Card>

        {/* Card 2: Abaixo do Esperado */}
        <Card className="border-t-4 border-amber-500 shadow-sm flex flex-col justify-between">
          <div>
            <CardHeader className="flex flex-row items-center justify-between pb-1">
              <CardTitle className="text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider">Abaixo do Esperado</CardTitle>
              <button
                onClick={() => exportGradesData({ filters: currentFilters, type: 'below_expected', title: `Alunos_Abaixo_Media_${institution || 'Geral'}` })}
                className="text-[10px] font-bold text-[#9AA0AC] hover:text-navy border border-gray-200 hover:bg-gray-50 h-5 px-1.5 py-0.5 rounded flex items-center gap-1 transition-colors"
                title="Exportar dados do card"
              >
                <Download className="w-2.5 h-2.5" /> Exportar
              </button>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="flex items-center gap-3">
                <DonutChart percent={metrics.average_below_expected} color="#F59E0B" label="ATRASO" />
                <div className="flex-1 space-y-0.5">
                  {/* Removido as barras de fase provisoriamente, manter vazio ou colocar outras metricas */}
                  <div className="h-4"></div>
                </div>
              </div>
            </CardContent>
          </div>
          <div className="px-6 py-2 border-t border-gray-100 flex justify-between items-center bg-gray-50/50">
            <span className="text-[9px] text-[#9AA0AC] font-bold uppercase tracking-wider">Total de Matrículas</span>
            <span className="text-xs font-black text-amber-600 font-mono">{metrics.total_records}</span>
          </div>
        </Card>

        {/* Card 3: Progresso Crítico */}
        <Card className="border-t-4 border-red-500 shadow-sm flex flex-col justify-between">
          <div>
            <CardHeader className="flex flex-row items-center justify-between pb-1">
              <CardTitle className="text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider">Desempenho Crítico</CardTitle>
              <button
                onClick={() => exportGradesData({ filters: currentFilters, type: 'critical', title: `Turmas_Criticas_${institution || 'Geral'}` })}
                className="text-[10px] font-bold text-[#9AA0AC] hover:text-navy border border-gray-200 hover:bg-gray-50 h-5 px-1.5 py-0.5 rounded flex items-center gap-1 transition-colors"
                title="Exportar dados do card"
              >
                <Download className="w-2.5 h-2.5" /> Exportar
              </button>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="flex items-center gap-3">
                <DonutChart percent={0} color="#EF4444" label="CRÍTICO" />
                <div className="flex-1 space-y-0.5">
                  <div className="h-4"></div>
                </div>
              </div>
            </CardContent>
          </div>
          <div className="px-6 py-2 border-t border-gray-100 flex justify-between items-center bg-gray-50/50">
            <span className="text-[9px] text-[#9AA0AC] font-bold uppercase tracking-wider">Total de Disciplinas</span>
            <span className="text-xs font-black text-red-600 font-mono">
              {metrics.critical_disciplines} de {metrics.total_disciplines}
            </span>
          </div>
        </Card>

        {/* Card 4: Sem Acesso (AVA) */}
        <Card className="border-t-4 border-navy shadow-sm flex flex-col justify-between">
          <div>
            <CardHeader className="flex flex-row items-center justify-between pb-1">
              <CardTitle className="text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider">Sem Acesso (AVA)</CardTitle>
              <button
                onClick={() => exportGradesData({ filters: currentFilters, type: 'no_access', title: `Alunos_Sem_Acesso_${institution || 'Geral'}` })}
                className="text-[10px] font-bold text-[#9AA0AC] hover:text-navy border border-gray-200 hover:bg-gray-50 h-5 px-1.5 py-0.5 rounded flex items-center gap-1 transition-colors"
                title="Exportar dados do card"
              >
                <Download className="w-2.5 h-2.5" /> Exportar
              </button>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-center justify-center shrink-0 w-20 h-20 bg-gray-50 border border-gray-100 rounded-full select-none">
                  <span className="text-3xl font-black text-navy font-mono leading-none">{metrics.count_mat_sem_acesso}</span>
                  <span className="text-[6px] font-bold text-[#9AA0AC] uppercase mt-1 tracking-wider">ALUNOS</span>
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#1976D2]" />
                      <span className="text-[#5F6775] font-semibold">Matrículas</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[8px] bg-blue-100 text-blue-700 font-bold px-1 rounded-full">{metrics.percent_mat_sem_acesso.toFixed(1)}%</span>
                      <span className="font-bold text-navy font-mono">{metrics.count_mat_sem_acesso}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-navy" />
                      <span className="text-[#5F6775] font-semibold">Alunos</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[8px] bg-slate-100 text-slate-700 font-bold px-1 rounded-full">{metrics.percent_alunos_sem_acesso.toFixed(1)}%</span>
                      <span className="font-bold text-navy font-mono">{metrics.count_alunos_sem_acesso}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </div>
          <div className="px-6 py-2 border-t border-gray-100 flex justify-between items-center bg-gray-50/50">
            <span className="text-[9px] text-[#9AA0AC] font-bold uppercase tracking-wider">Total de Alunos Únicos</span>
            <span className="text-xs font-black text-navy font-mono">{metrics.total_alunos_unicos}</span>
          </div>
        </Card>

      </div>

      {/* Tabela */}
      <Card className="shadow-sm overflow-hidden">
        <CardHeader className="bg-[#F4F5F7] border-b flex flex-row items-center justify-between py-3">
          <CardTitle className="text-base font-extrabold text-navy flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-green-dark" /> Alunos Analisados
          </CardTitle>
          <div className="text-[11px] font-bold text-[#9AA0AC] uppercase tracking-widest">
            {metrics.total_records} registros · Pág. {metrics.page}/{metrics.total_pages}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <NotasTable data={metrics.data} institution={institution} />
          <NotasPagination
            currentPage={metrics.page}
            totalPages={metrics.total_pages}
            totalRecords={metrics.total_records}
            pageSize={metrics.size}
          />
        </CardContent>
      </Card>
    </div>
  )
}
