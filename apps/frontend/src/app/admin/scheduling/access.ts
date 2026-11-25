import { redirect } from "next/navigation"
import { getSidebarModules } from "@/app/actions/system"

/**
 * Checks whether the resolved module list grants access to Backoffice / Scheduling.
 */
export function hasSchedulingModuleAccess(modules: any[]): boolean {
  return (Array.isArray(modules) ? modules : []).some(
    (m: any) =>
      m?.slug === "backoffice" ||
      m?.slug === "scheduling" ||
      m?.code === "backoffice" ||
      m?.code === "scheduling" ||
      m?.name === "Backoffice Agendamentos"
  )
}

/**
 * Server guard shared across Backoffice Scheduling routes.
 */
export async function requireSchedulingAccess(session: any): Promise<void> {
  if (!session?.user) {
    redirect("/login")
  }

  const isSuperAdmin = !!(session.user as any)?.isSuperAdmin
  if (isSuperAdmin) return

  const modules = await getSidebarModules().catch(() => [])
  if (!hasSchedulingModuleAccess(modules)) {
    redirect("/")
  }
}
