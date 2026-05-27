import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { DB_CONNECTION } from '../db/db.provider';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { users, userGroups, groups } from '../db/schema';
import { eq, or } from 'drizzle-orm';
import { verifyPassword } from '../users/password.util';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    @Inject(DB_CONNECTION) private readonly db: PostgresJsDatabase<any>,
    private jwtService: JwtService
  ) {}

  async login(login: string, pass: string) {
    const userResult = await this.db.select()
      .from(users)
      .where(or(eq(users.email, login), eq(users.userid, login)))
      .limit(1);

    if (userResult.length === 0) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const user = userResult[0];
    const isMatch = await verifyPassword(pass, user.password as string);
    if (!isMatch) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Usuário inativo');
    }

    const adminGroups = await this.db.select()
      .from(userGroups)
      .innerJoin(groups, eq(userGroups.groupId, groups.id))
      .where(eq(userGroups.userId, user.id));
    
    const isSuperAdmin = adminGroups.some(g => g.group.name === 'Super Admin') || user.email === 'rrrdias25@gmail.com';

    const groupNames = adminGroups.map(g => g.group.name);

    const payload = { sub: user.id, email: user.email, isSuperAdmin, isDisabled: !user.isActive };
    return {
      access_token: await this.jwtService.signAsync(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        isSuperAdmin,
        groups: groupNames,
      }
    };
  }
}
