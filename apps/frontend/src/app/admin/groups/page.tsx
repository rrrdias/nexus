import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { GroupFormDialog } from "./GroupFormDialog"
import { deleteGroup, getGroups } from "@/app/actions/groups"
import { getAllModules } from "@/app/actions/system"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Pencil, Trash2, Plus, ShieldCheck } from "lucide-react"

export default async function AdminGroupsPage() {
  const session = await auth()
  // @ts-ignore
  if (!session?.user?.isSuperAdmin) redirect("/")

  const groupsWithModules = await getGroups()
  const allModules = await getAllModules()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-navy tracking-tight">Grupos e Permissões</h1>
          <p className="text-sm text-[#5F6775] mt-1">Gerencie os grupos de acesso e os sistemas vinculados a eles.</p>
        </div>
        <GroupFormDialog allModules={allModules} mode="create">
          <Button className="bg-green-dark hover:bg-green-brand text-white gap-2">
            <Plus className="w-4 h-4" /> Novo Grupo
          </Button>
        </GroupFormDialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {groupsWithModules.length === 0 && (
          <p className="text-[#9AA0AC] italic col-span-3 text-center py-12">Nenhum grupo cadastrado.</p>
        )}
        {groupsWithModules.map((g: any) => (
          <div key={g.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col gap-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-navy flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4 h-4 text-green-brand" />
                </div>
                <div>
                  <p className="font-bold text-navy text-sm">{g.name}</p>
                  {g.description && <p className="text-[11px] text-[#9AA0AC] mt-0.5 line-clamp-1">{g.description}</p>}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <GroupFormDialog allModules={allModules} mode="edit" groupId={g.id} defaultName={g.name} defaultDescription={g.description ?? ""} defaultModuleIds={g.modules.map((m: any) => m.id)}>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-[#9AA0AC] hover:text-navy">
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                </GroupFormDialog>
                <form action={async () => { "use server"; await deleteGroup(g.id) }}>
                  <Button variant="ghost" size="sm" type="submit" className="h-8 w-8 p-0 text-[#9AA0AC] hover:text-[#E53935]">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </form>
              </div>
            </div>

            <div>
              <p className="text-[9px] font-bold text-[#9AA0AC] uppercase tracking-widest mb-2">Sistemas com acesso</p>
              <div className="flex flex-wrap gap-1.5">
                {g.modules.length === 0
                  ? <span className="text-[11px] text-[#9AA0AC] italic">Nenhum sistema vinculado</span>
                  : g.modules.map((m: any) => (
                    <Badge key={m.id} variant="outline" className="text-[10px] border-[#1976D2] text-[#1976D2]">{m.name}</Badge>
                  ))
                }
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
