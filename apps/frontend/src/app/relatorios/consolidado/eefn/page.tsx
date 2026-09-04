import { getConsolidatedAvaData } from "@/app/actions/ava-reports"
import { ConsolidatedDashboard } from "@/components/ava-reports/ConsolidatedDashboard"

export default async function ConsolidatedEefnPage(props: { searchParams: Promise<any> }) {
  const searchParams = await props.searchParams
  const page = parseInt(searchParams.page) || 1
  const size = parseInt(searchParams.size) || 15
  
  let reportData = null
  try {
    reportData = await getConsolidatedAvaData(page, size, { ...searchParams, sourceInstitution: 'eefn' })
  } catch (error) {
    console.error("Erro ao carregar dados consolidados EEFN:", error)
  }

  return (
    <ConsolidatedDashboard 
      reportData={reportData} 
      filters={searchParams} 
      institution="eefn"
    />
  )
}
