import { Test, TestingModule } from '@nestjs/testing';
import { AvaSyncController } from './ava-sync.controller';
import { AvaSyncService } from './ava-sync.service';

describe('AvaSyncController', () => {
  let controller: AvaSyncController;
  let avaSyncService: any;

  beforeEach(async () => {
    avaSyncService = {
      syncGrades: jest.fn().mockResolvedValue({ status: 'success' }),
      syncProgress: jest.fn().mockResolvedValue({ status: 'success' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AvaSyncController],
      providers: [
        {
          provide: AvaSyncService,
          useValue: avaSyncService,
        },
      ],
    }).compile();

    controller = module.get<AvaSyncController>(AvaSyncController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
