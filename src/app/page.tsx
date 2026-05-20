import { auth } from "@/auth"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CalendarCheck, Users, Activity, FileStack, AlertCircle } from "lucide-react"

export default async function DashboardPage() {
  const session = await auth()

  const stats = [
    { label: 'Colaboradores', value: '248', trend: '+4 este mês', icon: Users, color: 'text-green-dark', bg: 'bg-[#E6FAF0]', border: 'border-green-dark' },
    { label: 'Solicitações', value: '31', trend: '7 pendentes', icon: Activity, color: 'text-[#F39C12]', bg: 'bg-[#F39C12]/10', border: 'border-[#F39C12]' },
    { label: 'Disciplinas', value: '1.204', trend: 'Atualizado hoje', icon: FileStack, color: 'text-[#1976D2]', bg: 'bg-[#1976D2]/10', border: 'border-[#1976D2]' },
    { label: 'Chamados', value: '12', trend: '3 críticos', icon: AlertCircle, color: 'text-[#E53935]', bg: 'bg-[#E53935]/10', border: 'border-[#E53935]' },
  ]

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-2xl font-extrabold text-navy tracking-tight">
          Bom dia, {session?.user?.name?.split(' ')[0] || 'Usuário'}!
        </h1>
        <p className="text-[#5F6775] text-sm mt-1">Bem-vindo ao novo painel corporativo.</p>
      </div>

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
              <div className="text-2xl font-extrabold text-navy font-mono">{stat.value}</div>
              <p className={`text-xs mt-2 font-semibold px-2 py-0.5 rounded-full inline-block ${stat.bg} ${stat.color}`}>
                {stat.trend}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader className="bg-[#F4F5F7] border-b flex flex-row items-center justify-between py-4">
            <CardTitle className="text-base font-extrabold text-navy flex items-center gap-2">
              <CalendarCheck className="w-5 h-5 text-green-dark" /> Agendamentos Recentes
            </CardTitle>
            <button className="text-xs text-green-dark font-bold hover:underline">Ver todos</button>
          </CardHeader>
          <CardContent className="p-8 text-center text-[#9AA0AC] italic text-sm">
            Nenhum agendamento pendente para hoje.
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="bg-[#F4F5F7] border-b py-4">
            <CardTitle className="text-base font-extrabold text-navy">Teste de Componentes</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="default" className="bg-green-dark hover:bg-green-brand text-white">Concluído</Badge>
              <Badge variant="destructive" className="bg-[#E53935] text-white">Ausente</Badge>
              <Badge variant="outline" className="border-[#1976D2] text-[#1976D2]">Aguardando</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
