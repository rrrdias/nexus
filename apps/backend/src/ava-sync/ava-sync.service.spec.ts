import { Test, TestingModule } from '@nestjs/testing';
import { AvaSyncService } from './ava-sync.service';

describe('AvaSyncService', () => {
  let service: AvaSyncService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AvaSyncService],
    }).compile();

    service = module.get<AvaSyncService>(AvaSyncService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
