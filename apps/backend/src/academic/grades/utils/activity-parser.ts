import { ParsedGradeActivity } from '../interfaces/academic-grades.types';

export function normalizeName(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/ª/g, 'a')
    .replace(/º/g, 'o')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2010-\u2015\u2212\u002d]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isDateString(val: string | null | undefined): boolean {
  if (!val) return false;
  const clean = val.trim();
  return (
    /^\d{2}\/\d{2}\/\d{4}(?:\s+\d{2}:\d{2}(?::\d{2})?)?$/.test(clean) ||
    /^\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}(?::\d{2})?)?$/.test(clean)
  );
}

export function isValidGrade(val: string | null | undefined): boolean {
  if (!val) return false;
  const clean = val.trim();
  if (isDateString(clean)) return false;
  if (/^(concl|pend|feito|realiz|avaliad|nunca|sem|none|-|null)/i.test(clean)) {
    return false;
  }
  return /^\d+(?:[.,]\d+)?$/.test(clean);
}

/**
 * Detecta se a string lista_notas sofreu truncamento pelo limite do buffer GROUP_CONCAT (1024 caracteres).
 */
export function detectListaNotasTruncated(
  raw: string | null | undefined,
): boolean {
  if (!raw) return false;
  const trimmed = raw.trim();
  if (!trimmed) return false;

  if (trimmed.length >= 1024) {
    return true;
  }

  const items = trimmed.split('|');
  if (items.length > 1) {
    const firstPartsCount = items[0] ? items[0].split(':').length : 0;
    const lastItem = items[items.length - 1];
    if (!lastItem) return false;
    const lastParts = lastItem.split(':');
    if (lastParts.length < 2) return true;
    if (firstPartsCount >= 3 && lastParts.length < 3) return true;
    if (
      firstPartsCount >= 4 &&
      lastParts.length === 3 &&
      !isDateString(lastParts[2]?.trim())
    ) {
      return true;
    }
  }

  return false;
}

export function parseActivities(
  raw: string | null | undefined,
): ParsedGradeActivity[] {
  if (!raw) return [];
  const rawItems = raw.split('|');
  const firstPartsCount = rawItems[0] ? rawItems[0].split(':').length : 0;

  return rawItems
    .map((item, idx): ParsedGradeActivity | null => {
      const parts = item.split(':');
      if (parts.length < 2) {
        return null;
      }

      const isLastItem = rawItems.length > 1 && idx === rawItems.length - 1;
      const nome = parts[0]?.trim() || '';
      const rawSecond = parts[1]?.trim() || '';
      const second = rawSecond || '-';
      const third = parts[2]?.trim() || '-';
      const fourth = parts[3]?.trim() || '-';

      if (
        parts.length === 2 &&
        (!rawSecond || (isLastItem && firstPartsCount >= 3))
      ) {
        return null;
      }

      if (parts.length >= 4) {
        const hasGrade = isValidGrade(second);
        const dataStr = isDateString(fourth)
          ? fourth
          : isDateString(third)
            ? third
            : '-';
        const maxGrade = isValidGrade(third)
          ? third
          : isValidGrade(fourth)
            ? fourth
            : '100';

        return {
          nome,
          status: hasGrade ? 'Avaliado' : second === '-' ? 'Pendente' : second,
          nota: hasGrade ? second : null,
          notaMax: maxGrade,
          data: dataStr,
        };
      }

      if (parts.length === 3) {
        if (isLastItem && firstPartsCount >= 4 && !isDateString(third)) {
          return null;
        }
        const hasGrade = isValidGrade(second);
        if (isDateString(third)) {
          return {
            nome,
            status: hasGrade
              ? 'Avaliado'
              : second === '-'
                ? 'Pendente'
                : second,
            nota: hasGrade ? second : null,
            notaMax: null,
            data: third,
          };
        }

        return {
          nome,
          status: hasGrade ? 'Avaliado' : second === '-' ? 'Pendente' : second,
          nota: hasGrade ? second : null,
          notaMax: !isLastItem && isValidGrade(third) ? third : null,
          data: '-',
        };
      }

      if (isDateString(second)) {
        return {
          nome,
          status: 'Concluído',
          nota: null,
          notaMax: null,
          data: second,
        };
      }

      if (isValidGrade(second)) {
        return {
          nome,
          status: 'Avaliado',
          nota: second,
          notaMax: null,
          data: '-',
        };
      }

      return {
        nome,
        status: second === '-' ? 'Pendente' : second,
        nota: null,
        notaMax: null,
        data: '-',
      };
    })
    .filter((a): a is ParsedGradeActivity => Boolean(a && a.nome));
}

