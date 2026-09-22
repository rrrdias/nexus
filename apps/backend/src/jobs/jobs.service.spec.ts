import { Test, TestingModule } from '@nestjs/testing';
import { JobsService } from './jobs.service';
import { getQueueToken } from '@nestjs/bullmq';
import { QUEUE_ACADEMIC_SYNC, QUEUE_AVA_SYNC, JOB_ACADEMIC_SYNC, JOB_AVA_SYNC } from './jobs.constants';
import { NotFoundException } from '@nestjs/common';

describe('JobsService', () => {
  let service: JobsService;
  let academicQueue: any;
  let avaQueue: any;

  beforeEach(async () => {
    academicQueue = {
      getActive: jest.fn().mockResolvedValue([]),
      getWaiting: jest.fn().mockResolvedValue([]),
      add: jest.fn().mockResolvedValue({ id: 'job-acad-123' }),
      getJob: jest.fn(),
    };

    avaQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-ava-456' }),
      getJob: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobsService,
        {
          provide: getQueueToken(QUEUE_ACADEMIC_SYNC),
          useValue: academicQueue,
        },
        {
          provide: getQueueToken(QUEUE_AVA_SYNC),
          useValue: avaQueue,
        },
      ],
    }).compile();

    service = module.get<JobsService>(JobsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('addAcademicSyncJob', () => {
    it('should create a new job if none active or waiting', async () => {
      const result = await service.addAcademicSyncJob();
      expect(result).toEqual({ jobId: 'job-acad-123', queue: QUEUE_ACADEMIC_SYNC });
      expect(academicQueue.add).toHaveBeenCalledWith(
        JOB_ACADEMIC_SYNC,
        {},
        expect.objectContaining({ attempts: 3 })
      );
    });

    it('should reuse existing job if one is already active', async () => {
      academicQueue.getActive.mockResolvedValue([{ id: 'existing-job-1' }]);
      const result = await service.addAcademicSyncJob();
      expect(result).toEqual({ jobId: 'existing-job-1', queue: QUEUE_ACADEMIC_SYNC });
      expect(academicQueue.add).not.toHaveBeenCalled();
    });
  });

  describe('addAvaSyncJob', () => {
    it('should enqueue a new AVA sync job', async () => {
      const result = await service.addAvaSyncJob({ institution: 'ead', type: 'grades' });
      expect(result).toEqual({ jobId: 'job-ava-456', queue: QUEUE_AVA_SYNC });
      expect(avaQueue.add).toHaveBeenCalledWith(
        JOB_AVA_SYNC,
        { institution: 'ead', type: 'grades' },
        expect.objectContaining({ attempts: 2 })
      );
    });
  });

  describe('getJobStatus', () => {
    it('should throw NotFoundException for invalid queue', async () => {
      await expect(service.getJobStatus('invalid-queue', '123')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if job not found', async () => {
      academicQueue.getJob.mockResolvedValue(null);
      await expect(service.getJobStatus(QUEUE_ACADEMIC_SYNC, '999')).rejects.toThrow(NotFoundException);
    });

    it('should return formatted job status when job exists', async () => {
      const mockJob = {
        id: 'job-123',
        name: JOB_ACADEMIC_SYNC,
        getState: jest.fn().mockResolvedValue('active'),
        progress: { progress: 45, step: 'Sincronizando Turmas' },
        data: {},
        returnvalue: null,
        failedReason: undefined,
        timestamp: 1600000000,
        processedOn: 1600000010,
        finishedOn: undefined,
        attemptsMade: 1,
      };

      academicQueue.getJob.mockResolvedValue(mockJob);

      const status = await service.getJobStatus(QUEUE_ACADEMIC_SYNC, 'job-123');
      expect(status).toEqual({
        id: 'job-123',
        queue: QUEUE_ACADEMIC_SYNC,
        name: JOB_ACADEMIC_SYNC,
        state: 'active',
        progress: 45,
        step: 'Sincronizando Turmas',
        data: {},
        result: null,
        failedReason: undefined,
        timestamp: 1600000000,
        processedOn: 1600000010,
        finishedOn: undefined,
        attemptsMade: 1,
      });
    });
  });
});
