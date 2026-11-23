import {
  AcademicOnlineStatusConsolidacao,
  AcademicOnlineStatusMatricula,
  AcademicOnlineStatusNota,
} from '../../../db/schema';

export interface GradesTurmasQuery {
  periodo?: string;
  search?: string;
  instituicao?: string;
  page?: number;
  pageSize?: number;
}

export interface TurmaStudentsQuery {
  statusMatricula?: 'todos' | 'matriculado' | 'suspenso' | 'cancelado';
  statusNota?: 'todas' | 'pendente' | 'lancada';
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface ParsedGradeActivity {
  nome: string;
  status: string;
  nota?: string | null;
  notaMax?: string | null;
  data: string;
  fase?: 1 | 2 | 3;
}

export interface EnrolmentResolution {
  statusMatricula: AcademicOnlineStatusMatricula;
  bloqueioLancamento: boolean;
  motivo: string;
}

export type GradeScale = '0-10' | '0-100' | 'auto';

export interface NormalizedGradeResult {
  numericGrade: number | null;
  status: AcademicOnlineStatusNota;
  scaleApplied: '0-10' | '0-100';
}

export interface TurmaGradesSummaryItem {
  id: string;
  turma: string;
  codTurma: string | null;
  disciplina: string;
  nomeDisciplina: string;
  codDisciplina: string | null;
  curso: string | null;
  cursoNome: string | null;
  cursoInstituicao: string | null;
  periodo: string;
  modelagem: string;
  sourceInstitution: string;
  moodleCourseId: string | null;
  moodleCourseFullname: string | null;
  totalAlunos: number;
  totalMatriculados: number;
  totalSuspensos: number;
  totalCancelados: number;
  totalNotasLancadasVa1: number;
  totalNotasLancadasVa2: number;
  totalNotasLancadasVa3: number;
  syncedAt: Date;
}

export interface StudentGradeRow {
  matriculaId: string;
  turmaId: string;
  matricula: string;
  nomeAluno: string;
  emailAluno: string | null;
  cpfAluno: string | null;
  statusMatricula: AcademicOnlineStatusMatricula;
  situacaoLyceum: string | null;
  ativoLyceum: string | null;
  enrolmentStatusAva: string | null;
  bloqueioLancamento: boolean;
  notas: {
    va1: number | null;
    va1Raw: string | null;
    va1Status: AcademicOnlineStatusNota;
    va2: number | null;
    va2Raw: string | null;
    va2Status: AcademicOnlineStatusNota;
    va3: number | null;
    va3Raw: string | null;
    va3Status: AcademicOnlineStatusNota;
    mediaFinal: number | null;
    mediaRaw: string | null;
    itensVa1: ParsedGradeActivity[];
    itensVa2: ParsedGradeActivity[];
    itensVa3: ParsedGradeActivity[];
    statusConsolidacao: AcademicOnlineStatusConsolidacao;
    divergenciaMotivo: string | null;
    lastAvaSyncAt: Date | null;
  };
}

export interface SyncMirrorSummary {
  periodo: string;
  turmasEspelhadas: number;
  matriculasSincronizadas: number;
  totalMatriculados: number;
  totalSuspensos: number;
  totalCancelados: number;
}
