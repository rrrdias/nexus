import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getUsers } from "@/app/actions/users"
import { getGroups } from "@/app/actions/groups"
import { getAllModules } from "@/app/actions/system"
import { UsersManagementClient } from "./UsersManagementClient"

export default async function AdminUsersPage() {
  const session = await auth()
  if (!session?.user?.isSuperAdmin) redirect("/")

  const [usersWithDetails, allGroups, allModules] = await Promise.all([
    getUsers(),
    getGroups(),
    getAllModules(),
  ])

  return (
    <UsersManagementClient
      users={usersWithDetails}
      allGroups={allGroups}
      allModules={allModules}
    />
  )
}
