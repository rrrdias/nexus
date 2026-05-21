import { getProgressData } from "@/app/actions/ava-reports"
import { DashboardProgresso } from "@/components/ava-reports/DashboardProgresso"

export default async function ProgressoEefnPage(props: { searchParams: Promise<any> }) {
  const searchParams = await props.searchParams
  const page = parseInt(searchParams.page) || 1
  const size = parseInt(searchParams.size) || 30
  
  const metrics = await getProgressData(page, size, { ...searchParams, sourceInstitution: 'eefn' })

  return <DashboardProgresso title="Progresso dos Alunos - Disciplinas Online EEFN" metrics={metrics} institution="eefn" />
}
