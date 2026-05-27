"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  AlertCircle, 
  AlertTriangle, 
  BookOpen, 
  Clock, 
  PlayCircle, 
  Filter, 
  TrendingUp, 
  TrendingDown,
  Download, 
  CheckCircle2, 
  Activity, 
  Award, 
  ThumbsUp, 
  ThumbsDown,
  Sparkles,
  Minus,
  ChevronDown,
  ChevronUp
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { NotasTable } from "./NotasTable"
import { NotasActions, exportGradesData } from "./NotasActions"
import { NotasFilters } from "./NotasFilters"
import { NotasPagination } from "./NotasPagination"

function DonutChart({ percent, color, label, isAbsolute = false }: { percent: number, color: string, label: string, isAbsolute?: boolean }) {
  const radius = 24
  const circ = 2 * Math.PI * radius
  const fillPercent = isAbsolute ? percent * 10 : percent
  const strokeDashoffset = circ - (circ * Math.min(Math.max(fillPercent, 0), 100)) / 100

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
        <span className="text-[13px] font-black text-navy leading-none font-mono">
          {isAbsolute ? percent.toFixed(1) : `${Math.round(percent)}%`}
        </span>
        <span className="text-[6px] font-extrabold text-[#9AA0AC] uppercase mt-0.5 tracking-wider">{label}</span>
      </div>
    </div>
  )
}

function PhaseBar({ 
  label, 
  value, 
  isPercent = false,
  status, 
  onDownload 
}: { 
  label: string
  value: number
  isPercent?: boolean
  status: string
  onDownload?: () => void 
}) {
  const barColor =
    status === 'success' ? 'bg-[#27AE60]' : 
    status === 'danger' ? 'bg-red-500' :
    status === 'warning' ? 'bg-amber-500' : 'bg-gray-300'

  const textColor =
    status === 'success' ? 'text-green-700' :
    status === 'danger' ? 'text-red-600' :
    status === 'warning' ? 'text-amber-600' : 'text-gray-400'

  const fillWidth = isPercent ? value : value * 10

  return (
    <div className="flex items-center gap-1.5 text-[10px] py-0.5">
      <PlayCircle className="w-3 h-3 text-[#9AA0AC] shrink-0" />
      <span className="text-[#5F6775] w-12 shrink-0 font-medium">{label}</span>
      
      {onDownload && (
        <button 
          onClick={onDownload}
          title={`Exportar dados da ${label}`}
          className="text-gray-400 hover:text-navy transition-colors shrink-0 p-0.5 cursor-pointer"
        >
          <Download className="w-3 h-3" />
        </button>
      )}

      <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden ml-0.5">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${fillWidth}%` }} />
      </div>
      <span className={`font-bold w-8 text-right font-mono ${textColor}`}>
        {isPercent ? `${Math.round(value)}%` : value.toFixed(1)}
      </span>
    </div>
  )
}

