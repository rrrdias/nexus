import { auth } from "@/auth"
import { getAvaDashboardStats } from "@/app/actions/ava-reports"
import { DashboardAva } from "@/components/ava-reports/DashboardAva"

export default async function RelatoriosPage() {
  const session = await auth()
  
  let avaStats: any = null
  try {
    avaStats = await getAvaDashboardStats()
  } catch (err) {
    console.error("Error fetching ava stats in relatorios page:", err)
  }
  
  const data = avaStats || {
    totalStudents: 0,
    averageProgress: 0,
    averageGrade: 0,
    belowApprovalCount: 0,
    noAccessCount: 0,
    institutionsStats: [
      { id: 'ead', name: 'EAD', totalStudents: 0, averageProgress: 0, averageGrade: 0, belowApprovalCount: 0, noAccessCount: 0, lastSync: null, status: 'offline' },
      { id: 'eefn', name: 'EEFN', totalStudents: 0, averageProgress: 0, averageGrade: 0, belowApprovalCount: 0, noAccessCount: 0, lastSync: null, status: 'offline' },
      { id: 'raizes', name: 'RAÍZES', totalStudents: 0, averageProgress: 0, averageGrade: 0, belowApprovalCount: 0, noAccessCount: 0, lastSync: null, status: 'offline' },
      { id: 'uni', name: 'UNI', totalStudents: 0, averageProgress: 0, averageGrade: 0, belowApprovalCount: 0, noAccessCount: 0, lastSync: null, status: 'offline' },
      { id: 'uniego', name: 'UNIEGO', totalStudents: 0, averageProgress: 0, averageGrade: 0, belowApprovalCount: 0, noAccessCount: 0, lastSync: null, status: 'offline' },
    ]
  }
  
  const hour = Number(new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }))
  let greeting = 'Bom dia'
  if (hour >= 12 && hour < 18) {
    greeting = 'Boa tarde'
  } else if (hour >= 18 || hour < 6) {
    greeting = 'Boa noite'
  }
  
  return (
    <DashboardAva 
      data={data}
      session={session}
      greeting={greeting}
    />
  )
}
