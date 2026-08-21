import { Injectable, Inject, BadRequestException, NotFoundException } from '@nestjs/common';
import { DB_CONNECTION } from '../db/db.provider';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq, and, or, inArray, ilike, sql, isNull, desc } from 'drizzle-orm';
import { locals, opcaos, agendamentosMatricula, avaProgressReport } from '../db/schema';
import { CreateBookingDto } from './dto/create-booking.dto';

function getNextTimeStr(timeStr: string, index: number): string {
  const [h, m] = timeStr.split(':').map(Number);
  const totalMinutes = h * 60 + m + index * 30;
  const newH = Math.floor(totalMinutes / 60) % 24;
  const newM = totalMinutes % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}:00`;
}

@Injectable()
export class SchedulingService {
  constructor(
    @Inject(DB_CONNECTION) private readonly db: PostgresJsDatabase<any>,
  ) {}

  async listLocals(incluirInativos = false) {
    if (incluirInativos) {
      return this.db.select()
        .from(locals)
        .orderBy(locals.nome);
    }
    return this.db.select()
      .from(locals)
      .where(eq(locals.status, true))
      .orderBy(locals.nome);
  }

  async getLocalById(id: string) {
    const [local] = await this.db.select()
      .from(locals)
      .where(eq(locals.id, id))
      .limit(1);
    if (!local) throw new NotFoundException('Campus não encontrado.');
    return local;
  }

  async createLocal(data: { nome: string; endereco: string; linkLocal?: string; telefone?: string }) {
    const [inserted] = await this.db.insert(locals)
      .values({ ...data, status: true })
      .returning();
    return inserted;
  }

  async updateLocal(id: string, data: Partial<{ nome: string; endereco: string; linkLocal: string; telefone: string; status: boolean }>) {
    const [updated] = await this.db.update(locals)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(locals.id, id))
      .returning();
    if (!updated) throw new NotFoundException('Campus não encontrado.');
    return updated;
  }

  async listOptions(filters: { localId?: string; data?: string; apenasDisponiveis?: boolean; incluirInativos?: boolean }) {
    const conditions: any[] = [];
    if (!filters.incluirInativos) {
      conditions.push(eq(opcaos.status, true));
    }

    if (filters.localId) {
      conditions.push(eq(opcaos.localId, filters.localId));
    }
    if (filters.data) {
      conditions.push(eq(opcaos.data, new Date(filters.data)));
    }
    if (filters.apenasDisponiveis) {
      conditions.push(sql`${opcaos.vagas} > 0`);
    }

    return this.db.select({
      id: opcaos.id,
      localId: opcaos.localId,
      localNome: locals.nome,
      data: opcaos.data,
      hora: opcaos.hora,
      vagas: opcaos.vagas,
      status: opcaos.status
    })
      .from(opcaos)
      .innerJoin(locals, eq(opcaos.localId, locals.id))
      .where(and(...conditions))
      .orderBy(opcaos.data, opcaos.hora);
  }

  async createOption(data: { localId: string; data: string; horaInicio: string; horaFim: string; vagas: number }) {
    await this.getLocalById(data.localId);
    
    let currentIndex = 0;
    const times: string[] = [];
    const endT = data.horaFim.includes(':') && data.horaFim.split(':').length === 2 ? `${data.horaFim}:00` : data.horaFim;
    
    while (true) {
      const current = getNextTimeStr(data.horaInicio, currentIndex);
      if (current >= endT) {
        break;
      }
      times.push(current);
      currentIndex++;
    }

    if (times.length === 0) {
      throw new BadRequestException('Horário final deve ser maior que o horário inicial em pelo menos 30 minutos.');
    }

    const inserts = times.map(t => ({
      localId: data.localId,
      data: new Date(data.data),
      hora: t,
      vagas: data.vagas,
      status: true
    }));

    const inserted = await this.db.insert(opcaos)
      .values(inserts)
      .returning();
      
    return inserted;
  }

  async updateOption(id: string, data: Partial<{ vagas: number; status: boolean }>) {
    const [updated] = await this.db.update(opcaos)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(opcaos.id, id))
      .returning();
    if (!updated) throw new NotFoundException('Horário não encontrado.');
    return updated;
  }

  // 3. Student Profile Query (Local AVA tables)
  async getStudentProfile(matricula: string, periodo: string) {
    const studentRecords = await this.db.select()
      .from(avaProgressReport)
      .where(and(
        eq(avaProgressReport.matricula, matricula),
        eq(avaProgressReport.periodo, periodo)
      ));

    if (studentRecords.length === 0) {
      throw new NotFoundException('Estudante não encontrado ou sem disciplinas vinculadas no período atual.');
    }

    const studentName = studentRecords[0].aluno;
    const email = studentRecords[0].usuario;
    const phone = studentRecords[0].userPhone1;
    const disciplines = studentRecords.map(r => r.curso).filter(Boolean);

    return {
      matricula,
      nome: studentName,
      email,
      telefone: phone,
      disciplinas: disciplines,
      totalDisciplinas: disciplines.length
    };
  }

  // 4. Bookings Management (with Locking Transactions)
  async createBooking(dto: CreateBookingDto) {
    const { opcaoId, matricula, periodo } = dto;

    // Validate student exists and retrieve disciplines
    const profile = await this.getStudentProfile(matricula, periodo);
    const totalDisciplines = profile.totalDisciplinas;
    if (totalDisciplines === 0) {
      throw new BadRequestException('O estudante não possui disciplinas matriculadas para realizar agendamentos.');
    }

    // Execute pessimistic transactional slot reservation
    return this.db.transaction(async (tx) => {
      // Check for already active booking
      const existing = await tx.select()
        .from(agendamentosMatricula)
        .where(and(
          eq(agendamentosMatricula.matricula, matricula),
          eq(agendamentosMatricula.periodo, periodo),
          eq(agendamentosMatricula.status, 'ativo')
        ))
        .limit(1);

      if (existing.length > 0) {
        throw new BadRequestException('O estudante já possui um agendamento ativo para este período.');
      }

      // Fetch base slot and Lock it
      const [opcao] = await tx.select()
        .from(opcaos)
        .where(eq(opcaos.id, opcaoId))
        .for('update');

      if (!opcao) throw new NotFoundException('Horário base selecionado não encontrado.');
      if (!opcao.status) throw new BadRequestException('O horário selecionado está desativado.');

      // Calculate consecutive slots needed
      const timeStr = opcao.hora.slice(0, 5); // Format HH:MM
      const requiredTimes = Array.from({ length: totalDisciplines }, (_, i) => getNextTimeStr(timeStr, i));

      // Fetch and Lock all consecutive slots needed
      const slots = await tx.select()
        .from(opcaos)
        .where(and(
          eq(opcaos.localId, opcao.localId),
          eq(opcaos.data, opcao.data),
          inArray(opcaos.hora, requiredTimes),
          eq(opcaos.status, true)
        ))
        .orderBy(opcaos.hora)
        .for('update');

      if (slots.length < requiredTimes.length) {
        throw new BadRequestException('Não há horários consecutivos suficientes disponíveis a partir de ' + timeStr + ' para todas as ' + totalDisciplines + ' disciplinas do aluno.');
      }

      // Check capacity for all slots
      for (const slot of slots) {
        if (slot.vagas <= 0) {
          throw new BadRequestException(`O slot de horário ${slot.hora.slice(0, 5)} já está esgotado.`);
        }
      }

      // Decrement slot vacancies by 1
      for (const slot of slots) {
        await tx.update(opcaos)
          .set({ vagas: slot.vagas - 1, updatedAt: new Date() })
          .where(eq(opcaos.id, slot.id));
      }

      // Insert scheduling entry
      const [booking] = await tx.insert(agendamentosMatricula)
        .values({
          opcaoId,
          matricula,
          descricao: profile.disciplinas.join(';'),
          status: 'ativo',
          periodo,
          data: opcao.data,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();

      return {
        ...booking,
        studentName: profile.nome,
        disciplines: profile.disciplinas
      };
    });
  }

  async cancelBooking(id: string) {
    return this.db.transaction(async (tx) => {
      const [booking] = await tx.select()
        .from(agendamentosMatricula)
        .where(eq(agendamentosMatricula.id, id))
        .for('update');

      if (!booking) throw new NotFoundException('Agendamento não encontrado.');
      if (booking.status === 'cancelado') throw new BadRequestException('Este agendamento já está cancelado.');

      // Fetch base slot
      const [opcao] = await tx.select()
        .from(opcaos)
        .where(eq(opcaos.id, booking.opcaoId))
        .limit(1);

      if (opcao) {
        // Calculate consecutive slots that were occupied
        const disciplines = booking.descricao.split(';');
        const totalDisciplines = disciplines.length;
        const timeStr = opcao.hora.slice(0, 5);
        const requiredTimes = Array.from({ length: totalDisciplines }, (_, i) => getNextTimeStr(timeStr, i));

        // Fetch and Lock all matching slots
        const slots = await tx.select()
          .from(opcaos)
          .where(and(
            eq(opcaos.localId, opcao.localId),
            eq(opcaos.data, opcao.data),
            inArray(opcaos.hora, requiredTimes)
          ))
          .orderBy(opcaos.hora)
          .for('update');

        // Restore vacancy capacity (+1)
        for (const slot of slots) {
          await tx.update(opcaos)
            .set({ vagas: slot.vagas + 1, updatedAt: new Date() })
            .where(eq(opcaos.id, slot.id));
        }
      }

      // Perform soft delete
      const [updated] = await tx.update(agendamentosMatricula)
        .set({
          status: 'cancelado',
          deletedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(agendamentosMatricula.id, id))
        .returning();

      return updated;
    });
  }

  async concludeBooking(id: string) {
    const [booking] = await this.db.select()
      .from(agendamentosMatricula)
      .where(eq(agendamentosMatricula.id, id))
      .limit(1);

    if (!booking) throw new NotFoundException('Agendamento não encontrado.');
    if (booking.status !== 'ativo') throw new BadRequestException('Apenas agendamentos ativos podem ser concluídos.');

    // Prevent future date check-ins
    const bookingDate = new Date(booking.data);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (bookingDate > today) {
      throw new BadRequestException('Não é possível marcar presença em agendamentos de datas futuras.');
    }

    const [updated] = await this.db.update(agendamentosMatricula)
      .set({ status: 'presente', updatedAt: new Date() })
      .where(eq(agendamentosMatricula.id, id))
      .returning();

    return updated;
  }

  async markAbsentBooking(id: string) {
    const [booking] = await this.db.select()
      .from(agendamentosMatricula)
      .where(eq(agendamentosMatricula.id, id))
      .limit(1);

    if (!booking) throw new NotFoundException('Agendamento não encontrado.');
    if (booking.status !== 'ativo') throw new BadRequestException('Apenas agendamentos ativos podem ser marcados como ausentes.');

    // Prevent future date check-ins
    const bookingDate = new Date(booking.data);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (bookingDate > today) {
      throw new BadRequestException('Não é possível marcar falta em agendamentos de datas futuras.');
    }

    const [updated] = await this.db.update(agendamentosMatricula)
      .set({ status: 'ausente', updatedAt: new Date() })
      .where(eq(agendamentosMatricula.id, id))
      .returning();

    return updated;
  }

  // 5. Backoffice Lists & Filters
  async listBookings(filters: {
    matricula?: string;
    localId?: string;
    periodo?: string;
    data?: string;
    status?: string;
    page?: number;
    size?: number;
  }) {
    const page = filters.page || 1;
    const size = filters.size || 15;
    const offset = (page - 1) * size;

    const conditions: any[] = [isNull(agendamentosMatricula.deletedAt)];

    if (filters.matricula) {
      conditions.push(ilike(agendamentosMatricula.matricula, `%${filters.matricula}%`));
    }
    if (filters.localId) {
      conditions.push(eq(opcaos.localId, filters.localId));
    }
    if (filters.periodo) {
      conditions.push(eq(agendamentosMatricula.periodo, filters.periodo));
    }
    if (filters.data) {
      conditions.push(eq(opcaos.data, new Date(filters.data)));
    }
    if (filters.status) {
      conditions.push(eq(agendamentosMatricula.status, filters.status));
    }

    const whereClause = and(...conditions);

    const studentSubquery = this.db.select({
      matricula: avaProgressReport.matricula,
      periodo: avaProgressReport.periodo,
      aluno: sql<string>`max(${avaProgressReport.aluno})`.as('aluno'),
      usuario: sql<string>`max(${avaProgressReport.usuario})`.as('usuario'),
    })
      .from(avaProgressReport)
      .groupBy(avaProgressReport.matricula, avaProgressReport.periodo)
      .as('student_subquery');

    // Get paginated bookings details
    const rawData = await this.db.select({
      id: agendamentosMatricula.id,
      matricula: agendamentosMatricula.matricula,
      descricao: agendamentosMatricula.descricao,
      status: agendamentosMatricula.status,
      periodo: agendamentosMatricula.periodo,
      data: agendamentosMatricula.data,
      createdAt: agendamentosMatricula.createdAt,
      hora: opcaos.hora,
      localId: opcaos.localId,
      localNome: locals.nome,
      studentName: studentSubquery.aluno,
      studentEmail: studentSubquery.usuario,
    })
      .from(agendamentosMatricula)
      .innerJoin(opcaos, eq(agendamentosMatricula.opcaoId, opcaos.id))
      .innerJoin(locals, eq(opcaos.localId, locals.id))
      .leftJoin(
        studentSubquery,
        and(
          eq(studentSubquery.matricula, agendamentosMatricula.matricula),
          eq(studentSubquery.periodo, agendamentosMatricula.periodo)
        )
      )
      .where(whereClause)
      .orderBy(desc(agendamentosMatricula.createdAt))
      .limit(size)
      .offset(offset);

    // Get total count
    const [countResult] = await this.db.select({ count: sql`count(*)` })
      .from(agendamentosMatricula)
      .innerJoin(opcaos, eq(agendamentosMatricula.opcaoId, opcaos.id))
      .innerJoin(locals, eq(opcaos.localId, locals.id))
      .where(whereClause);

    const totalRecords = Number(countResult?.count || 0);
    const totalPages = Math.ceil(totalRecords / size);

    // Hydrate names & emails from synced progress reports
    const bookings = rawData.map((row) => {
      return {
        ...row,
        studentName: row.studentName || 'Estudante Não Identificado',
        studentEmail: row.studentEmail || ''
      };
    });

    return {
      page,
      size,
      total_records: totalRecords,
      total_pages: totalPages,
      data: bookings
    };
  }

  // 6. Export to CSV
  async getExportData(filters: Omit<Parameters<typeof this.listBookings>[0], 'page' | 'size'>) {
    const result = await this.listBookings({ ...filters, page: 1, size: 50000 });
    return result.data;
  }

  // 7. Import from CSV
  async importBookings(rows: any[]) {
    let imported = 0;
    let errors = 0;

    for (const row of rows) {
      try {
        if (!row.matricula || !row.campus || !row.dataProva || !row.horaInicio || !row.periodo || !row.disciplinas) {
          continue;
        }

        // Find or create local
        let localId: string;
        const [existingLocal] = await this.db.select().from(locals).where(ilike(locals.nome, row.campus)).limit(1);
        if (existingLocal) {
          localId = existingLocal.id;
        } else {
          const [newLocal] = await this.db.insert(locals).values({ nome: row.campus, endereco: 'Importado', status: true }).returning();
          localId = newLocal.id;
        }

        // Find or create opcao (slot)
        let opcaoId: string;
        // Handle dates from Excel which might be DD/MM/YYYY or YYYY-MM-DD
        let dateObj: Date;
        if (row.dataProva.includes('/')) {
          const [d, m, y] = row.dataProva.split('/');
          dateObj = new Date(`${y}-${m}-${d}T00:00:00Z`);
        } else {
          dateObj = new Date(`${row.dataProva}T00:00:00Z`);
        }

        const horaStr = row.horaInicio.includes(':') && row.horaInicio.split(':').length === 2 ? `${row.horaInicio}:00` : row.horaInicio;
        
        const [existingOpcao] = await this.db.select().from(opcaos)
          .where(and(eq(opcaos.localId, localId), eq(opcaos.data, dateObj), eq(opcaos.hora, horaStr)))
          .limit(1);

        if (existingOpcao) {
          opcaoId = existingOpcao.id;
        } else {
          const [newOpcao] = await this.db.insert(opcaos).values({
            localId,
            data: dateObj,
            hora: horaStr,
            vagas: 50, // Default for imported
            status: true
          }).returning();
          opcaoId = newOpcao.id;
        }

        // Check if booking already exists
        const [existingBooking] = await this.db.select().from(agendamentosMatricula)
          .where(and(eq(agendamentosMatricula.matricula, row.matricula), eq(agendamentosMatricula.periodo, row.periodo)))
          .limit(1);

        const statusStr = (row.status || 'ativo').toLowerCase();

        if (existingBooking) {
          // Update
          await this.db.update(agendamentosMatricula)
            .set({ 
              status: statusStr, 
              opcaoId, 
              descricao: row.disciplinas, 
              data: dateObj,
              updatedAt: new Date(),
              deletedAt: statusStr === 'cancelado' ? new Date() : null
            })
            .where(eq(agendamentosMatricula.id, existingBooking.id));
        } else {
          // Insert
          await this.db.insert(agendamentosMatricula).values({
            opcaoId,
            matricula: row.matricula,
            descricao: row.disciplinas,
            status: statusStr,
            periodo: row.periodo,
            data: dateObj,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }
        imported++;
      } catch (err) {
        console.error('Error importing row', row, err);
        errors++;
      }
    }

    return { success: true, imported, errors, total: rows.length };
  }
}
