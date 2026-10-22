import {
  Injectable,
  Inject,
  Optional,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
  OnModuleInit,
} from '@nestjs/common';
import { DB_CONNECTION } from '../db/db.provider';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { getDefaultPeriod } from '../config/app-config';
import { AuditService } from '../audit/audit.service';
import {
  eq,
  ne,
  and,
  or,
  inArray,
  ilike,
  sql,
  isNull,
  isNotNull,
  desc,
} from 'drizzle-orm';
import {
  locals,
  opcaos,
  agendamentosMatricula,
  avaProgressReport,
  systemModules,
  usersSystemAccess,
  userGroups,
  groupSystemAccess,
  academicDiscente,
  academicTurma,
  academicMatricula,
} from '../db/schema';
import { CreateBookingDto } from './dto/create-booking.dto';

type SessionUser = {
  id?: string;
  isSuperAdmin?: boolean;
  isDisabled?: boolean;
};

function parseTimeToMinutes(timeStr: string): number | null {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const match = timeStr
    .trim()
    .match(/^([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  return h * 60 + m;
}

function minutesToTimeStr(totalMinutes: number): string {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}

function getNextTimeStr(timeStr: string, index: number): string {
  const startMin = parseTimeToMinutes(timeStr);
  if (startMin === null) {
    return '00:00:00';
  }
  return minutesToTimeStr(startMin + index * 30);
}

function getExamEndTime(startTime: string, disciplinesCount: number): string {
  if (!startTime) return '';
  const startMin = parseTimeToMinutes(startTime);
  if (startMin === null) return '';
  const totalMinutes = startMin + Math.max(1, disciplinesCount) * 30;
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function getNowInSaoPaulo(referenceDate: Date = new Date()): {
  dateStr: string;
  currentMinutes: number;
  timeStr: string;
} {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(referenceDate);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '00';
  const year = get('year');
  const month = get('month');
  const day = get('day');
  const hour = parseInt(get('hour'), 10) % 24;
  const minute = parseInt(get('minute'), 10);

  const dateStr = `${year}-${month}-${day}`;
  const currentMinutes = hour * 60 + minute;
  const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

  return { dateStr, currentMinutes, timeStr };
}

@Injectable()
export class SchedulingService implements OnModuleInit {
  constructor(
    @Inject(DB_CONNECTION) private readonly db: PostgresJsDatabase<any>,
    @Optional() private readonly auditService?: AuditService,
  ) {}

  async onModuleInit() {
    try {
      await this.db.execute(sql`
        DO $$
        DECLARE
            r RECORD;
        BEGIN
            FOR r IN (
                SELECT conname
                FROM pg_constraint
                WHERE conrelid = 'agendamentos_matricula'::regclass
                  AND contype = 'u'
                  AND conname LIKE '%matricula%periodo%'
            ) LOOP
                EXECUTE 'ALTER TABLE "agendamentos_matricula" DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
            END LOOP;
        END $$;
        CREATE UNIQUE INDEX IF NOT EXISTS "unq_agendamento_matricula_periodo_ativo" 
          ON "agendamentos_matricula" ("matricula", "periodo") 
          WHERE "deletedAt" IS NULL;
      `);
      console.log(
        '[SchedulingService] Constraint de agendamentos atualizada para índice condicional (suporta reagendamento após cancelamento).',
      );
    } catch (err: any) {
      console.error(
        '[SchedulingService] Aviso ao inicializar índice de agendamentos no PostgreSQL:',
        err.message,
      );
    }
  }

  async assertSchedulingAdminAccess(user?: SessionUser) {
    if (!user?.id || user.isDisabled) {
      throw new UnauthorizedException('Acesso negado.');
    }

    if (user.isSuperAdmin) return;

    // Check direct user access
    const directAccess = await this.db
      .select({ id: systemModules.id })
      .from(usersSystemAccess)
      .innerJoin(
        systemModules,
        eq(usersSystemAccess.systemModuleId, systemModules.id),
      )
      .where(
        and(
          eq(usersSystemAccess.userId, user.id),
          or(
            eq(systemModules.slug, 'backoffice'),
            eq(systemModules.slug, 'scheduling'),
          ),
          eq(systemModules.isActive, true),
        ),
      )
      .limit(1);

    if (directAccess.length > 0) return;

    // Check group access
    const groupAccess = await this.db
      .select({ id: systemModules.id })
      .from(userGroups)
      .innerJoin(
        groupSystemAccess,
        eq(userGroups.groupId, groupSystemAccess.groupId),
      )
      .innerJoin(
        systemModules,
        eq(groupSystemAccess.systemModuleId, systemModules.id),
      )
      .where(
        and(
          eq(userGroups.userId, user.id),
          or(
            eq(systemModules.slug, 'backoffice'),
            eq(systemModules.slug, 'scheduling'),
          ),
          eq(systemModules.isActive, true),
        ),
      )
      .limit(1);

    if (groupAccess.length === 0) {
      throw new ForbiddenException(
        'Acesso restrito a administradores do módulo de agendamento.',
      );
    }
  }

  async listLocals(incluirInativos = false) {
    if (incluirInativos) {
      return this.db.select().from(locals).orderBy(locals.nome);
    }
    return this.db
      .select()
      .from(locals)
      .where(eq(locals.status, true))
      .orderBy(locals.nome);
  }

  async getLocalById(id: string) {
    const [local] = await this.db
      .select()
      .from(locals)
      .where(eq(locals.id, id))
      .limit(1);
    if (!local) throw new NotFoundException('Campus não encontrado.');
    return local;
  }

  async createLocal(data: {
    nome: string;
    endereco: string;
    linkLocal?: string;
    telefone?: string;
  }) {
    const [inserted] = await this.db
      .insert(locals)
      .values({ ...data, status: true })
      .returning();
    return inserted;
  }

  async updateLocal(
    id: string,
    data: Partial<{
      nome: string;
      endereco: string;
      linkLocal: string;
      telefone: string;
      status: boolean;
    }>,
  ) {
    const [updated] = await this.db
      .update(locals)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(locals.id, id))
      .returning();
    if (!updated) throw new NotFoundException('Campus não encontrado.');
    return updated;
  }

  async listOptions(filters: {
    localId?: string;
    data?: string;
    apenasDisponiveis?: boolean;
    incluirInativos?: boolean;
  }) {
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

    return this.db
      .select({
        id: opcaos.id,
        localId: opcaos.localId,
        localNome: locals.nome,
        data: opcaos.data,
        hora: opcaos.hora,
        vagas: opcaos.vagas,
        status: opcaos.status,
      })
      .from(opcaos)
      .innerJoin(locals, eq(opcaos.localId, locals.id))
      .where(and(...conditions))
      .orderBy(opcaos.data, opcaos.hora);
  }

  async createOption(data: {
    localId: string;
    data: string;
    horaInicio: string;
    horaFim: string;
    vagas: number;
  }) {
    await this.getLocalById(data.localId);

    const startMin = parseTimeToMinutes(data.horaInicio);
    const endMin = parseTimeToMinutes(data.horaFim);

    if (startMin === null || endMin === null) {
      throw new BadRequestException(
        'Formato de horário inválido. Utilize o formato HH:MM (ex: 08:00).',
      );
    }

    if (startMin % 30 !== 0 || endMin % 30 !== 0) {
      throw new BadRequestException(
        'Os horários devem ser múltiplos de 30 minutos (ex: 08:00, 08:30, 09:00).',
      );
    }

    if (endMin <= startMin || endMin - startMin < 30) {
      throw new BadRequestException(
        'Horário final deve ser maior que o horário inicial em pelo menos 30 minutos.',
      );
    }

    if ((endMin - startMin) % 30 !== 0) {
      throw new BadRequestException(
        'O intervalo total entre horário inicial e final deve ser múltiplo exato de 30 minutos.',
      );
    }

    const parsedDate = new Date(data.data);
    if (isNaN(parsedDate.getTime())) {
      throw new BadRequestException('Data informada é inválida.');
    }

    if (typeof data.vagas !== 'number' || data.vagas < 0) {
      throw new BadRequestException(
        'Quantidade de vagas deve ser um número maior ou igual a zero.',
      );
    }

    const times: string[] = [];
    // Laço estritamente finito com passo de 30 minutos (máximo 48 slots por dia)
    for (let currentMin = startMin; currentMin < endMin; currentMin += 30) {
      times.push(minutesToTimeStr(currentMin));
      if (times.length >= 48) break;
    }

    if (times.length === 0) {
      throw new BadRequestException(
        'Horário final deve ser maior que o horário inicial em pelo menos 30 minutos.',
      );
    }

    const inserts = times.map((t) => ({
      localId: data.localId,
      data: parsedDate,
      hora: t,
      vagas: data.vagas,
      status: true,
    }));

    const inserted = await this.db.insert(opcaos).values(inserts).returning();

    return inserted;
  }

  async updateOption(
    id: string,
    data: Partial<{ vagas: number; status: boolean }>,
  ) {
    const [updated] = await this.db
      .update(opcaos)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(opcaos.id, id))
      .returning();
    if (!updated) throw new NotFoundException('Horário não encontrado.');

    return updated;
  }

  private isRegularAvaDiscipline(
    curso: string | null | undefined,
    subcategoria?: string | null,
  ): boolean {
    if (!curso || !curso.trim()) return false;

    if (subcategoria && subcategoria.trim() !== '') {
      const normSub = subcategoria
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase();
      return normSub.includes('REGULAR');
    }

    const normCurso = curso
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase();

    const nonRegularPatterns = [
      'ESTAGIO',
      'EXTENSAO',
      'EXTENSIONISTA',
      'AMBIENTACAO',
      'NIVELAMENTO',
      'ATIVIDADE COMPLEMENTAR',
      'ATIVIDADES COMPLEMENTARES',
      'TRABALHO DE CONCLUSAO',
      'PRATICA PEDAGOGICA',
      'SEMINARIO INTEGRADOR',
      'ATIVIDADES INTERDISCIPLINARES',
      'ATIVIDADE INTERDISCIPLINAR',
      'PRATICA CONTABIL',
      'PROJETO INTEGRADOR',
    ];

    return !nonRegularPatterns.some((pattern) => normCurso.includes(pattern));
  }

  private isNonEadLyceumModality(discente: {
    turno?: string | null;
    cursoInstituicao?: string | null;
    cursoNome?: string | null;
    nomeUnidadeFisica?: string | null;
  }): boolean {
    if (
      discente.cursoInstituicao &&
      discente.cursoInstituicao.trim() !== ''
    ) {
      const normInst = discente.cursoInstituicao
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase();
      if (!normInst.includes('EAD')) {
        return true;
      }
    }

    if (discente.turno && discente.turno.trim() !== '') {
      const normTurno = discente.turno
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase();
      if (
        !normTurno.includes('EAD') &&
        !normTurno.includes('DISTANCIA') &&
        !normTurno.includes('VIRTUAL')
      ) {
        return true;
      }
    }
    return false;
  }

  // 3. Student Profile Query (Hybrid: AVA Reports with Academic / Lyceum Fallback)
  async getStudentProfile(matricula: string, periodo: string) {
    const trimmedMatricula = matricula.trim();
    const trimmedPeriodo = periodo.trim();

    // 1. Try local AVA Progress Report table (case-insensitive for matricula)
    const studentRecords = await this.db
      .select()
      .from(avaProgressReport)
      .where(
        and(
          ilike(avaProgressReport.matricula, trimmedMatricula),
          eq(avaProgressReport.periodo, trimmedPeriodo),
        ),
      );

    if (studentRecords.length > 0) {
      // Restrição 1: Apenas alunos da Graduação EaD (sourceInstitution = 'ead' e não Semipresencial -SEMI)
      const eadRecords = studentRecords.filter((r) => {
        const isEadInst =
          !r.sourceInstitution ||
          r.sourceInstitution.trim().toLowerCase() === 'ead';
        const isSemipresencial =
          Boolean(r.curso && /-SEMI\d{4}/i.test(r.curso)) ||
          Boolean(r.cursoPerfil && /\bSEMI\b/i.test(r.cursoPerfil));
        return isEadInst && !isSemipresencial;
      });

      if (eadRecords.length === 0) {
        throw new BadRequestException(
          'Apenas alunos da Graduação EaD podem realizar o agendamento de provas. A matrícula informada pertence a outra modalidade.',
        );
      }

      // Restrição 2: Apenas disciplinas da categoria REGULARES
      const regularRecords = eadRecords.filter((r) =>
        this.isRegularAvaDiscipline(r.curso, (r as any).subcategoria),
      );

      const disciplines = Array.from(
        new Set(regularRecords.map((r) => r.curso).filter(Boolean)),
      ) as string[];

      if (disciplines.length === 0) {
        throw new BadRequestException(
          'O estudante não possui disciplinas na categoria REGULARES disponíveis para agendamento neste período.',
        );
      }

      const canonicalMatricula = eadRecords[0].matricula || trimmedMatricula.toUpperCase();
      const studentName = eadRecords[0].aluno;
      const email = eadRecords[0].usuario;
      const phone = eadRecords[0].userPhone1;

      return {
        matricula: canonicalMatricula,
        nome: studentName,
        email,
        telefone: phone,
        modalidade: 'Graduação EaD',
        categoria: 'REGULARES',
        disciplinas: disciplines,
        totalDisciplinas: disciplines.length,
      };
    }

    // 2. Fallback to Lyceum Academic tables (academic_discente, academic_matricula, academic_turma)
    const [discente] = await this.db
      .select()
      .from(academicDiscente)
      .where(
        or(
          ilike(academicDiscente.matricula, trimmedMatricula),
          ilike(academicDiscente.usuario, trimmedMatricula),
          ilike(academicDiscente.id, trimmedMatricula),
        ),
      )
      .limit(1);

    if (discente) {
      if (this.isNonEadLyceumModality(discente)) {
        throw new BadRequestException(
          'Apenas alunos da Graduação EaD podem realizar o agendamento de provas. A matrícula informada pertence a outra modalidade.',
        );
      }

      const enrollments = await this.db
        .select({
          nomeDisciplina: academicTurma.nomeDisciplina,
          disciplina: academicTurma.disciplina,
          turma: academicTurma.turma,
        })
        .from(academicMatricula)
        .innerJoin(
          academicTurma,
          eq(academicMatricula.turmaId, academicTurma.id),
        )
        .where(
          and(
            eq(academicMatricula.usuarioId, discente.id),
            eq(academicTurma.periodo, trimmedPeriodo),
            eq(academicMatricula.nivel, '2'),
          ),
        );

      if (enrollments.length > 0) {
        const allRawDisciplines = Array.from(
          new Set(
            enrollments
              .map((e) => e.nomeDisciplina || e.disciplina || e.turma)
              .filter(Boolean),
          ),
        ) as string[];

        const disciplines = allRawDisciplines.filter((d) =>
          this.isRegularAvaDiscipline(d, null),
        );

        if (allRawDisciplines.length > 0 && disciplines.length === 0) {
          throw new BadRequestException(
            'O estudante não possui disciplinas na categoria REGULARES disponíveis para agendamento neste período.',
          );
        }

        if (disciplines.length > 0) {
          const fullName =
            discente.nomeSocial ||
            `${discente.nome || ''} ${discente.sobrenome || ''}`.trim() ||
            'Estudante Não Identificado';
          return {
            matricula: discente.matricula || trimmedMatricula,
            nome: fullName,
            email: discente.email || discente.usuario || '',
            telefone: discente.telefone || '',
            modalidade: 'Graduação EaD',
            categoria: 'REGULARES',
            disciplinas: disciplines,
            totalDisciplinas: disciplines.length,
          };
        }
      }
    }

    throw new NotFoundException(
      'Estudante não encontrado ou sem disciplinas vinculadas no período informado.',
    );
  }

  // 4. Bookings Management (with Locking Transactions)
  async createBooking(dto: CreateBookingDto) {
    const { opcaoId, matricula, periodo } = dto;

    // Validate student exists and retrieve disciplines
    const profile = await this.getStudentProfile(matricula, periodo);
    const totalDisciplines = profile.totalDisciplinas;
    if (totalDisciplines === 0) {
      throw new BadRequestException(
        'O estudante não possui disciplinas matriculadas para realizar agendamentos.',
      );
    }

    // Execute pessimistic transactional slot reservation
    return this.db.transaction(async (tx) => {
      // Check for already active booking
      const existing = await tx
        .select()
        .from(agendamentosMatricula)
        .where(
          and(
            ilike(agendamentosMatricula.matricula, profile.matricula),
            eq(agendamentosMatricula.periodo, periodo),
            eq(agendamentosMatricula.status, 'ativo'),
            isNull(agendamentosMatricula.deletedAt),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        throw new BadRequestException(
          'O estudante já possui um agendamento ativo para este período.',
        );
      }

      // Fetch base slot and Lock it
      const [opcao] = await tx
        .select()
        .from(opcaos)
        .where(eq(opcaos.id, opcaoId))
        .for('update');

      if (!opcao)
        throw new NotFoundException('Horário base selecionado não encontrado.');
      if (!opcao.status)
        throw new BadRequestException('O horário selecionado está desativado.');

      // Validate that booking is not in the past for today or earlier dates in Brazil timezone (America/Sao_Paulo)
      const timeStr = opcao.hora.slice(0, 5); // Format HH:MM
      const { dateStr: todayStr, currentMinutes } = getNowInSaoPaulo();
      const slotDate = opcao.data instanceof Date ? opcao.data : new Date(opcao.data);
      const slotDateStr = `${slotDate.getUTCFullYear()}-${String(slotDate.getUTCMonth() + 1).padStart(2, '0')}-${String(slotDate.getUTCDate()).padStart(2, '0')}`;

      if (slotDateStr < todayStr) {
        throw new BadRequestException('Não é permitido agendar provas para datas passadas.');
      }
      if (slotDateStr === todayStr) {
        const slotMinutes = parseTimeToMinutes(timeStr);
        if (slotMinutes !== null && slotMinutes <= currentMinutes) {
          throw new BadRequestException(
            `O horário ${timeStr} já passou para o dia de hoje. Selecione um horário futuro.`,
          );
        }
      }

      // Calculate required consecutive slots (HH:MM)
      const requiredTimes = Array.from({ length: totalDisciplines }, (_, i) => {
        const startMin = parseTimeToMinutes(timeStr);
        const totalMin = ((startMin! + i * 30) % 1440 + 1440) % 1440;
        const h = Math.floor(totalMin / 60);
        const m = totalMin % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      });

      // Match both HH:MM and HH:MM:00 formats in database
      const allPossibleTimes = [
        ...requiredTimes,
        ...requiredTimes.map((t) => `${t}:00`),
      ];

      // Fetch and Lock all consecutive slots needed
      const slots = await tx
        .select()
        .from(opcaos)
        .where(
          and(
            eq(opcaos.localId, opcao.localId),
            eq(opcaos.data, opcao.data),
            inArray(opcaos.hora, allPossibleTimes),
            eq(opcaos.status, true),
          ),
        )
        .orderBy(opcaos.hora)
        .for('update');

      const matchedTimeMap = new Map<string, typeof opcao>();
      for (const slot of slots) {
        matchedTimeMap.set(slot.hora.slice(0, 5), slot);
      }

      for (const reqTime of requiredTimes) {
        const slot = matchedTimeMap.get(reqTime);
        if (!slot) {
          throw new BadRequestException(
            `Não há horários consecutivos suficientes disponíveis a partir de ${timeStr} para todas as ${totalDisciplines} disciplinas do aluno. Falta o horário ${reqTime}.`,
          );
        }
        if (slot.vagas <= 0) {
          throw new BadRequestException(
            `O horário ${reqTime} já está com as vagas esgotadas.`,
          );
        }
      }

      // Decrement slot vacancies by 1 for all required consecutive slots
      for (const reqTime of requiredTimes) {
        const slot = matchedTimeMap.get(reqTime)!;
        await tx
          .update(opcaos)
          .set({ vagas: slot.vagas - 1, updatedAt: new Date() })
          .where(eq(opcaos.id, slot.id));
      }

      // Insert scheduling entry
      const [booking] = await tx
        .insert(agendamentosMatricula)
        .values({
          opcaoId,
          matricula,
          descricao: profile.disciplinas.join(';'),
          status: 'ativo',
          periodo,
          data: opcao.data,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      return {
        ...booking,
        studentName: profile.nome,
        disciplines: profile.disciplinas,
      };
    });
  }

  async cancelBooking(id: string) {
    return this.db.transaction(async (tx) => {
      const [booking] = await tx
        .select()
        .from(agendamentosMatricula)
        .where(eq(agendamentosMatricula.id, id))
        .for('update');

      if (!booking) throw new NotFoundException('Agendamento não encontrado.');
      if (booking.status === 'cancelado')
        throw new BadRequestException('Este agendamento já está cancelado.');

      // Fetch base slot
      const [opcao] = await tx
        .select()
        .from(opcaos)
        .where(eq(opcaos.id, booking.opcaoId))
        .limit(1);

      if (opcao) {
        // Calculate consecutive slots that were occupied
        const disciplines = booking.descricao.split(';');
        const totalDisciplines = disciplines.length;
        const timeStr = opcao.hora.slice(0, 5);
        const requiredTimes = Array.from({ length: totalDisciplines }, (_, i) =>
          getNextTimeStr(timeStr, i),
        );

        // Fetch and Lock all matching slots
        const slots = await tx
          .select()
          .from(opcaos)
          .where(
            and(
              eq(opcaos.localId, opcao.localId),
              eq(opcaos.data, opcao.data),
              inArray(opcaos.hora, requiredTimes),
            ),
          )
          .orderBy(opcaos.hora)
          .for('update');

        // Restore vacancy capacity (+1)
        for (const slot of slots) {
          await tx
            .update(opcaos)
            .set({ vagas: slot.vagas + 1, updatedAt: new Date() })
            .where(eq(opcaos.id, slot.id));
        }
      }

      // Perform soft delete
      const [updated] = await tx
        .update(agendamentosMatricula)
        .set({
          status: 'cancelado',
          deletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(agendamentosMatricula.id, id))
        .returning();

      return updated;
    });
  }

  async concludeBooking(id: string) {
    const [booking] = await this.db
      .select()
      .from(agendamentosMatricula)
      .where(eq(agendamentosMatricula.id, id))
      .limit(1);

    if (!booking) throw new NotFoundException('Agendamento não encontrado.');
    if (booking.status !== 'ativo')
      throw new BadRequestException(
        'Apenas agendamentos ativos podem ser concluídos.',
      );

    // Prevent future date check-ins
    const bookingDate = new Date(booking.data);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (bookingDate > today) {
      throw new BadRequestException(
        'Não é possível marcar presença em agendamentos de datas futuras.',
      );
    }

    const [updated] = await this.db
      .update(agendamentosMatricula)
      .set({ status: 'presente', updatedAt: new Date() })
      .where(eq(agendamentosMatricula.id, id))
      .returning();

    return updated;
  }

  async markAbsentBooking(id: string) {
    const [booking] = await this.db
      .select()
      .from(agendamentosMatricula)
      .where(eq(agendamentosMatricula.id, id))
      .limit(1);

    if (!booking) throw new NotFoundException('Agendamento não encontrado.');
    if (booking.status !== 'ativo')
      throw new BadRequestException(
        'Apenas agendamentos ativos podem ser marcados como ausentes.',
      );

    // Prevent future date check-ins
    const bookingDate = new Date(booking.data);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (bookingDate > today) {
      throw new BadRequestException(
        'Não é possível marcar falta em agendamentos de datas futuras.',
      );
    }

    const [updated] = await this.db
      .update(agendamentosMatricula)
      .set({ status: 'ausente', updatedAt: new Date() })
      .where(eq(agendamentosMatricula.id, id))
      .returning();

    return updated;
  }

  // 5. Distinct Periods Query
  async getPeriods(): Promise<string[]> {
    const periodsSet = new Set<string>();

    try {
      const turmaPeriods = await this.db
        .selectDistinct({ periodo: academicTurma.periodo })
        .from(academicTurma)
        .where(isNotNull(academicTurma.periodo));
      turmaPeriods.forEach((p) => {
        if (p.periodo && p.periodo.trim()) periodsSet.add(p.periodo.trim());
      });
    } catch {
      // Tabela academic_turma pode estar indisponível ou vazia
    }

    try {
      const avaPeriods = await this.db
        .selectDistinct({ periodo: avaProgressReport.periodo })
        .from(avaProgressReport)
        .where(isNotNull(avaProgressReport.periodo));
      avaPeriods.forEach((p) => {
        if (p.periodo && p.periodo.trim()) periodsSet.add(p.periodo.trim());
      });
    } catch {
      // Tabela ava_progress_report pode estar indisponível ou vazia
    }

    try {
      const bookingPeriods = await this.db
        .selectDistinct({ periodo: agendamentosMatricula.periodo })
        .from(agendamentosMatricula)
        .where(isNotNull(agendamentosMatricula.periodo));
      bookingPeriods.forEach((p) => {
        if (p.periodo && p.periodo.trim()) periodsSet.add(p.periodo.trim());
      });
    } catch {
      // Tabela agendamentos_matricula pode estar indisponível ou vazia
    }

    if (periodsSet.size === 0) {
      periodsSet.add('2026-1');
      periodsSet.add('2025-2');
    }

    return Array.from(periodsSet).sort((a, b) => b.localeCompare(a));
  }

  // 6. Backoffice Lists & Filters
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
      conditions.push(
        ilike(agendamentosMatricula.matricula, `%${filters.matricula}%`),
      );
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

    // Subquery from AVA Progress Report
    const studentSubquery = this.db
      .select({
        matricula: avaProgressReport.matricula,
        periodo: avaProgressReport.periodo,
        aluno: sql<string>`max(${avaProgressReport.aluno})`.as('ava_aluno'),
        usuario: sql<string>`max(${avaProgressReport.usuario})`.as(
          'ava_usuario',
        ),
      })
      .from(avaProgressReport)
      .groupBy(avaProgressReport.matricula, avaProgressReport.periodo)
      .as('student_subquery');

    // Subquery from Academic Discente (Lyceum cache)
    const academicDiscenteSubquery = this.db
      .select({
        matricula: academicDiscente.matricula,
        nomeSocial: sql<string>`max(${academicDiscente.nomeSocial})`.as(
          'ac_nome_social',
        ),
        nome: sql<string>`max(${academicDiscente.nome})`.as('ac_nome'),
        sobrenome: sql<string>`max(${academicDiscente.sobrenome})`.as(
          'ac_sobrenome',
        ),
        email: sql<string>`max(${academicDiscente.email})`.as('ac_email'),
        usuario: sql<string>`max(${academicDiscente.usuario})`.as('ac_usuario'),
      })
      .from(academicDiscente)
      .groupBy(academicDiscente.matricula)
      .as('ac_discente_subquery');

    // Get paginated bookings details
    const rawData = await this.db
      .select({
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
        acNomeSocial: academicDiscenteSubquery.nomeSocial,
        acNome: academicDiscenteSubquery.nome,
        acSobrenome: academicDiscenteSubquery.sobrenome,
        acEmail: academicDiscenteSubquery.email,
        acUsuario: academicDiscenteSubquery.usuario,
      })
      .from(agendamentosMatricula)
      .innerJoin(opcaos, eq(agendamentosMatricula.opcaoId, opcaos.id))
      .innerJoin(locals, eq(opcaos.localId, locals.id))
      .leftJoin(
        studentSubquery,
        and(
          eq(studentSubquery.matricula, agendamentosMatricula.matricula),
          eq(studentSubquery.periodo, agendamentosMatricula.periodo),
        ),
      )
      .leftJoin(
        academicDiscenteSubquery,
        eq(academicDiscenteSubquery.matricula, agendamentosMatricula.matricula),
      )
      .where(whereClause)
      .orderBy(desc(agendamentosMatricula.createdAt))
      .limit(size)
      .offset(offset);

    // Get total count
    const [countResult] = await this.db
      .select({ count: sql`count(*)` })
      .from(agendamentosMatricula)
      .innerJoin(opcaos, eq(agendamentosMatricula.opcaoId, opcaos.id))
      .innerJoin(locals, eq(opcaos.localId, locals.id))
      .where(whereClause);

    const totalRecords = Number(countResult?.count || 0);
    const totalPages = Math.ceil(totalRecords / size);

    // Hydrate names & emails from synced progress reports or Lyceum discentes
    const bookings = rawData.map((row: any) => {
      const studentName =
        row.studentName ||
        row.acNomeSocial ||
        (row.acNome ? `${row.acNome} ${row.acSobrenome || ''}`.trim() : null) ||
        'Estudante Não Identificado';
      const studentEmail =
        row.studentEmail || row.acEmail || row.acUsuario || '';
      return {
        id: row.id,
        matricula: row.matricula,
        descricao: row.descricao,
        status: row.status,
        periodo: row.periodo,
        data: row.data,
        createdAt: row.createdAt,
        hora: row.hora,
        localId: row.localId,
        localNome: row.localNome,
        studentName,
        studentEmail,
      };
    });

    return {
      page,
      size,
      total_records: totalRecords,
      total_pages: totalPages,
      data: bookings,
    };
  }

  // 7. Export to CSV
  async getExportData(
    filters: Omit<Parameters<typeof this.listBookings>[0], 'page' | 'size'>,
  ) {
    const result = await this.listBookings({
      ...filters,
      page: 1,
      size: 50000,
    });
    return result.data;
  }

  // 8. Attendance List for Campus Proctors (Lista de Presença A4)
  async getAttendanceList(filters: {
    localId?: string;
    data?: string;
    periodo?: string;
  }) {
    const conditions: any[] = [
      isNull(agendamentosMatricula.deletedAt),
      ne(agendamentosMatricula.status, 'cancelado'),
    ];

    if (filters.localId && filters.localId !== 'all') {
      conditions.push(eq(opcaos.localId, filters.localId));
    }
    if (filters.data) {
      conditions.push(eq(opcaos.data, new Date(filters.data)));
    }
    if (filters.periodo) {
      conditions.push(eq(agendamentosMatricula.periodo, filters.periodo));
    }

    const whereClause = and(...conditions);

    // Subquery from AVA Progress Report
    const studentSubquery = this.db
      .select({
        matricula: avaProgressReport.matricula,
        periodo: avaProgressReport.periodo,
        aluno: sql<string>`max(${avaProgressReport.aluno})`.as('att_ava_aluno'),
        usuario: sql<string>`max(${avaProgressReport.usuario})`.as(
          'att_ava_usuario',
        ),
      })
      .from(avaProgressReport)
      .groupBy(avaProgressReport.matricula, avaProgressReport.periodo)
      .as('att_student_subquery');

    // Subquery from Academic Discente (Lyceum cache)
    const academicDiscenteSubquery = this.db
      .select({
        matricula: academicDiscente.matricula,
        nomeSocial: sql<string>`max(${academicDiscente.nomeSocial})`.as(
          'att_ac_nome_social',
        ),
        nome: sql<string>`max(${academicDiscente.nome})`.as('att_ac_nome'),
        sobrenome: sql<string>`max(${academicDiscente.sobrenome})`.as(
          'att_ac_sobrenome',
        ),
        email: sql<string>`max(${academicDiscente.email})`.as('att_ac_email'),
        usuario: sql<string>`max(${academicDiscente.usuario})`.as(
          'att_ac_usuario',
        ),
      })
      .from(academicDiscente)
      .groupBy(academicDiscente.matricula)
      .as('att_ac_discente_subquery');

    const rawData = await this.db
      .select({
        id: agendamentosMatricula.id,
        matricula: agendamentosMatricula.matricula,
        descricao: agendamentosMatricula.descricao,
        status: agendamentosMatricula.status,
        periodo: agendamentosMatricula.periodo,
        data: agendamentosMatricula.data,
        hora: opcaos.hora,
        localId: opcaos.localId,
        localNome: locals.nome,
        localEndereco: locals.endereco,
        studentName: studentSubquery.aluno,
        studentEmail: studentSubquery.usuario,
        acNomeSocial: academicDiscenteSubquery.nomeSocial,
        acNome: academicDiscenteSubquery.nome,
        acSobrenome: academicDiscenteSubquery.sobrenome,
        acEmail: academicDiscenteSubquery.email,
        acUsuario: academicDiscenteSubquery.usuario,
      })
      .from(agendamentosMatricula)
      .innerJoin(opcaos, eq(agendamentosMatricula.opcaoId, opcaos.id))
      .innerJoin(locals, eq(opcaos.localId, locals.id))
      .leftJoin(
        studentSubquery,
        and(
          eq(studentSubquery.matricula, agendamentosMatricula.matricula),
          eq(studentSubquery.periodo, agendamentosMatricula.periodo),
        ),
      )
      .leftJoin(
        academicDiscenteSubquery,
        eq(academicDiscenteSubquery.matricula, agendamentosMatricula.matricula),
      )
      .where(whereClause)
      .orderBy(opcaos.hora, agendamentosMatricula.matricula);

    return rawData.map((row: any) => {
      const studentName =
        row.studentName ||
        row.acNomeSocial ||
        (row.acNome ? `${row.acNome} ${row.acSobrenome || ''}`.trim() : null) ||
        'Estudante Não Identificado';

      const disciplinas = row.descricao
        ? row.descricao
            .split(';')
            .map((d: string) => d.trim())
            .filter(Boolean)
        : [];
      const startTime = row.hora ? row.hora.slice(0, 5) : '';
      const endTime = getExamEndTime(startTime, disciplinas.length || 1);

      return {
        id: row.id,
        matricula: row.matricula,
        studentName,
        studentEmail: row.studentEmail || row.acEmail || row.acUsuario || '',
        localNome: row.localNome,
        localEndereco: row.localEndereco,
        data: row.data,
        horaInicio: startTime,
        horaFim: endTime,
        disciplinas,
        totalDisciplinas: disciplinas.length,
        status: row.status,
        periodo: row.periodo,
      };
    });
  }

  // 8. Import from CSV (Otimizado com Transação e Cache de Busca)
  async importBookings(rows: any[]) {
    if (!rows || rows.length === 0) {
      return { success: true, imported: 0, errors: 0, total: 0 };
    }

    return this.db.transaction(async (tx) => {
      let imported = 0;
      let errors = 0;

      // 1. Pré-carregar Polos existentes em cache
      const existingLocals = await tx.select().from(locals);
      const localMap = new Map<string, string>(); // nome.toLowerCase() -> id
      for (const loc of existingLocals) {
        localMap.set(loc.nome.trim().toLowerCase(), loc.id);
      }

      // 2. Pré-carregar Opções existentes em cache
      const existingOpcaos = await tx.select().from(opcaos);
      const opcaoMap = new Map<string, string>(); // `${localId}_${dateStr}_${horaStr}` -> id
      for (const opc of existingOpcaos) {
        const dStr = new Date(opc.data).toISOString().split('T')[0];
        const key = `${opc.localId}_${dStr}_${opc.hora}`;
        opcaoMap.set(key, opc.id);
      }

      // 3. Pré-carregar Agendamentos existentes
      const existingBookings = await tx
        .select({
          id: agendamentosMatricula.id,
          matricula: agendamentosMatricula.matricula,
          periodo: agendamentosMatricula.periodo,
        })
        .from(agendamentosMatricula);
      const bookingMap = new Map<string, string>(); // `${matricula}_${periodo}` -> id
      for (const b of existingBookings) {
        bookingMap.set(`${b.matricula.trim()}_${b.periodo.trim()}`, b.id);
      }

      for (const row of rows) {
        try {
          if (
            !row.matricula ||
            !row.campus ||
            !row.dataProva ||
            !row.horaInicio ||
            !row.periodo ||
            !row.disciplinas
          ) {
            continue;
          }

          const campusName = String(row.campus).trim();
          const campusKey = campusName.toLowerCase();

          // Obter ou criar Local (Polo)
          let localId = localMap.get(campusKey);
          if (!localId) {
            const [newLocal] = await tx
              .insert(locals)
              .values({ nome: campusName, endereco: 'Importado', status: true })
              .returning();
            localId = newLocal.id;
            localMap.set(campusKey, localId);
          }

          // Tratar Data da Prova
          let dateObj: Date;
          if (String(row.dataProva).includes('/')) {
            const [d, m, y] = String(row.dataProva).split('/');
            dateObj = new Date(
              `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T00:00:00Z`,
            );
          } else {
            dateObj = new Date(
              `${String(row.dataProva).split('T')[0]}T00:00:00Z`,
            );
          }

          if (isNaN(dateObj.getTime())) {
            errors++;
            continue;
          }

          const dateISO = dateObj.toISOString().split('T')[0];
          const rawHora = String(row.horaInicio).trim();
          const horaParts = rawHora.split(':');
          const horaStr =
            horaParts.length === 2
              ? `${horaParts[0].padStart(2, '0')}:${horaParts[1].padStart(2, '0')}:00`
              : rawHora.length === 5
                ? `${rawHora}:00`
                : rawHora;

          // Obter ou criar Opção (Slot de Horário)
          const opcaoKey = `${localId}_${dateISO}_${horaStr}`;
          let opcaoId = opcaoMap.get(opcaoKey);
          if (!opcaoId) {
            const [newOpcao] = await tx
              .insert(opcaos)
              .values({
                localId,
                data: dateObj,
                hora: horaStr,
                vagas: 50,
                status: true,
              })
              .returning();
            opcaoId = newOpcao.id;
            opcaoMap.set(opcaoKey, opcaoId);
          }

          const matriculaStr = String(row.matricula).trim();
          const periodoStr = String(row.periodo).trim();
          const bKey = `${matriculaStr}_${periodoStr}`;
          const existingBookingId = bookingMap.get(bKey);
          const statusStr = String(row.status || 'ativo')
            .trim()
            .toLowerCase();

          if (existingBookingId) {
            // Atualizar
            await tx
              .update(agendamentosMatricula)
              .set({
                status: statusStr,
                opcaoId,
                descricao: String(row.disciplinas).trim(),
                data: dateObj,
                updatedAt: new Date(),
                deletedAt: statusStr === 'cancelado' ? new Date() : null,
              })
              .where(eq(agendamentosMatricula.id, existingBookingId));
          } else {
            // Inserir
            const [newBooking] = await tx
              .insert(agendamentosMatricula)
              .values({
                opcaoId,
                matricula: matriculaStr,
                descricao: String(row.disciplinas).trim(),
                status: statusStr,
                periodo: periodoStr,
                data: dateObj,
                createdAt: new Date(),
                updatedAt: new Date(),
              })
              .returning();
            bookingMap.set(bKey, newBooking.id);
          }

          imported++;
        } catch (err) {
          console.error('Erro ao importar linha:', row, err);
          errors++;
        }
      }

      return { success: true, imported, errors, total: rows.length };
    });
  }

  // ---------------------------------------------------------------------------
  // Fluxo Público do Estudante (Sem necessidade de login com conta Nexus)
  // ---------------------------------------------------------------------------

  /**
   * Obtém os dados completos do fluxo do estudante:
   * - Perfil e elegibilidade (Graduação EaD, disciplinas regulares)
   * - Agendamento ativo (caso já tenha agendado)
   * - Lista de polos disponíveis para seleção
   */
  async getStudentFlow(matricula: string, periodo?: string) {
    if (!matricula || !matricula.trim()) {
      throw new BadRequestException('A matrícula é obrigatória.');
    }
    const trimmedMatricula = matricula.trim();
    let targetPeriod = (periodo && periodo.trim()) || '';

    // Se o período não foi explicitado na URL, tenta encontrar se o aluno possui disciplinas no período padrão (2026-2)
    // ou no período mais recente com registros cadastrados
    let profile: any;
    if (!targetPeriod) {
      const defaultPeriod = getDefaultPeriod();
      try {
        profile = await this.getStudentProfile(trimmedMatricula, defaultPeriod);
        targetPeriod = defaultPeriod;
      } catch (err: any) {
        // Se der 404 no período padrão, busca se tem outro período com dados
        const [recentPeriodRecord] = await this.db
          .select({ periodo: avaProgressReport.periodo })
          .from(avaProgressReport)
          .where(ilike(avaProgressReport.matricula, trimmedMatricula))
          .orderBy(desc(avaProgressReport.periodo))
          .limit(1);

        if (recentPeriodRecord?.periodo && recentPeriodRecord.periodo !== defaultPeriod) {
          targetPeriod = recentPeriodRecord.periodo;
          profile = await this.getStudentProfile(trimmedMatricula, targetPeriod);
        } else {
          throw err;
        }
      }
    } else {
      profile = await this.getStudentProfile(trimmedMatricula, targetPeriod);
    }

    // Consulta se já possui agendamento ativo ou concluído no período
    const activeBookings = await this.db
      .select({
        id: agendamentosMatricula.id,
        matricula: agendamentosMatricula.matricula,
        status: agendamentosMatricula.status,
        descricao: agendamentosMatricula.descricao,
        data: agendamentosMatricula.data,
        periodo: agendamentosMatricula.periodo,
        createdAt: agendamentosMatricula.createdAt,
        opcaoId: opcaos.id,
        hora: opcaos.hora,
        opcaoData: opcaos.data,
        localId: locals.id,
        localNome: locals.nome,
        localEndereco: locals.endereco,
        localTelefone: locals.telefone,
        linkLocal: locals.linkLocal,
      })
      .from(agendamentosMatricula)
      .leftJoin(opcaos, eq(agendamentosMatricula.opcaoId, opcaos.id))
      .leftJoin(locals, eq(opcaos.localId, locals.id))
      .where(
        and(
          ilike(agendamentosMatricula.matricula, profile.matricula),
          eq(agendamentosMatricula.periodo, targetPeriod),
          or(
            eq(agendamentosMatricula.status, 'ativo'),
            eq(agendamentosMatricula.status, 'concluido'),
          ),
          isNull(agendamentosMatricula.deletedAt),
        ),
      )
      .limit(1);

    const activeBooking = activeBookings[0] || null;

    // Polos ativos para seleção
    const localsList = await this.listLocals(false);

    return {
      student: profile,
      activeBooking,
      locals: localsList,
      periodo: targetPeriod,
    };
  }

  /**
   * Lista opções/horários com vagas disponíveis para um polo específico,
   * excluindo datas passadas e horários já ultrapassados hoje no fuso de Brasília.
   */
  async getAvailableSlots(localId: string, periodo?: string) {
    if (!localId) {
      throw new BadRequestException('O local é obrigatório.');
    }

    const options = await this.db
      .select({
        id: opcaos.id,
        localId: opcaos.localId,
        localNome: locals.nome,
        data: opcaos.data,
        hora: opcaos.hora,
        vagas: opcaos.vagas,
        status: opcaos.status,
      })
      .from(opcaos)
      .innerJoin(locals, eq(opcaos.localId, locals.id))
      .where(
        and(
          eq(opcaos.localId, localId),
          eq(opcaos.status, true),
          sql`${opcaos.vagas} > 0`,
        ),
      )
      .orderBy(opcaos.data, opcaos.hora);

    const { dateStr: todayStr, currentMinutes } = getNowInSaoPaulo();

    // Filtra horários futuros no fuso de Brasília
    const availableSlots = options.filter((opt) => {
      const optDateStr =
        opt.data instanceof Date
          ? opt.data.toISOString().slice(0, 10)
          : String(opt.data).slice(0, 10);

      if (optDateStr < todayStr) return false;
      if (optDateStr === todayStr) {
        const [optHour, optMin] = opt.hora.split(':').map(Number);
        const optMinutes = optHour * 60 + (optMin || 0);
        if (optMinutes <= currentMinutes) return false;
      }
      return true;
    });

    return availableSlots;
  }

  /**
   * Cancelamento de agendamento pelo próprio aluno, liberando as vagas
   */
  async cancelStudentBooking(bookingId: string, matricula: string) {
    const [booking] = await this.db
      .select()
      .from(agendamentosMatricula)
      .where(eq(agendamentosMatricula.id, bookingId))
      .limit(1);

    if (!booking) {
      throw new NotFoundException('Agendamento não encontrado.');
    }

    if (
      booking.matricula.trim().toLowerCase() !== matricula.trim().toLowerCase()
    ) {
      throw new BadRequestException(
        'Este agendamento não pertence à matrícula informada.',
      );
    }

    if (booking.status === 'concluido' || booking.status === 'ausente') {
      throw new BadRequestException(
        'Agendamentos já concluídos ou com presença registrada não podem ser cancelados.',
      );
    }

    const result = await this.cancelBooking(bookingId);

    await this.auditService?.record({
      action: 'EXAM_BOOKING_CANCELLED_BY_STUDENT',
      category: 'SCHEDULING',
      status: 'SUCCESS',
      userEmail: matricula,
      details: { bookingId, matricula },
    });

    return result;
  }

  /**
   * Remarcação de agendamento pelo aluno (troca de polo, data ou horário)
   */
  async rescheduleStudentBooking(
    bookingId: string,
    matricula: string,
    newOpcaoId: string,
    periodo: string,
  ) {
    const [booking] = await this.db
      .select()
      .from(agendamentosMatricula)
      .where(eq(agendamentosMatricula.id, bookingId))
      .limit(1);

    if (!booking) {
      throw new NotFoundException('Agendamento não encontrado.');
    }

    if (
      booking.matricula.trim().toLowerCase() !== matricula.trim().toLowerCase()
    ) {
      throw new BadRequestException(
        'Este agendamento não pertence à matrícula informada.',
      );
    }

    if (booking.status === 'concluido' || booking.status === 'ausente') {
      throw new BadRequestException(
        'Agendamentos já concluídos ou com presença registrada não podem ser alterados.',
      );
    }

    // Libera a vaga do agendamento antigo
    await this.cancelBooking(bookingId);

    try {
      // Reserva o novo horário
      const newBooking = await this.createBooking({
        opcaoId: newOpcaoId,
        matricula,
        periodo,
      });

      await this.auditService?.record({
        action: 'EXAM_BOOKING_RESCHEDULED_BY_STUDENT',
        category: 'SCHEDULING',
        status: 'SUCCESS',
        userEmail: matricula,
        details: { oldBookingId: bookingId, newOpcaoId, matricula, periodo },
      });

      return newBooking;
    } catch (err: any) {
      // Em caso de falha no novo agendamento, restaura o agendamento anterior
      try {
        await this.createBooking({
          opcaoId: booking.opcaoId,
          matricula,
          periodo,
        });
      } catch {
        // Silencioso se não conseguir reverter
      }
      throw err;
    }
  }
}
