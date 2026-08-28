import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { SchedulingService } from './scheduling.service';

describe('SchedulingService (createOption stability test & RBAC)', () => {
  let service: SchedulingService;
  let db: any;

  beforeEach(() => {
    const queryBuilder = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn(),
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      returning: jest.fn(),
      transaction: jest.fn().mockImplementation((cb) => cb(queryBuilder)),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
    };

    db = queryBuilder;
    service = new SchedulingService(db);
  });

  it('should generate valid 30-min slots without infinite loop', async () => {
    db.limit.mockResolvedValue([{ id: 'local-1', nome: 'Campus Anápolis' }]);
    db.returning.mockImplementation(async () => [
      { id: '1', hora: '08:00:00' },
      { id: '2', hora: '08:30:00' },
      { id: '3', hora: '09:00:00' },
      { id: '4', hora: '09:30:00' },
    ]);

    const result = await service.createOption({
      localId: 'local-1',
      data: '2026-09-01',
      horaInicio: '08:00',
      horaFim: '10:00',
      vagas: 25,
    });

    expect(db.values).toHaveBeenCalled();
    const calls = db.values.mock.calls[0][0];
    expect(calls).toHaveLength(4);
    expect(calls[0].hora).toBe('08:00:00');
    expect(calls[1].hora).toBe('08:30:00');
    expect(calls[2].hora).toBe('09:00:00');
    expect(calls[3].hora).toBe('09:30:00');
  });

  it('should REJECT invalid time formats immediately without hanging (Anti-DoS)', async () => {
    db.limit.mockResolvedValue([{ id: 'local-1', nome: 'Campus Anápolis' }]);

    await expect(service.createOption({
      localId: 'local-1',
      data: '2026-09-01',
      horaInicio: 'invalid_time',
      horaFim: '10:00',
      vagas: 25,
    })).rejects.toThrow(BadRequestException);
  });

  it('should REJECT when horaFim is earlier than horaInicio without hanging', async () => {
    db.limit.mockResolvedValue([{ id: 'local-1', nome: 'Campus Anápolis' }]);

    await expect(service.createOption({
      localId: 'local-1',
      data: '2026-09-01',
      horaInicio: '10:00',
      horaFim: '08:00',
      vagas: 25,
    })).rejects.toThrow(BadRequestException);
  });

  it('should REJECT when interval is less than 30 minutes', async () => {
    db.limit.mockResolvedValue([{ id: 'local-1', nome: 'Campus Anápolis' }]);

    await expect(service.createOption({
      localId: 'local-1',
      data: '2026-09-01',
      horaInicio: '08:00',
      horaFim: '08:15',
      vagas: 25,
    })).rejects.toThrow(BadRequestException);
  });

  it('should ALLOW admin action for Super Admin', async () => {
    await expect(service.assertSchedulingAdminAccess({ id: 'u1', isSuperAdmin: true })).resolves.not.toThrow();
  });

  it('should REJECT admin action for unauthorized user', async () => {
    db.limit.mockResolvedValue([]);
    await expect(service.assertSchedulingAdminAccess({ id: 'u2', isSuperAdmin: false })).rejects.toThrow(UnauthorizedException);
  });
});
