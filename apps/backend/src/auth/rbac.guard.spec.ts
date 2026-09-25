import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RbacGuard } from './rbac.guard';
import { REQUIRE_ADMIN_KEY, REQUIRE_MODULES_KEY } from './rbac.decorators';
import { IS_PUBLIC_KEY } from './public.decorator';

describe('RbacGuard (Authorization & RBAC Test)', () => {
  let guard: RbacGuard;
  let reflector: jest.Mocked<Reflector>;
  let db: any;

  beforeEach(() => {
    RbacGuard.clearCache();

    reflector = {
      getAllAndOverride: jest.fn(),
    } as any;

    db = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
    };

    guard = new RbacGuard(reflector, db);
  });

  const mockContext = (
    user?: any,
    handler?: any,
    targetClass?: any,
  ): ExecutionContext => {
    const req = { user };
    return {
      switchToHttp: () => ({
        getRequest: () => req,
      }),
      getHandler: () => handler || (() => {}),
      getClass: () => targetClass || class {},
    } as any;
  };

  it('should ALLOW access when route is @Public()', async () => {
    reflector.getAllAndOverride.mockImplementation(
      (key) => key === IS_PUBLIC_KEY,
    );
    const ctx = mockContext(undefined);
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('should REJECT when user is not present in request', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const ctx = mockContext(undefined);
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('should REJECT when user is disabled', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const ctx = mockContext({ id: 'u1', isDisabled: true });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('should ALLOW Super Admin regardless of required module or admin requirement', async () => {
    reflector.getAllAndOverride.mockImplementation((key) => {
      if (key === REQUIRE_ADMIN_KEY) return true;
      if (key === REQUIRE_MODULES_KEY) return ['academic', 'ava'];
      return false;
    });

    const ctx = mockContext({
      id: 'admin-1',
      isSuperAdmin: true,
      isDisabled: false,
    });
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('should REJECT non-admin on @RequireAdmin() route', async () => {
    reflector.getAllAndOverride.mockImplementation((key) => {
      if (key === REQUIRE_ADMIN_KEY) return true;
      return false;
    });

    const ctx = mockContext({
      id: 'user-normal',
      isSuperAdmin: false,
      isDisabled: false,
    });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('should ALLOW non-admin when user has required module direct or group access', async () => {
    reflector.getAllAndOverride.mockImplementation((key) => {
      if (key === REQUIRE_MODULES_KEY) return ['academic'];
      return false;
    });

    // Mock DB queries for direct and group modules
    db.where
      .mockResolvedValueOnce([{ slug: 'academic' }])
      .mockResolvedValueOnce([]);

    const ctx = mockContext({
      id: 'user-academic',
      isSuperAdmin: false,
      isDisabled: false,
    });
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('should REJECT non-admin when user does not have required module', async () => {
    reflector.getAllAndOverride.mockImplementation((key) => {
      if (key === REQUIRE_MODULES_KEY) return ['ava'];
      return false;
    });

    // Mock DB queries returning empty or other modules
    db.where
      .mockResolvedValueOnce([{ slug: 'academic' }])
      .mockResolvedValueOnce([]);

    const ctx = mockContext({
      id: 'user-no-ava',
      isSuperAdmin: false,
      isDisabled: false,
    });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });
});
