import { BadRequestException, ForbiddenException } from '@nestjs/common';
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
      limit: jest
        .fn()
        .mockResolvedValue([{ id: 'local-1', nome: 'Campus Anápolis' }]),
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

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should split slots into exact 30-min intervals when duration is divisible by 30', async () => {
    db.returning.mockResolvedValue([
      {
        id: 'opt-1',
        localId: 'local-1',
        data: '2026-09-01',
        horaInicio: '08:00:00',
        horaFim: '08:30:00',
        vagas: 20,
      },
      {
        id: 'opt-2',
        localId: 'local-1',
        data: '2026-09-01',
        horaInicio: '08:30:00',
        horaFim: '09:00:00',
        vagas: 20,
      },
      {
        id: 'opt-3',
        localId: 'local-1',
        data: '2026-09-01',
        horaInicio: '09:00:00',
        horaFim: '09:30:00',
        vagas: 20,
      },
      {
        id: 'opt-4',
        localId: 'local-1',
        data: '2026-09-01',
        horaInicio: '09:30:00',
        horaFim: '10:00:00',
        vagas: 20,
      },
    ]);

    const result = await service.createOption({
      localId: 'local-1',
      data: '2026-09-01',
      horaInicio: '08:00',
      horaFim: '10:00',
      vagas: 20,
    });

    expect(result).toHaveLength(4);
    expect(db.values).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ hora: '08:00:00' }),
        expect.objectContaining({ hora: '08:30:00' }),
        expect.objectContaining({ hora: '09:00:00' }),
        expect.objectContaining({ hora: '09:30:00' }),
      ]),
    );
  });

  it('should REJECT intervals that are NOT exact multiples of 30 minutes', async () => {
    await expect(
      service.createOption({
        localId: 'local-1',
        data: '2026-09-01',
        horaInicio: '08:00',
        horaFim: '08:45',
        vagas: 20,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should REJECT invalid intervals where horaInicio >= horaFim', async () => {
    await expect(
      service.createOption({
        localId: 'local-1',
        data: '2026-09-01',
        horaInicio: '10:00',
        horaFim: '08:00',
        vagas: 20,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should REJECT intervals shorter than 30 minutes', async () => {
    await expect(
      service.createOption({
        localId: 'local-1',
        data: '2026-09-01',
        horaInicio: '08:00',
        horaFim: '08:15',
        vagas: 20,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should ALLOW admin action for Super Admin', async () => {
    await expect(
      service.assertSchedulingAdminAccess({ id: 'u1', isSuperAdmin: true }),
    ).resolves.not.toThrow();
  });

  it('should REJECT admin action for unauthorized user', async () => {
    db.limit.mockResolvedValue([]);
    await expect(
      service.assertSchedulingAdminAccess({ id: 'u2', isSuperAdmin: false }),
    ).rejects.toThrow(ForbiddenException);
  });
});
