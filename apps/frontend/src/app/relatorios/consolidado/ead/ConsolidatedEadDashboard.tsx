"use client"

import { Card, CardContent } from "@/components/ui/card"
import { ConsolidatedTable } from "@/components/ava-reports/ConsolidatedTable"
import { ConsolidatedFilters } from "@/components/ava-reports/ConsolidatedFilters"
import { ConsolidatedActions } from "@/components/ava-reports/ConsolidatedActions"
import { ConsolidatedPagination } from "@/components/ava-reports/ConsolidatedPagination"
import { 
  Users, 
  TrendingUp, 
  Award, 
  AlertTriangle,
  GraduationCap,
  Layers
} from "lucide-react"

interface ConsolidatedEadDashboardProps {
  reportData: any
  filters: any
}

export function ConsolidatedEadDashboard({ reportData, filters }: ConsolidatedEadDashboardProps) {
  const {
    data = [],
    total_records = 0,
    total_pages = 1,
    page = 1,
    size = 15,
    average_progress = 0,
    average_grade = 0,
    below_approval = 0,
    no_access_count = 0,
    total_alunos_unicos = 0,
    total_disciplinas = 0,
    unique_periodos = ["2026-2", "2026-1", "2025-2"],

    unique_polos = [],
    unique_cursos = [],
  } = reportData || {}

  const percentBelowApproval = total_records > 0 
    ? Math.round((below_approval / total_records) * 100) 
    : 0

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 select-none">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-md bg-navy text-white text-[10px] font-extrabold uppercase tracking-wider">
              EaD Graduação
            </span>
            <span className="text-xs text-gray-4 font-semibold">Moodle OpenLMS</span>
          </div>
          <h1 className="text-2xl font-extrabold text-navy mt-1 tracking-tight">
            Relatório Unificado: Progresso & Notas
          </h1>
          <p className="text-xs text-gray-5 mt-0.5">
            Acompanhamento 360° de engajamento, tarefas concluídas e desempenho acadêmico em tempo real.
          </p>
        </div>

        <ConsolidatedActions filters={filters} institution="ead" />
      </div>

      {/* Grid de 4 Cards de Métricas Consolidadas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 select-none">
        {/* Card 1: Total de Matrículas / Alunos */}
        <Card className="border-t-4 border-navy shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-gray-4 uppercase tracking-wider">Total de Matrículas</p>
              <div className="text-2xl font-black text-navy mt-1 font-mono">{total_records.toLocaleString('pt-BR')}</div>
              <p className="text-[11px] text-gray-5 mt-1 font-semibold">
                👤 <span className="font-bold text-navy">{total_alunos_unicos}</span> alunos únicos · 📚 <span className="font-bold text-navy">{total_disciplinas}</span> disciplinas
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-navy/5 flex items-center justify-center text-navy shrink-0">
              <Users className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Média de Progresso */}
        <Card className="border-t-4 border-green-brand shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-gray-4 uppercase tracking-wider">Média de Progresso</p>
              <div className="text-2xl font-black text-green-dark mt-1 font-mono">{average_progress}%</div>
              <div className="w-28 bg-gray-2 h-1.5 rounded-full mt-2 overflow-hidden">
                <div className="bg-green-brand h-full rounded-full transition-all" style={{ width: `${Math.min(100, average_progress)}%` }} />
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-green-dark shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Média de Notas */}
        <Card className="border-t-4 border-blue-500 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-gray-4 uppercase tracking-wider">Média Geral de Notas</p>
              <div className="text-2xl font-black text-blue-700 mt-1 font-mono">
                {average_grade > 10 ? (average_grade / 10).toFixed(1) : average_grade}
                <span className="text-xs text-gray-4 font-sans font-normal ml-1">/ 10</span>
              </div>
              <p className="text-[11px] text-blue-600 mt-1 font-semibold">
                Status acadêmico ponderado
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
              <Award className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Alertas de Risco Pedagógico */}
        <Card className="border-t-4 border-amber-500 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-gray-4 uppercase tracking-wider">Atenção Pedagógica</p>
              <div className="text-2xl font-black text-amber-600 mt-1 font-mono">{below_approval}</div>
              <p className="text-[11px] text-gray-5 mt-1 font-semibold">
                ⚠️ <span className="font-bold text-amber-700">{percentBelowApproval}%</span> abaixo da média · 🚫 <span className="font-bold text-red-600">{no_access_count}</span> sem acesso
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </CardContent>
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
