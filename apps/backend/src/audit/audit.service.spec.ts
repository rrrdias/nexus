import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from './audit.service';
import { DB_CONNECTION } from '../db/db.provider';

describe('AuditService', () => {
  let service: AuditService;
  let mockDb: any;

  beforeEach(async () => {
    mockDb = {
      execute: jest.fn().mockResolvedValue([]),
      insert: jest.fn().mockReturnValue({
        values: jest.fn().mockResolvedValue([]),
      }),
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{ total: 10 }]),
          leftJoin: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              orderBy: jest.fn().mockReturnValue({
                limit: jest.fn().mockReturnValue({
                  offset: jest.fn().mockResolvedValue([
                    {
                      id: 'log-1',
                      action: 'LOGIN',
                      category: 'AUTH',
                      status: 'SUCCESS',
                      timestamp: new Date(),
                    },
                  ]),
                }),
              }),
            }),
          }),
        }),
      }),
      update: jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: DB_CONNECTION,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should record an audit log successfully', async () => {
    await service.record({
      action: 'LOGIN',
      category: 'AUTH',
      status: 'SUCCESS',
      userEmail: 'admin@unievangelica.edu.br',
      ipAddress: '127.0.0.1',
    });

    expect(mockDb.insert).toHaveBeenCalled();
  });

  it('should not throw error when recording fails', async () => {
    mockDb.insert = jest.fn().mockImplementation(() => {
      throw new Error('Database connection lost');
    });

    await expect(
      service.record({
        action: 'TEST',
      }),
    ).resolves.not.toThrow();
  });

  it('should call onModuleInit and execute schema check', async () => {
    await service.onModuleInit();
    expect(mockDb.execute).toHaveBeenCalled();
  });
});
