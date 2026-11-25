import { auth } from "@/auth"
import { getLocals } from "@/app/actions/scheduling"
import { requireSchedulingAccess } from "../access"
import { SlotsManagement } from "./SlotsManagement"

export default async function AdminSlotsPage() {
  const session = await auth()
  await requireSchedulingAccess(session)

  // Fetch only active locals to allow creating slots for active campus centers
  const locals = await getLocals()

  return (
    <div className="space-y-6">
      <SlotsManagement locals={locals} />
    </div>
  )
}
