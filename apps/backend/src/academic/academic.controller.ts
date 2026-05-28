import { Controller, Get, Query, Param, BadRequestException } from '@nestjs/common';
import { AcademicService } from './academic.service';

@Controller('academic')
export class AcademicController {
  constructor(private readonly academicService: AcademicService) {}

  @Get('discentes')
  async getStudents(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('size') size?: string,
  ) {
    const pageNum = page ? parseInt(page) : 1;
    const sizeNum = size ? parseInt(size) : 15;
    
    if (isNaN(pageNum) || pageNum < 1) throw new BadRequestException('Página inválida.');
    if (isNaN(sizeNum) || sizeNum < 1) throw new BadRequestException('Tamanho de página inválido.');

    return this.academicService.getStudents(search, pageNum, sizeNum);
  }

  @Get('discentes/:matricula/disciplinas')
  async getStudentDisciplines(@Param('matricula') matricula: string) {
    if (!matricula) throw new BadRequestException('Matrícula é obrigatória.');
    const data = await this.academicService.getStudentDisciplines(matricula);
    return { success: true, data };
  }

  @Get('docentes')
  async getTeachers(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('size') size?: string,
  ) {
    const pageNum = page ? parseInt(page) : 1;
    const sizeNum = size ? parseInt(size) : 15;

    if (isNaN(pageNum) || pageNum < 1) throw new BadRequestException('Página inválida.');
    if (isNaN(sizeNum) || sizeNum < 1) throw new BadRequestException('Tamanho de página inválido.');

    return this.academicService.getTeachers(search, pageNum, sizeNum);
  }

  @Get('docentes/:docenteId/disciplinas')
  async getTeacherDisciplines(@Param('docenteId') docenteId: string) {
    if (!docenteId) throw new BadRequestException('Identificador do docente é obrigatório.');
    const data = await this.academicService.getTeacherDisciplines(docenteId);
    return { success: true, data };
  }

  @Get('turmas')
  async getClasses(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('size') size?: string,
  ) {
    const pageNum = page ? parseInt(page) : 1;
    const sizeNum = size ? parseInt(size) : 15;

    if (isNaN(pageNum) || pageNum < 1) throw new BadRequestException('Página inválida.');
    if (isNaN(sizeNum) || sizeNum < 1) throw new BadRequestException('Tamanho de página inválido.');

    return this.academicService.getClasses(search, pageNum, sizeNum);
  }
}
