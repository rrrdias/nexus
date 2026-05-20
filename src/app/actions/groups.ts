"use server"

import { auth } from "@/auth"
import { db } from "@/db"
import { groups, groupSystemAccess, systemModules } from "@/db/schema"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

async function assertSuperAdmin() {
  const session = await auth()
  // @ts-ignore
  if (!session?.user?.isSuperAdmin) {
    throw new Error("Acesso negado. Apenas Super Admins podem executar esta ação.")
  }
  return session
}

export async function getGroups() {
  await assertSuperAdmin()
  return db.select().from(groups).orderBy(groups.name)
}

export async function getGroupWithModules(groupId: string) {
  await assertSuperAdmin()
  const group = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1)
  if (group.length === 0) throw new Error("Grupo não encontrado.")

  const access = await db
    .select({ module: systemModules })
    .from(groupSystemAccess)
    .innerJoin(systemModules, eq(groupSystemAccess.systemModuleId, systemModules.id))
    .where(eq(groupSystemAccess.groupId, groupId))

  return { group: group[0], moduleIds: access.map(a => a.module.id) }
}

export async function createGroup(formData: FormData) {
  await assertSuperAdmin()
  const name = formData.get("name") as string
  const description = formData.get("description") as string
  const moduleIds = formData.getAll("moduleIds") as string[]

  if (!name?.trim()) throw new Error("Nome do grupo é obrigatório.")

  const [created] = await db.insert(groups).values({ name: name.trim(), description }).returning()

  if (moduleIds.length > 0) {
    await db.insert(groupSystemAccess).values(
      moduleIds.map(id => ({ groupId: created.id, systemModuleId: id }))
    )
  }

  revalidatePath("/admin/groups")
  return { success: true }
}

export async function updateGroup(groupId: string, formData: FormData) {
  await assertSuperAdmin()
  const name = formData.get("name") as string
  const description = formData.get("description") as string
  const moduleIds = formData.getAll("moduleIds") as string[]

  if (!name?.trim()) throw new Error("Nome do grupo é obrigatório.")

  await db.update(groups).set({ name: name.trim(), description }).where(eq(groups.id, groupId))

  await db.delete(groupSystemAccess).where(eq(groupSystemAccess.groupId, groupId))
  if (moduleIds.length > 0) {
    await db.insert(groupSystemAccess).values(
      moduleIds.map(id => ({ groupId, systemModuleId: id }))
    )
  }

  revalidatePath("/admin/groups")
  return { success: true }
}

export async function deleteGroup(groupId: string) {
  await assertSuperAdmin()
  await db.delete(groups).where(eq(groups.id, groupId))
  revalidatePath("/admin/groups")
  return { success: true }
}
