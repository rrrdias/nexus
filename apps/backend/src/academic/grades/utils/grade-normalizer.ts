import {
  GradeScale,
  NormalizedGradeResult,
} from '../interfaces/academic-grades.types';

/**
 * Detecta a escala predominante da turma/fase com base no universo de notas do cohort.
 * Se qualquer estudante ou nota máxima de atividade exceder 10.0, toda a fase
 * opera em escala 0-100, evitando descontinuidades em notas <= 10.0.
 */
export function detectCohortPhaseScale(
  grades: (string | null | undefined)[],
  maxActivitiesGrade?: number | null,
): '0-10' | '0-100' {
  if (
    maxActivitiesGrade !== null &&
    maxActivitiesGrade !== undefined &&
    maxActivitiesGrade > 10.0
  ) {
    return '0-100';
  }

  for (const raw of grades) {
    if (!raw) continue;
    const clean = raw.trim().replace(',', '.').replace('%', '').trim();
    if (!/^[0-9]+(\.[0-9]+)?$/.test(clean)) continue;
    const num = parseFloat(clean);
    if (!isNaN(num) && num > 10.0) {
      return '0-100';
    }
  }

  return '0-10';
}

/**
 * Normaliza nota individual com base na escala resolvida no nível da turma/fase.
 * Preserva estritamente a diferença entre ausente/pendente (null) e zero explícito (0.00 Lançada).
 */
export function normalizeGrade(
  rawGrade: string | null | undefined,
  courseScale: GradeScale = 'auto',
): NormalizedGradeResult {
  if (rawGrade === null || rawGrade === undefined) {
    return { numericGrade: null, status: 'Pendente', scaleApplied: '0-10' };
  }

  const trimmed = rawGrade.trim();
  if (
    trimmed === '' ||
    trimmed === '-' ||
    trimmed.toLowerCase() === 'null' ||
    trimmed.toLowerCase() === 'undefined'
  ) {
    return { numericGrade: null, status: 'Pendente', scaleApplied: '0-10' };
  }

  const clean = trimmed.replace(',', '.').replace('%', '').trim();
  if (!/^[0-9]+(\.[0-9]+)?$/.test(clean)) {
    return { numericGrade: null, status: 'Pendente', scaleApplied: '0-10' };
  }

  const val = parseFloat(clean);
  if (isNaN(val)) {
    return { numericGrade: null, status: 'Pendente', scaleApplied: '0-10' };
  }

  let effectiveScale: '0-10' | '0-100';
  let converted: number;

  if (courseScale === '0-100') {
    effectiveScale = '0-100';
    converted = val / 10.0;
  } else if (courseScale === '0-10') {
    effectiveScale = '0-10';
    converted = val;
  } else {
    if (val > 10.0) {
      effectiveScale = '0-100';
      converted = val / 10.0;
    } else {
      effectiveScale = '0-10';
      converted = val;
    }
  }

  const bounded = Math.max(0, Math.min(10, converted));
  const rounded = Number(bounded.toFixed(2));

  return {
    numericGrade: rounded,
    status: 'Lançada',
    scaleApplied: effectiveScale,
  };
}