export function classifyActivityPhase(
  name: string,
  fallbackPhase: 1 | 2 | 3 = 1,
): 1 | 2 | 3 {
  const norm = normalizeName(name);

  if (
    norm.includes('1a verificacao') ||
    norm.includes('1a va') ||
    norm.includes('va 1') ||
    norm.includes('va1') ||
    norm.includes('fase 1') ||
    norm.includes('entrega 1') ||
    norm.includes('revisando conteudo - fase 1') ||
    norm.includes('revisando conteudo - fase1')
  ) {
    return 1;
  }
  if (
    norm.includes('2a verificacao') ||
    norm.includes('2a va') ||
    norm.includes('va 2') ||
    norm.includes('va2') ||
    norm.includes('fase 2') ||
    norm.includes('entrega 2') ||
    norm.includes('entrega 3') ||
    norm.includes('revisando conteudo - fase 2') ||
    norm.includes('revisando conteudo - fase2')
  ) {
    return 2;
  }
  if (
    norm.includes('3a verificacao') ||
    norm.includes('3a va') ||
    norm.includes('va 3') ||
    norm.includes('va3') ||
    norm.includes('fase 3') ||
    norm.includes('exame') ||
    norm.includes('final') ||
    norm.includes('entrega 4') ||
    norm.includes('entrega 5') ||
    norm.includes('entrega 6') ||
    norm.includes('entrega 7') ||
    norm.includes('revisando conteudo - fase 3') ||
    norm.includes('revisando conteudo - fase3')
  ) {
    return 3;
  }

  const matchAps = norm.match(
    /(?:aps\s*|atividade\s+pratica\s+supervisionada\s*)(\d+)/i,
  );
  if (matchAps && matchAps[1]) {
    const apsNum = parseInt(matchAps[1], 10);
    if (apsNum >= 13) return 3;
    if (apsNum >= 7) return 2;
    return 1;
  }

  const matchUnit = norm.match(
    /(?:unidade\s+tematica|unidade|ut|fixacao\s*-\s*unidade\s+tematica|daily\s*-\s*semana(?:\s*-)?)\s*(\d+)/i,
  );
  if (matchUnit && matchUnit[1]) {
    const unitNum = parseInt(matchUnit[1], 10);
    if (unitNum >= 9) return 3;
    if (unitNum >= 5) return 2;
    return 1;
  }

  const matchEntrega = norm.match(/(?:entrega)\s*(\d+)/i);
  if (matchEntrega && matchEntrega[1]) {
    const entNum = parseInt(matchEntrega[1], 10);
    if (entNum >= 4) return 3;
    if (entNum >= 2) return 2;
    return 1;
  }

  return fallbackPhase;
}

export function isEvaluativeActivity(name: string): boolean {
  const norm = normalizeName(name);

  if (
    (norm.startsWith('unidade tematica') ||
      norm.startsWith('unidade ') ||
      norm.startsWith('ut ')) &&
    !norm.includes('fixacao') &&
    !norm.includes('atividade')
  ) {
    return false;
  }
  if (
    norm.includes('guia de estudo') ||
    norm.includes('apresentacao da disciplina') ||
    norm.includes('plano de ensino') ||
    norm.includes('instrucoes para atividade') ||
    norm.includes('normas para producao') ||
    norm.includes('material')
  ) {
    return false;
  }

  return (
    norm.includes('verificacao') ||
    norm.includes('avaliacao') ||
    norm.includes('prova') ||
    norm.includes('va') ||
    norm.includes('fase') ||
    norm.includes('exame') ||
    norm.includes('entrega') ||
    norm.includes('aps') ||
    norm.includes('fixacao') ||
    norm.includes('revisando') ||
    norm.includes('arp') ||
    norm.includes('aprendi hoje') ||
    norm.includes('questionario') ||
    norm.includes('quiz') ||
    norm.includes('trabalho') ||
    norm.includes('aulas ao vivo') ||
    norm.includes('daily') ||
    norm.includes('tarefa') ||
    norm.includes('atividade') ||
    norm.includes('relatorio') ||
    norm.includes('depoimento') ||
    norm.includes('poster') ||
    norm.includes('anexo') ||
    norm.includes('caso') ||
    norm.includes('envio') ||
    norm.includes('poste aqui') ||
    norm.includes('envie aqui')
  );
}

export interface StudentActivitySources {
  listaNotas?: string | null;
  listaFase1?: string | null;
  listaFase2?: string | null;
  listaFase3?: string | null;
  progressoListaFase1?: string | null;
  progressoListaFase2?: string | null;
  progressoListaFase3?: string | null;
}

export interface ReconciledStudentActivitiesResult {
  f1Activities: ParsedGradeActivity[];
  f2Activities: ParsedGradeActivity[];
  f3Activities: ParsedGradeActivity[];
  allActivities: ParsedGradeActivity[];
  isTruncatedUncompensated: boolean;
}

