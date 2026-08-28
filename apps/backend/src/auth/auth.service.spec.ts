import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import * as passwordUtil from '../users/password.util';

describe('AuthService (RBAC and Login Test)', () => {
  let service: AuthService;
  let db: any;
  let jwtService: any;

  beforeEach(() => {
    const queryBuilder = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn(),
    };

    db = queryBuilder;

    jwtService = {
      signAsync: jest.fn().mockResolvedValue('signed.jwt.token'),
    };

    service = new AuthService(db, jwtService);
  });

  it('should authenticate user and set isSuperAdmin TRUE when in Super Admin group', async () => {
    jest.spyOn(passwordUtil, 'verifyPassword').mockResolvedValue(true);

    // Mock find user (where returns queryBuilder, limit returns array)
    db.limit.mockResolvedValueOnce([
      {
        id: 'u1',
        name: 'Admin User',
        email: 'admin@unievangelica.edu.br',
        password: '$2a$10$hashedpassword',
        isActive: true,
      }
    ]);

    // Mock find user groups (second query where does not have limit)
    db.where.mockReturnValueOnce(db).mockResolvedValueOnce([
      {
        user_group: { userId: 'u1', groupId: 'g1' },
        group: { id: 'g1', name: 'Super Admin' },
      }
    ]);

    const res = await service.login('admin@unievangelica.edu.br', 'senha123');
    expect(res.access_token).toBe('signed.jwt.token');
    expect(res.user.isSuperAdmin).toBe(true);
    expect(res.user.groups).toContain('Super Admin');
  });

  it('should authenticate user and set isSuperAdmin FALSE when NOT in Super Admin group, even if special email', async () => {
    jest.spyOn(passwordUtil, 'verifyPassword').mockResolvedValue(true);

    // Mock find user with previous hardcoded email
    db.limit.mockResolvedValueOnce([
      {
        id: 'u2',
        name: 'Regular User',
        email: 'rrrdias25@gmail.com',
        password: '$2a$10$hashedpassword',
        isActive: true,
      }
    ]);

    // Mock groups without Super Admin
    db.where.mockReturnValueOnce(db).mockResolvedValueOnce([
      {
        user_group: { userId: 'u2', groupId: 'g2' },
        group: { id: 'g2', name: 'Coordenadores' },
      }
    ]);

    const res = await service.login('rrrdias25@gmail.com', 'senha123');
    expect(res.access_token).toBe('signed.jwt.token');
    expect(res.user.isSuperAdmin).toBe(false);
    expect(res.user.groups).toEqual(['Coordenadores']);
  });

  it('should REJECT invalid password', async () => {
    jest.spyOn(passwordUtil, 'verifyPassword').mockResolvedValue(false);

    db.limit.mockResolvedValueOnce([
      {
        id: 'u1',
        email: 'admin@unievangelica.edu.br',
        password: '$2a$10$hashedpassword',
        isActive: true,
      }
    ]);

    await expect(service.login('admin@unievangelica.edu.br', 'wrongpass')).rejects.toThrow(UnauthorizedException);
  });
});
