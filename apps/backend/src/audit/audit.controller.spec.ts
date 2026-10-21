import { Test, TestingModule } from '@nestjs/testing';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

describe('AuditController', () => {
  let controller: AuditController;
  let mockAuditService: any;

  beforeEach(async () => {
    mockAuditService = {
      findAll: jest.fn().mockResolvedValue({
        page: 1,
        size: 20,
        total_records: 1,
        total_pages: 1,
        data: [{ id: 'log-1', action: 'LOGIN' }],
      }),
      getStats: jest.fn().mockResolvedValue({
        loginsToday: 5,
        loginsFailedToday: 1,
        actionsToday: 10,
        uniqueUsersToday: 4,
        totalLogsWeek: 50,
      }),
      exportData: jest.fn().mockResolvedValue([
        {
          Data: '20/10/2026 10:00:00',
          Usuario: 'Admin',
          Email: 'admin@test.com',
          Categoria: 'AUTH',
          Acao: 'LOGIN',
          Status: 'SUCCESS',
        },
      ]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditController],
      providers: [
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
      ],
    }).compile();

    controller = module.get<AuditController>(AuditController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call auditService.findAll', async () => {
    const res = await controller.getLogs({ page: 1, size: 20 });
    expect(mockAuditService.findAll).toHaveBeenCalledWith({
      page: 1,
      size: 20,
    });
    expect(res.total_records).toBe(1);
  });

  it('should call auditService.getStats', async () => {
    const res = await controller.getStats();
    expect(mockAuditService.getStats).toHaveBeenCalled();
    expect(res.loginsToday).toBe(5);
  });

  it('should call auditService.exportData', async () => {
    const res = await controller.exportLogs({});
    expect(mockAuditService.exportData).toHaveBeenCalledWith({});
    expect(res.length).toBe(1);
  });
});
