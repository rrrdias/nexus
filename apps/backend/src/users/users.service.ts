import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { DB_CONNECTION } from '../db/db.provider';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { users, userGroups, usersSystemAccess, groups, systemModules } from '../db/schema';
import { eq, inArray } from 'drizzle-orm';
import { hashPassword } from './password.util'; // We will create this

type SessionUser = {
  id?: string;
  isSuperAdmin?: boolean;
  isDisabled?: boolean;
};

@Injectable()
export class UsersService {
  constructor(
    @Inject(DB_CONNECTION) private readonly db: PostgresJsDatabase<any>,
  ) {}

  private assertSuperAdmin(user?: SessionUser) {
    if (!user?.isSuperAdmin) {
      throw new UnauthorizedException("Acesso negado. Apenas Super Admins podem executar esta ação.");
    }
  }

  async getUsers(user: SessionUser) {
    this.assertSuperAdmin(user);
    const allUsers = await this.db.select().from(users).orderBy(users.name);

    if (allUsers.length === 0) return [];

    const userIds = allUsers.map((u) => u.id);
    const [groupRows, moduleRows] = await Promise.all([
      this.db
        .select({ userId: userGroups.userId, id: groups.id, name: groups.name })
        .from(userGroups)
        .innerJoin(groups, eq(userGroups.groupId, groups.id))
        .where(inArray(userGroups.userId, userIds)),
      this.db
        .select({ userId: usersSystemAccess.userId, id: systemModules.id, name: systemModules.name })
        .from(usersSystemAccess)
        .innerJoin(systemModules, eq(usersSystemAccess.systemModuleId, systemModules.id))
        .where(inArray(usersSystemAccess.userId, userIds)),
    ]);

    const groupsByUser = new Map<string, { id: string; name: string }[]>();
    for (const row of groupRows) {
      const list = groupsByUser.get(row.userId) ?? [];
      list.push({ id: row.id, name: row.name });
      groupsByUser.set(row.userId, list);
    }

    const modulesByUser = new Map<string, { id: string; name: string }[]>();
    for (const row of moduleRows) {
      const list = modulesByUser.get(row.userId) ?? [];
      list.push({ id: row.id, name: row.name });
      modulesByUser.set(row.userId, list);
    }

    return allUsers.map((u) => ({
      ...u,
      groups: groupsByUser.get(u.id) ?? [],
      modules: modulesByUser.get(u.id) ?? [],
    }));
  }

  async getUserForEdit(userSession: SessionUser, userId: string) {
    this.assertSuperAdmin(userSession);
    const user = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (user.length === 0) throw new Error("Usuário não encontrado.");

    const groupList = await this.db
      .select({ id: groups.id })
      .from(userGroups)
      .where(eq(userGroups.userId, userId));

    const moduleList = await this.db
      .select({ id: systemModules.id })
      .from(usersSystemAccess)
      .where(eq(usersSystemAccess.userId, userId));

    return {
      user: user[0],
      groupIds: groupList.map(g => g.id),
      moduleIds: moduleList.map(m => m.id),
    };
  }

  async createUser(userSession: SessionUser, data: any) {
    this.assertSuperAdmin(userSession);
    const { name, email, password, userid, isActive, groupIds, moduleIds } = data;

    if (!name?.trim() || !email?.trim() || !password?.trim()) {
      throw new Error("Nome, e-mail e senha são obrigatórios.");
    }

    const hashedPassword = await hashPassword(password.trim());

    await this.db.transaction(async (tx) => {
      const [created] = await tx.insert(users).values({
        name: name.trim(),
        email: email.trim(),
        password: hashedPassword,
        userid: userid?.trim() || undefined,
        isActive: isActive === true || isActive === 'on' || isActive === 'true',
      }).returning();

      if (groupIds && groupIds.length > 0) {
        await tx.insert(userGroups).values(groupIds.map(id => ({ userId: created.id, groupId: id })));
      }
      if (moduleIds && moduleIds.length > 0) {
        await tx.insert(usersSystemAccess).values(moduleIds.map(id => ({ userId: created.id, systemModuleId: id })));
      }
    });

    return { success: true };
  }

  async updateUser(userSession: SessionUser, userId: string, data: any) {
    this.assertSuperAdmin(userSession);
    const { name, email, password, userid, isActive, groupIds, moduleIds } = data;

    const updateData: Record<string, unknown> = {
      name: name.trim(),
      email: email.trim(),
      userid: userid?.trim() || undefined,
      isActive: isActive === true || isActive === 'on' || isActive === 'true',
    };
    if (password?.trim()) {
      updateData.password = await hashPassword(password.trim());
    }

    await this.db.transaction(async (tx) => {
      await tx.update(users).set(updateData).where(eq(users.id, userId));

      await tx.delete(userGroups).where(eq(userGroups.userId, userId));
      if (groupIds && groupIds.length > 0) {
        await tx.insert(userGroups).values(groupIds.map(id => ({ userId, groupId: id })));
      }

      await tx.delete(usersSystemAccess).where(eq(usersSystemAccess.userId, userId));
      if (moduleIds && moduleIds.length > 0) {
        await tx.insert(usersSystemAccess).values(moduleIds.map(id => ({ userId, systemModuleId: id })));
      }
    });

    return { success: true };
  }

  async toggleUserActive(userSession: SessionUser, userId: string, isActive: boolean) {
    this.assertSuperAdmin(userSession);
    await this.db.update(users).set({ isActive }).where(eq(users.id, userId));
    return { success: true };
  }

  async deleteUser(userSession: SessionUser, userId: string) {
    this.assertSuperAdmin(userSession);
    await this.db.delete(users).where(eq(users.id, userId));
    return { success: true };
  }
}
