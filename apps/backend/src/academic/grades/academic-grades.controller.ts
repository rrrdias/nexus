import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Optional,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { RequireAdmin, RequireModule } from '../../auth/rbac.decorators';
import { JobsService } from '../../jobs/jobs.service';
import { AcademicGradesMirrorService } from './academic-grades-mirror.service';
import { AcademicGradesSearchService } from './academic-grades-search.service';
import { GradesQueryDto, TurmaStudentsQueryDto } from './dto/grades-query.dto';
import {
  SyncAvaCorrelateDto,
  SyncGradesMirrorDto,
} from './dto/sync-grades-mirror.dto';
import { ExportGradesDto } from './dto/export-grades.dto';

@RequireModule('academic')
@Controller('api/academic/grades')
export class AcademicGradesController {
  constructor(
    private readonly mirrorService: AcademicGradesMirrorService,
    private readonly searchService: AcademicGradesSearchService,
    @Optional() private readonly jobsService?: JobsService,
  ) {}

  @Get('turmas')
  async listOnlineTurmas(@Query() query: GradesQueryDto) {
    return this.searchService.listOnlineTurmas(query);
  }

  @Get('export')
  async exportGrades(@Query() query: ExportGradesDto) {
    const data = await this.searchService.exportGradesData(query);
    return {
      success: true,
      total: data.length,
      data,
    };
  }

  @Get('turmas/:turmaId')
  async getTurmaDetails(@Param('turmaId') turmaId: string) {
    if (!turmaId?.trim()) {
      throw new BadRequestException('Identificador da turma é obrigatório.');
    }
    return this.searchService.getTurmaDetails(turmaId.trim());
  }

  @Get('turmas/:turmaId/alunos')
  async getTurmaStudents(
    @Param('turmaId') turmaId: string,
    @Query() query: TurmaStudentsQueryDto,
  ) {
    if (!turmaId?.trim()) {
      throw new BadRequestException('Identificador da turma é obrigatório.');
    }
    return this.searchService.getTurmaGradesWithStudents(turmaId.trim(), query);
  }

  @Get('alunos/:matricula/notas')
  async getStudentGrades(
    @Param('matricula') matricula: string,
    @Query('periodo') periodo?: string,
  ) {
    if (!matricula?.trim()) {
      throw new BadRequestException('Matrícula do aluno é obrigatória.');
    }
    const data = await this.searchService.getStudentGradesHistory(
      matricula.trim(),
      periodo,
    );
    return {
      success: true,
      matricula: matricula.trim(),
      data,
    };
  }

  @RequireAdmin()
  @Post('sync-mirror')
  async syncMirror(@Body() dto: SyncGradesMirrorDto = {}) {
    if (dto.async && this.jobsService) {
      const { jobId, queue } =
        await this.jobsService.addAcademicGradesMirrorJob({
          periodo: dto.periodo,
          correlateAfter: dto.correlateAfter,
        });
      return {
        status: 'queued',
        queued: true,
        jobId,
        queue,
        message:
          'Job de espelhamento de turmas 100% online enfileirado com sucesso.',
      };
    }

    const mirror = await this.mirrorService.syncMirror100Online(dto.periodo);
    const correlation =
      dto.correlateAfter === false
        ? null
        : await this.searchService.correlateAllOnlineTurmas(dto.periodo);

    return {
      status: 'completed',
      queued: false,
      mirror,
      correlation,
    };
  }

  @RequireAdmin()
  @Post('sync-ava-correlate')
  async syncAvaCorrelate(@Body() dto: SyncAvaCorrelateDto = {}) {
    if (dto.async && this.jobsService) {
      const { jobId, queue } =
        await this.jobsService.addAcademicGradesCorrelateJob({
          periodo: dto.periodo,
          turmaId: dto.turmaId,
        });
      return {
        status: 'queued',
        queued: true,
        jobId,
        queue,
        message:
          'Job de correlação de notas com o AVA enfileirado com sucesso.',
      };
    }

    if (dto.turmaId?.trim()) {
      const result = await this.searchService.correlateGradesForTurma(
        dto.turmaId.trim(),
      );
      return {
        status: 'completed',
        queued: false,
        ...result,
      };
    }

    const result = await this.searchService.correlateAllOnlineTurmas(
      dto.periodo,
    );
    return {
      status: 'completed',
      queued: false,
      ...result,
    };
  }
}