function getActivityOrderBucket(normName: string): number {
  if (
    normName.includes('verificacao') ||
    normName.includes('1a va') ||
    normName.includes('2a va') ||
    normName.includes('3a va') ||
    normName.includes('va 1') ||
    normName.includes('va 2') ||
    normName.includes('va 3') ||
    normName.includes('va1') ||
    normName.includes('va2') ||
    normName.includes('va3') ||
    normName.includes('prova') ||
    normName.includes('exame')
  ) {
    return 2;
  }
  if (normName.includes('revisando')) {
    return 1;
  }
  return 0;
}

export function sortActivitiesByPhaseOrder(
  activities: ParsedGradeActivity[],
): ParsedGradeActivity[] {
  return [...activities].sort((a, b) => {
    const aNorm = normalizeName(a.nome);
    const bNorm = normalizeName(b.nome);

    const aBucket = getActivityOrderBucket(aNorm);
    const bBucket = getActivityOrderBucket(bNorm);
    if (aBucket !== bBucket) {
      return aBucket - bBucket;
    }

    const aNumMatch = aNorm.match(/\d+/);
    const bNumMatch = bNorm.match(/\d+/);
    const aNum = aNumMatch ? parseInt(aNumMatch[0], 10) : 999;
    const bNum = bNumMatch ? parseInt(bNumMatch[0], 10) : 999;

    if (aNum !== bNum) {
      return aNum - bNum;
    }
    return a.nome.localeCompare(b.nome, 'pt-BR');
  });
}

function isCompletedActivityStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  const s = status.trim().toLowerCase();
  if (
    !s ||
    s === '-' ||
    s.includes('pend') ||
    s.includes('sem') ||
    s.includes('nunca')
  ) {
    return false;
  }
  return (
    s.includes('conclu') ||
    s.includes('feito') ||
    s.includes('realiz') ||
    s.includes('avaliad')
  );
}

function addOrMergeActivity(
  map: Map<string, ParsedGradeActivity>,
  act: ParsedGradeActivity,
  fase: 1 | 2 | 3,
  overrideKey?: string,
): void {
  const key = overrideKey || normalizeName(act.nome);
  if (!key) return;

  if (!map.has(key)) {
    map.set(key, { ...act, fase });
    return;
  }

  const existing = map.get(key)!;
  const existingHasGrade =
    existing.nota !== null &&
    existing.nota !== undefined &&
    existing.nota !== '-';
  const actHasGrade =
    act.nota !== null && act.nota !== undefined && act.nota !== '-';

  const resolvedNota = existingHasGrade
    ? existing.nota
    : actHasGrade
      ? act.nota
      : null;

  const isExistingDone = isCompletedActivityStatus(existing.status);
  const isActDone = isCompletedActivityStatus(act.status);

  const resolvedStatus =
    resolvedNota !== null
      ? 'Avaliado'
      : isActDone
        ? act.status
        : isExistingDone
          ? existing.status
          : existing.status && existing.status !== '-'
            ? existing.status
            : act.status;

  map.set(key, {
    nome: existing.nome.length >= act.nome.length ? existing.nome : act.nome,
    status: resolvedStatus,
    nota: resolvedNota,
    notaMax: existing.notaMax || act.notaMax || null,
    data: existing.data && existing.data !== '-' ? existing.data : act.data,
    fase,
  });
}

function findPrefixMatchKey(
  map: Map<string, ParsedGradeActivity>,
  key: string,
): string | null {
  if (key.length < 4) return null;
  for (const existingKey of map.keys()) {
    if (existingKey.startsWith(key)) {
      const nextChar = existingKey.slice(key.length, key.length + 1);
      if (!/^\d$/.test(nextChar)) return existingKey;
    } else if (key.startsWith(existingKey)) {
      const nextChar = key.slice(existingKey.length, existingKey.length + 1);
      if (!/^\d$/.test(nextChar)) return existingKey;
    }
  }
  return null;
}

