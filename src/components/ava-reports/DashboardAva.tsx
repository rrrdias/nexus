"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  GraduationCap, 
  TrendingUp, 
  AlertTriangle, 
  Users, 
  Cpu, 
  ArrowUpRight, 
  Clock, 
  BookOpen, 
  Award,
  BookOpenCheck
} from "lucide-react"
import Link from "next/link"

function formatSyncTime(dateStr: string | null) {
  if (!dateStr) return 'Nunca sincronizado'
  try {
    const date = new Date(dateStr)
    return `Sincronizado em ${date.toLocaleDateString('pt-BR')} às ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
  } catch (e) {
    return 'Erro na data'
  }
}

export function DashboardAva({ data, session, greeting }: { data: any, session: any, greeting: string }) {
  const stats = [
    { 
      label: 'Alunos Monitorados', 
      value: data.totalStudents.toLocaleString('pt-BR'), 
      trend: 'Total unificado AVA', 
      icon: GraduationCap, 
      color: 'text-[#1976D2]', 
      bg: 'bg-blue-50 text-blue-700', 
      border: 'border-[#1976D2]' 
    },
    { 
      label: 'Progresso Médio', 
      value: `${data.averageProgress}%`, 
      trend: 'Média de conclusão de cursos', 
      icon: TrendingUp, 
      color: 'text-[#27AE60]', 
      bg: 'bg-green-50 text-green-700', 
      border: 'border-[#27AE60]' 
    },
    { 
      label: 'Nota Média Geral', 
      value: (data.averageGrade / 10).toFixed(1),
      trend: 'Desempenho acadêmico', 
      icon: Award, 
      color: 'text-amber-600', 
      bg: 'bg-amber-50 text-amber-700', 
      border: 'border-amber-500' 
    },
    { 
      label: 'Alunos em Risco', 
      value: (data.belowApprovalCount + data.noAccessCount).toLocaleString('pt-BR'), 
      trend: `${data.belowApprovalCount} críticos / ${data.noAccessCount} inativos`, 
      icon: AlertTriangle, 
      color: 'text-[#EF4444]', 
      bg: 'bg-red-50 text-red-700', 
      border: 'border-[#EF4444]' 
    },
  ]

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header com Status do Módulo */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-navy tracking-tight select-none">
            {greeting}, {session?.user?.name?.split(' ')[0] || 'Coordenador'}!
          </h1>
          <p className="text-[#5F6775] text-sm mt-1 flex items-center gap-2 select-none">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#27AE60] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#27AE60]"></span>
            </span>
            <span>Módulo AVA Reports ativo • Status de integrações Moodle operacionais</span>
          </p>
        </div>
      </div>

      {/* Grid de Métricas Acadêmicas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <Card key={stat.label} className={`border-t-4 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow select-none ${stat.border}`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider">
                {stat.label}
              </CardTitle>
              <stat.icon className={`w-4 h-4 ${stat.color} shrink-0`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black text-navy font-mono leading-none">{stat.value}</div>
              <p className={`text-[10px] mt-2 font-bold px-2 py-0.5 rounded-full inline-block ${stat.bg}`}>
                {stat.trend}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Grid Central de Ações & Saúde dos Sistemas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Coluna 1: Status de Integrações & Analytics Acadêmicos */}
        <Card className="lg:col-span-8 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="bg-[#F4F5F7] border-b flex flex-row items-center justify-between py-4">
            <CardTitle className="text-base font-extrabold text-navy flex items-center gap-2 select-none">
              <Cpu className="w-5 h-5 text-green-dark" /> Desempenho e Sincronização por Instituição
            </CardTitle>
            <Badge variant="outline" className="border-green-dark text-green-dark font-bold bg-green-50 select-none">
              5 Canais Conectados
            </Badge>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="divide-y divide-gray-100">
              {data.institutionsStats.map((inst: any) => (
                <div key={inst.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 first:pt-0 last:pb-0">
                  <div className="flex items-start gap-2.5">
                    <div className="relative flex h-3 w-3 shrink-0 mt-1">
                      {inst.status === 'success' ? (
                        <>
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#27AE60] opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-[#27AE60]"></span>
                        </>
                      ) : (
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                      )}
                    </div>
                    <div>
                      <span className="text-sm font-extrabold text-navy">{inst.name}</span>
                      <p className="text-[10px] text-[#9AA0AC] font-medium font-mono mt-0.5">
                        {formatSyncTime(inst.lastSync)}
                      </p>
                      <div className="flex flex-wrap items-center gap-3 mt-2 text-[10px] text-gray-500 font-bold">
                        <span className="bg-slate-50 px-2 py-0.5 rounded border border-slate-100">Alunos: {inst.totalStudents}</span>
                        <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded border border-green-100">Progresso: {inst.averageProgress}%</span>
                        <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-100">Média: {(inst.averageGrade / 10).toFixed(1)}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {inst.belowApprovalCount > 0 && (
                      <span className="text-[9px] font-bold bg-red-50 text-red-700 border border-red-100 px-2 py-0.5 rounded">
                        {inst.belowApprovalCount} críticos
                      </span>
                    )}
                    {inst.noAccessCount > 0 && (
                      <span className="text-[9px] font-bold bg-gray-50 text-gray-600 border border-gray-100 px-2 py-0.5 rounded">
                        {inst.noAccessCount} inativos
                      </span>
                    )}
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded shrink-0 ${
                      inst.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {inst.status === 'success' ? 'Conectado' : 'Offline'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Coluna 2: Atalhos e Ações Rápidas */}
        <Card className="lg:col-span-4 shadow-sm hover:shadow-md transition-shadow flex flex-col">
          <CardHeader className="bg-[#F4F5F7] border-b py-4">
            <CardTitle className="text-base font-extrabold text-navy flex items-center gap-2 select-none">
              <BookOpenCheck className="w-5 h-5 text-indigo-600" /> Ações Rápidas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 flex-1 flex flex-col justify-between gap-6">
            <p className="text-xs text-[#5F6775] leading-relaxed">
              Monitore o progresso dos alunos e a distribuição das notas por fases e cursos em tempo real para ações pedagógicas proativas.
            </p>
            
            <div className="space-y-3">
              <Link 
                href="/relatorios/progresso"
                className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Users className="w-4 h-4 text-[#1976D2]" />
                  <span className="text-xs font-bold text-navy group-hover:text-indigo-600 transition-colors">Relatório de Progresso</span>
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-[#9AA0AC] group-hover:text-indigo-600 transition-colors transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>

              <Link 
                href="/relatorios/notas"
                className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-green-200 hover:bg-green-50/20 transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <BookOpen className="w-4 h-4 text-[#27AE60]" />
                  <span className="text-xs font-bold text-navy group-hover:text-green-700 transition-colors">Relatório de Notas</span>
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-[#9AA0AC] group-hover:text-green-700 transition-colors transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            </div>

            <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 text-center">
              <span className="text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider block">Último Processamento Global</span>
              <span className="inline-flex items-center gap-1.5 mt-2 text-xs font-black text-[#27AE60]">
                <Clock className="w-3.5 h-3.5" /> Concluído há 10 min
              </span>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
