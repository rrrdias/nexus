import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getLocals } from "@/app/actions/scheduling"
import { getSidebarModules } from "@/app/actions/system"
import { SlotsManagement } from "./SlotsManagement"

export default async function AdminSlotsPage() {
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

  // Fetch only active locals to allow creating slots for active campus centers
  const locals = await getLocals()

  return (
    <div className="space-y-6">
      <SlotsManagement locals={locals} />
    </div>
  )
}
