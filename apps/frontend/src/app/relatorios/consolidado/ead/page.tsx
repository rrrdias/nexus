import { getConsolidatedAvaData } from "@/app/actions/ava-reports"
import { ConsolidatedEadDashboard } from "./ConsolidatedEadDashboard"

export default async function ConsolidatedEadPage(props: { searchParams: Promise<any> }) {
  const searchParams = await props.searchParams
  const page = parseInt(searchParams.page) || 1
  const size = parseInt(searchParams.size) || 15
  
  let reportData = null
  try {
    reportData = await getConsolidatedAvaData(page, size, { ...searchParams, sourceInstitution: 'ead' })
  } catch (error) {
    console.error("Erro ao carregar dados consolidados EaD:", error)
  }

  return (
    <ConsolidatedEadDashboard 
      reportData={reportData} 
      filters={searchParams} 
    />
  )
}
