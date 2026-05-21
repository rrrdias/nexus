import { auth } from "@/auth"
import { Search, ChevronRight } from "lucide-react"

export async function Topbar() {
  const session = await auth()
  
  const initials = session?.user?.name
    ? session.user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()
    : 'NX'

  return (
    <header className="h-16 shrink-0 bg-white border-b border-gray-2 flex items-center justify-between px-6 shadow-sm">
      <div className="flex items-center gap-4">
        <h2 className="text-gray-3 font-medium text-sm flex items-center gap-2">
          Dashboard <ChevronRight className="w-3 h-3" /> <span className="text-gray-9 font-bold">Início</span>
        </h2>
      </div>

      <div className="flex items-center gap-6">
        <div className="hidden md:flex items-center bg-gray-1 px-3 py-1.5 rounded-md border border-gray-2">
          <Search className="w-4 h-4 text-gray-3" />
          <input type="text" placeholder="Buscar no Nexus..." className="bg-transparent border-none text-[11px] focus:outline-none focus:ring-0 text-gray-4 ml-2 w-48" />
        </div>

        {session?.user && (
          <div className="flex items-center gap-3 border-l pl-4 border-gray-2">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-gray-9 leading-none">
                {session.user.name}
              </p>
              <p className="text-[10px] text-green-dark font-bold uppercase tracking-tighter mt-1">
                {/* @ts-ignore */}
                {session.user.groups?.length > 0 ? session.user.groups[0] : 'Colaborador'}
              </p>
            </div>
            <div className="w-7 h-7 rounded-full bg-navy text-white flex items-center justify-center font-bold text-[10px] shadow-inner">
              {initials}
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
