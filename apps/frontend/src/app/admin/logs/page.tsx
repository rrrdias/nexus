import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getAuditLogs, getAuditStats } from "@/app/actions/audit"
import { AuditFilters } from "./AuditFilters"
import { AuditPagination } from "./AuditPagination"
import { AuditLogDetailDialog } from "./AuditLogDetailDialog"
import { Badge } from "@/components/ui/badge"
import {
  ShieldAlert,
  LogIn,
  AlertTriangle,
  Activity,
  Users,
  CheckCircle2,
  XCircle,
  Laptop,
  Smartphone,
  Globe,
} from "lucide-react"

export const metadata = {
  title: "Logs de Auditoria | Nexus Core",
  description: "Histórico completo de acessos e ações dos usuários no sistema.",
}

// Helper para categorizar e colorir o badge de categoria
function getCategoryBadge(category: string) {
  switch (category) {
    case "AUTH":
      return <Badge className="bg-sky-50 text-sky-700 border-sky-200 text-[10px] font-bold">Autenticação</Badge>
    case "USERS":
      return <Badge className="bg-purple-50 text-purple-700 border-purple-200 text-[10px] font-bold">Usuários</Badge>
    case "GROUPS":
      return <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px] font-bold">Grupos</Badge>
    case "SCHEDULING":
      return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold">Agendamentos</Badge>
    case "AVA_SYNC":
      return <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] font-bold">Sincronização</Badge>
    default:
      return <Badge variant="outline" className="text-slate-600 border-slate-200 text-[10px] font-bold">Sistema</Badge>
  }
}

// Helper para traduzir o nome da ação para algo amigável
function getActionLabel(action: string) {
  const map: Record<string, string> = {
    LOGIN: "Login no Sistema",
    LOGIN_FAILED: "Falha de Login",
    LOGIN_BLOCKED: "Tentativa Bloqueada",
    USER_CREATED: "Criação de Usuário",
    USER_UPDATED: "Edição de Usuário",
    USER_DELETED: "Exclusão de Usuário",
    USER_STATUS_TOGGLED: "Status Alterado",
    GROUP_CREATED: "Criação de Grupo",
    GROUP_UPDATED: "Edição de Grupo",
    EXAM_BOOKING_CREATED: "Agendamento Criado",
    EXAM_BOOKING_CANCELLED: "Agendamento Cancelado",
  }
  return map[action] || action
}

// Helper para detectar navegador/dispositivo básico
function parseDevice(userAgent?: string) {
  if (!userAgent) return { label: "Desconhecido", isMobile: false }
  const ua = userAgent.toLowerCase()
  const isMobile = ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")

  let browser = "Navegador"
  if (ua.includes("edg/")) browser = "Edge"
  else if (ua.includes("chrome/")) browser = "Chrome"
  else if (ua.includes("firefox/")) browser = "Firefox"
  else if (ua.includes("safari/") && !ua.includes("chrome")) browser = "Safari"

  let os = ""
  if (ua.includes("windows")) os = "Windows"
  else if (ua.includes("macintosh") || ua.includes("mac os")) os = "macOS"
  else if (ua.includes("linux")) os = "Linux"
  else if (ua.includes("android")) os = "Android"
  else if (ua.includes("iphone") || ua.includes("ipad")) os = "iOS"

  return {
    label: `${browser}${os ? ` (${os})` : ""}`,
    isMobile,
  }
}

