import { Test, TestingModule } from '@nestjs/testing';
import { AvaReportsController } from './ava-reports.controller';

describe('AvaReportsController', () => {
  let controller: AvaReportsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AvaReportsController],
    }).compile();

    controller = module.get<AvaReportsController>(AvaReportsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
