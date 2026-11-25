import { auth } from "@/auth"
import { getLocals, getBookings, getPeriods } from "@/app/actions/scheduling"
import { requireSchedulingAccess } from "./access"
import { SchedulingDashboard } from "./SchedulingDashboard"

export default async function AdminSchedulingPage({
  searchParams,
}: {
  searchParams: Promise<any>
}) {
  const session = await auth()
  await requireSchedulingAccess(session)

  const filters = await searchParams
  const preferredPeriod =
    process.env.NEXT_PUBLIC_NEXUS_DEFAULT_PERIOD ||
    process.env.NEXUS_DEFAULT_PERIOD ||
    "2026-2"
  const selectedPeriod = filters.periodo || preferredPeriod

  const [locals, periods, initialBookings] = await Promise.all([
    getLocals(),
    getPeriods(),
    getBookings({
      matricula: filters.matricula,
      localId: filters.localId === "all" ? undefined : filters.localId,
      periodo: selectedPeriod,
      data: filters.data,
      status: filters.status === "all" ? undefined : filters.status,
      page: filters.page ? parseInt(filters.page) : 1,
      size: 15,
    }),
  ])

  const defaultPeriod = periods.includes(preferredPeriod)
    ? preferredPeriod
    : periods.includes("2026-2")
      ? "2026-2"
      : periods[0] || "2026-2"

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
