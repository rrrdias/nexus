import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getSidebarModules } from "@/app/actions/system"
import { TutoriaKanbanClient } from "./TutoriaKanbanClient"

export const metadata = {
  title: "Atendimentos Kanban | Tutoria Nexus Core",
  description: "Quadro Kanban de busca ativa e intervenções pedagógicas da tutoria.",
}

export default async function TutoriaKanbanPage() {
  let session = null
  try {
    session = await auth()
  } catch (err) {
    console.error("[TutoriaKanbanPage] Erro ao obter sessão:", err)
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
      <TutoriaKanbanClient sessionUser={safeSessionUser} />
    </div>
  )
}
