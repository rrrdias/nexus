import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getLocals, getBookings } from "@/app/actions/scheduling"
import { SchedulingDashboard } from "./SchedulingDashboard"

export default async function AdminSchedulingPage({ searchParams }: { searchParams: Promise<any> }) {
  const session = await auth()
  // @ts-ignore
  if (!session?.user) redirect("/login")

  const filters = await searchParams
  const locals = await getLocals()
  
  const initialBookings = await getBookings({
    matricula: filters.matricula,
    localId: filters.localId === 'all' ? undefined : filters.localId,
    periodo: filters.periodo || '2026-1',
    data: filters.data,
    status: filters.status === 'all' ? undefined : filters.status,
    page: filters.page ? parseInt(filters.page) : 1,
    size: 15
  })

  return (
    <div className="space-y-6">
      <SchedulingDashboard locals={locals} initialBookings={initialBookings} />
    </div>
  )
}
