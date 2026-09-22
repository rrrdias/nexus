import { Controller, Get, Post, Put, Delete, Body, Param, Query, Res, BadRequestException } from '@nestjs/common';
import type { Response } from 'express';
import { SchedulingService } from './scheduling.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { CreateLocalDto } from './dto/create-local.dto';
import { UpdateLocalDto } from './dto/update-local.dto';
import { CreateOptionDto } from './dto/create-option.dto';
import { UpdateOptionDto } from './dto/update-option.dto';
import { RequireAdmin, RequireModule } from '../auth/rbac.decorators';

@RequireModule('scheduling', 'backoffice')
@Controller('api/scheduling')
export class SchedulingController {
  constructor(private readonly schedulingService: SchedulingService) {}

  @Get('locals')
  listLocals(@Query('todos') todos?: string) {
    return this.schedulingService.listLocals(todos === 'true');
  }

  @RequireAdmin()
  @Post('locals')
  async createLocal(@Body() body: CreateLocalDto) {
    return this.schedulingService.createLocal(body);
  }

  @RequireAdmin()
  @Put('locals/:id')
  async updateLocal(
    @Param('id') id: string,
    @Body() body: UpdateLocalDto
  ) {
    return this.schedulingService.updateLocal(id, body);
  }

  // 2. Options/Slots
  @Get('options')
  listOptions(
    @Query('localId') localId?: string,
    @Query('data') data?: string,
    @Query('apenasDisponiveis') apenasDisponiveis?: string,
    @Query('incluirInativos') incluirInativos?: string
  ) {
    return this.schedulingService.listOptions({
      localId,
      data,
      apenasDisponiveis: apenasDisponiveis === 'true',
      incluirInativos: incluirInativos === 'true'
    });
  }

  @RequireAdmin()
  @Post('options')
  async createOption(@Body() body: CreateOptionDto) {
    return this.schedulingService.createOption(body);
  }

  @RequireAdmin()
  @Put('options/:id')
  async updateOption(
    @Param('id') id: string,
    @Body() body: UpdateOptionDto
  ) {
    return this.schedulingService.updateOption(id, body);
  }

  // 3. Profiles
  @Get('profile/:matricula/:periodo')
  getStudentProfile(
    @Param('matricula') matricula: string,
    @Param('periodo') periodo: string
  ) {
    return this.schedulingService.getStudentProfile(matricula, periodo);
  }

  // 4. Bookings
  @Get('bookings')
  listBookings(
    @Query('matricula') matricula?: string,
    @Query('localId') localId?: string,
    @Query('periodo') periodo?: string,
    @Query('data') data?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('size') size?: string
  ) {
    return this.schedulingService.listBookings({
      matricula,
      localId,
      periodo,
      data,
      status,
      page: page ? parseInt(page) : undefined,
      size: size ? parseInt(size) : undefined
    });
  }

  @Post('bookings')
  createBooking(@Body() dto: CreateBookingDto) {
    return this.schedulingService.createBooking(dto);
  }

  @RequireAdmin()
  @Post('bookings/:id/conclude')
  async concludeBooking(@Param('id') id: string) {
    return this.schedulingService.concludeBooking(id);
  }

  @RequireAdmin()
  @Post('bookings/:id/absent')
  async markAbsentBooking(@Param('id') id: string) {
    return this.schedulingService.markAbsentBooking(id);
  }

  @RequireAdmin()
  @Delete('bookings/:id')
  async cancelBooking(@Param('id') id: string) {
    return this.schedulingService.cancelBooking(id);
  }

  // 5. Excel/CSV Export
  @Get('export')
  async exportBookings(
    @Query('matricula') matricula: string | undefined,
    @Query('localId') localId: string | undefined,
    @Query('periodo') periodo: string | undefined,
    @Query('data') data: string | undefined,
    @Query('status') status: string | undefined,
    @Res() res: Response
  ) {
    const records = await this.schedulingService.getExportData({
      matricula,
      localId,
      periodo,
      data,
      status
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=agendamentos.csv');
    
    // UTF-8 BOM for Microsoft Excel
    res.write('\uFEFF');
    
    // Header Row
    res.write('Matrícula,Nome,E-mail,Campus,Data Prova,Hora Início,Período,Status,Disciplinas Agendadas,Criado Em\n');
    
    // Content Rows
    for (const row of records) {
      const disciplines = row.descricao.replace(/"/g, '""');
      const studentName = row.studentName.replace(/"/g, '""');
      const studentEmail = row.studentEmail.replace(/"/g, '""');
      const localNome = row.localNome.replace(/"/g, '""');
      const bookingDate = new Date(row.data).toLocaleDateString('pt-BR');
      const createdAt = new Date(row.createdAt).toLocaleString('pt-BR');
      
      res.write(`"${row.matricula}","${studentName}","${studentEmail}","${localNome}","${bookingDate}","${row.hora.slice(0, 5)}","${row.periodo}","${row.status}","${disciplines}","${createdAt}"\n`);
    }

    res.end();
  }

  @RequireAdmin()
  @Post('import')
  async importBookings(@Body() body: { bookings: any[] }) {
    if (!body.bookings || !Array.isArray(body.bookings)) {
      throw new BadRequestException('Formato inválido. Esperado array de bookings.');
    }
    return this.schedulingService.importBookings(body.bookings);
  }
}

