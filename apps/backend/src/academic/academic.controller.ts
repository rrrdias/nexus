import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  BadRequestException,
} from '@nestjs/common';
import { AcademicService } from './academic.service';
import { AcademicSyncService } from './academic-sync.service';
import { JobsService } from '../jobs/jobs.service';
import { RequireAdmin, RequireModule } from '../auth/rbac.decorators';
import { AcademicQueryDto } from './dto/academic-query.dto';

@RequireModule('academic')
@Controller('api/academic')
export class AcademicController {
  constructor(
    private readonly academicService: AcademicService,
    private readonly syncService: AcademicSyncService,
    private readonly jobsService: JobsService,
  ) {}

  @RequireAdmin()
  @Post('sync')
  async triggerSync(@Query('async') isAsync?: string) {
    if (isAsync === 'false') {
      return this.syncService.syncActivePeriods();
    }
    const { jobId, queue } = await this.jobsService.addAcademicSyncJob();
    return {
      success: true,
      queued: true,
      jobId,
      queue,
      message: 'Sincronização do Lyceum enfileirada com sucesso.',
    };
  }

  @Get('discentes')
  async getStudents(@Query() query: AcademicQueryDto) {
    return this.academicService.getStudents(
      query.search,
      query.page,
      query.size,
    );
  }

  @Get('discentes/:matricula/disciplinas')
  async getStudentDisciplines(@Param('matricula') matricula: string) {
    if (!matricula?.trim())
      throw new BadRequestException('Matrícula é obrigatória.');
    const data = await this.academicService.getStudentDisciplines(
      matricula.trim(),
    );
    return { success: true, data };
  }

  @Get('docentes')
  async getTeachers(@Query() query: AcademicQueryDto) {
    return this.academicService.getTeachers(
      query.search,
      query.page,
      query.size,
    );
  }

  @Get('docentes/:docenteId/disciplinas')
  async getTeacherDisciplines(@Param('docenteId') docenteId: string) {
    if (!docenteId?.trim())
      throw new BadRequestException('Identificador do docente é obrigatório.');
    const data = await this.academicService.getTeacherDisciplines(
      docenteId.trim(),
    );
    return { success: true, data };
  }

  @Get('turmas')
  async getClasses(@Query() query: AcademicQueryDto) {
    return this.academicService.getClasses(
      query.search,
      query.page,
      query.size,
    );
  }

  @Get('matriculas')
  async getMatriculas(@Query() query: AcademicQueryDto) {
    return this.academicService.getMatriculas(
      query.search,
      query.page,
      query.size,
    );
  }
}
