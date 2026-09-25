import { Test, TestingModule } from '@nestjs/testing';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { QUEUE_ACADEMIC_SYNC } from './jobs.constants';

describe('JobsController', () => {
  let controller: JobsController;
  let jobsService: any;

  beforeEach(async () => {
    jobsService = {
      getJobStatus: jest.fn().mockResolvedValue({
        id: 'job-123',
        queue: QUEUE_ACADEMIC_SYNC,
        state: 'active',
        progress: 50,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [JobsController],
      providers: [
        {
          provide: JobsService,
          useValue: jobsService,
        },
      ],
    }).compile();

    controller = module.get<JobsController>(JobsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call jobsService.getJobStatus with params', async () => {
    const result = await controller.getStatus(QUEUE_ACADEMIC_SYNC, 'job-123');
    expect(jobsService.getJobStatus).toHaveBeenCalledWith(
      QUEUE_ACADEMIC_SYNC,
      'job-123',
    );
    expect(result).toEqual({
      id: 'job-123',
      queue: QUEUE_ACADEMIC_SYNC,
      state: 'active',
      progress: 50,
    });
  });
});
