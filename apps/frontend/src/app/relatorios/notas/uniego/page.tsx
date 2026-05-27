import { getGradesData } from "@/app/actions/ava-reports"
import { DashboardNotas } from "@/components/ava-reports/DashboardNotas"

export default async function NotasUniegoPage(props: { searchParams: Promise<any> }) {
  const searchParams = await props.searchParams
  const page = parseInt(searchParams.page) || 1
  const size = parseInt(searchParams.size) || 30
  
  const metrics = await getGradesData(page, size, { ...searchParams, sourceInstitution: 'uniego' })

  return <DashboardNotas title="Notas dos Alunos - Disciplinas Online (UNIEGO)" metrics={metrics} institution="uniego" />
}
