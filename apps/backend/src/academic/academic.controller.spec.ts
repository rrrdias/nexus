import { Test, TestingModule } from '@nestjs/testing';
import { AcademicController } from './academic.controller';
import { AcademicService } from './academic.service';
import { AcademicSyncService } from './academic-sync.service';
import { JobsService } from '../jobs/jobs.service';

describe('AcademicController', () => {
  let controller: AcademicController;
  let academicService: any;
  let syncService: any;
  let jobsService: any;

  beforeEach(async () => {
    academicService = {
      getStudents: jest.fn().mockResolvedValue({ total: 10, data: [] }),
      getStudentDisciplines: jest.fn().mockResolvedValue([]),
      getTeachers: jest.fn().mockResolvedValue({ total: 5, data: [] }),
      getTeacherDisciplines: jest.fn().mockResolvedValue([]),
      getClasses: jest.fn().mockResolvedValue({ total: 2, data: [] }),
      getMatriculas: jest.fn().mockResolvedValue({ total: 20, data: [] }),
    };

    syncService = {
      syncActivePeriods: jest.fn().mockResolvedValue({ status: 'success' }),
    };

    jobsService = {
      addAcademicSyncJob: jest
        .fn()
        .mockResolvedValue({ jobId: 'job-acad-1', queue: 'academic-sync' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AcademicController],
      providers: [
        { provide: AcademicService, useValue: academicService },
        { provide: AcademicSyncService, useValue: syncService },
        { provide: JobsService, useValue: jobsService },
      ],
    }).compile();

    controller = module.get<AcademicController>(AcademicController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should enqueue sync job by default', async () => {
    const res = await controller.triggerSync();
    expect(jobsService.addAcademicSyncJob).toHaveBeenCalled();
    expect(res).toEqual({
      success: true,
      queued: true,
      jobId: 'job-acad-1',
      queue: 'academic-sync',
      message: 'Sincronização do Lyceum enfileirada com sucesso.',
    });
  });

  it('should run synchronously if async=false query param passed', async () => {
    const res = await controller.triggerSync('false');
    expect(syncService.syncActivePeriods).toHaveBeenCalled();
    expect(res).toEqual({ status: 'success' });
  });
});
