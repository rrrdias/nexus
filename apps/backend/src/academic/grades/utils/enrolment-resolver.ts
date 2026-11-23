import { AcademicOnlineStatusMatricula } from '../../../db/schema';
import { EnrolmentResolution } from '../interfaces/academic-grades.types';

/**
 * Gera variantes equivalentes do período letivo (ex: '2026-2' <-> '2026/2')
 * para compatibilizar formatos entre Lyceum e relatórios do Moodle.
 */
export function getPeriodVariants(periodo: string): string[] {
  const clean = (periodo || '').trim();
  if (!clean) return [];
  const dash = clean.replace(/\//g, '-');
  const slash = clean.replace(/-/g, '/');
  return Array.from(new Set([clean, dash, slash]));
}

/**
 * Valida estritamente se a modelagem cadastral da turma representa uma disciplina 100% Online.
 * Elimina falsos positivos de turmas presenciais/semipresenciais que usam tag '-INT-' ou '-EAD-'.
 */
export function isStrictOnlineModelagem(
  modelagem: string | null | undefined,
): boolean {
  if (!modelagem || typeof modelagem !== 'string') return false;
  const trimmed = modelagem.trim();
  if (!trimmed) return false;

  // Bloqueio explícito de modalidades presenciais, semipresenciais ou práticas
  if (/presencial|semipresencial|pr[aá]tica/i.test(trimmed)) {
    return false;
  }

  const upper = trimmed.toUpperCase();
  const homologated = new Set([
    'DISCIPLINA 100% ONLINE',
    'DISCIPLINA100',
    'DISCIPLINA100%ONLINE',
    '100% ONLINE',
    'DISCIPLINAS 100% ON-LINE',
    'DISCIPLINA 100% ON-LINE',
    '100% ON-LINE',
  ]);

  if (homologated.has(upper)) {
    return true;
  }

  return /100\s*%\s*on-?line|disciplina\s*100/i.test(trimmed);
}

/**
 * Mapeia o nome da unidade/instituição do Lyceum para o identificador sourceInstitution do AVA.
 */
export function resolveSourceInstitution(
  cursoInstituicao: string | null | undefined,
): string {
  const norm = (cursoInstituicao || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (!norm) return 'ead';
  if (norm.includes('faego') || norm.includes('uniego')) return 'uniego';
  if (norm.includes('raizes')) return 'raizes';
  if (norm.includes('eefn') || norm.includes('aee')) return 'eefn';
  if (norm.includes('ead')) return 'ead';
  if (norm.includes('unievang') || norm === 'uni') return 'uni';

  return 'ead';
}

/**
 * Retorna a lista ordenada de instituições candidatas no AVA para uma turma online
 * (ex: turmas 100% online da UniEVANGÉLICA podem residir no AVAGrad 'uni' ou AVAEAD 'ead').
 */
export function getCandidateSourceInstitutions(
  primaryInstitution: string,
): string[] {
  const clean = (primaryInstitution || 'ead').trim().toLowerCase();
  if (clean === 'uni') return ['uni', 'ead'];
  if (clean === 'ead') return ['ead', 'uni'];
  return [clean];
}

/**
 * Algoritmo determinístico de resolução de status de matrícula (Lyceum + fallback AVA)
 * mantendo postura defensiva (bloqueioLancamento = true) para suspensos, cancelados e incertos.
 */
export function resolveEnrolmentStatus(
  situacaoLyceum: string | null | undefined,
  ativoLyceum: string | null | undefined,
  enrolmentStatusAva: string | null | undefined,
): EnrolmentResolution {
  const sit = (situacaoLyceum || '').trim().toLowerCase();
  const atv = (ativoLyceum || '').trim().toUpperCase();
  const ava = (enrolmentStatusAva || '').trim().toLowerCase();

  // 1. Cancelamentos expressos e evasões definitivas no Lyceum
  if (
    sit.includes('cancelad') ||
    sit.includes('desvinculad') ||
    sit.includes('transferid') ||
    sit.includes('desistent') ||
    sit.includes('evadid')
  ) {
    return {
      statusMatricula: 'cancelado' as AcademicOnlineStatusMatricula,
      bloqueioLancamento: true,
      motivo: `Matrícula cancelada/evadida no Lyceum (${situacaoLyceum})`,
    };
  }

  // 2. Suspensões financeiras, trancamentos e bloqueios administrativos no Lyceum
  if (
    sit.includes('suspens') ||
    sit.includes('trancad') ||
    sit.includes('inativ') ||
    atv === 'N' ||
    atv === '0'
  ) {
    return {
      statusMatricula: 'suspenso' as AcademicOnlineStatusMatricula,
      bloqueioLancamento: true,
      motivo: `Matrícula suspensa/trancada/inativa no Lyceum (${situacaoLyceum || 'Inativo'})`,
    };
  }

  // 3. Matrícula Regular Ativa (requer comprovação afirmativa no Lyceum)
  if (
    (sit.includes('matriculad') || sit.includes('aberta')) &&
    (atv === 'S' || atv === '1' || atv === '')
  ) {
    return {
      statusMatricula: 'matriculado' as AcademicOnlineStatusMatricula,
      bloqueioLancamento: false,
      motivo: 'Regularmente matriculado no Lyceum',
    };
  }

  // 4. Fallback de segurança baseado no AVA (quando Lyceum estiver ausente ou indefinido)
  if (
    ava.includes('cancelad') ||
    ava.includes('desistent') ||
    ava.includes('evadid') ||
    ava.includes('desvinculad')
  ) {
    return {
      statusMatricula: 'cancelado' as AcademicOnlineStatusMatricula,
      bloqueioLancamento: true,
      motivo: `Status cancelado/evadido no AVA (${enrolmentStatusAva}) com situação indefinida no Lyceum`,
    };
  }

  if (
    ava.includes('suspens') ||
    ava.includes('trancad') ||
    ava.includes('inativ')
  ) {
    return {
      statusMatricula: 'suspenso' as AcademicOnlineStatusMatricula,
      bloqueioLancamento: true,
      motivo: `Status suspenso no AVA (${enrolmentStatusAva}) com situação indefinida no Lyceum`,
    };
  }

  if (ava.includes('matriculad') || ava.includes('ativ')) {
    return {
      statusMatricula: 'matriculado' as AcademicOnlineStatusMatricula,
      bloqueioLancamento: false,
      motivo: `Status ativo no AVA (${enrolmentStatusAva}) com cadastro Lyceum pendente de sincronização`,
    };
  }

  // 5. Postura defensiva: situação ambígua ou vazia em ambos os sistemas
  return {
    statusMatricula: 'suspenso' as AcademicOnlineStatusMatricula,
    bloqueioLancamento: true,
    motivo:
      'Situação cadastral indefinida em ambos os sistemas (Lyceum e AVA) - bloqueio defensivo de lançamento',
  };
}
