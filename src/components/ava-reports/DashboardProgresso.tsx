"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Users, AlertCircle, AlertTriangle, BookOpen, Clock, PlayCircle, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ProgressoTable } from "./ProgressoTable"
import { ProgressoActions } from "./ProgressoActions"
import { ProgressoFilters } from "./ProgressoFilters"

type PhaseMetrics = {
  average_fase1: number, status_fase1: string, f1_below: number, f1_crit: number,
  average_fase2: number, status_fase2: string, f2_below: number, f2_crit: number,
  average_fase3: number, status_fase3: string, f3_below: number, f3_crit: number,
}

export function DashboardProgresso({ title, metrics, institution }: { title: string, metrics: any, institution?: string }) {
  const [showFilters, setShowFilters] = useState(false)

  const getBadgeVariant = (status: string) => {
    if (status === 'success') return 'bg-green-brand text-navy hover:bg-green-dark'
    if (status === 'danger') return 'bg-red-500 text-white hover:bg-red-600'
    if (status === 'warning') return 'bg-amber-500 text-white hover:bg-amber-600'
    return 'bg-gray-200 text-gray-700 hover:bg-gray-300'
  }

  const PhaseItem = ({ label, avg, status }: { label: string, avg: number, status: string }) => (
    <div className="flex items-center justify-between text-xs font-semibold py-1">
      <div className="flex items-center gap-2">
        <PlayCircle className="w-3 h-3 text-[#9AA0AC]" />
        <span className="text-[#5F6775]">{label}</span>
      </div>
      <Badge className={`px-2 py-0 ${getBadgeVariant(status)}`}>{avg}%</Badge>
    </div>
  )

  const stats = [
    { 
      label: 'Progresso Médio', 
      value: `${metrics.average_progress}%`, 
      icon: ActivityIcon, 
      color: 'text-[#1976D2]', bg: 'bg-[#1976D2]/10', border: 'border-[#1976D2]',
      fases: [
        { label: 'Fase 1', avg: metrics.average_fase1, status: metrics.status_fase1 },
        { label: 'Fase 2', avg: metrics.average_fase2, status: metrics.status_fase2 },
        { label: 'Fase 3', avg: metrics.average_fase3, status: metrics.status_fase3 },
      ]
    },
    { 
      label: 'Abaixo do Esperado', 
      value: `${metrics.average_below_expected}%`, 
      icon: AlertTriangle, 
      color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500',
      fases: null,
      customContent: (
        <div className="mt-2 text-xs font-semibold text-[#5F6775]">
          <span className="text-amber-600 font-bold">{metrics.below_expected}</span> matrículas críticas.
        </div>
      )
    },
    { 
      label: 'Progresso Crítico', 
      value: metrics.critical_disciplines, 
      icon: AlertCircle, 
      color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500',
      fases: null,
      customContent: (
        <div className="mt-2 text-xs font-semibold text-[#5F6775]">
          De um total de <span className="font-bold">{metrics.total_disciplines}</span> disciplinas.
        </div>
      )
    },
    { 
      label: 'Sem Acesso (AVA)', 
      value: metrics.count_mat_sem_acesso, 
      icon: Clock, 
      color: 'text-navy', bg: 'bg-navy/10', border: 'border-navy',
      fases: null,
      customContent: (
        <div className="mt-2 text-xs font-semibold text-[#5F6775]">
          Representa <span className="font-bold">{metrics.percent_mat_sem_acesso.toFixed(1)}%</span> do total.
        </div>
      )
    },
  ]

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 p-6">
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
            className={showFilters ? "bg-navy text-white" : "text-navy border-navy/20"}
          >
            <Filter className="w-4 h-4 mr-2" />
            Filtros
          </Button>
          <ProgressoActions data={metrics.data} institution={institution} />
        </div>
      </div>

      {showFilters && <ProgressoFilters />}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <Card key={stat.label} className={`border-t-4 shadow-sm ${stat.border}`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-semibold text-[#9AA0AC] uppercase tracking-wider">
                {stat.label}
              </CardTitle>
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold text-navy font-mono">{stat.value}</div>
              
              {stat.fases && (
                <div className="mt-4 pt-3 border-t border-gray-100 flex flex-col gap-1">
                  {stat.fases.map((f, i) => <PhaseItem key={i} {...f} />)}
                </div>
              )}

              {stat.customContent}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-sm">
        <CardHeader className="bg-[#F4F5F7] border-b flex flex-row items-center justify-between py-4">
          <CardTitle className="text-base font-extrabold text-navy flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-green-dark" /> Alunos Analisados
          </CardTitle>
          <div className="text-[11px] font-bold text-[#9AA0AC] uppercase tracking-widest">
            Total: {metrics.total_records} registros
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ProgressoTable data={metrics.data} />
        </CardContent>
      </Card>
    </div>
  )
}

function ActivityIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  )
}
