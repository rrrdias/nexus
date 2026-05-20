import { getProgressData } from "@/app/actions/ava-reports"
import { DashboardProgresso } from "@/components/ava-reports/DashboardProgresso"

export default async function ProgressoEaDPage(props: { searchParams: Promise<any> }) {
  const searchParams = await props.searchParams
  const page = parseInt(searchParams.page) || 1
  const size = parseInt(searchParams.size) || 100
  
  // O legado de EaD usava "ead" como sourceInstitution, vamos assumir padrão ou vazio
  const metrics = await getProgressData(page, size, { ...searchParams, sourceInstitution: 'ead' })

  return <DashboardProgresso title="Progresso dos Alunos - Graduação EaD" metrics={metrics} institution="ead" />
}
