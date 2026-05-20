import Link from "next/link"
import { auth, signOut } from "@/auth"
import { db } from "@/db"
import { usersSystemAccess, systemModules, userGroups, groupSystemAccess } from "@/db/schema"
import { eq, inArray } from "drizzle-orm"
import { LayoutDashboard, Box, LogOut, ShieldCheck, Users } from "lucide-react"
import { Button } from "@/components/ui/button"

export async function Sidebar() {
  const session = await auth()
  
  let modules: any[] = []
  if (session?.user?.id) {
    const userGroupRecords = await db.select({ groupId: userGroups.groupId })
      .from(userGroups)
      .where(eq(userGroups.userId, session.user.id))
    const groupIds = userGroupRecords.map(g => g.groupId)

    const directAccess = await db.select({ module: systemModules })
      .from(usersSystemAccess)
      .innerJoin(systemModules, eq(usersSystemAccess.systemModuleId, systemModules.id))
      .where(eq(usersSystemAccess.userId, session.user.id))

    let groupAccess: any[] = []
    if (groupIds.length > 0) {
      groupAccess = await db.select({ module: systemModules })
        .from(groupSystemAccess)
        .innerJoin(systemModules, eq(groupSystemAccess.systemModuleId, systemModules.id))
        .where(inArray(groupSystemAccess.groupId, groupIds))
    }

    const allModules = [...directAccess.map(a => a.module), ...groupAccess.map(a => a.module)]
    // Remove duplicatas
    modules = Array.from(new Map(allModules.map(m => [m.id, m])).values())
  }

  const initials = session?.user?.name
    ? session.user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()
    : '??'

  return (
    <aside className="w-64 bg-navy flex flex-col h-full shadow-2xl z-30">
      <div className="p-6 flex items-center gap-3 border-b border-white/10">
        <div className="w-8 h-8 rounded-md bg-green-brand flex items-center justify-center shrink-0">
          <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
            <circle cx="8.5" cy="8.5" r="3" fill="#1C2B4A" opacity=".9"/>
            <circle cx="2.5" cy="2.5" r="1.5" fill="#1C2B4A" opacity=".55"/>
            <circle cx="14.5" cy="2.5" r="1.5" fill="#1C2B4A" opacity=".55"/>
            <circle cx="2.5" cy="14.5" r="1.5" fill="#1C2B4A" opacity=".55"/>
            <circle cx="14.5" cy="14.5" r="1.5" fill="#1C2B4A" opacity=".55"/>
            <line x1="5.5" y1="5.5" x2="2.5" y2="2.5" stroke="#1C2B4A" strokeWidth="1.2" opacity=".4"/>
            <line x1="11.5" y1="5.5" x2="14.5" y2="2.5" stroke="#1C2B4A" strokeWidth="1.2" opacity=".4"/>
            <line x1="5.5" y1="11.5" x2="2.5" y2="14.5" stroke="#1C2B4A" strokeWidth="1.2" opacity=".4"/>
            <line x1="11.5" y1="11.5" x2="14.5" y2="14.5" stroke="#1C2B4A" strokeWidth="1.2" opacity=".4"/>
          </svg>
        </div>
        <div>
          <h1 className="text-white font-extrabold text-[15px] tracking-tight">Nexus<span className="text-green-brand font-normal">Hub</span></h1>
          <p className="text-[8px] font-semibold text-white/35 uppercase tracking-widest font-mono">NEXUS APPLICATION</p>
        </div>
      </div>

      {session?.user && (
        <div className="p-4 mx-4 mt-4 bg-slate-800 rounded-lg flex items-center gap-3 border border-slate-700">
          <div className="w-10 h-10 rounded-full bg-white text-slate-900 flex items-center justify-center font-bold text-sm shrink-0">
            {initials}
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="text-white text-sm font-medium tracking-tight truncate">{session.user.name}</span>
            <span className="text-green-400 text-[10px] font-bold uppercase tracking-wider mt-0.5 truncate">
              {/* @ts-ignore */}
              {session.user.groups?.length > 0 ? session.user.groups.join(', ') : 'Sem Grupo'}
            </span>
          </div>
        </div>
      )}

      <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
        <div className="text-[9px] font-bold text-white/30 uppercase tracking-widest px-3 mb-2 mt-4">Módulos</div>

        <Link href="/" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/50 hover:bg-navy-light hover:text-white transition-colors">
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[12px] font-medium">Dashboard</span>
        </Link>

        {modules.map((sys) => {
          if (sys.name === 'AVA Reports') {
            return (
              <details key={sys.id} className="group">
                <summary className="flex items-center justify-between px-3 py-2.5 rounded-lg text-white/50 hover:bg-navy-light hover:text-white transition-colors cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                  <div className="flex items-center gap-3">
                    <Box className="w-5 h-5" />
                    <span className="text-[12px] font-medium">{sys.name}</span>
                  </div>
                  <svg className="w-4 h-4 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="pl-11 pr-3 py-2 space-y-2 relative before:content-[''] before:absolute before:left-5 before:top-0 before:bottom-2 before:w-[1px] before:bg-white/10">
                  <Link href="/relatorios/progresso" className="block text-[11px] text-white/40 hover:text-white py-1 transition-colors">Progresso EaD</Link>
                  <Link href="/relatorios/progresso/uni" className="block text-[11px] text-white/40 hover:text-white py-1 transition-colors">Progresso Disciplinas Online Uni</Link>
                  <Link href="/relatorios/progresso/uniego" className="block text-[11px] text-white/40 hover:text-white py-1 transition-colors">Progresso Disciplinas Online UNIEGO</Link>
                  <Link href="/relatorios/progresso/raizes" className="block text-[11px] text-white/40 hover:text-white py-1 transition-colors">Progresso Disciplinas Online Raizes</Link>
                  <Link href="/relatorios/progresso/eefn" className="block text-[11px] text-white/40 hover:text-white py-1 transition-colors">Progresso Disciplinas Online EEFN</Link>
                </div>
              </details>
            )
          }

          return (
            <Link key={sys.id} href={sys.pathUrl} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/50 hover:bg-navy-light hover:text-white transition-colors">
              <Box className="w-5 h-5" />
              <span className="text-[12px] font-medium">{sys.name}</span>
            </Link>
          )
        })}

        {/* @ts-ignore */}
        {session?.user?.isSuperAdmin && (
          <>
            <div className="text-[9px] font-bold text-white/30 uppercase tracking-widest px-3 mb-2 mt-6">Administração</div>
            <Link href="/admin/users" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/50 hover:bg-navy-light hover:text-white transition-colors">
              <Users className="w-5 h-5" />
              <span className="text-[12px] font-medium">Usuários e Acessos</span>
            </Link>
            <Link href="/admin/groups" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/50 hover:bg-navy-light hover:text-white transition-colors">
              <ShieldCheck className="w-5 h-5" />
              <span className="text-[12px] font-medium">Grupos e Permissões</span>
            </Link>
          </>
        )}
      </nav>

      <div className="p-4 border-t border-white/10">
        <form action={async () => {
          "use server"
          await signOut({ redirectTo: "/login" })
        }}>
          <Button variant="ghost" type="submit" className="w-full justify-start text-white/50 hover:text-white hover:bg-navy-light">
            <LogOut className="w-4 h-4 mr-2" />
            Sair do sistema
          </Button>
        </form>
      </div>
    </aside>
  )
}
