import { Controller, Get, Post, Put, Delete, Body, Param, Query, Res, Req, BadRequestException } from '@nestjs/common';
import type { Response } from 'express';
import { SchedulingService } from './scheduling.service';
import { CreateBookingDto } from './dto/create-booking.dto';

@Controller('api/scheduling')
export class SchedulingController {
  constructor(private readonly schedulingService: SchedulingService) {}

  @Get('locals')
  listLocals(@Query('todos') todos?: string) {
    return this.schedulingService.listLocals(todos === 'true');
  }

  @Post('locals')
  async createLocal(
    @Req() req: any,
    @Body() body: { nome: string; endereco: string; linkLocal?: string; telefone?: string }
  ) {
    await this.schedulingService.assertSchedulingAdminAccess(req.user);
    if (!body.nome || !body.endereco) {
      throw new BadRequestException('Nome e endereço são obrigatórios.');
    }
    return this.schedulingService.createLocal(body);
  }

  @Put('locals/:id')
  async updateLocal(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: Partial<{ nome: string; endereco: string; linkLocal: string; telefone: string; status: boolean }>
  ) {
    await this.schedulingService.assertSchedulingAdminAccess(req.user);
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

  @Post('options')
  async createOption(
    @Req() req: any,
    @Body() body: { localId: string; data: string; horaInicio: string; horaFim: string; vagas: number }
  ) {
    await this.schedulingService.assertSchedulingAdminAccess(req.user);
    if (!body.localId || !body.data || !body.horaInicio || !body.horaFim || body.vagas === undefined) {
      throw new BadRequestException('Todos os campos (localId, data, horaInicio, horaFim, vagas) são obrigatórios.');
    }
    return this.schedulingService.createOption(body);
  }

  @Put('options/:id')
  async updateOption(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: Partial<{ vagas: number; status: boolean }>
  ) {
    await this.schedulingService.assertSchedulingAdminAccess(req.user);
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
    if (!dto.opcaoId || !dto.matricula || !dto.periodo) {
      throw new BadRequestException('OpcaoId, Matricula e Periodo são obrigatórios.');
    }
    return this.schedulingService.createBooking(dto);
  }

  @Post('bookings/:id/conclude')
  async concludeBooking(@Req() req: any, @Param('id') id: string) {
    await this.schedulingService.assertSchedulingAdminAccess(req.user);
    return this.schedulingService.concludeBooking(id);
  }

  @Post('bookings/:id/absent')
  async markAbsentBooking(@Req() req: any, @Param('id') id: string) {
    await this.schedulingService.assertSchedulingAdminAccess(req.user);
    return this.schedulingService.markAbsentBooking(id);
  }

  @Delete('bookings/:id')
  async cancelBooking(@Req() req: any, @Param('id') id: string) {
    await this.schedulingService.assertSchedulingAdminAccess(req.user);
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

  @Post('import')
  async importBookings(@Req() req: any, @Body() body: { bookings: any[] }) {
    await this.schedulingService.assertSchedulingAdminAccess(req.user);
    if (!body.bookings || !Array.isArray(body.bookings)) {
      throw new BadRequestException('Formato inválido. Esperado array de bookings.');
    }
    return this.schedulingService.importBookings(body.bookings);
  }
}

