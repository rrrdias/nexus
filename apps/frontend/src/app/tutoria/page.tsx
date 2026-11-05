import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getSidebarModules } from "@/app/actions/system"
import { TutoriaDashboard } from "./TutoriaDashboard"

export const metadata = {
  title: "Tutoria & Engajamento | Nexus Core",
  description: "Monitoramento inteligente de engajamento discente, prevenção de evasão e planos de intervenção pedagógica.",
}

export default async function TutoriaPage() {
  const session = await auth()
  if (!session?.user) {
    redirect("/login")
  }

  const isSuperAdmin = !!(session.user as any)?.isSuperAdmin
  if (!isSuperAdmin) {
    const modules = await getSidebarModules().catch(() => [])
    const hasAccess = modules.some(
      (m: any) => m.slug === "tutoria" || m.code === "tutoria" || m.name === "Tutoria"
    )
    if (!hasAccess) {
      redirect("/")
    }
  }

  return (
    <div className="space-y-6">
      <TutoriaDashboard sessionUser={session.user} />
    </div>
  )
}
