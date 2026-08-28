import { Test, TestingModule } from '@nestjs/testing';
import { AvaReportsController } from './ava-reports.controller';
import { AvaReportsService } from './ava-reports.service';

describe('AvaReportsController', () => {
  let controller: AvaReportsController;
  let avaReportsService: any;

  beforeEach(async () => {
    avaReportsService = {
      getProgressData: jest.fn().mockResolvedValue({ total_records: 10, data: [] }),
      getGradesData: jest.fn().mockResolvedValue({ total_records: 10, data: [] }),
      getAvaDashboardStats: jest.fn().mockResolvedValue({ totalStudents: 10 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AvaReportsController],
      providers: [
        {
          provide: AvaReportsService,
          useValue: avaReportsService,
        },
      ],
    }).compile();

    controller = module.get<AvaReportsController>(AvaReportsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call getProgressData', async () => {
    const req = { user: { id: '1', isSuperAdmin: true } };
    const res = await controller.getProgressData(req, 1, 15, {});
    expect(avaReportsService.getProgressData).toHaveBeenCalledWith(req.user, 1, 15, {});
    expect(res).toEqual({ total_records: 10, data: [] });
  });
});
