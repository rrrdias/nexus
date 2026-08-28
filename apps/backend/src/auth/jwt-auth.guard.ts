import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { DB_CONNECTION } from '../db/db.provider';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class JwtAuthGuard implements CanActivate {
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
    
    // Normalizar pathname removendo query strings e barras finais para evitar bypass por query params
    const rawPath = request.path || (request.url ? request.url.split('?')[0] : '');
    const normalizedPath = rawPath.replace(/\/+$/, '') || '/';

    // Rotas públicas estritas: login e ava-sync (que possui validação própria de CRON_SECRET no controller)
    if (
      normalizedPath === '/api/auth/login' ||
      normalizedPath === '/auth/login' ||
      normalizedPath === '/api/ava-sync' ||
      normalizedPath.startsWith('/api/ava-sync/') ||
      normalizedPath === '/ava-sync' ||
      normalizedPath.startsWith('/ava-sync/')
    ) {
      return true;
    }

    const token = this.extractTokenFromHeader(request);
    if (!token) {
      throw new UnauthorizedException();
    }
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET || 'nexus-secret-key-2026'
      });

      // Consultar banco para garantir que o usuário ainda existe e está ativo no sistema
      const userResult = await this.db.select({ isActive: users.isActive })
        .from(users)
        .where(eq(users.id, payload.sub))
        .limit(1);

      if (userResult.length === 0 || !userResult[0].isActive) {
        throw new UnauthorizedException('Usuário inativo ou não encontrado');
      }

      request['user'] = {
        id: payload.sub,
        email: payload.email,
        isSuperAdmin: payload.isSuperAdmin,
        isDisabled: !userResult[0].isActive
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

