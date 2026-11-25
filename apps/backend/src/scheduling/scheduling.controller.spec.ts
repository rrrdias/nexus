import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RbacGuard } from '../auth/rbac.guard';
import { REQUIRE_ADMIN_KEY, REQUIRE_MODULES_KEY } from '../auth/rbac.decorators';
import { SchedulingController } from './scheduling.controller';

describe('SchedulingController RBAC & Backoffice Permissions', () => {
  let reflector: Reflector;
  let db: any;
  let guard: RbacGuard;

  beforeEach(() => {
    RbacGuard.clearCache();
    reflector = new Reflector();
    db = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
    };
    guard = new RbacGuard(reflector, db);
  });

  const mockContext = (user: any, handler: (...args: any[]) => any): ExecutionContext => {
    const req = { user };
    return {
      switchToHttp: () => ({
        getRequest: () => req,
      }),
      getHandler: () => handler,
      getClass: () => SchedulingController,
    } as any;
  };

  it('deve exigir @RequireModule("scheduling", "backoffice") no SchedulingController', () => {
    const modules = reflector.get<string[]>(
      REQUIRE_MODULES_KEY,
      SchedulingController,
    );
    expect(modules).toEqual(['scheduling', 'backoffice']);
  });

  it('não deve restringir endpoints operacionais do Backoffice com @RequireAdmin()', () => {
    const operationalMethods: Array<keyof SchedulingController> = [
      'createLocal',
      'updateLocal',
      'createOption',
      'updateOption',
      'concludeBooking',
      'markAbsentBooking',
      'cancelBooking',
      'importBookings',
    ];

    for (const method of operationalMethods) {
      const requireAdmin = reflector.get<boolean>(
        REQUIRE_ADMIN_KEY,
        SchedulingController.prototype[method],
      );
      expect(requireAdmin).toBeUndefined();
    }
  });

  it('deve PERMITIR usuário não-SuperAdmin com módulo avulso "backoffice" nos endpoints operacionais', async () => {
    db.where
      .mockResolvedValueOnce([{ slug: 'backoffice' }])
      .mockResolvedValueOnce([]);

    const userWithBackoffice = {
      id: 'user-backoffice-1',
      isSuperAdmin: false,
      isDisabled: false,
    };

    await expect(
      guard.canActivate(
        mockContext(userWithBackoffice, SchedulingController.prototype.listBookings),
      ),
    ).resolves.toBe(true);

    await expect(
      guard.canActivate(
        mockContext(userWithBackoffice, SchedulingController.prototype.createLocal),
      ),
    ).resolves.toBe(true);

    await expect(
      guard.canActivate(
        mockContext(userWithBackoffice, SchedulingController.prototype.concludeBooking),
      ),
    ).resolves.toBe(true);

    await expect(
      guard.canActivate(
        mockContext(userWithBackoffice, SchedulingController.prototype.importBookings),
      ),
    ).resolves.toBe(true);
  });

  it('deve BLOQUEAR (ForbiddenException) usuário não-SuperAdmin sem permissão em "backoffice" ou "scheduling"', async () => {
    db.where
      .mockResolvedValueOnce([{ slug: 'tutoria' }])
      .mockResolvedValueOnce([]);

    const unauthorizedUser = {
      id: 'user-other-1',
      isSuperAdmin: false,
      isDisabled: false,
    };

    await expect(
      guard.canActivate(
        mockContext(unauthorizedUser, SchedulingController.prototype.listBookings),
      ),
    ).rejects.toThrow(ForbiddenException);
  });
});
