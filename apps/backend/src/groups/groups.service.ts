import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { DB_CONNECTION } from '../db/db.provider';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { groups, groupSystemAccess, systemModules } from '../db/schema';
import { eq, inArray } from 'drizzle-orm';

type SessionUser = {
  id?: string;
  isSuperAdmin?: boolean;
  isDisabled?: boolean;
};

@Injectable()
export class GroupsService {
  constructor(
    @Inject(DB_CONNECTION) private readonly db: PostgresJsDatabase<any>,
  ) {}

  private assertSuperAdmin(user?: SessionUser) {
    if (!user?.isSuperAdmin) {
      throw new UnauthorizedException("Acesso negado. Apenas Super Admins podem executar esta ação.");
    }
  }

  async getGroups(user: SessionUser) {
    this.assertSuperAdmin(user);
    const allGroups = await this.db.select().from(groups).orderBy(groups.name);

    if (allGroups.length === 0) return [];

    const groupIds = allGroups.map((g) => g.id);
    const accessRows = await this.db
      .select({ groupId: groupSystemAccess.groupId, module: systemModules })
      .from(groupSystemAccess)
      .innerJoin(systemModules, eq(groupSystemAccess.systemModuleId, systemModules.id))
      .where(inArray(groupSystemAccess.groupId, groupIds));

    const modulesByGroup = new Map<string, (typeof systemModules.$inferSelect)[]>();
    for (const row of accessRows) {
      const list = modulesByGroup.get(row.groupId) ?? [];
      list.push(row.module);
      modulesByGroup.set(row.groupId, list);
    }

    return allGroups.map((g) => ({ ...g, modules: modulesByGroup.get(g.id) ?? [] }));
  }

  async getGroupWithModules(user: SessionUser, groupId: string) {
    this.assertSuperAdmin(user);
    const group = await this.db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
    if (group.length === 0) throw new Error("Grupo não encontrado.");

    const access = await this.db
      .select({ module: systemModules })
      .from(groupSystemAccess)
      .innerJoin(systemModules, eq(groupSystemAccess.systemModuleId, systemModules.id))
      .where(eq(groupSystemAccess.groupId, groupId));

    return { group: group[0], moduleIds: access.map(a => a.module.id) };
  }

  async createGroup(user: SessionUser, name: string, description: string, moduleIds: string[]) {
    this.assertSuperAdmin(user);
    if (!name?.trim()) throw new Error("Nome do grupo é obrigatório.");

    await this.db.transaction(async (tx) => {
      const [created] = await tx.insert(groups).values({ name: name.trim(), description }).returning();

      if (moduleIds && moduleIds.length > 0) {
        await tx.insert(groupSystemAccess).values(
          moduleIds.map(id => ({ groupId: created.id, systemModuleId: id }))
        );
      }
    });

    return { success: true };
  }

  async updateGroup(user: SessionUser, groupId: string, name: string, description: string, moduleIds: string[]) {
    this.assertSuperAdmin(user);
    if (!name?.trim()) throw new Error("Nome do grupo é obrigatório.");

    await this.db.transaction(async (tx) => {
      await tx.update(groups).set({ name: name.trim(), description }).where(eq(groups.id, groupId));

      await tx.delete(groupSystemAccess).where(eq(groupSystemAccess.groupId, groupId));
      if (moduleIds && moduleIds.length > 0) {
        await tx.insert(groupSystemAccess).values(
          moduleIds.map(id => ({ groupId, systemModuleId: id }))
        );
      }
    });

    return { success: true };
  }

  async deleteGroup(user: SessionUser, groupId: string) {
    this.assertSuperAdmin(user);
    await this.db.delete(groups).where(eq(groups.id, groupId));
    return { success: true };
  }
}
