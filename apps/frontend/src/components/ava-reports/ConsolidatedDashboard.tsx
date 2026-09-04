"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ConsolidatedTable } from "@/components/ava-reports/ConsolidatedTable"
import { ConsolidatedFilters } from "@/components/ava-reports/ConsolidatedFilters"
import { ConsolidatedActions } from "@/components/ava-reports/ConsolidatedActions"
import { ConsolidatedPagination } from "@/components/ava-reports/ConsolidatedPagination"
import { 
  Users, 
  TrendingUp, 
  Award, 
  AlertTriangle,
  PlayCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  BookOpen
} from "lucide-react"

function DonutChart({ 
  percent, 
  color, 
  label, 
  isAbsolute = false, 
  displayVal 
}: { 
  percent: number
  color: string
  label: string
  isAbsolute?: boolean
  displayVal?: string
}) {
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
          {displayVal ? displayVal : isAbsolute ? percent.toFixed(1) : `${Math.round(percent)}%`}
        </span>
        <span className="text-[6px] font-extrabold text-[#9AA0AC] uppercase mt-0.5 tracking-wider">{label}</span>
      </div>
    </div>
  )
}

function PhaseBar({ 
  label, 
  value, 
  isPercent = true, 
  status = 'default' 
}: { 
  label: string
  value: number
  isPercent?: boolean
  status?: 'success' | 'warning' | 'danger' | 'default'
}) {
  const barColor =
    status === 'success' ? 'bg-[#27AE60]' : 
    status === 'danger' ? 'bg-red-500' :
    status === 'warning' ? 'bg-amber-500' : 'bg-[#1976D2]'

  const textColor =
    status === 'success' ? 'text-green-700' :
    status === 'danger' ? 'text-red-600' :
    status === 'warning' ? 'text-amber-600' : 'text-slate-700'

  const fillWidth = isPercent ? Math.min(100, Math.max(0, value)) : Math.min(100, Math.max(0, value * 10))

  return (
    <div className="flex items-center gap-1.5 text-[10px] py-0.5">
      <PlayCircle className="w-3 h-3 text-[#9AA0AC] shrink-0" />
      <span className="text-[#5F6775] w-12 shrink-0 font-medium">{label}</span>
      
      <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden ml-0.5">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${fillWidth}%` }} />
      </div>
      <span className={`font-bold w-10 text-right font-mono ${textColor}`}>
        {isPercent ? `${Math.round(value)}%` : value.toFixed(1)}
      </span>
    </div>
  )
}

const INSTITUTION_CONFIG: Record<string, { title: string; badge: string; lmsLabel: string }> = {
  ead: {
    title: "EaD Graduação",
    badge: "EaD Graduação",
    lmsLabel: "Moodle OpenLMS",
  },
  uni: {
    title: "UniEVANGÉLICA",
    badge: "Online Uni",
    lmsLabel: "Moodle Presencial",
  },
  uniego: {
    title: "UNIEGO / FAEGO",
    badge: "Online UNIEGO",
    lmsLabel: "Moodle UNIEGO",
  },
  raizes: {
    title: "Faculdade Raízes",
    badge: "Online Raízes",
    lmsLabel: "Moodle Raízes",
  },
  eefn: {
    title: "EEFN / Colégios AEE",
    badge: "Online EEFN",
    lmsLabel: "Moodle EEFN",
  },
}

interface ConsolidatedDashboardProps {
  reportData: any
  filters: any
  institution?: string
}

