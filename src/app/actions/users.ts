"use server"

import { auth } from "@/auth"
import { db } from "@/db"
import { users, userGroups, usersSystemAccess, groups, systemModules } from "@/db/schema"
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

export async function getUsers() {
  await assertSuperAdmin()
  const allUsers = await db.select().from(users).orderBy(users.name)

  const result = await Promise.all(allUsers.map(async (u) => {
    const groupList = await db
      .select({ id: groups.id, name: groups.name })
      .from(userGroups)
      .innerJoin(groups, eq(userGroups.groupId, groups.id))
      .where(eq(userGroups.userId, u.id))

    const moduleList = await db
      .select({ id: systemModules.id, name: systemModules.name })
      .from(usersSystemAccess)
      .innerJoin(systemModules, eq(usersSystemAccess.systemModuleId, systemModules.id))
      .where(eq(usersSystemAccess.userId, u.id))

    return { ...u, groups: groupList, modules: moduleList }
  }))

  return result
}

export async function getUserForEdit(userId: string) {
  await assertSuperAdmin()
  const user = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  if (user.length === 0) throw new Error("Usuário não encontrado.")

  const groupList = await db
    .select({ id: groups.id })
    .from(userGroups)
    .where(eq(userGroups.userId, userId))

  const moduleList = await db
    .select({ id: systemModules.id })
    .from(usersSystemAccess)
    .where(eq(usersSystemAccess.userId, userId))

  return {
    user: user[0],
    groupIds: groupList.map(g => g.id),
    moduleIds: moduleList.map(m => m.id),
  }
}

export async function createUser(formData: FormData) {
  await assertSuperAdmin()
  const name = formData.get("name") as string
  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const userid = formData.get("userid") as string
  const isActive = formData.get("isActive") === "on"
  const groupIds = formData.getAll("groupIds") as string[]
  const moduleIds = formData.getAll("moduleIds") as string[]

  if (!name?.trim() || !email?.trim() || !password?.trim()) {
    throw new Error("Nome, e-mail e senha são obrigatórios.")
  }

  const [created] = await db.insert(users).values({
    name: name.trim(),
    email: email.trim(),
    password, // TODO: bcrypt em produção
    userid: userid?.trim() || undefined,
    isActive,
  }).returning()

  if (groupIds.length > 0) {
    await db.insert(userGroups).values(groupIds.map(id => ({ userId: created.id, groupId: id })))
  }
  if (moduleIds.length > 0) {
    await db.insert(usersSystemAccess).values(moduleIds.map(id => ({ userId: created.id, systemModuleId: id })))
  }

  revalidatePath("/admin/users")
  return { success: true }
}

export async function updateUser(userId: string, formData: FormData) {
  await assertSuperAdmin()
  const name = formData.get("name") as string
  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const userid = formData.get("userid") as string
  const isActive = formData.get("isActive") === "on"
  const groupIds = formData.getAll("groupIds") as string[]
  const moduleIds = formData.getAll("moduleIds") as string[]

  const updateData: Record<string, unknown> = {
    name: name.trim(),
    email: email.trim(),
    userid: userid?.trim() || undefined,
    isActive,
  }
  if (password?.trim()) {
    updateData.password = password.trim() // TODO: bcrypt em produção
  }

  await db.update(users).set(updateData).where(eq(users.id, userId))

  await db.delete(userGroups).where(eq(userGroups.userId, userId))
  if (groupIds.length > 0) {
    await db.insert(userGroups).values(groupIds.map(id => ({ userId, groupId: id })))
  }

  await db.delete(usersSystemAccess).where(eq(usersSystemAccess.userId, userId))
  if (moduleIds.length > 0) {
    await db.insert(usersSystemAccess).values(moduleIds.map(id => ({ userId, systemModuleId: id })))
  }

  revalidatePath("/admin/users")
  return { success: true }
}

export async function toggleUserActive(userId: string, isActive: boolean) {
  await assertSuperAdmin()
  await db.update(users).set({ isActive }).where(eq(users.id, userId))
  revalidatePath("/admin/users")
  return { success: true }
}

export async function deleteUser(userId: string) {
  await assertSuperAdmin()
  await db.delete(users).where(eq(users.id, userId))
  revalidatePath("/admin/users")
  return { success: true }
}
