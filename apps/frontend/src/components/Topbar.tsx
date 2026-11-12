import { auth } from "@/auth"
import { TopbarBreadcrumbs } from "./TopbarBreadcrumbs"
import { TopbarUserMenu } from "./TopbarUserMenu"

export async function Topbar() {
  let session: any = null
  try {
    session = await auth()
  } catch (error) {
    console.error("[Topbar] Erro ao recuperar sessão:", error)
  }

  const rawName = typeof session?.user?.name === "string" ? session.user.name.trim() : ""
  const initials = rawName
    ? rawName
        .split(/\s+/)
        .filter(Boolean)
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "NX"

  const userGroup = Array.isArray(session?.user?.groups) && session.user.groups.length > 0
    ? String(session.user.groups[0])
    : "Usuário"

  const safeSession = session?.user
    ? {
        user: {
          name: rawName || "Usuário",
          email: typeof session.user.email === "string" ? session.user.email : "",
        },
      }
    : null

  return (
    <header className="h-16 shrink-0 bg-white border-b border-slate-200/80 flex items-center justify-between px-6 shadow-2xs select-none z-20">
      <div className="flex items-center gap-4">
        <TopbarBreadcrumbs />
      </div>

      <div className="flex items-center gap-4">
        {safeSession && (
          <TopbarUserMenu 
            session={safeSession} 
            initials={initials || "NX"} 
            userGroup={userGroup} 
          />
        )}
      </div>
    </header>
  )
}

