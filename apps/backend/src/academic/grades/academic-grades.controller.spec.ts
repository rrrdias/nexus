import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AcademicGradesController } from './academic-grades.controller';
import { AcademicGradesMirrorService } from './academic-grades-mirror.service';
import { AcademicGradesSearchService } from './academic-grades-search.service';
import { JobsService } from '../../jobs/jobs.service';

describe('AcademicGradesController', () => {
  let controller: AcademicGradesController;
  let mirrorService: any;
  let searchService: any;
  let jobsService: any;

  beforeEach(async () => {
    mirrorService = {
      syncMirror100Online: jest.fn().mockResolvedValue({
        periodo: '2026-2',
        turmasEspelhadas: 5,
        matriculasSincronizadas: 120,
        totalMatriculados: 112,
        totalSuspensos: 6,
        totalCancelados: 2,
      }),
    };

    searchService = {
      listOnlineTurmas: jest.fn().mockResolvedValue({
        data: [{ id: 't1', turma: 'DIR-ON-20262' }],
        meta: { total: 1, page: 1, pageSize: 50, totalPages: 1 },
      }),
      getTurmaDetails: jest
        .fn()
        .mockResolvedValue({ id: 't1', turma: 'DIR-ON-20262' }),
      getTurmaGradesWithStudents: jest.fn().mockResolvedValue({
        turma: { id: 't1', turma: 'DIR-ON-20262' },
        alunos: [],
        meta: { total: 0, page: 1, pageSize: 100, totalPages: 1 },
      }),
      getStudentGradesHistory: jest.fn().mockResolvedValue([]),
      correlateGradesForTurma: jest
        .fn()
        .mockResolvedValue({ turmaId: 't1', updatedCount: 30 }),
      correlateAllOnlineTurmas: jest
        .fn()
        .mockResolvedValue({ turmasProcessadas: 5, registrosAtualizados: 120 }),
      exportGradesData: jest.fn().mockResolvedValue([{ matricula: '2026001' }]),
    };

    jobsService = {
      addAcademicGradesMirrorJob: jest.fn().mockResolvedValue({
        jobId: 'job-grades-mirror-1',
        queue: 'academic-sync',
      }),
      addAcademicGradesCorrelateJob: jest.fn().mockResolvedValue({
        jobId: 'job-grades-corr-1',
        queue: 'academic-sync',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AcademicGradesController],
      providers: [
        { provide: AcademicGradesMirrorService, useValue: mirrorService },
        { provide: AcademicGradesSearchService, useValue: searchService },
        { provide: JobsService, useValue: jobsService },
      ],
    }).compile();

    controller = module.get<AcademicGradesController>(AcademicGradesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should list online turmas via SearchService', async () => {
    const query: any = { periodo: '2026-2', page: 1, pageSize: 50 };
    const res = await controller.listOnlineTurmas(query);
    expect(searchService.listOnlineTurmas).toHaveBeenCalledWith(query);
    expect(res.meta.total).toBe(1);
  });

  it('should return turma details and validate empty turmaId', async () => {
    const res = await controller.getTurmaDetails(' t1 ');
    expect(searchService.getTurmaDetails).toHaveBeenCalledWith('t1');
    expect(res.id).toBe('t1');

    await expect(controller.getTurmaDetails('   ')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should list turma students and validate empty turmaId', async () => {
    const query: any = { statusMatricula: 'suspenso', page: 1, pageSize: 100 };
    const res = await controller.getTurmaStudents('t1', query);
    expect(searchService.getTurmaGradesWithStudents).toHaveBeenCalledWith(
      't1',
      query,
    );
    expect(res.turma.id).toBe('t1');

    await expect(controller.getTurmaStudents('', query)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should return student grades history and validate empty matricula', async () => {
    const res = await controller.getStudentGrades(' 2026001 ', '2026-2');
    expect(searchService.getStudentGradesHistory).toHaveBeenCalledWith(
      '2026001',
      '2026-2',
    );
    expect(res).toEqual({ success: true, matricula: '2026001', data: [] });

    await expect(controller.getStudentGrades('  ')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should execute sync-mirror synchronously by default with automatic correlation', async () => {
    const res = await controller.syncMirror({ periodo: '2026-2' });
    expect(mirrorService.syncMirror100Online).toHaveBeenCalledWith('2026-2');
    expect(searchService.correlateAllOnlineTurmas).toHaveBeenCalledWith(
      '2026-2',
    );
    expect(res.status).toBe('completed');
    expect(res.queued).toBe(false);
  });

  it('should enqueue sync-mirror job when async=true', async () => {
    const res = await controller.syncMirror({
      periodo: '2026-2',
      correlateAfter: false,
      async: true,
    });
    expect(jobsService.addAcademicGradesMirrorJob).toHaveBeenCalledWith({
      periodo: '2026-2',
      correlateAfter: false,
    });
    expect(mirrorService.syncMirror100Online).not.toHaveBeenCalled();
    expect(res).toMatchObject({
      status: 'queued',
      queued: true,
      jobId: 'job-grades-mirror-1',
    });
  });

  it('should run sync-ava-correlate for single turma, full period, or async queue', async () => {
    const singleRes = await controller.syncAvaCorrelate({ turmaId: 't1' });
    expect(searchService.correlateGradesForTurma).toHaveBeenCalledWith('t1');
    expect(singleRes).toMatchObject({ status: 'completed', updatedCount: 30 });

    const allRes = await controller.syncAvaCorrelate({ periodo: '2026-2' });
    expect(searchService.correlateAllOnlineTurmas).toHaveBeenCalledWith(
      '2026-2',
    );
    expect(allRes).toMatchObject({
      status: 'completed',
      turmasProcessadas: 5,
    });

    const queuedRes = await controller.syncAvaCorrelate({
      periodo: '2026-2',
      async: true,
    });
    expect(jobsService.addAcademicGradesCorrelateJob).toHaveBeenCalledWith({
      periodo: '2026-2',
      turmaId: undefined,
    });
    expect(queuedRes).toMatchObject({
      status: 'queued',
      queued: true,
      jobId: 'job-grades-corr-1',
    });
  });

  it('should export grades data', async () => {
    const res = await controller.exportGrades({ periodo: '2026-2' });
    expect(searchService.exportGradesData).toHaveBeenCalledWith({
      periodo: '2026-2',
    });
    expect(res).toEqual({
      success: true,
      total: 1,
      data: [{ matricula: '2026001' }],
    });
  });
});
