import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getLocals } from "@/app/actions/scheduling"
import { getSidebarModules } from "@/app/actions/system"
import { LocalsManagement } from "./LocalsManagement"

export default async function AdminLocalsPage() {
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

  const locals = await getLocals({ todos: true })

  return (
    <div className="space-y-6">
      <LocalsManagement initialLocals={locals} />
    </div>
  )
}
