import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard (Security Test)', () => {
  let guard: JwtAuthGuard;
  let jwtService: jest.Mocked<JwtService>;
  let db: any;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(() => {
    jwtService = {
      verifyAsync: jest.fn(),
    } as any;

    db = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn(),
    };

    reflector = {
      getAllAndOverride: jest.fn(),
    } as any;

    guard = new JwtAuthGuard(jwtService, db, reflector);
  });

  const mockContext = (url: string, path?: string, authHeader?: string, handler?: any, targetClass?: any): ExecutionContext => {
    const req = {
      url,
      path: path || url.split('?')[0],
      headers: authHeader ? { authorization: authHeader } : {},
    };
    return {
      switchToHttp: () => ({
        getRequest: () => req,
      }),
      getHandler: () => handler || (() => {}),
      getClass: () => targetClass || class {},
    } as any;
  };

  it('should ALLOW access to public /api/auth/login without token', async () => {
    const ctx = mockContext('/api/auth/login');
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('should ALLOW access when @Public() decorator is present', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const ctx = mockContext('/api/any-custom-public-route');
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('should BLOCK bypass attempt via query parameters (e.g. /api/users?bypass=/api/auth/login)', async () => {
    const ctx = mockContext('/api/users?bypass=/api/auth/login', '/api/users');
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('should BLOCK bypass attempt via query parameters for ava-sync', async () => {
    const ctx = mockContext('/api/users?fake=/api/ava-sync', '/api/users');
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('should ALLOW valid JWT tokens and populate request.user', async () => {
    const ctx = mockContext('/api/users', '/api/users', 'Bearer valid.jwt.token');
    jwtService.verifyAsync.mockResolvedValue({ sub: 'user-123', email: 'test@nexus.com', isSuperAdmin: true });
    db.limit.mockResolvedValue([{ isActive: true }]);

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    const req = ctx.switchToHttp().getRequest() as any;
    expect(req.user).toEqual({
      id: 'user-123',
      email: 'test@nexus.com',
      isSuperAdmin: true,
      isDisabled: false,
    });
  });

  it('should REJECT token when user is deactivated in database', async () => {
    const ctx = mockContext('/api/users', '/api/users', 'Bearer valid.jwt.token');
    jwtService.verifyAsync.mockResolvedValue({ sub: 'user-123', email: 'test@nexus.com', isSuperAdmin: false });
    db.limit.mockResolvedValue([{ isActive: false }]);

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });
});