export function ConsolidatedDashboard({ reportData, filters, institution = "ead" }: ConsolidatedDashboardProps) {
  const {
    data = [],
    total_records = 0,
    total_pages = 1,
    page = 1,
    size = 15,
    average_progress = 0,
    average_fase1 = 0,
    average_fase2 = 0,
    average_fase3 = 0,
    average_grade = 0,
    average_nota_fase1 = 0,
    average_nota_fase2 = 0,
    average_nota_fase3 = 0,
    below_approval = 0,
    above_approval = 0,
    on_track_progress = 0,
    no_access_count = 0,
    total_alunos_unicos = 0,
    total_disciplinas = 0,
    unique_periodos = ["2026-2", "2026-1", "2025-2"],
    unique_polos = [],
    unique_cursos = [],
  } = reportData || {}

  const instConfig = INSTITUTION_CONFIG[institution] || {
    title: institution.toUpperCase(),
    badge: institution.toUpperCase(),
    lmsLabel: "Moodle AVA",
  }

  // Métricas auxiliares de porcentagem
  const percentBelowApproval = total_records > 0 ? Math.round((below_approval / total_records) * 100) : 0
  const percentAboveApproval = total_records > 0 ? Math.round((above_approval / total_records) * 100) : 0
  const percentOnTrack = total_records > 0 ? Math.round((on_track_progress / total_records) * 100) : 0
  const percentNoAccess = total_records > 0 ? ((no_access_count / total_records) * 100).toFixed(1) : "0"
  const percentWithAccess = total_records > 0 ? Math.max(0, 100 - Number(percentNoAccess)).toFixed(1) : "100"

  // Status de notas
  const getGradeStatus = (val: number): 'success' | 'warning' | 'danger' => {
    if (val >= 60.0 || (val >= 6.0 && val <= 10.0)) return 'success'
    if (val >= 30.0 || (val >= 3.0 && val < 6.0)) return 'warning'
    return 'danger'
  }

  const getProgressStatus = (val: number): 'success' | 'warning' | 'danger' => {
    if (val >= 70) return 'success'
    if (val >= 40) return 'warning'
    return 'danger'
  }

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 select-none">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-md bg-navy text-white text-[10px] font-extrabold uppercase tracking-wider">
              {instConfig.badge}
            </span>
            <span className="text-xs text-gray-4 font-semibold">{instConfig.lmsLabel}</span>
          </div>
          <h1 className="text-2xl font-extrabold text-navy mt-1 tracking-tight">
            Relatório Unificado: Progresso & Notas — {instConfig.title}
          </h1>
          <p className="text-xs text-gray-5 mt-0.5">
            Acompanhamento 360° de engajamento, tarefas concluídas e desempenho acadêmico em tempo real.
          </p>
        </div>

        <ConsolidatedActions filters={filters} institution={institution} />
      </div>

      {/* Grid de 4 Cards de Métricas Consolidadas Ricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 select-none">
        
        {/* Card 1: Panorama de Matrículas & Acesso */}
        <Card className="border-t-4 border-navy shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <CardHeader className="flex flex-row items-center justify-between pb-1">
              <CardTitle className="text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider">Matrículas & Acesso</CardTitle>
              <span className="text-[10px] font-bold text-navy bg-navy/5 px-2 py-0.5 rounded-full font-mono">
                {percentWithAccess}% ativos
              </span>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-center justify-center shrink-0 w-20 h-20 bg-slate-50 border border-slate-200/80 rounded-2xl select-none">
                  <span className="text-2xl font-black text-navy font-mono leading-none">
                    {total_records >= 1000 ? `${(total_records / 1000).toFixed(1)}k` : total_records}
                  </span>
                  <span className="text-[7px] font-bold text-[#9AA0AC] uppercase mt-1 tracking-wider">MATRÍCULAS</span>
                </div>
                <div className="flex-1 space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Alunos Únicos:</span>
                    <strong className="text-navy font-mono font-bold">{total_alunos_unicos.toLocaleString('pt-BR')}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Disciplinas:</span>
                    <strong className="text-navy font-mono font-bold">{total_disciplinas}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Sem Acesso:</span>
                    <strong className="text-rose-600 font-mono font-bold">{no_access_count} ({percentNoAccess}%)</strong>
                  </div>
                </div>
              </div>
            </CardContent>
          </div>
          <div className="px-5 py-2 border-t border-slate-100 flex justify-between items-center bg-slate-50/50 text-[10px]">
            <span className="text-slate-400 font-semibold uppercase tracking-wider">Total Geral</span>
            <span className="font-mono font-black text-navy">{total_records.toLocaleString('pt-BR')} registros</span>
          </div>
        </Card>

        {/* Card 2: Progresso Acadêmico (Donut Total + PhaseBars F1, F2, F3) */}
        <Card className="border-t-4 border-[#27AE60] shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <CardHeader className="flex flex-row items-center justify-between pb-1">
              <CardTitle className="text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider">Progresso das Atividades</CardTitle>
              <span className="text-[10px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full font-mono">
                Média {average_progress}%
              </span>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="flex items-center gap-3">
                <DonutChart 
                  percent={average_progress} 
                  color="#27AE60" 
                  label="PROG." 
                />
                <div className="flex-1 space-y-0.5">
                  <PhaseBar 
                    label="Fase 01" 
                    value={average_fase1} 
                    status={getProgressStatus(average_fase1)} 
                  />
                  <PhaseBar 
                    label="Fase 02" 
                    value={average_fase2} 
                    status={getProgressStatus(average_fase2)} 
                  />
                  <PhaseBar 
                    label="Fase 03" 
                    value={average_fase3} 
                    status={getProgressStatus(average_fase3)} 
                  />
                </div>
              </div>
            </CardContent>
          </div>
          <div className="px-5 py-2 border-t border-slate-100 flex justify-between items-center bg-slate-50/50 text-[10px]">
            <span className="text-slate-400 font-semibold uppercase tracking-wider">Progresso em Dia (&gt; 70%)</span>
            <span className="font-mono font-black text-green-700">{percentOnTrack}%</span>
          </div>
        </Card>

        {/* Card 3: Desempenho e Notas (Donut Média + PhaseBars F1, F2, F3) */}
        <Card className="border-t-4 border-[#1976D2] shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <CardHeader className="flex flex-row items-center justify-between pb-1">
              <CardTitle className="text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider">Desempenho & Notas</CardTitle>
              <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full font-mono">
                Média {average_grade > 10 ? (average_grade / 10).toFixed(1) : average_grade} / 10
              </span>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="flex items-center gap-3">
                <DonutChart 
                  percent={average_grade > 10 ? average_grade / 10 : average_grade} 
                  color="#1976D2" 
                  label="MÉDIA" 
                  isAbsolute
                  displayVal={average_grade > 10 ? (average_grade / 10).toFixed(1) : average_grade.toFixed(1)}
                />
                <div className="flex-1 space-y-0.5">
                  <PhaseBar 
                    label="Fase 01" 
                    value={average_nota_fase1 > 10 ? average_nota_fase1 / 10 : average_nota_fase1} 
                    isPercent={false}
                    status={getGradeStatus(average_nota_fase1)} 
                  />
                  <PhaseBar 
                    label="Fase 02" 
                    value={average_nota_fase2 > 10 ? average_nota_fase2 / 10 : average_nota_fase2} 
                    isPercent={false}
                    status={getGradeStatus(average_nota_fase2)} 
                  />
                  <PhaseBar 
                    label="Fase 03" 
                    value={average_nota_fase3 > 10 ? average_nota_fase3 / 10 : average_nota_fase3} 
                    isPercent={false}
                    status={getGradeStatus(average_nota_fase3)} 
                  />
                </div>
              </div>
            </CardContent>
          </div>
          <div className="px-5 py-2 border-t border-slate-100 flex justify-between items-center bg-slate-50/50 text-[10px]">
            <span className="text-slate-400 font-semibold uppercase tracking-wider">Acima da Média (&ge; 6.0)</span>
            <span className="font-mono font-black text-blue-700">{percentAboveApproval}%</span>
          </div>
        </Card>

        {/* Card 4: Atenção Pedagógica & Risco Acadêmico */}
        <Card className="border-t-4 border-amber-500 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <CardHeader className="flex flex-row items-center justify-between pb-1">
              <CardTitle className="text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider">Atenção Pedagógica</CardTitle>
              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full font-mono">
                {percentBelowApproval}% em alerta
              </span>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="flex items-center gap-3">
                <DonutChart 
                  percent={percentBelowApproval} 
                  color="#F59E0B" 
                  label="ALERTA" 
                />
                <div className="flex-1 space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 text-amber-500" /> Nota &lt; 6.0:
                    </span>
                    <strong className="text-amber-700 font-mono font-bold">{below_approval} ({percentBelowApproval}%)</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium flex items-center gap-1">
                      <Clock className="w-3 h-3 text-rose-500" /> Sem Acesso:
                    </span>
                    <strong className="text-rose-600 font-mono font-bold">{no_access_count} ({percentNoAccess}%)</strong>
                  </div>
                </div>
              </div>
            </CardContent>
          </div>
          <div className="px-5 py-2 border-t border-slate-100 flex justify-between items-center bg-slate-50/50 text-[10px]">
            <span className="text-slate-400 font-semibold uppercase tracking-wider">Foco da Tutoria</span>
            <span className="font-mono font-black text-amber-700">{below_approval + no_access_count} matrículas</span>
          </div>
        </Card>

      </div>

      {/* Barra de Filtros */}
      <ConsolidatedFilters 
        uniquePeriodos={unique_periodos}
        uniquePolos={unique_polos}
        uniqueCursos={unique_cursos}
      />

      {/* Tabela Unificada com Colunas Duplas e Modal */}
      <ConsolidatedTable data={data} />

      {/* Paginação */}
      <ConsolidatedPagination
        currentPage={page}
        totalPages={total_pages}
        totalRecords={total_records}
        pageSize={size}
      />
    </div>
  )
}
