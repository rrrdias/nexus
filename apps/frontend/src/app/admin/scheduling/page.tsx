import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getLocals, getBookings, getPeriods } from "@/app/actions/scheduling"
import { getSidebarModules } from "@/app/actions/system"
import { SchedulingDashboard } from "./SchedulingDashboard"

export default async function AdminSchedulingPage({
  searchParams,
}: {
  searchParams: Promise<any>
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const isSuperAdmin = !!(session.user as any)?.isSuperAdmin
  if (!isSuperAdmin) {
    const modules = await getSidebarModules().catch(() => [])
    const hasAccess = modules.some(
      (m: any) => m.code === "scheduling" || m.code === "backoffice"
    )
    if (!hasAccess) {
      redirect("/nexus")
    }
  }

  const filters = await searchParams
  const [locals, periods] = await Promise.all([
    getLocals(),
    getPeriods(),
  ])

  const defaultPeriod = periods[0] || "2026-1"
  const selectedPeriod = filters.periodo || defaultPeriod

  const initialBookings = await getBookings({
    matricula: filters.matricula,
    localId: filters.localId === "all" ? undefined : filters.localId,
    periodo: selectedPeriod,
    data: filters.data,
    status: filters.status === "all" ? undefined : filters.status,
    page: filters.page ? parseInt(filters.page) : 1,
    size: 15,
  })

  return (
    <div className="space-y-6">
      <SchedulingDashboard
        locals={locals}
        initialBookings={initialBookings}
        availablePeriods={periods}
        defaultPeriod={defaultPeriod}
      />
    </div>
  )
}
