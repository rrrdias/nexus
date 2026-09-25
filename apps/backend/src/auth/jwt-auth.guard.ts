import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { DB_CONNECTION } from '../db/db.provider';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { IS_PUBLIC_KEY } from './public.decorator';

interface UserActiveCacheEntry {
  isActive: boolean;
  timestamp: number;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  // In-memory LRU-style TTL cache (30s) to avoid querying Postgres on every single sub-request
  private static userActiveCache = new Map<string, UserActiveCacheEntry>();
  private static readonly CACHE_TTL_MS = 30_000;

  constructor(
    private jwtService: JwtService,
    @Inject(DB_CONNECTION) private readonly db: PostgresJsDatabase<any>,
    private reflector?: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector?.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);
    if (!token) {
      throw new UnauthorizedException();
    }
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret:
          process.env.JWT_SECRET ||
          (process.env.NODE_ENV === 'production'
            ? (() => {
                throw new Error('JWT_SECRET is required in production');
              })()
            : 'nexus-dev-jwt-secret-not-for-production-min32chars'),
      });

      const userId = payload.sub;
      let isActive = false;
      const now = Date.now();
      const cached = JwtAuthGuard.userActiveCache.get(userId);

      if (cached && now - cached.timestamp < JwtAuthGuard.CACHE_TTL_MS) {
        isActive = cached.isActive;
      } else {
        // Consultar banco para garantir que o usuário ainda existe e está ativo no sistema
        const userResult = await this.db
          .select({ isActive: users.isActive })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        if (userResult.length === 0 || !userResult[0].isActive) {
          JwtAuthGuard.userActiveCache.delete(userId);
          throw new UnauthorizedException('Usuário inativo ou não encontrado');
        }

        isActive = Boolean(userResult[0].isActive);
        JwtAuthGuard.userActiveCache.set(userId, { isActive, timestamp: now });

        // Auto-prune cache if it grows too large (> 1000 items)
        if (JwtAuthGuard.userActiveCache.size > 1000) {
          for (const [key, value] of JwtAuthGuard.userActiveCache.entries()) {
            if (now - value.timestamp > JwtAuthGuard.CACHE_TTL_MS) {
              JwtAuthGuard.userActiveCache.delete(key);
            }
          }
        }
      }

      if (!isActive) {
        throw new UnauthorizedException('Usuário inativo ou não encontrado');
      }

      request['user'] = {
        id: payload.sub,
        email: payload.email,
        isSuperAdmin: payload.isSuperAdmin,
        isDisabled: !isActive,
      };
    } catch {
      throw new UnauthorizedException();
    }
    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
