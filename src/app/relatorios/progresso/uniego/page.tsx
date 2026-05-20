import { getProgressData } from "@/app/actions/ava-reports"
import { DashboardProgresso } from "@/components/ava-reports/DashboardProgresso"

export default async function ProgressoUniegoPage(props: { searchParams: Promise<any> }) {
  const searchParams = await props.searchParams
  const page = parseInt(searchParams.page) || 1
  const size = parseInt(searchParams.size) || 100
  
  const metrics = await getProgressData(page, size, { ...searchParams, sourceInstitution: 'uniego' })

  return <DashboardProgresso title="Progresso das Disciplinas Online - UNIEGO" metrics={metrics} institution="uniego" />
}
