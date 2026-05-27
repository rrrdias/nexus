import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { DB_CONNECTION } from '../db/db.provider';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    @Inject(DB_CONNECTION) private readonly db: PostgresJsDatabase<any>
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);
    
    // Ignore ava-sync endpoints using CRON_SECRET which handle their own auth
    if (request.url.includes('/api/ava-sync') || request.url.includes('/api/auth/login')) {
      return true;
    }

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
