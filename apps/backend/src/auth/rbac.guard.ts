import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  UnauthorizedException,
  Inject,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DB_CONNECTION } from '../db/db.provider';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import {
  systemModules,
  usersSystemAccess,
  userGroups,
  groupSystemAccess,
} from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { IS_PUBLIC_KEY } from './public.decorator';
import { REQUIRE_ADMIN_KEY, REQUIRE_MODULES_KEY } from './rbac.decorators';
import { CacheService } from '../cache/cache.service';

@Injectable()
export class RbacGuard implements CanActivate {
  private static readonly LOCAL_CACHE_TTL_MS = 60_000;
  private static localFallbackCache = new Map<
    string,
    { modules: Set<string>; timestamp: number }
  >();

  constructor(
    private readonly reflector: Reflector,
    @Inject(DB_CONNECTION) private readonly db: PostgresJsDatabase<any>,
    @Optional() private readonly cacheService?: CacheService,
  ) {}

  static clearCache(userId?: string) {
    if (userId) {
      RbacGuard.localFallbackCache.delete(userId);
    } else {
      RbacGuard.localFallbackCache.clear();
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.id || user.isDisabled) {
      throw new UnauthorizedException('Usuário não autenticado ou inativo.');
    }

    // Super Admin tem acesso irrestrito
    if (user.isSuperAdmin) {
      return true;
    }

    // 1. Verificar restrição exclusiva de Super Admin (@RequireAdmin)
    const requireAdmin = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_ADMIN_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requireAdmin) {
      throw new ForbiddenException('Acesso restrito a administradores.');
    }

    // 2. Verificar permissão de módulos (@RequireModule)
    const requiredModules = this.reflector.getAllAndOverride<string[]>(
      REQUIRE_MODULES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredModules || requiredModules.length === 0) {
      // Nenhuma restrição de módulo específica, usuário autenticado permitido
      return true;
    }

    const allowedModules = await this.getUserAllowedModules(user.id);
    const hasAccess = requiredModules.some((mod) => allowedModules.has(mod));

    if (!hasAccess) {
      throw new ForbiddenException(
        `Acesso negado. Requer permissão em: ${requiredModules.join(', ')}.`,
      );
    }

    return true;
  }

  private async getUserAllowedModules(userId: string): Promise<Set<string>> {
    // 1. Tenta usar CacheService distribuído (Redis/Central)
    if (this.cacheService) {
      const cachedArray = await this.cacheService.wrap<string[]>(
        `rbac:user:${userId}:modules`,
        async () => {
          const directModulesPromise = this.db
            .select({ slug: systemModules.slug })
            .from(usersSystemAccess)
            .innerJoin(
              systemModules,
              eq(usersSystemAccess.systemModuleId, systemModules.id),
            )
            .where(
              and(
                eq(usersSystemAccess.userId, userId),
                eq(systemModules.isActive, true),
              ),
            );

          const groupModulesPromise = this.db
            .select({ slug: systemModules.slug })
            .from(userGroups)
            .innerJoin(
              groupSystemAccess,
              eq(userGroups.groupId, groupSystemAccess.groupId),
            )
            .innerJoin(
              systemModules,
              eq(groupSystemAccess.systemModuleId, systemModules.id),
            )
            .where(
              and(
                eq(userGroups.userId, userId),
                eq(systemModules.isActive, true),
              ),
            );

          const [directModules, groupModules] = await Promise.all([
            directModulesPromise,
            groupModulesPromise,
          ]);

          const moduleList: string[] = [];
          directModules.forEach((m) => {
            if (m.slug && !moduleList.includes(m.slug)) moduleList.push(m.slug);
          });
          groupModules.forEach((m) => {
            if (m.slug && !moduleList.includes(m.slug)) moduleList.push(m.slug);
          });

          return moduleList;
        },
        300, // 5 minutos de TTL
      );

      return new Set(cachedArray || []);
    }

    // 2. Fallback em memória estático caso CacheService não esteja injetado
    const now = Date.now();
    const cached = RbacGuard.localFallbackCache.get(userId);
    if (cached && now - cached.timestamp < RbacGuard.LOCAL_CACHE_TTL_MS) {
      return cached.modules;
    }

    const [directModules, groupModules] = await Promise.all([
      this.db
        .select({ slug: systemModules.slug })
        .from(usersSystemAccess)
        .innerJoin(
          systemModules,
          eq(usersSystemAccess.systemModuleId, systemModules.id),
        )
        .where(
          and(
            eq(usersSystemAccess.userId, userId),
            eq(systemModules.isActive, true),
          ),
        ),
      this.db
        .select({ slug: systemModules.slug })
        .from(userGroups)
        .innerJoin(
          groupSystemAccess,
          eq(userGroups.groupId, groupSystemAccess.groupId),
        )
        .innerJoin(
          systemModules,
          eq(groupSystemAccess.systemModuleId, systemModules.id),
        )
        .where(
          and(eq(userGroups.userId, userId), eq(systemModules.isActive, true)),
        ),
    ]);

    const moduleSet = new Set<string>();
    directModules.forEach((m) => {
      if (m.slug) moduleSet.add(m.slug);
    });
    groupModules.forEach((m) => {
      if (m.slug) moduleSet.add(m.slug);
    });

    RbacGuard.localFallbackCache.set(userId, {
      modules: moduleSet,
      timestamp: now,
    });

    return moduleSet;
  }
}
