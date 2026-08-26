import { auth, signOut } from "@/auth"
import { SidebarClient } from "./SidebarClient"
import { getSidebarModules } from "@/app/actions/system"
import { redirect } from "next/navigation"

export async function Sidebar() {
  const session = await auth()
  
  let modules: any[] = []
  if (session?.user?.id) {
    try {
      modules = await getSidebarModules()
    } catch (e) {
      if (
        e instanceof Error &&
        (e.message === "NEXT_REDIRECT" || String((e as any).digest || "").startsWith("NEXT_REDIRECT"))
      ) {
        throw e
      }
      if (e instanceof Error && (e.message === "Unauthorized" || e.message === "Acesso negado.")) {
        await signOut({ redirectTo: "/nexus/login" })
      }
      console.error(e)
    }
  }

  const initials = session?.user?.name
    ? session.user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()
    : '??'

  const basePath = process.env.NEXT_BASE_PATH || ""

  return (
    <SidebarClient 
      session={session} 
      modules={modules} 
      initials={initials} 
      basePath={basePath}
    />
  )
}