export function DashboardNotas({ title, metrics, institution }: { title: string, metrics: any, institution?: string }) {
  const searchParams = useSearchParams()
  const [isExpanded, setIsExpanded] = useState(false)

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

  // Dynamic status helpers based on thresholds
  const getGradeStatus = (val: number): 'success' | 'warning' | 'danger' => {
    if (val >= 60.0) return 'success'
    if (val >= 30.0) return 'warning'
    return 'danger'
  }

  const getBelowExpectedStatus = (val: number): 'success' | 'warning' | 'danger' => {
    if (val < 30.0) return 'success' // low failure rate is good (green)
    if (val < 50.0) return 'warning' // medium failure rate is warning (orange)
    return 'danger' // high failure rate is dangerous (red)
  }

  const getCriticalStatus = (val: number): 'success' | 'warning' | 'danger' => {
    if (val < 10.0) return 'success' // low critical rate is green
    if (val < 20.0) return 'warning' // medium critical rate is orange
    return 'danger' // high critical rate is red
  }

  // Dynamic colors for DonutCharts
  const getGradeColor = (val: number): string => {
    const status = getGradeStatus(val)
    return status === 'success' ? '#27AE60' : status === 'warning' ? '#F59E0B' : '#EF4444'
  }

  const getBelowExpectedColor = (val: number): string => {
    const status = getBelowExpectedStatus(val)
    return status === 'success' ? '#27AE60' : status === 'warning' ? '#F59E0B' : '#EF4444'
  }

  const getCriticalColor = (val: number): string => {
    const status = getCriticalStatus(val)
    return status === 'success' ? '#27AE60' : status === 'warning' ? '#F59E0B' : '#EF4444'
  }

  // Prepara as faixas de histograma com valores seguros
  const hp = metrics.histogram_percents || {
    range_0_3: 0,
    range_3_5: 0,
    range_5_6: 0,
    range_6_7: 0,
    range_7_8: 0,
    range_8_9: 0,
    range_9_10: 0
  }

  const histogramData = [
    { label: "0-30", val: hp.range_0_3, color: "bg-[#E06D6D]", isApproval: false },
    { label: "30-50", val: hp.range_3_5, color: "bg-[#E29B63]", isApproval: false },
    { label: "50-60", val: hp.range_5_6, color: "bg-[#E29B63]", isApproval: false },
    { label: "60-70", val: hp.range_6_7, color: "bg-[#7BB4EC]", isApproval: true },
    { label: "70-80", val: hp.range_7_8, color: "bg-[#5B95E2]", isApproval: true },
    { label: "80-90", val: hp.range_8_9, color: "bg-[#457DC7]", isApproval: true },
    { label: "90-100", val: hp.range_9_10, color: "bg-[#3264A7]", isApproval: true },
  ]

  const maxHistVal = Math.max(...histogramData.map(h => h.val), 1)

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-navy tracking-tight">{title}</h1>
          <p className="text-[#5F6775] text-sm mt-1">Dashboard estratégico de avaliação e notas dos alunos.</p>
        </div>
        <div className="flex gap-2">
          <NotasFilters />
          <NotasActions filters={currentFilters} institution={institution} />
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────── */}
      {/* BLOCO 1: VISÃO GERAL DE DESEMPENHO */}
      {/* ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Card 1: Média Global */}
        <Card className="border-t-4 border-[#1976D2] shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <CardHeader className="flex flex-row items-center justify-between pb-1">
              <CardTitle className="text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider">Média Global</CardTitle>
              <button
                onClick={() => exportGradesData({ filters: currentFilters, type: 'general', title: `Media_Global_${institution || 'Geral'}` })}
                className="text-[10px] font-bold text-[#9AA0AC] hover:text-navy border border-gray-200 hover:bg-gray-50 h-5 px-1.5 py-0.5 rounded flex items-center gap-1 transition-colors cursor-pointer"
                title="Exportar dados do card"
              >
                <Download className="w-2.5 h-2.5" /> Exportar
              </button>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="flex items-center gap-3">
                <DonutChart percent={metrics.average_media || 0} color={getGradeColor(metrics.average_media || 0)} label="MÉDIA" isAbsolute />
                <div className="flex-1 space-y-0.5">
                  <PhaseBar 
                    label="Fase 01" 
                    value={metrics.average_fase1 || 0} 
                    status={getGradeStatus(metrics.average_fase1 || 0)} 
                    onDownload={() => exportGradesData({ filters: currentFilters, type: 'general', phase: 1, title: `Media_Fase1_${institution || 'Geral'}` })}
                  />
                  <PhaseBar 
                    label="Fase 02" 
                    value={metrics.average_fase2 || 0} 
                    status={getGradeStatus(metrics.average_fase2 || 0)} 
                    onDownload={() => exportGradesData({ filters: currentFilters, type: 'general', phase: 2, title: `Media_Fase2_${institution || 'Geral'}` })}
                  />
                  <PhaseBar 
                    label="Fase 03" 
                    value={metrics.average_fase3 || 0} 
                    status={getGradeStatus(metrics.average_fase3 || 0)} 
                    onDownload={() => exportGradesData({ filters: currentFilters, type: 'general', phase: 3, title: `Media_Fase3_${institution || 'Geral'}` })}
                  />
                </div>
              </div>
            </CardContent>
          </div>
          <div className="px-6 py-2 border-t border-gray-100 flex justify-between items-center bg-gray-50/50">
            <span className="text-[9px] text-[#9AA0AC] font-bold uppercase tracking-wider">Acima da Aprovação</span>
            <span className="text-xs font-black text-[#1976D2] font-mono">{metrics.percent_acima_aprovacao || 0}%</span>
          </div>
        </Card>

        {/* Card 2: Abaixo da Aprovação */}
        <Card className="border-t-4 border-amber-500 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <CardHeader className="flex flex-row items-center justify-between pb-1">
              <CardTitle className="text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider">Abaixo da Aprovação</CardTitle>
              <button
                onClick={() => exportGradesData({ filters: currentFilters, type: 'below_expected', title: `Alunos_Abaixo_Aprovacao_${institution || 'Geral'}` })}
                className="text-[10px] font-bold text-[#9AA0AC] hover:text-navy border border-gray-200 hover:bg-gray-50 h-5 px-1.5 py-0.5 rounded flex items-center gap-1 transition-colors cursor-pointer"
                title="Exportar dados do card"
              >
                <Download className="w-2.5 h-2.5" /> Exportar
              </button>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="flex items-center gap-3">
                <DonutChart percent={metrics.average_below_expected || 0} color={getBelowExpectedColor(metrics.average_below_expected || 0)} label="ABAIXO" />
                <div className="flex-1 space-y-0.5">
                  <PhaseBar 
                    label="Fase 01" 
                    value={metrics.f1_below_percent || 0} 
                    isPercent
                    status={getBelowExpectedStatus(metrics.f1_below_percent || 0)} 
                  />
                  <PhaseBar 
                    label="Fase 02" 
                    value={metrics.f2_below_percent || 0} 
                    isPercent
                    status={getBelowExpectedStatus(metrics.f2_below_percent || 0)} 
                  />
                  <PhaseBar 
                    label="Fase 03" 
                    value={metrics.f3_below_percent || 0} 
                    isPercent
                    status={getBelowExpectedStatus(metrics.f3_below_percent || 0)} 
                  />
                </div>
              </div>
            </CardContent>
          </div>
          <div className="px-6 py-2 border-t border-gray-100 flex justify-between items-center bg-gray-50/50">
            <span className="text-[9px] text-[#9AA0AC] font-bold uppercase tracking-wider">Total de Matrículas</span>
            <span className="text-xs font-black text-amber-600 font-mono">{metrics.total_records || 0}</span>
          </div>
        </Card>

        {/* Card 3: Desempenho Crítico */}
        <Card className="border-t-4 border-red-500 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <CardHeader className="flex flex-row items-center justify-between pb-1">
              <CardTitle className="text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider">Desempenho Crítico</CardTitle>
              <button
                onClick={() => exportGradesData({ filters: currentFilters, type: 'critical', title: `Alunos_Criticos_${institution || 'Geral'}` })}
                className="text-[10px] font-bold text-[#9AA0AC] hover:text-navy border border-gray-200 hover:bg-gray-50 h-5 px-1.5 py-0.5 rounded flex items-center gap-1 transition-colors cursor-pointer"
                title="Exportar dados do card"
              >
                <Download className="w-2.5 h-2.5" /> Exportar
              </button>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="flex items-center gap-3">
                <DonutChart percent={metrics.percent_critical || 0} color={getCriticalColor(metrics.percent_critical || 0)} label="CRÍTICO" />
                <div className="flex-1 space-y-0.5">
                  <PhaseBar 
                    label="Fase 01" 
                    value={metrics.f1_crit_percent || 0} 
                    isPercent
                    status={getCriticalStatus(metrics.f1_crit_percent || 0)} 
                  />
                  <PhaseBar 
                    label="Fase 02" 
                    value={metrics.f2_crit_percent || 0} 
                    isPercent
                    status={getCriticalStatus(metrics.f2_crit_percent || 0)} 
                  />
                  <PhaseBar 
                    label="Fase 03" 
                    value={metrics.f3_crit_percent || 0} 
                    isPercent
                    status={getCriticalStatus(metrics.f3_crit_percent || 0)} 
                  />
                </div>
              </div>
            </CardContent>
          </div>
          <div className="px-6 py-2 border-t border-gray-100 flex justify-between items-center bg-gray-50/50">
            <span className="text-[9px] text-[#9AA0AC] font-bold uppercase tracking-wider">Total de Disciplinas</span>
            <span className="text-xs font-black text-red-600 font-mono">
              {metrics.critical_disciplines || 0} de {metrics.total_disciplines || 0}
            </span>
          </div>
        </Card>

        {/* Card 4: Sem Acesso (AVA) */}
        <Card className="border-t-4 border-navy shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <CardHeader className="flex flex-row items-center justify-between pb-1">
              <CardTitle className="text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider">Sem Acesso (AVA)</CardTitle>
              <button
                onClick={() => exportGradesData({ filters: currentFilters, type: 'no_access', title: `Alunos_Sem_Acesso_${institution || 'Geral'}` })}
                className="text-[10px] font-bold text-[#9AA0AC] hover:text-navy border border-gray-200 hover:bg-gray-50 h-5 px-1.5 py-0.5 rounded flex items-center gap-1 transition-colors cursor-pointer"
                title="Exportar dados do card"
              >
                <Download className="w-2.5 h-2.5" /> Exportar
              </button>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-center justify-center shrink-0 w-20 h-20 bg-gray-50 border border-gray-100 rounded-full select-none">
                  <span className="text-3xl font-black text-navy font-mono leading-none">{metrics.count_alunos_sem_acesso || 0}</span>
                  <span className="text-[6px] font-bold text-[#9AA0AC] uppercase mt-1 tracking-wider">ALUNOS</span>
                </div>
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#1976D2]" />
                      <span className="text-[#5F6775] font-semibold">Matrículas</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[8px] bg-blue-100 text-blue-700 font-bold px-1 rounded-full">{(metrics.percent_mat_sem_acesso || 0).toFixed(1)}%</span>
                      <span className="font-bold text-navy font-mono">{metrics.count_mat_sem_acesso || 0}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-navy" />
                      <span className="text-[#5F6775] font-semibold">Alunos</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[8px] bg-slate-100 text-slate-700 font-bold px-1 rounded-full">{(metrics.percent_alunos_sem_acesso || 0).toFixed(1)}%</span>
                      <span className="font-bold text-navy font-mono">{metrics.count_alunos_sem_acesso || 0}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[10px] border-t border-gray-100 pt-1 mt-0.5">
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                      <span className="text-red-600 font-bold text-[9px]">Nota Crítica</span>
                    </div>
                    <span className="font-black text-red-600 font-mono text-[9px]">{metrics.percent_sem_acesso_nota_critica || 0}%</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </div>
          <div className="px-6 py-2 border-t border-gray-100 flex justify-between items-center bg-gray-50/50">
            <span className="text-[9px] text-[#9AA0AC] font-bold uppercase tracking-wider">Total Alunos Únicos</span>
            <span className="text-xs font-black text-navy font-mono">{metrics.total_alunos_unicos || 0}</span>
          </div>
        </Card>

      </div>

      {/* Botão de Expansão/Colapso */}
      <div className="flex justify-center py-2">
        <Button
          onClick={() => setIsExpanded(!isExpanded)}
          variant="outline"
          className="border-gray-200 hover:bg-gray-50 hover:text-navy text-[#5F6775] font-extrabold text-xs py-2 px-6 flex items-center gap-2 rounded-xl transition-all shadow-sm cursor-pointer select-none bg-white"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="w-4 h-4 text-navy shrink-0" />
              <span>Retrair Dashboards Detalhados</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4 text-navy shrink-0" />
              <span>Expandir Dashboards Detalhados</span>
            </>
          )}
        </Button>
      </div>

      {isExpanded && (
        <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">

          {/* ──────────────────────────────────────────────────────── */}
          {/* BLOCO 2: DISTRIBUIÇÃO DE NOTAS & ESTATÍSTICAS */}
          {/* ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Histograma */}
        <Card className="lg:col-span-7 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div>
              <CardTitle className="text-sm font-extrabold text-navy tracking-tight">Distribuição por Faixa de Nota</CardTitle>
              <p className="text-[10px] text-[#9AA0AC] uppercase font-bold mt-1 tracking-wider">Mínimo de aprovação: 60</p>
            </div>
            <button
              onClick={() => exportGradesData({ filters: currentFilters, type: 'general', title: `Distribuicao_Faixas_${institution || 'Geral'}` })}
              className="text-[10px] font-bold text-[#9AA0AC] hover:text-navy border border-gray-200 hover:bg-gray-50 h-5 px-1.5 py-0.5 rounded flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Download className="w-2.5 h-2.5" /> Exportar
            </button>
          </CardHeader>
          <CardContent>
            {/* Histograma em Barras */}
            <div className="relative h-44 flex items-end justify-between gap-2 px-2 pt-6 pb-2 border-b border-gray-100">
              {/* Linha pontilhada de Aprovação (60) */}
              <div 
                className="absolute top-0 bottom-0 border-l border-dashed border-navy/20 z-0 flex flex-col justify-start" 
                style={{ left: "calc(42.8% + 4px)" }}
              >
                <div className="bg-navy/10 text-navy font-black text-[7px] px-1 rounded-sm border border-navy/15 select-none -translate-x-1/2 -translate-y-4 shadow-sm py-0.5">
                  Aprovação (60)
                </div>
              </div>

              {histogramData.map((h, i) => {
                const heightPercent = maxHistVal > 0 ? (h.val / maxHistVal) * 100 : 0
                return (
                  <div key={h.label} className="flex-1 flex flex-col items-center justify-end h-full z-10 group">
                    <span className="text-[10px] font-black text-navy font-mono mb-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {h.val}%
                    </span>
                    <div 
                      className={`w-full rounded-t-sm transition-all duration-500 ease-out group-hover:brightness-95 ${h.color}`}
                      style={{ height: `${Math.max(heightPercent, 4)}%` }}
                    />
                    <div className="w-full text-center mt-2">
                      <span className="text-[9px] font-bold text-gray-500 font-mono block leading-none">
                        {h.label}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Legenda */}
            <div className="flex items-center gap-6 mt-4 px-2 text-[10px] font-bold">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-[#E06D6D]" />
                <span className="text-red-600">Reprovação ({metrics.reproved_percent || 0}%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-[#5B95E2]" />
                <span className="text-[#1565C0]">Aprovação ({metrics.approved_percent || 0}%)</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Estatísticas Gerais */}
        <Card className="lg:col-span-5 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-extrabold text-navy tracking-tight">Estatísticas Gerais</CardTitle>
            <button
              onClick={() => exportGradesData({ filters: currentFilters, type: 'general', title: `Estatisticas_Gerais_${institution || 'Geral'}` })}
              className="text-[10px] font-bold text-[#9AA0AC] hover:text-navy border border-gray-200 hover:bg-gray-50 h-5 px-1.5 py-0.5 rounded flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Download className="w-2.5 h-2.5" /> Exportar
            </button>
          </CardHeader>
          <CardContent className="space-y-4">
            
            {/* Grid 3x2 + 1 principal */}
            <div className="grid grid-cols-3 gap-2.5">
              
              <div className="col-span-3 bg-gray-50 p-2.5 rounded-xl border border-gray-100 flex justify-between items-center select-none">
                <div>
                  <span className="text-[8px] font-extrabold text-[#9AA0AC] uppercase tracking-wider block">Nota Média</span>
                  <span className="text-2xl font-black text-navy font-mono leading-tight mt-0.5 block">
                    {(metrics.average_media || 0).toFixed(1)}
                  </span>
                </div>
                <div className="bg-green-100 text-green-700 font-extrabold text-[9px] px-2 py-1 rounded-lg flex items-center gap-1">
                  <TrendingUp className="w-3 h-3 shrink-0" />
                  <span>+0.3 vs ant.</span>
                </div>
              </div>

              <div className="bg-slate-50/50 p-2 rounded-lg border border-slate-100 flex flex-col select-none">
                <span className="text-[7.5px] font-bold text-[#9AA0AC] uppercase tracking-wider block">Mediana</span>
                <span className="text-sm font-black text-navy font-mono leading-none mt-1.5 block">
                  {(metrics.mediana || 0).toFixed(1)}
                </span>
              </div>

              <div className="bg-slate-50/50 p-2 rounded-lg border border-slate-100 flex flex-col select-none">
                <span className="text-[7.5px] font-bold text-[#9AA0AC] uppercase tracking-wider block">Nota Mínima</span>
                <span className="text-sm font-black text-red-600 font-mono leading-none mt-1.5 block">
                  {(metrics.nota_minima || 0).toFixed(1)}
                </span>
              </div>

              <div className="bg-slate-50/50 p-2 rounded-lg border border-slate-100 flex flex-col select-none">
                <span className="text-[7.5px] font-bold text-[#9AA0AC] uppercase tracking-wider block">Nota Máxima</span>
                <span className="text-sm font-black text-green-700 font-mono leading-none mt-1.5 block">
                  {(metrics.nota_maxima || 0).toFixed(1)}
                </span>
              </div>

              <div className="bg-slate-50/50 p-2 rounded-lg border border-slate-100 flex flex-col select-none">
                <span className="text-[7.5px] font-bold text-[#9AA0AC] uppercase tracking-wider block">Aprovados</span>
                <span className="text-sm font-black text-green-600 font-mono leading-none mt-1.5 block">
                  {metrics.approved_percent || 0}%
                </span>
              </div>

              <div className="bg-slate-50/50 p-2 rounded-lg border border-slate-100 flex flex-col select-none">
                <span className="text-[7.5px] font-bold text-[#9AA0AC] uppercase tracking-wider block">Reprovados</span>
                <span className="text-sm font-black text-red-600 font-mono leading-none mt-1.5 block">
                  {metrics.reproved_percent || 0}%
                </span>
              </div>

              <div className="bg-slate-50/50 p-2 rounded-lg border border-slate-100 flex flex-col select-none">
                <span className="text-[7.5px] font-bold text-[#9AA0AC] uppercase tracking-wider block">Sem Nota</span>
                <span className="text-sm font-black text-slate-500 font-mono leading-none mt-1.5 block">
                  {metrics.sem_nota_percent || 0}%
                </span>
              </div>

            </div>

          </CardContent>
        </Card>

      </div>

      {/* ──────────────────────────────────────────────────────── */}
      {/* BLOCO 3: RANKING DE DISCIPLINAS */}
      {/* ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        
        {/* Piores Médias */}
        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-sm font-extrabold text-navy tracking-tight">Piores Médias — Top 5 Disciplinas</CardTitle>
              <p className="text-[8.5px] text-[#9AA0AC] font-bold uppercase mt-1 tracking-wider">Atenção e intervenção prioritárias</p>
            </div>
            <button
              onClick={() => exportGradesData({ filters: currentFilters, type: 'critical', title: `Worst_Disciplinas_${institution || 'Geral'}` })}
              className="text-[10px] font-bold text-[#9AA0AC] hover:text-navy border border-gray-200 hover:bg-gray-50 h-5 px-1.5 py-0.5 rounded flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Download className="w-2.5 h-2.5" /> Exportar
            </button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2.5">
              {metrics.worstCourses && metrics.worstCourses.length > 0 ? (
                metrics.worstCourses.map((c: any, i: number) => (
                  <div key={c.name} className="space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="font-semibold text-gray-700 truncate max-w-[80%]">
                        {i + 1}. {c.name}
                      </span>
                      <span className="font-black text-red-600 font-mono">{c.average.toFixed(1)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-red-400 h-full rounded-full transition-all" 
                          style={{ width: `${c.average}%` }} 
                        />
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-[#9AA0AC] italic">Nenhuma disciplina avaliada.</div>
              )}
            </div>
            <div className="border-t border-gray-100 pt-3 flex justify-between items-center select-none">
              <span className="text-[10px] text-[#9AA0AC] font-black uppercase tracking-wider">Total com Média Crítica</span>
              <span className="text-xs font-black text-red-600 font-mono bg-red-50 px-2 py-0.5 rounded-full border border-red-100">
                {metrics.critical_disciplines || 0} disciplinas
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Melhores Médias */}
        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-sm font-extrabold text-navy tracking-tight">Melhores Médias — Top 5 Disciplinas</CardTitle>
              <p className="text-[8.5px] text-[#9AA0AC] font-bold uppercase mt-1 tracking-wider">Destaques e referências positivas</p>
            </div>
            <button
              onClick={() => exportGradesData({ filters: currentFilters, type: 'general', title: `Best_Disciplinas_${institution || 'Geral'}` })}
              className="text-[10px] font-bold text-[#9AA0AC] hover:text-navy border border-gray-200 hover:bg-gray-50 h-5 px-1.5 py-0.5 rounded flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Download className="w-2.5 h-2.5" /> Exportar
            </button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2.5">
              {metrics.bestCourses && metrics.bestCourses.length > 0 ? (
                metrics.bestCourses.map((c: any, i: number) => (
                  <div key={c.name} className="space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="font-semibold text-gray-700 truncate max-w-[80%]">
                        {i + 1}. {c.name}
                      </span>
                      <span className="font-black text-green-700 font-mono">{c.average.toFixed(1)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-[#27AE60] h-full rounded-full transition-all" 
                          style={{ width: `${c.average}%` }} 
                        />
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-[#9AA0AC] italic">Nenhuma disciplina avaliada.</div>
              )}
            </div>
            <div className="border-t border-gray-100 pt-3 flex justify-between items-center select-none">
              <span className="text-[10px] text-[#9AA0AC] font-black uppercase tracking-wider">Total com Ótimo Desempenho</span>
              <span className="text-xs font-black text-green-700 font-mono bg-green-50 px-2 py-0.5 rounded-full border border-green-100">
                {metrics.excellent_disciplines || 0} disciplinas
              </span>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* ──────────────────────────────────────────────────────── */}
      {/* BLOCO 4: ALUNOS EM RISCO */}
      {/* ──────────────────────────────────────────────────────── */}
      <div className="space-y-3 select-none">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-red" />
          <h2 className="text-sm font-extrabold text-navy uppercase tracking-wider">Alunos em Risco — Ação Recomendada</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          
          {/* Card Risco 1: Abaixo da Aprovação */}
          <Card className="border-l-4 border-red-500 shadow-sm hover:shadow-md transition-all flex flex-col justify-between p-4">
            <div className="space-y-2">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-black text-[#9AA0AC] uppercase tracking-wider">Abaixo da Aprovação (&lt; 60)</span>
                <button
                  onClick={() => exportGradesData({ filters: currentFilters, type: 'critical', title: `Alunos_Risco_AbaixoAprovacao_${institution || 'Geral'}` })}
                  className="text-gray-400 hover:text-navy cursor-pointer"
                  title="Exportar alunos"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-red-600 font-mono">{metrics.count_critical_grade || 0}</span>
                <span className="text-xs text-gray-500 font-semibold">alunos</span>
              </div>
              <p className="text-[11px] text-[#5F6775] leading-relaxed">
                Nota abaixo de 60 em ao menos uma disciplina. Acompanhamento preventivo indicado.
              </p>
            </div>
            <div className="mt-4 pt-2 border-t border-gray-100">
              <span className="inline-flex items-center gap-1 text-[9px] bg-red-50 text-red-600 font-black px-2 py-0.5 rounded-md border border-red-100/50">
                <TrendingUp className="w-3 h-3 shrink-0" />
                <span>+41 vs anterior</span>
              </span>
            </div>
          </Card>

          {/* Card Risco 2: Reprovação Múltipla */}
          <Card className="border-l-4 border-amber-500 shadow-sm hover:shadow-md transition-all flex flex-col justify-between p-4">
            <div className="space-y-2">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-black text-[#9AA0AC] uppercase tracking-wider">Reprovação Múltipla (2+)</span>
                <button
                  onClick={() => exportGradesData({ filters: currentFilters, type: 'below_expected', title: `Alunos_Risco_ReprovacaoMultipla_${institution || 'Geral'}` })}
                  className="text-gray-400 hover:text-navy cursor-pointer"
                  title="Exportar alunos"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-amber-600 font-mono">{metrics.count_multiple_fail || 0}</span>
                <span className="text-xs text-gray-500 font-semibold">alunos</span>
              </div>
              <p className="text-[11px] text-[#5F6775] leading-relaxed">
                Reprovados em 2 ou mais disciplinas simultaneamente. Acompanhamento pedagógico indicado.
              </p>
            </div>
            <div className="mt-4 pt-2 border-t border-gray-100">
              <span className="inline-flex items-center gap-1 text-[9px] bg-slate-50 text-slate-500 font-black px-2 py-0.5 rounded-md border border-slate-100">
                <Minus className="w-3 h-3 shrink-0" />
                <span>= mesmo nível</span>
              </span>
            </div>
          </Card>

          {/* Card Risco 3: Sem Nota Lançada */}
          <Card className="border-l-4 border-slate-400 shadow-sm hover:shadow-md transition-all flex flex-col justify-between p-4">
            <div className="space-y-2">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-black text-[#9AA0AC] uppercase tracking-wider">Sem Nota Lançada</span>
                <button
                  onClick={() => exportGradesData({ filters: currentFilters, type: 'no_access', title: `Alunos_Risco_SemNota_${institution || 'Geral'}` })}
                  className="text-gray-400 hover:text-navy cursor-pointer"
                  title="Exportar alunos"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-500 font-mono">{metrics.count_no_grade || 0}</span>
                <span className="text-xs text-gray-500 font-semibold">alunos</span>
              </div>
              <p className="text-[11px] text-[#5F6775] leading-relaxed">
                Nenhuma nota registrada no AVA. Pode indicar falha no lançamento ou evasão silenciosa.
              </p>
            </div>
            <div className="mt-4 pt-2 border-t border-gray-100">
              <span className="inline-flex items-center gap-1 text-[9px] bg-green-50 text-green-700 font-black px-2 py-0.5 rounded-md border border-green-100/50">
                <TrendingDown className="w-3 h-3 shrink-0" />
                <span>-12 vs anterior</span>
              </span>
            </div>
          </Card>

        </div>
      </div>
      
      </div>
      )}

      {/* ──────────────────────────────────────────────────────── */}
      {/* TABELA DE ALUNOS ANALISADOS */}
      {/* ──────────────────────────────────────────────────────── */}
      <Card className="shadow-sm overflow-hidden hover:shadow-md transition-shadow">
        <CardHeader className="bg-[#F4F5F7] border-b flex flex-row items-center justify-between py-3">
          <CardTitle className="text-base font-extrabold text-navy flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-green-dark" /> Alunos Analisados
          </CardTitle>
          <div className="text-[11px] font-bold text-[#9AA0AC] uppercase tracking-widest">
            {metrics.total_records || 0} registros · Pág. {metrics.page || 1}/{metrics.total_pages || 1}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <NotasTable data={metrics.data || []} institution={institution} />
          <NotasPagination
            currentPage={metrics.page || 1}
            totalPages={metrics.total_pages || 1}
            totalRecords={metrics.total_records || 0}
            pageSize={metrics.size || 30}
          />
        </CardContent>
      </Card>
    </div>
  )
}
