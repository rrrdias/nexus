import { auth } from "@/auth"
import { db } from "@/db"
import { usersSystemAccess, systemModules, userGroups, groupSystemAccess } from "@/db/schema"
import { eq, inArray } from "drizzle-orm"
import { SidebarClient } from "./SidebarClient"

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
    <SidebarClient 
      session={session} 
      modules={modules} 
      initials={initials} 
    />
  )
}
