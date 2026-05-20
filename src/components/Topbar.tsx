import { auth } from "@/auth"
import { Search, ChevronRight } from "lucide-react"

export async function Topbar() {
  const session = await auth()
  
  const initials = session?.user?.name
    ? session.user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()
    : 'NX'

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 shadow-sm">
      <div className="flex items-center gap-4">
        <h2 className="text-gray-500 font-medium text-sm flex items-center gap-2">
          Dashboard <ChevronRight className="w-3 h-3" /> <span className="text-slate-900 font-bold">Início</span>
        </h2>
      </div>

      <div className="flex items-center gap-6">
        <div className="hidden md:flex items-center bg-gray-100 px-3 py-1.5 rounded-md border border-gray-200">
          <Search className="w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Buscar no Nexus..." className="bg-transparent border-none text-xs focus:outline-none focus:ring-0 text-gray-600 ml-2 w-48" />
        </div>

        {session?.user && (
          <div className="flex items-center gap-3 border-l pl-6 border-gray-200">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-[#1A1D23] leading-none">
                {session.user.name}
              </p>
              <p className="text-[10px] text-green-dark font-bold uppercase tracking-tighter mt-1">
                {/* @ts-ignore */}
                {session.user.groups?.length > 0 ? session.user.groups[0] : 'Colaborador'}
              </p>
            </div>
            <div className="w-10 h-10 rounded-full bg-navy text-white flex items-center justify-center font-bold text-sm shadow-inner">
              {initials}
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
