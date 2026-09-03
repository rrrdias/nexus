import { auth } from "@/auth"
import { TopbarBreadcrumbs } from "./TopbarBreadcrumbs"
import { TopbarUserMenu } from "./TopbarUserMenu"

export async function Topbar() {
  const session = await auth()
  
  const initials = session?.user?.name
    ? session.user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()
    : 'NX'

  const userGroup = (session?.user?.groups ?? [])[0] || 'Usuário'

  return (
    <header className="h-16 shrink-0 bg-white border-b border-slate-200/80 flex items-center justify-between px-6 shadow-2xs select-none z-20">
      <div className="flex items-center gap-4">
        <TopbarBreadcrumbs />
      </div>

      <div className="flex items-center gap-4">
        {session?.user && (
          <TopbarUserMenu 
            session={session} 
            initials={initials} 
            userGroup={userGroup} 
          />
        )}
      </div>
    </header>
  )
}