export function reconcileStudentPhaseActivities(
  sources: StudentActivitySources,
): ReconciledStudentActivitiesResult {
  const progF1 = parseActivities(sources.progressoListaFase1);
  const progF2 = parseActivities(sources.progressoListaFase2);
  const progF3 = parseActivities(sources.progressoListaFase3);

  const authoritativeProgressMap = new Map<
    string,
    { phase: 1 | 2 | 3; act: ParsedGradeActivity }
  >();
  progF1.forEach((a) =>
    authoritativeProgressMap.set(normalizeName(a.nome), { phase: 1, act: a }),
  );
  progF2.forEach((a) =>
    authoritativeProgressMap.set(normalizeName(a.nome), { phase: 2, act: a }),
  );
  progF3.forEach((a) =>
    authoritativeProgressMap.set(normalizeName(a.nome), { phase: 3, act: a }),
  );

  const f1Map = new Map<string, ParsedGradeActivity>();
  const f2Map = new Map<string, ParsedGradeActivity>();
  const f3Map = new Map<string, ParsedGradeActivity>();

  progF1
    .filter(
      (a) =>
        isEvaluativeActivity(a.nome) || (a.nota !== null && a.nota !== '-'),
    )
    .forEach((act) => addOrMergeActivity(f1Map, act, 1));
  progF2
    .filter(
      (a) =>
        isEvaluativeActivity(a.nome) || (a.nota !== null && a.nota !== '-'),
    )
    .forEach((act) => addOrMergeActivity(f2Map, act, 2));
  progF3
    .filter(
      (a) =>
        isEvaluativeActivity(a.nome) || (a.nota !== null && a.nota !== '-'),
    )
    .forEach((act) => addOrMergeActivity(f3Map, act, 3));

  const hasAuthoritativePhases = authoritativeProgressMap.size > 0;

  const allGradedActivities: Array<{
    act: ParsedGradeActivity;
    sourcePhase?: 1 | 2 | 3;
  }> = [
    ...parseActivities(sources.listaFase1).map((act) => ({
      act,
      sourcePhase: 1 as const,
    })),
    ...parseActivities(sources.listaFase2).map((act) => ({
      act,
      sourcePhase: 2 as const,
    })),
    ...parseActivities(sources.listaFase3).map((act) => ({
      act,
      sourcePhase: 3 as const,
    })),
    ...parseActivities(sources.listaNotas).map((act) => ({ act })),
  ];

  for (const { act, sourcePhase } of allGradedActivities) {
    if (
      hasAuthoritativePhases &&
      !isEvaluativeActivity(act.nome) &&
      (act.nota === null || act.nota === '-')
    ) {
      continue;
    }

    const key = normalizeName(act.nome);
    if (!key) continue;

    if (f1Map.has(key)) {
      addOrMergeActivity(f1Map, act, 1, key);
      continue;
    }
    if (f2Map.has(key)) {
      addOrMergeActivity(f2Map, act, 2, key);
      continue;
    }
    if (f3Map.has(key)) {
      addOrMergeActivity(f3Map, act, 3, key);
      continue;
    }

    const authEntry = authoritativeProgressMap.get(key);
    if (authEntry) {
      const targetMap =
        authEntry.phase === 1 ? f1Map : authEntry.phase === 2 ? f2Map : f3Map;
      addOrMergeActivity(targetMap, authEntry.act, authEntry.phase, key);
      addOrMergeActivity(targetMap, act, authEntry.phase, key);
      continue;
    }

    const p1 = findPrefixMatchKey(f1Map, key);
    if (p1) {
      addOrMergeActivity(f1Map, act, 1, p1);
      continue;
    }
    const p2 = findPrefixMatchKey(f2Map, key);
    if (p2) {
      addOrMergeActivity(f2Map, act, 2, p2);
      continue;
    }
    const p3 = findPrefixMatchKey(f3Map, key);
    if (p3) {
      addOrMergeActivity(f3Map, act, 3, p3);
      continue;
    }

    const hasGrade = act.nota !== null && act.nota !== '-';
    const isExam = key.includes('exame') || key.includes('substitutiva');
    if (!hasAuthoritativePhases || hasGrade || isExam) {
      const phase = classifyActivityPhase(act.nome, sourcePhase || 1);
      const targetMap = phase === 1 ? f1Map : phase === 2 ? f2Map : f3Map;
      addOrMergeActivity(targetMap, act, phase);
    }
  }

  const f1Activities = sortActivitiesByPhaseOrder(Array.from(f1Map.values()));
  const f2Activities = sortActivitiesByPhaseOrder(Array.from(f2Map.values()));
  const f3Activities = sortActivitiesByPhaseOrder(Array.from(f3Map.values()));

  const hasComplementaryPhaseLists = Boolean(
    sources.listaFase1?.trim() ||
    sources.listaFase2?.trim() ||
    sources.listaFase3?.trim() ||
    sources.progressoListaFase1?.trim() ||
    sources.progressoListaFase2?.trim() ||
    sources.progressoListaFase3?.trim(),
  );

  const isTruncatedUncompensated =
    detectListaNotasTruncated(sources.listaNotas) &&
    !hasComplementaryPhaseLists;

  return {
    f1Activities,
    f2Activities,
    f3Activities,
    allActivities: [...f1Activities, ...f2Activities, ...f3Activities],
    isTruncatedUncompensated,
  };
}
