import { Test, TestingModule } from '@nestjs/testing';
import { AvaSyncController } from './ava-sync.controller';

describe('AvaSyncController', () => {
  let controller: AvaSyncController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AvaSyncController],
    }).compile();

    controller = module.get<AvaSyncController>(AvaSyncController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
