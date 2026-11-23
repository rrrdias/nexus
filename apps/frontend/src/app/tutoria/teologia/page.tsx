import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getSidebarModules } from "@/app/actions/system"
import { TutoriaDashboard } from "../TutoriaDashboard"

export const metadata = {
  title: "Tutoria — Teologia | Nexus Core",
  description: "Acompanhamento dedicado aos estudantes do grupo de Teologia (diagnóstico AVA e notas por fase).",
}

export default async function TutoriaTeologiaPage() {
  let session = null
  try {
    session = await auth()
  } catch (err) {
    console.error("[TutoriaTeologiaPage] Erro ao obter sessão:", err)
  }

  if (!session?.user) {
    redirect("/login")
  }

  const isSuperAdmin = !!(session.user as any)?.isSuperAdmin
  let canAccessGeral = isSuperAdmin
  if (!isSuperAdmin) {
    const modules = await getSidebarModules().catch(() => [])
    const hasTeologia = modules.some((m: any) => m.slug === "tutoria-teologia")
    const hasGeral = modules.some(
      (m: any) => m.slug === "tutoria" || m.code === "tutoria" || m.name === "Tutoria"
    )
    canAccessGeral = hasGeral
    if (!hasTeologia) {
      if (hasGeral) {
        redirect("/tutoria")
      }
      redirect("/")
    }
  }

  const safeSessionUser = {
    id: String(session.user.id || ""),
    name: String(session.user.name || ""),
    email: String(session.user.email || ""),
    isSuperAdmin,
  }

  return (
    <div className="space-y-6">
      <TutoriaDashboard
        sessionUser={safeSessionUser}
        variant="teologia"
        canAccessGeral={canAccessGeral}
        canAccessTeologia={true}
      />
    </div>
  )
}
