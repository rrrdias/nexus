import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getSidebarModules } from "@/app/actions/system"
import { TutoriaDashboard } from "./TutoriaDashboard"

export const metadata = {
  title: "Tutoria & Engajamento | Nexus Core",
  description: "Monitoramento inteligente de engajamento discente, prevenção de evasão e planos de intervenção pedagógica.",
}

export default async function TutoriaPage() {
  let session = null
  try {
    session = await auth()
  } catch (err) {
    console.error("[TutoriaPage] Erro ao obter sessão:", err)
  }

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

  const safeSessionUser = {
    id: String(session.user.id || ""),
    name: String(session.user.name || ""),
    email: String(session.user.email || ""),
    isSuperAdmin: !!(session.user as any)?.isSuperAdmin,
  }

  return (
    <div className="space-y-6">
      <TutoriaDashboard sessionUser={safeSessionUser} />
    </div>
  )
}
