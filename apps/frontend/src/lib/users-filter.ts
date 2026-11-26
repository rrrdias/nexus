export type UserLinkScope = "all" | "direct" | "group"
export type UserStatusFilter = "all" | "active" | "inactive"

export interface AdminUsersFilterOptions {
  search?: string
  moduleId?: string
  linkScope?: UserLinkScope
  status?: UserStatusFilter
}

export function normalizeSearchText(value?: string | null): string {
  if (!value) return ""
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
}

export function buildGroupModuleMap(allGroups: any[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>()
  for (const group of Array.isArray(allGroups) ? allGroups : []) {
    if (!group?.id) continue
    const moduleIds = new Set<string>()
    for (const mod of Array.isArray(group.modules) ? group.modules : []) {
      if (mod?.id) moduleIds.add(String(mod.id))
    }
    map.set(String(group.id), moduleIds)
  }
  return map
}

export function getUserEffectiveModuleSets(
  user: any,
  groupModuleMap: Map<string, Set<string>>
): { direct: Set<string>; group: Set<string> } {
  const direct = new Set<string>()
  for (const mod of Array.isArray(user?.modules) ? user.modules : []) {
    if (mod?.id) direct.add(String(mod.id))
  }

  const group = new Set<string>()
  for (const grp of Array.isArray(user?.groups) ? user.groups : []) {
    const grpModules = grp?.id ? groupModuleMap.get(String(grp.id)) : undefined
    if (!grpModules) continue
    for (const modId of grpModules) {
      group.add(modId)
    }
  }

  return { direct, group }
}

export function filterAdminUsers<T = any>(
  users: T[],
  allGroups: any[],
  filters: AdminUsersFilterOptions
): T[] {
  const list = Array.isArray(users) ? users : []
  const searchNorm = normalizeSearchText(filters.search)
  const moduleId = filters.moduleId || "all"
  const linkScope: UserLinkScope = filters.linkScope || "all"
  const status: UserStatusFilter = filters.status || "all"

  const groupModuleMap = buildGroupModuleMap(allGroups)

  return list.filter((user: any) => {
    if (status === "active" && !user?.isActive) return false
    if (status === "inactive" && !!user?.isActive) return false

    if (searchNorm) {
      const name = normalizeSearchText(user?.name)
      const email = normalizeSearchText(user?.email)
      const userid = normalizeSearchText(user?.userid)
      if (
        !name.includes(searchNorm) &&
        !email.includes(searchNorm) &&
        !userid.includes(searchNorm)
      ) {
        return false
      }
    }

    if (moduleId !== "all" || linkScope !== "all") {
      const { direct, group } = getUserEffectiveModuleSets(user, groupModuleMap)

      if (moduleId === "none") {
        if (linkScope === "direct") return direct.size === 0
        if (linkScope === "group") return group.size === 0
        return direct.size === 0 && group.size === 0
      }

      if (moduleId === "all") {
        if (linkScope === "direct") return direct.size > 0
        if (linkScope === "group") return group.size > 0
        return true
      }

      if (linkScope === "direct") return direct.has(moduleId)
      if (linkScope === "group") return group.has(moduleId)
      return direct.has(moduleId) || group.has(moduleId)
    }

    return true
  })
}
