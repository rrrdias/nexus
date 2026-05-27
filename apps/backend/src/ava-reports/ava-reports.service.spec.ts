import { Test, TestingModule } from '@nestjs/testing';
import { AvaReportsService } from './ava-reports.service';

describe('AvaReportsService', () => {
  let service: AvaReportsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AvaReportsService],
    }).compile();

    service = module.get<AvaReportsService>(AvaReportsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