export default async function AdminLogsPage(props: { searchParams: Promise<any> }) {
  const session = await auth()
  if (!session?.user?.isSuperAdmin) redirect("/")

  const searchParams = await props.searchParams
  const page = parseInt(searchParams.page) || 1
  const size = parseInt(searchParams.size) || 20

  const [stats, logsResult] = await Promise.all([
    getAuditStats().catch(() => ({
      loginsToday: 0,
      loginsFailedToday: 0,
      actionsToday: 0,
      uniqueUsersToday: 0,
      totalLogsWeek: 0,
    })),
    getAuditLogs({
      page,
      size,
      search: searchParams.search,
      category: searchParams.category,
      status: searchParams.status,
      startDate: searchParams.startDate,
      endDate: searchParams.endDate,
    }).catch(() => ({
      page: 1,
      size: 20,
      total_records: 0,
      total_pages: 1,
      data: [],
    })),
  ])

  const logs = logsResult.data || []
  const totalRecords = logsResult.total_records || 0
  const totalPages = logsResult.total_pages || 1

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-navy tracking-tight flex items-center gap-2.5">
            <ShieldAlert className="w-6 h-6 text-green-dark" />
            Logs de Auditoria
          </h1>
          <p className="text-sm text-[#5F6775] mt-1">
            Rastreamento detalhado de acessos, autenticações e ações administrativas de usuários no sistema.
          </p>
        </div>
      </div>

      {/* Cards de Métricas em Destaque */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Logins Hoje */}
        <div className="bg-white p-4 rounded-xl border border-gray-2 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <LogIn className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Logins Hoje</span>
            <div className="text-2xl font-black text-navy font-mono">{stats.loginsToday}</div>
            <span className="text-[11px] text-slate-500">Sessões autenticadas</span>
          </div>
        </div>

        {/* Card 2: Falhas / Bloqueios */}
        <div className="bg-white p-4 rounded-xl border border-gray-2 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Falhas de Acesso</span>
            <div className="text-2xl font-black text-rose-600 font-mono">{stats.loginsFailedToday}</div>
            <span className="text-[11px] text-slate-500">Tentativas inválidas hoje</span>
          </div>
        </div>

        {/* Card 3: Ações Administrativas */}
        <div className="bg-white p-4 rounded-xl border border-gray-2 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Ações do Sistema</span>
            <div className="text-2xl font-black text-navy font-mono">{stats.actionsToday}</div>
            <span className="text-[11px] text-slate-500">Mutações e alterações</span>
          </div>
        </div>

        {/* Card 4: Usuários Únicos Ativos */}
        <div className="bg-white p-4 rounded-xl border border-gray-2 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Usuários Ativos</span>
            <div className="text-2xl font-black text-navy font-mono">{stats.uniqueUsersToday}</div>
            <span className="text-[11px] text-slate-500">Contas operando hoje</span>
          </div>
        </div>
      </div>

      {/* Barra de Filtros */}
      <AuditFilters />

      {/* Tabela de Logs de Auditoria */}
      <div className="bg-white rounded-xl border border-gray-2 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-gray-2 text-slate-400 font-bold uppercase text-[10px] tracking-wider select-none">
                <th className="px-5 py-3.5">Data & Hora</th>
                <th className="px-5 py-3.5">Usuário</th>
                <th className="px-5 py-3.5">Categoria</th>
                <th className="px-5 py-3.5">Ação Realizada</th>
                <th className="px-5 py-3.5 hidden md:table-cell">Origem / Dispositivo</th>
                <th className="px-5 py-3.5 text-center">Status</th>
                <th className="px-5 py-3.5 text-right">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400 italic">
                    Nenhum registro de auditoria encontrado com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                logs.map((log: any) => {
                  const logDate = log.timestamp ? new Date(log.timestamp) : new Date()
                  const device = parseDevice(log.userAgent)
                  const initials = log.userName
                    ? log.userName
                        .split(" ")
                        .map((n: string) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)
                    : "??"

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Data / Hora */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="font-semibold text-slate-800 text-xs">
                          {logDate.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                        </div>
                        <div className="font-mono text-[11px] text-slate-400">
                          {logDate.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                        </div>
                      </td>

                      {/* Usuário */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-navy text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                            {initials}
                          </div>
                          <div>
                            <div className="font-semibold text-navy text-xs leading-snug">
                              {log.userName || "Sistema / Anônimo"}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono leading-none">
                              {log.userEmail || "-"}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Categoria */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {getCategoryBadge(log.category)}
                      </td>

                      {/* Ação */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className="font-semibold text-slate-800 text-xs block">
                          {getActionLabel(log.action)}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">{log.action}</span>
                      </td>

                      {/* Origem / Dispositivo */}
                      <td className="px-5 py-3.5 hidden md:table-cell whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-slate-700 text-xs font-mono">
                          <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{log.ipAddress || "-"}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                          {device.isMobile ? (
                            <Smartphone className="w-3 h-3 text-slate-400 shrink-0" />
                          ) : (
                            <Laptop className="w-3 h-3 text-slate-400 shrink-0" />
                          )}
                          <span>{device.label}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3.5 text-center whitespace-nowrap">
                        {log.status === "SUCCESS" ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/60">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Sucesso
                          </span>
                        ) : log.status === "FAILURE" ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200/60">
                            <XCircle className="w-3 h-3 text-rose-600" /> Falha
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200/60">
                            <AlertTriangle className="w-3 h-3 text-amber-600" /> {log.status}
                          </span>
                        )}
                      </td>

                      {/* Detalhes */}
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <AuditLogDetailDialog log={log} />
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Paginação */}
      <AuditPagination
        currentPage={page}
        totalPages={totalPages}
        totalRecords={totalRecords}
        pageSize={size}
      />
    </div>
  )
}
