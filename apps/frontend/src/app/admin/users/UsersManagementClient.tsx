"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Search, X, Pencil, Trash2, Plus, Filter } from "lucide-react"
import { UserFormDialog } from "./UserFormDialog"
import { ToggleUserButton } from "./ToggleUserButton"
import { deleteUser } from "@/app/actions/users"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  filterAdminUsers,
  type UserLinkScope,
  type UserStatusFilter,
} from "@/lib/users-filter"

interface UsersManagementClientProps {
  users: any[]
  allGroups: any[]
  allModules: any[]
}

export function UsersManagementClient({
  users,
  allGroups,
  allModules,
}: UsersManagementClientProps) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [moduleId, setModuleId] = useState("all")
  const [linkScope, setLinkScope] = useState<UserLinkScope>("all")
  const [status, setStatus] = useState<UserStatusFilter>("all")
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const sortedModules = useMemo(
    () =>
      [...(Array.isArray(allModules) ? allModules : [])].sort((a, b) =>
        String(a?.name || "").localeCompare(String(b?.name || ""), "pt-BR")
      ),
    [allModules]
  )

  const filteredUsers = useMemo(
    () =>
      filterAdminUsers(users, allGroups, {
        search,
        moduleId,
        linkScope,
        status,
      }),
    [users, allGroups, search, moduleId, linkScope, status]
  )

  const hasActiveFilters =
    search.trim().length > 0 ||
    moduleId !== "all" ||
    linkScope !== "all" ||
    status !== "all"

  const clearFilters = () => {
    setSearch("")
    setModuleId("all")
    setLinkScope("all")
    setStatus("all")
  }

  const handleDelete = (user: any) => {
    const label = user?.name || user?.email || "este usuário"
    if (!window.confirm(`Deseja realmente excluir ${label}?`)) return

    setDeletingId(user.id)
    startTransition(async () => {
      try {
        await deleteUser(user.id)
        router.refresh()
      } finally {
        setDeletingId(null)
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-navy tracking-tight">
            Usuários e Acessos
          </h1>
          <p className="text-sm text-[#5F6775] mt-1">
            Gerencie os usuários, seus grupos e sistemas disponíveis.
          </p>
        </div>
        <UserFormDialog allGroups={allGroups} allModules={allModules} mode="create">
          <Button className="bg-green-dark hover:bg-green-brand text-white gap-2 cursor-pointer">
            <Plus className="w-4 h-4" /> Novo Usuário
          </Button>
        </UserFormDialog>
      </div>

      {/* Barra de Pesquisa e Filtros por Módulos */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Pesquisa */}
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-[#9AA0AC] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar por nome, e-mail ou matrícula..."
              aria-label="Pesquisar usuários"
              className="pl-9 pr-8 h-9 text-sm bg-[#F8F9FB] border-gray-200 focus-visible:ring-navy"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Limpar pesquisa"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9AA0AC] hover:text-navy cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filtro por Módulo */}
          <div className="md:col-span-3">
            <select
              value={moduleId}
              onChange={(e) => setModuleId(e.target.value)}
              aria-label="Filtrar por módulo vinculado"
              className="w-full h-9 px-3 text-xs font-medium bg-[#F8F9FB] border border-gray-200 rounded-md text-navy focus:outline-none focus:ring-2 focus:ring-navy cursor-pointer"
            >
              <option value="all">Todos os módulos</option>
              <option value="none">Sem módulos vinculados</option>
              {sortedModules.map((mod: any) => (
                <option key={mod.id} value={mod.id}>
                  {mod.name}
                </option>
              ))}
            </select>
          </div>

          {/* Origem do Vínculo (Direto / Grupo) */}
          <div className="md:col-span-2">
            <select
              value={linkScope}
              onChange={(e) => setLinkScope(e.target.value as UserLinkScope)}
              aria-label="Filtrar por tipo de vínculo"
              className="w-full h-9 px-3 text-xs font-medium bg-[#F8F9FB] border border-gray-200 rounded-md text-navy focus:outline-none focus:ring-2 focus:ring-navy cursor-pointer"
            >
              <option value="all">Vínculo: Direto ou Grupo</option>
              <option value="direct">Apenas Avulso (Direto)</option>
              <option value="group">Apenas via Grupo</option>
            </select>
          </div>

          {/* Filtro de Status */}
          <div className="md:col-span-2">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as UserStatusFilter)}
              aria-label="Filtrar por status do usuário"
              className="w-full h-9 px-3 text-xs font-medium bg-[#F8F9FB] border border-gray-200 rounded-md text-navy focus:outline-none focus:ring-2 focus:ring-navy cursor-pointer"
            >
              <option value="all">Todos os status</option>
              <option value="active">Somente Ativos</option>
              <option value="inactive">Somente Inativos</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-[#5F6775]">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-[#9AA0AC]" />
            <span>
              Mostrando <strong className="text-navy">{filteredUsers.length}</strong> de{" "}
              <strong className="text-navy">{users.length}</strong> usuário(s)
            </span>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 text-xs font-semibold text-navy hover:text-green-dark transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* Tabela de Usuários */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#F4F5F7] border-b border-gray-200">
              <th className="text-left px-5 py-3 text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider">
                Usuário
              </th>
              <th className="text-left px-5 py-3 text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider hidden md:table-cell">
                Grupos
              </th>
              <th className="text-left px-5 py-3 text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider hidden lg:table-cell">
                Sistemas Avulsos
              </th>
              <th className="text-center px-5 py-3 text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider">
                Ativo
              </th>
              <th className="text-right px-5 py-3 text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredUsers.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="text-center py-12 text-[#9AA0AC] italic"
                >
                  {users.length === 0
                    ? "Nenhum usuário cadastrado."
                    : "Nenhum usuário encontrado com os filtros aplicados."}
                </td>
              </tr>
            )}
            {filteredUsers.map((u: any) => (
              <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-navy text-white flex items-center justify-center font-bold text-xs shrink-0">
                      {u.name
                        ?.split(" ")
                        .map((n: string) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2) || "??"}
                    </div>
                    <div>
                      <p className="font-semibold text-navy text-sm">{u.name}</p>
                      <p className="text-[11px] text-[#9AA0AC]">{u.email}</p>
                      {u.userid && (
                        <p className="text-[10px] font-mono text-[#9AA0AC]">
                          {u.userid}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5 hidden md:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {u.groups.length === 0 ? (
                      <span className="text-[11px] text-[#9AA0AC] italic">
                        Sem grupo
                      </span>
                    ) : (
                      u.groups.map((g: any) => (
                        <Badge
                          key={g.id}
                          variant="outline"
                          className="text-[10px] border-navy text-navy"
                        >
                          {g.name}
                        </Badge>
                      ))
                    )}
                  </div>
                </td>
                <td className="px-5 py-3.5 hidden lg:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {u.modules.length === 0 ? (
                      <span className="text-[11px] text-[#9AA0AC] italic">
                        Nenhum
                      </span>
                    ) : (
                      u.modules.map((m: any) => (
                        <Badge
                          key={m.id}
                          variant="outline"
                          className="text-[10px] border-[#1976D2] text-[#1976D2]"
                        >
                          {m.name}
                        </Badge>
                      ))
                    )}
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
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-[#9AA0AC] hover:text-navy cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    </UserFormDialog>
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      disabled={isPending && deletingId === u.id}
                      onClick={() => handleDelete(u)}
                      aria-label={`Excluir ${u.name || u.email}`}
                      className="h-8 w-8 p-0 text-[#9AA0AC] hover:text-[#E53935] cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
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
