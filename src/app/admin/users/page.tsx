import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { UserFormDialog } from "./UserFormDialog"
import { deleteUser, getUsers } from "@/app/actions/users"
import { getGroups } from "@/app/actions/groups"
import { getAllModules } from "@/app/actions/system"
import { ToggleUserButton } from "./ToggleUserButton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Pencil, Trash2, Plus } from "lucide-react"

export default async function AdminUsersPage() {
  const session = await auth()
  // @ts-ignore
  if (!session?.user?.isSuperAdmin) redirect("/")

  const usersWithDetails = await getUsers()
  const allGroups = await getGroups()
  const allModules = await getAllModules()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-navy tracking-tight">Usuários e Acessos</h1>
          <p className="text-sm text-[#5F6775] mt-1">Gerencie os usuários, seus grupos e sistemas disponíveis.</p>
        </div>
        <UserFormDialog allGroups={allGroups} allModules={allModules} mode="create">
          <Button className="bg-green-dark hover:bg-green-brand text-white gap-2">
            <Plus className="w-4 h-4" /> Novo Usuário
          </Button>
        </UserFormDialog>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#F4F5F7] border-b border-gray-200">
              <th className="text-left px-5 py-3 text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider">Usuário</th>
              <th className="text-left px-5 py-3 text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider hidden md:table-cell">Grupos</th>
              <th className="text-left px-5 py-3 text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider hidden lg:table-cell">Sistemas Avulsos</th>
              <th className="text-center px-5 py-3 text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider">Ativo</th>
              <th className="text-right px-5 py-3 text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {usersWithDetails.length === 0 && (
              <tr><td colSpan={5} className="text-center py-12 text-[#9AA0AC] italic">Nenhum usuário cadastrado.</td></tr>
            )}
            {usersWithDetails.map((u: any) => (
              <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-navy text-white flex items-center justify-center font-bold text-xs shrink-0">
                      {u.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || '??'}
                    </div>
                    <div>
                      <p className="font-semibold text-navy text-sm">{u.name}</p>
                      <p className="text-[11px] text-[#9AA0AC]">{u.email}</p>
                      {u.userid && <p className="text-[10px] font-mono text-[#9AA0AC]">{u.userid}</p>}
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5 hidden md:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {u.groups.length === 0
                      ? <span className="text-[11px] text-[#9AA0AC] italic">Sem grupo</span>
                      : u.groups.map((g: any) => <Badge key={g.id} variant="outline" className="text-[10px] border-navy text-navy">{g.name}</Badge>)
                    }
                  </div>
                </td>
                <td className="px-5 py-3.5 hidden lg:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {u.modules.length === 0
                      ? <span className="text-[11px] text-[#9AA0AC] italic">Nenhum</span>
                      : u.modules.map((m: any) => <Badge key={m.id} variant="outline" className="text-[10px] border-[#1976D2] text-[#1976D2]">{m.name}</Badge>)
                    }
                  </div>
                </td>
                <td className="px-5 py-3.5 text-center">
                  <ToggleUserButton userId={u.id} isActive={!!u.isActive} />
                </td>
                <td className="px-5 py-3.5 text-right">
                  <div className="flex gap-1 justify-end">
                    <UserFormDialog
                      allGroups={allGroups}
                      allModules={allModules}
                      mode="edit"
                      userId={u.id}
                      defaultName={u.name ?? ""}
                      defaultEmail={u.email}
                      defaultUserid={u.userid ?? ""}
                      defaultIsActive={!!u.isActive}
                      defaultGroupIds={u.groups.map((g: any) => g.id)}
                      defaultModuleIds={u.modules.map((m: any) => m.id)}
                    >
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-[#9AA0AC] hover:text-navy">
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    </UserFormDialog>
                    <form action={async () => { "use server"; await deleteUser(u.id) }}>
                      <Button variant="ghost" size="sm" type="submit" className="h-8 w-8 p-0 text-[#9AA0AC] hover:text-[#E53935]">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
