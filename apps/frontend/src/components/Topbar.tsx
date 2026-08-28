import { auth } from "@/auth"
import { TopbarBreadcrumbs } from "./TopbarBreadcrumbs"

export async function Topbar() {
  const session = await auth()
  
  const initials = session?.user?.name
    ? session.user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()
    : 'NX'

  const userGroup = (session?.user?.groups ?? [])[0] || 'Usuário'

  return (
    <header className="h-16 shrink-0 bg-white border-b border-gray-2 flex items-center justify-between px-6 shadow-sm select-none">
      <div className="flex items-center gap-4">
        <TopbarBreadcrumbs />
      </div>

      <div className="flex items-center gap-4">
        {session?.user && (
          <div className="flex items-center gap-3">
            <div 
              className="w-8 h-8 rounded-full bg-navy text-white flex items-center justify-center font-bold text-xs shadow-sm border border-navy/10 hover:ring-2 hover:ring-green-brand/50 transition-all cursor-default"
              title={`${session.user.name} (${userGroup})`}
            >
              {initials}
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
