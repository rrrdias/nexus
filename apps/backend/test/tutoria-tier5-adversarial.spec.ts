/**
 * apps/backend/test/tutoria-tier5-adversarial.spec.ts
 *
 * Phase 2 — Tier 5 Adversarial Test Suite for NexusHub Tutoria Subsystem
 * Focus: White-box adversarial hardening, invariant enforcement, race condition resilience,
 * boundary extremes, injection resistance, and audit trail immutability.
 *
 * Execution:
 *   npx jest --config apps/backend/test/jest-e2e.json --testRegex "tutoria-tier5-adversarial.*" --runInBand --forceExit
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import * as http from 'http';
import * as crypto from 'crypto';

import { TutoriaController } from '../src/tutoria/tutoria.controller';
import { TutoriaService } from '../src/tutoria/tutoria.service';
import { TutoriaSyncService } from '../src/tutoria/tutoria-sync.service';
import { DB_CONNECTION } from '../src/db/db.provider';
import { CacheService } from '../src/cache/cache.service';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { RbacGuard } from '../src/auth/rbac.guard';

// ============================================================================
// IPC NAMED PIPE ADAPTER
// ============================================================================
function createPipeClient(pipePath: string) {
  function makeReq(method: string, path: string) {
    const headers: Record<string, string> = {};
    let reqBody: any = null;
    let expectedStatus: number | null = null;

    const chain: any = {
      set(key: string, val: string) {
        headers[key] = val;
        return chain;
      },
      send(data: any) {
        reqBody = data;
        return chain;
      },
      expect(statusOrFn: number | ((res: any) => void)) {
        if (typeof statusOrFn === 'number') {
          expectedStatus = statusOrFn;
        }
        return chain;
      },
      then(resolve: any, reject: any) {
        return new Promise<any>((resResolve, resReject) => {
          const formattedPath = path.startsWith('/') ? path : `/${path}`;
          const isJson = reqBody && typeof reqBody === 'object';
          const payload = reqBody
            ? isJson
              ? JSON.stringify(reqBody)
              : String(reqBody)
            : null;

          function executeReq(retryCount = 0) {
            const req = http.request(
              {
                socketPath: pipePath,
                path: formattedPath,
                method,
                headers: {
                  ...headers,
                  ...(payload ? { 'Content-Type': 'application/json' } : {}),
                },
              },
              (res) => {
                let raw = '';
                res.on('data', (d) => (raw += d));
                res.on('end', () => {
                  let parsed = raw;
                  try {
                    parsed = JSON.parse(raw);
                  } catch {
                    parsed = raw;
                  }
                  const responseObj = {
                    status: res.statusCode || 200,
                    statusCode: res.statusCode || 200,
                    headers: res.headers,
                    body: parsed,
                    text: raw,
                  };
                  if (
                    expectedStatus !== null &&
                    res.statusCode !== expectedStatus
                  ) {
                    return resReject(
                      new Error(
                        `Expected status ${expectedStatus} but got ${res.statusCode}: ${raw}`,
                      ),
                    );
                  }
                  resResolve(responseObj);
                });
              },
            );
            req.on('error', (err: any) => {
              if (
                (err.code === 'ENOENT' ||
                  err.code === 'ECONNRESET' ||
                  err.code === 'ECONNREFUSED') &&
                retryCount < 5
              ) {
                setTimeout(
                  () => executeReq(retryCount + 1),
                  15 * (retryCount + 1),
                );
                return;
              }
              resReject(err);
            });
            if (payload) {
              req.write(payload);
            }
            req.end();
          }

          executeReq(0);
        }).then(resolve, reject);
      },
    };
    return chain;
  }

  return {
    get: (path: string) => makeReq('GET', path),
    post: (path: string) => makeReq('POST', path),
    patch: (path: string) => makeReq('PATCH', path),
    delete: (path: string) => makeReq('DELETE', path),
  };
}

// ============================================================================
// STATEFUL IN-MEMORY MOCK DATABASE FIXTURE (PROVEN AST-AWARE ROUTER)
// ============================================================================
interface MockUser {
  id: string;
  name: string;
  email: string | null;
  isActive: boolean;
  isSuperAdmin: boolean;
  modules: string[];
}

interface MockKanbanCard {
  id: string;
  matricula: string;
  aluno_nome: string;
  periodo: string;
  sourceInstitution?: string;
  status_kanban: string;
  tutor_responsavel_id: string | null;
  tutor_iniciador_id: string | null;
  observacoes: string | null;
  canal_contato_utilizado: string | null;
  ultimo_contato_em: string | null;
  ultima_intervencao_em: string | null;
  qtd_intervencoes: number;
  data_resolucao: string | null;
  createdAt: string;
  updatedAt: string;
}

interface MockTimelineEvent {
  id: string;
  atendimentoId: string | null;
  matricula: string;
  periodo: string;
  tipoEvento: string;
  autorId: string;
  autorNome: string;
  tutorResponsavelAnteriorId?: string | null;
  tutorResponsavelNovoId?: string | null;
  estadoAnterior?: string | null;
  estadoNovo?: string | null;
  canalContato?: string | null;
  observacoes?: string | null;
  metadata?: any;
  createdAt: string;
}

function createAdversarialMockDatabase() {
  const users = new Map<string, MockUser>([
    [
      'tutor-lead-1',
      {
        id: 'tutor-lead-1',
        name: 'Prof. Carlos Titular',
        email: 'carlos.tutor@unievangelica.edu.br',
        isActive: true,
        isSuperAdmin: false,
        modules: ['tutoria'],
      },
    ],
    [
      'tutor-collab-2',
      {
        id: 'tutor-collab-2',
        name: 'Profa. Marina Colaboradora',
        email: 'marina.tutor@unievangelica.edu.br',
        isActive: true,
        isSuperAdmin: false,
        modules: ['tutoria'],
      },
    ],
    [
      'tutor-new-3',
      {
        id: 'tutor-new-3',
        name: 'Prof. Roberto Sucessor',
        email: 'roberto.tutor@unievangelica.edu.br',
        isActive: true,
        isSuperAdmin: false,
        modules: ['tutoria'],
      },
    ],
    [
      'admin-1',
      {
        id: 'admin-1',
        name: 'Admin Geral',
        email: 'admin@unievangelica.edu.br',
        isActive: true,
        isSuperAdmin: true,
        modules: ['tutoria', 'admin'],
      },
    ],
    [
      'unauth-user-9',
      {
        id: 'unauth-user-9',
        name: 'Usuário Sem Acesso',
        email: 'unauth@unievangelica.edu.br',
        isActive: true,
        isSuperAdmin: false,
        modules: [],
      },
    ],
    [
      'inactive-tutor-8',
      {
        id: 'inactive-tutor-8',
        name: 'Tutor Desativado',
        email: 'inativo@unievangelica.edu.br',
        isActive: false,
        isSuperAdmin: false,
        modules: ['tutoria'],
      },
    ],
  ]);

  const kanbanCards = new Map<string, MockKanbanCard>();
  const timelineEvents: MockTimelineEvent[] = [];

  function extractSqlAndParams(query: any): { sqlText: string; params: any[] } {
    const params: any[] = [];
    function walk(q: any): string {
      if (q === null || q === undefined) {
        params.push(q);
        return '$param';
      }
      if (
        q?.constructor?.name === 'StringChunk' ||
        (q?.value && Array.isArray(q.value) && !q?.queryChunks)
      ) {
        return q.value.join('');
      }
      if (q?.queryChunks && Array.isArray(q.queryChunks)) {
        return q.queryChunks.map(walk).join('');
      }
      if (Array.isArray(q)) {
        return q.map(walk).join('');
      }
      params.push(q);
      return '$param';
    }
    const sqlText = walk(query);
    return { sqlText, params };
  }

  function parseInsert(
    query: any,
    tableName: string,
  ): Record<string, any> | null {
    const { sqlText, params } = extractSqlAndParams(query);
    const regex = new RegExp(
      `INSERT\\s+INTO\\s+${tableName}\\s*\\(([\\s\\S]*?)\\)\\s*VALUES`,
      'i',
    );
    const m = sqlText.match(regex);
    if (!m) return null;
    const cols = m[1].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    const valMatch = sqlText.match(/VALUES\s*\(([\s\S]*?)\)/i);
    const valTokens = valMatch
      ? valMatch[1].split(',').map((s) => s.trim())
      : [];
    const record: Record<string, any> = {};
    let pIdx = 0;
    for (let i = 0; i < cols.length; i++) {
      const col = cols[i];
      const token = valTokens[i] || '$param';
      if (
        col === 'createdAt' ||
        col === 'updatedAt' ||
        token.toLowerCase().includes('now()')
      ) {
        record[col] = new Date().toISOString();
      } else if (token === '$param') {
        record[col] = pIdx < params.length ? params[pIdx++] : null;
      } else if (token.toUpperCase() === 'NULL') {
        record[col] = null;
      } else {
        record[col] = token.replace(/^['"]|['"]$/g, '');
      }
    }
    return record;
  }

  function parseUpdate(query: any): {
    targetId: string | null;
    setFields: Record<string, any>;
  } | null {
    const { sqlText, params } = extractSqlAndParams(query);
    const setMatch = sqlText.match(
      /SET\s+([\s\S]*?)\s+WHERE\s+id\s*=\s*(\S+)/i,
    );
    if (!setMatch) return null;
    const assignments = setMatch[1].split(',').map((s) => s.trim());
    let pIdx = 0;
    const setFields: Record<string, any> = {};
    for (const a of assignments) {
      const parts = a.split('=');
      if (parts.length < 2) continue;
      const key = parts[0].trim().replace(/^"|"$/g, '');
      const valExpr = parts.slice(1).join('=').trim();
      if (valExpr.toLowerCase().includes('now()')) {
        setFields[key] = new Date().toISOString();
      } else if (valExpr.includes('$param')) {
        setFields[key] = pIdx < params.length ? params[pIdx++] : null;
      } else if (valExpr.toLowerCase().includes('coalesce')) {
        setFields[key] = '__increment__';
      } else {
        setFields[key] = valExpr.replace(/^['"]|['"]$/g, '');
      }
    }
    let targetId: string | null = null;
    if (pIdx < params.length && typeof params[pIdx] === 'string') {
      targetId = params[pIdx];
    } else {
      const cleaned = setMatch[2]
        .replace(/[;\s]+$/, '')
        .replace(/^['"]|['"]$/g, '');
      targetId = cleaned;
    }
    if (!targetId || !kanbanCards.has(targetId)) {
      for (const p of params) {
        if (typeof p === 'string' && kanbanCards.has(p)) {
          targetId = p;
          break;
        }
      }
    }
    return { targetId, setFields };
  }

  function extractUserIdFromCondition(cond: any): string | null {
    if (!cond) return null;
    if (typeof cond === 'string') return cond;
    if (Array.isArray(cond.queryChunks)) {
      for (const chunk of cond.queryChunks) {
        if (
          chunk &&
          typeof chunk.value === 'string' &&
          chunk.value.length > 0 &&
          !chunk.value.startsWith('select')
        ) {
          return chunk.value;
        }
        if (chunk && typeof chunk === 'object' && chunk.queryChunks) {
          const nested = extractUserIdFromCondition(chunk);
          if (nested) return nested;
        }
      }
    }
    return null;
  }

  const mockDb = {
    _state: { users, kanbanCards, timelineEvents },

    select: jest.fn().mockImplementation((fields) => {
      let targetUser: MockUser | undefined;
      const chain: any = {
        from: jest.fn().mockImplementation(() => chain),
        innerJoin: jest.fn().mockImplementation(() => chain),
        leftJoin: jest.fn().mockImplementation(() => chain),
        where: jest.fn().mockImplementation((cond) => {
          const val = extractUserIdFromCondition(cond);
          if (val && users.has(val)) {
            targetUser = users.get(val);
          }
          return chain;
        }),
        limit: jest.fn().mockImplementation(() => chain),
        orderBy: jest.fn().mockImplementation(() => chain),
        then: (resolve: any) => {
          if (fields?.isActive !== undefined) {
            if (targetUser) {
              return Promise.resolve([{ isActive: targetUser.isActive }]).then(
                resolve,
              );
            }
            return Promise.resolve([{ isActive: true }]).then(resolve);
          }
          if (fields?.slug !== undefined) {
            if (targetUser && targetUser.modules) {
              return Promise.resolve(
                targetUser.modules.map((s) => ({ slug: s })),
              ).then(resolve);
            }
            return Promise.resolve([{ slug: 'tutoria' }]).then(resolve);
          }
          return Promise.resolve([]).then(resolve);
        },
      };
      return chain;
    }),

    insert: jest.fn().mockImplementation(() => ({
      values: jest.fn().mockImplementation(() => ({
        returning: jest.fn().mockResolvedValue([]),
        then: (resolve: any) => Promise.resolve([]).then(resolve),
      })),
    })),

    update: jest.fn().mockImplementation(() => ({
      set: jest.fn().mockImplementation(() => ({
        where: jest.fn().mockImplementation(() => ({
          returning: jest.fn().mockResolvedValue([]),
          then: (resolve: any) => Promise.resolve([]).then(resolve),
        })),
      })),
    })),

    delete: jest.fn().mockImplementation(() => ({
      where: jest.fn().mockImplementation(() => ({
        then: (resolve: any) => Promise.resolve([]).then(resolve),
      })),
    })),

    execute: jest.fn().mockImplementation(async (query: any) => {
      const { sqlText, params } = extractSqlAndParams(query);
      const upper = sqlText.toUpperCase();

      if (
        upper.includes('CREATE TABLE') ||
        upper.includes('ALTER TABLE') ||
        upper.includes('CREATE INDEX')
      ) {
        return [];
      }

      if (upper.includes('FROM "USER"') || upper.includes('FROM USER')) {
        if (
          upper.includes('WHERE ID =') ||
          upper.includes('WHERE "ID" =') ||
          upper.includes('WHERE ID=')
        ) {
          let targetUserId: string | null = null;
          for (const p of params) {
            if (typeof p === 'string' && users.has(p)) {
              targetUserId = p;
              break;
            }
          }
          if (!targetUserId) {
            for (const id of users.keys()) {
              if (sqlText.includes(id)) {
                targetUserId = id;
                break;
              }
            }
          }
          if (targetUserId && users.has(targetUserId)) {
            const u = users.get(targetUserId)!;
            return [
              { id: u.id, name: u.name, email: u.email, isActive: u.isActive },
            ];
          }
          return [];
        }

        return Array.from(users.values())
          .filter(
            (u) =>
              u.isActive && (u.modules ? u.modules.includes('tutoria') : true),
          )
          .map((u) => ({ id: u.id, name: u.name, email: u.email }))
          .sort((a, b) => a.name.localeCompare(b.name));
      }

      if (
        upper.includes('FROM ACADEMIC_DISCENTE') ||
        upper.includes('FROM TUTORIA_ENGAJAMENTO_ALUNO')
      ) {
        return [];
      }

      if (upper.includes('INSERT INTO TUTORIA_ATENDIMENTOS_KANBAN')) {
        const parsed = parseInsert(query, 'tutoria_atendimentos_kanban');
        if (parsed && parsed.id) {
          const card: MockKanbanCard = {
            id: String(parsed.id),
            matricula: String(parsed.matricula || ''),
            aluno_nome: String(parsed.aluno_nome || 'Estudante'),
            periodo: String(parsed.periodo || '2026-2'),
            status_kanban: String(parsed.status_kanban || 'pendente'),
            tutor_responsavel_id: parsed.tutor_responsavel_id
              ? String(parsed.tutor_responsavel_id)
              : 'tutor-lead-1',
            tutor_iniciador_id: parsed.tutor_iniciador_id
              ? String(parsed.tutor_iniciador_id)
              : parsed.tutor_responsavel_id
                ? String(parsed.tutor_responsavel_id)
                : 'tutor-lead-1',
            observacoes: parsed.observacoes ? String(parsed.observacoes) : null,
            canal_contato_utilizado: parsed.canal_contato_utilizado
              ? String(parsed.canal_contato_utilizado)
              : null,
            ultimo_contato_em: parsed.ultimo_contato_em
              ? String(parsed.ultimo_contato_em)
              : parsed.canal_contato_utilizado
                ? new Date().toISOString()
                : null,
            ultima_intervencao_em: new Date().toISOString(),
            qtd_intervencoes: 1,
            data_resolucao: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          kanbanCards.set(card.id, card);
        }
        return [];
      }

      if (upper.includes('UPDATE TUTORIA_ATENDIMENTOS_KANBAN')) {
        const parsed = parseUpdate(query);
        let card: MockKanbanCard | undefined;
        if (parsed && parsed.targetId && kanbanCards.has(parsed.targetId)) {
          card = kanbanCards.get(parsed.targetId);
        }
        if (!card) {
          for (const [id, c] of kanbanCards.entries()) {
            if (params.includes(id) || sqlText.includes(id)) {
              card = c;
              break;
            }
          }
        }

        if (card) {
          if (parsed && parsed.setFields) {
            for (const [k, v] of Object.entries(parsed.setFields)) {
              if (v === '__increment__') {
                (card as any)[k] = ((card as any)[k] || 0) + 1;
              } else {
                (card as any)[k] = v;
              }
            }
          }
          card.updatedAt = new Date().toISOString();
          return [card];
        }
        return [];
      }

      if (upper.includes('DELETE FROM TUTORIA_ATENDIMENTOS_KANBAN')) {
        for (const p of params) {
          if (typeof p === 'string' && kanbanCards.has(p)) {
            kanbanCards.delete(p);
            break;
          }
        }
        for (const id of kanbanCards.keys()) {
          if (sqlText.includes(id)) {
            kanbanCards.delete(id);
            break;
          }
        }
        return [];
      }

      if (
        upper.includes('FROM TUTORIA_ATENDIMENTOS_KANBAN') &&
        upper.includes('SELECT')
      ) {
        const whereClause = sqlText.split(/WHERE/i)[1] || '';
        const hasIdFilter =
          /\b(?:k\.)?id\s*=/i.test(whereClause) ||
          /"id"\s*=/i.test(whereClause);
        const hasMatriculaFilter =
          /\b(?:k\.)?matricula\s*=/i.test(whereClause) ||
          whereClause.toUpperCase().includes('MATRICULA =') ||
          whereClause.toUpperCase().includes('MATRICULA=');
        const hasPeriodoFilter =
          whereClause.toUpperCase().includes('PERIODO =') ||
          whereClause.toUpperCase().includes('K.PERIODO =');

        for (const card of kanbanCards.values()) {
          if (
            hasIdFilter &&
            !params.includes(card.id) &&
            !sqlText.includes(card.id)
          ) {
            continue;
          }

          if (
            hasMatriculaFilter &&
            (!card.matricula ||
              (!params.includes(card.matricula) &&
                !sqlText.includes(card.matricula)))
          ) {
            continue;
          }

          if (
            hasPeriodoFilter &&
            (!card.periodo ||
              (!params.includes(card.periodo) &&
                !sqlText.includes(card.periodo)))
          ) {
            continue;
          }

          return [
            {
              ...card,
              sourceInstitution: 'ead',
              tutor_nome:
                users.get(card.tutor_responsavel_id || '')?.name ||
                'Tutor Responsável',
            },
          ];
        }

        if (hasIdFilter || hasMatriculaFilter) {
          return [];
        }

        return Array.from(kanbanCards.values()).map((card) => ({
          ...card,
          sourceInstitution: 'ead',
          tutor_nome:
            users.get(card.tutor_responsavel_id || '')?.name ||
            'Tutor Responsável',
        }));
      }

      if (upper.includes('INSERT INTO TUTORIA_ATENDIMENTOS_HISTORICO')) {
        const parsed = parseInsert(query, 'tutoria_atendimentos_historico');
        if (parsed) {
          const event: MockTimelineEvent = {
            id: String(parsed.id || crypto.randomUUID()),
            atendimentoId: parsed.atendimento_id
              ? String(parsed.atendimento_id)
              : null,
            matricula: String(parsed.matricula || ''),
            periodo: String(parsed.periodo || '2026-2'),
            tipoEvento: String(parsed.tipo_evento || 'intervencao_manual'),
            autorId: String(parsed.autor_id || 'tutor-lead-1'),
            autorNome: String(parsed.autor_nome || 'Tutor Atuante'),
            tutorResponsavelAnteriorId: parsed.tutor_responsavel_anterior_id
              ? String(parsed.tutor_responsavel_anterior_id)
              : null,
            tutorResponsavelNovoId: parsed.tutor_responsavel_novo_id
              ? String(parsed.tutor_responsavel_novo_id)
              : null,
            estadoAnterior: parsed.estado_anterior
              ? String(parsed.estado_anterior)
              : null,
            estadoNovo: parsed.estado_novo ? String(parsed.estado_novo) : null,
            canalContato: parsed.canal_contato
              ? String(parsed.canal_contato)
              : null,
            observacoes: parsed.observacoes ? String(parsed.observacoes) : null,
            metadata: parsed.metadata
              ? typeof parsed.metadata === 'string'
                ? (() => {
                    try {
                      return JSON.parse(parsed.metadata);
                    } catch {
                      return parsed.metadata;
                    }
                  })()
                : parsed.metadata
              : null,
            createdAt: new Date().toISOString(),
          };
          timelineEvents.push(event);
        }
        return [];
      }

      if (
        upper.includes('FROM TUTORIA_ATENDIMENTOS_HISTORICO') &&
        upper.includes('SELECT')
      ) {
        let filtered = [...timelineEvents];

        if (
          /\b(?:h\.)?atendimento_id\s*=/i.test(sqlText) ||
          upper.includes('ATENDIMENTO_ID =')
        ) {
          let targetAtendimentoId: string | null = null;
          const literalMatch = sqlText.match(
            /(?:h\.)?atendimento_id\s*=\s*'([^']+)'/i,
          );
          if (literalMatch) {
            targetAtendimentoId = literalMatch[1];
          } else {
            const m = sqlText.match(/(?:h\.)?atendimento_id\s*=\s*\$param/i);
            if (m && m.index !== undefined) {
              const prefix = sqlText.slice(0, m.index);
              const pIndex = (prefix.match(/\$param/g) || []).length;
              if (
                pIndex < params.length &&
                typeof params[pIndex] === 'string'
              ) {
                targetAtendimentoId = params[pIndex];
              }
            }
          }
          if (!targetAtendimentoId) {
            for (const p of params) {
              if (
                typeof p === 'string' &&
                (p.startsWith('card-') || kanbanCards.has(p))
              ) {
                targetAtendimentoId = p;
                break;
              }
            }
          }
          if (targetAtendimentoId !== null) {
            filtered = filtered.filter(
              (e) => e.atendimentoId === targetAtendimentoId,
            );
          }
        }

        if (
          /\b(?:h\.)?matricula\s*=/i.test(sqlText) ||
          upper.includes('MATRICULA =')
        ) {
          let targetMatricula: string | null = null;
          const literalMatch = sqlText.match(
            /(?:h\.)?matricula\s*=\s*'([^']+)'/i,
          );
          if (literalMatch) {
            targetMatricula = literalMatch[1];
          } else {
            const m = sqlText.match(/(?:h\.)?matricula\s*=\s*\$param/i);
            if (m && m.index !== undefined) {
              const prefix = sqlText.slice(0, m.index);
              const pIndex = (prefix.match(/\$param/g) || []).length;
              if (
                pIndex < params.length &&
                typeof params[pIndex] === 'string'
              ) {
                targetMatricula = params[pIndex];
              }
            }
          }
          if (targetMatricula !== null) {
            filtered = filtered.filter((e) => e.matricula === targetMatricula);
          }
        }

        const sorted = filtered.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );

        return sorted.map((e) => ({
          id: e.id,
          atendimentoId: e.atendimentoId,
          matricula: e.matricula,
          periodo: e.periodo,
          sourceInstitution: 'ead',
          tipoEvento: e.tipoEvento,
          autorId: e.autorId,
          autorNome: e.autorNome,
          tutorResponsavelAnteriorId: e.tutorResponsavelAnteriorId || null,
          tutorResponsavelNovoId: e.tutorResponsavelNovoId || null,
          estadoAnterior: e.estadoAnterior || null,
          estadoNovo: e.estadoNovo || null,
          canalContato: e.canalContato || null,
          observacoes: e.observacoes || null,
          metadata: e.metadata || null,
          createdAt: e.createdAt,
        }));
      }

      return [{ count: 1, total_alunos_disciplinas: 1, total: 1 }];
    }),
  };

  return mockDb;
}

// ============================================================================
// TIER 5 ADVERSARIAL TEST SUITE
// ============================================================================

describe('Tier 5: Adversarial Coverage Hardening (Backend Multi-Tutor Tutoria)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let mockDb: ReturnType<typeof createAdversarialMockDatabase>;
  let client: ReturnType<typeof createPipeClient>;
  const PIPE_PATH =
    '\\\\.\\pipe\\nexus_tutoria_tier5_' +
    Date.now() +
    '_' +
    Math.random().toString(36).substring(2, 6);

  process.env.JWT_SECRET = 'nexus-dev-jwt-secret-not-for-production-min32chars';
  const JWT_SECRET = process.env.JWT_SECRET;

  let tokenLead: string;
  let tokenCollab: string;
  let tokenSuccessor: string;
  let _tokenAdmin: string;
  let tokenUnauthStudent: string;
  let _tokenInactive: string;

  beforeAll(async () => {
    mockDb = createAdversarialMockDatabase();

    const mockSyncService = {
      syncTutoriaLogs: jest
        .fn()
        .mockResolvedValue({ status: 'success', records: 0 }),
      getSyncStatus: jest
        .fn()
        .mockReturnValue({ inProgress: false, lastSync: null }),
    };

    const mockCacheService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
      wrap: jest.fn().mockImplementation((key: string, fn: any) => fn()),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: JWT_SECRET,
          signOptions: { expiresIn: '1h' },
        }),
      ],
      controllers: [TutoriaController],
      providers: [
        TutoriaService,
        { provide: TutoriaSyncService, useValue: mockSyncService },
        { provide: DB_CONNECTION, useValue: mockDb },
        { provide: CacheService, useValue: mockCacheService },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RbacGuard },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );

    jwtService = moduleFixture.get<JwtService>(JwtService);

    tokenLead = jwtService.sign({
      sub: 'tutor-lead-1',
      email: 'carlos.tutor@unievangelica.edu.br',
      name: 'Prof. Carlos Titular',
      isSuperAdmin: false,
    });

    tokenCollab = jwtService.sign({
      sub: 'tutor-collab-2',
      email: 'marina.tutor@unievangelica.edu.br',
      name: 'Profa. Marina Colaboradora',
      isSuperAdmin: false,
    });

    tokenSuccessor = jwtService.sign({
      sub: 'tutor-new-3',
      email: 'roberto.tutor@unievangelica.edu.br',
      name: 'Prof. Roberto Sucessor',
      isSuperAdmin: false,
    });

    _tokenAdmin = jwtService.sign({
      sub: 'admin-1',
      email: 'admin@unievangelica.edu.br',
      name: 'Admin Geral',
      isSuperAdmin: true,
    });

    tokenUnauthStudent = jwtService.sign({
      sub: 'unauth-user-9',
      email: 'unauth@unievangelica.edu.br',
      name: 'Usuário Sem Acesso',
      isSuperAdmin: false,
    });

    _tokenInactive = jwtService.sign({
      sub: 'inactive-tutor-8',
      email: 'inativo@unievangelica.edu.br',
      name: 'Tutor Desativado',
      isSuperAdmin: false,
    });

    await app.listen(PIPE_PATH);
    client = createPipeClient(PIPE_PATH);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  // --------------------------------------------------------------------------
  // SUITE 1: Invariant Enforcement & Tampering Resilience (ADV-F1)
  // --------------------------------------------------------------------------
  describe('Suite 1: Invariant Enforcement & Tampering Resilience (ADV-F1)', () => {
    let testCardId: string;

    beforeEach(async () => {
      testCardId = `card-adv-inv-${Date.now()}`;
      mockDb._state.kanbanCards.set(testCardId, {
        id: testCardId,
        matricula: 'ADV2026101',
        aluno_nome: 'Aluno Blindado',
        periodo: '2026-2',
        status_kanban: 'pendente',
        tutor_responsavel_id: 'tutor-lead-1',
        tutor_iniciador_id: 'tutor-lead-1',
        observacoes: 'Card para testes de invariância',
        canal_contato_utilizado: null,
        ultimo_contato_em: null,
        ultima_intervencao_em: null,
        qtd_intervencoes: 0,
        data_resolucao: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });

    it('TC-T5-ADV-01: Collaborator parameter tampering in PATCH kanban card cannot overwrite lead tutor', async () => {
      const res = await client
        .patch(`/api/tutoria/kanban/${testCardId}`)
        .set('Authorization', `Bearer ${tokenCollab}`)
        .send({
          statusKanban: 'em_contato',
          observacoes: 'Tentativa de sequestro de titularidade',
          tutorResponsavelId: 'tutor-collab-2',
          tutor_responsavel_id: 'tutor-collab-2',
          tutorIniciadorId: 'tutor-collab-2',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      const card = mockDb._state.kanbanCards.get(testCardId)!;
      expect(card.tutor_responsavel_id).toBe('tutor-lead-1');
      expect(card.status_kanban).toBe('em_contato');
    });

    it('TC-T5-ADV-02: Collaborator parameter tampering in POST /intervencoes cannot overwrite lead tutor', async () => {
      await client
        .post('/api/tutoria/intervencoes')
        .set('Authorization', `Bearer ${tokenCollab}`)
        .send({
          atendimentoId: testCardId,
          matricula: 'ADV2026101',
          tipoEvento: 'intervencao_manual',
          observacoes: 'Intervenção colaborativa com injeção de parâmetros',
          tutorResponsavelId: 'tutor-collab-2',
          autorId: 'hacked-autor-id',
        })
        .expect(201);

      const card = mockDb._state.kanbanCards.get(testCardId)!;
      expect(card.tutor_responsavel_id).toBe('tutor-lead-1');
    });

    it('TC-T5-ADV-03: Former lead tutor cannot recapture ownership via regular updates after baton pass', async () => {
      // 1. Pass baton to successor
      await client
        .post(`/api/tutoria/kanban/${testCardId}/transferir`)
        .set('Authorization', `Bearer ${tokenLead}`)
        .send({
          novoTutorId: 'tutor-new-3',
          notaTransicao: 'Passagem formal para o Prof. Roberto Sucessor',
        })
        .expect(200);

      let card = mockDb._state.kanbanCards.get(testCardId)!;
      expect(card.tutor_responsavel_id).toBe('tutor-new-3');

      // 2. Former lead tutor updates notes on the card
      await client
        .patch(`/api/tutoria/kanban/${testCardId}`)
        .set('Authorization', `Bearer ${tokenLead}`)
        .send({
          observacoes: 'Nota complementar adicionada pelo antigo tutor titular',
        })
        .expect(200);

      card = mockDb._state.kanbanCards.get(testCardId)!;
      expect(card.tutor_responsavel_id).toBe('tutor-new-3');
    });

    it('TC-T5-ADV-04: Unauthorized user (student role) is rejected on baton pass with 403 Forbidden', async () => {
      await client
        .post(`/api/tutoria/kanban/${testCardId}/transferir`)
        .set('Authorization', `Bearer ${tokenUnauthStudent}`)
        .send({
          novoTutorId: 'tutor-new-3',
          notaTransicao: 'Tentativa de transferência sem módulo de tutoria',
        })
        .expect(403);

      const card = mockDb._state.kanbanCards.get(testCardId)!;
      expect(card.tutor_responsavel_id).toBe('tutor-lead-1');
    });

    it('TC-T5-ADV-05: Missing JWT token on baton pass is rejected with 401 Unauthorized', async () => {
      await client
        .post(`/api/tutoria/kanban/${testCardId}/transferir`)
        .send({
          novoTutorId: 'tutor-new-3',
          notaTransicao: 'Tentativa não autenticada',
        })
        .expect(401);
    });
  });

  // --------------------------------------------------------------------------
  // SUITE 2: Concurrency & Race Conditions (ADV-CONC)
  // --------------------------------------------------------------------------
  describe('Suite 2: Concurrency & Race Conditions (ADV-CONC)', () => {
    let raceCardId: string;

    beforeEach(async () => {
      raceCardId = `card-race-${Date.now()}`;
      mockDb._state.kanbanCards.set(raceCardId, {
        id: raceCardId,
        matricula: 'RACE2026',
        aluno_nome: 'Aluno Concorrente',
        periodo: '2026-2',
        status_kanban: 'pendente',
        tutor_responsavel_id: 'tutor-lead-1',
        tutor_iniciador_id: 'tutor-lead-1',
        observacoes: 'Teste de estresse concorrente',
        canal_contato_utilizado: null,
        ultimo_contato_em: null,
        ultima_intervencao_em: null,
        qtd_intervencoes: 0,
        data_resolucao: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });

    it('TC-T5-ADV-06: Rapid interleaved operations (6 concurrent interventions and movements) preserve atomic counter and timeline count', async () => {
      const results: any[] = [];

      for (let i = 0; i < 3; i++) {
        const batch = await Promise.all([
          client
            .post('/api/tutoria/intervencoes')
            .set('Authorization', `Bearer ${tokenCollab}`)
            .send({
              atendimentoId: raceCardId,
              matricula: 'RACE2026',
              tipoEvento: 'intervencao_manual',
              observacoes: `Intervenção concorrente #${i}`,
            }),
          client
            .patch(`/api/tutoria/kanban/${raceCardId}`)
            .set('Authorization', `Bearer ${tokenLead}`)
            .send({
              observacoes: `Atualização concorrente #${i}`,
            }),
        ]);
        results.push(...batch);
      }

      for (const r of results) {
        expect([200, 201]).toContain(r.status);
      }

      const card = mockDb._state.kanbanCards.get(raceCardId)!;
      expect(card.qtd_intervencoes).toBe(6);

      const timelineRes = await client
        .get(`/api/tutoria/aluno/RACE2026/timeline?atendimentoId=${raceCardId}`)
        .set('Authorization', `Bearer ${tokenLead}`)
        .expect(200);

      expect(Array.isArray(timelineRes.body)).toBe(true);
      expect(timelineRes.body.length).toBe(6);
    });

    it('TC-T5-ADV-07: Simultaneous status transition and baton pass resolves cleanly without state corruption', async () => {
      const [moveRes, transferRes] = await Promise.all([
        client
          .patch(`/api/tutoria/kanban/${raceCardId}`)
          .set('Authorization', `Bearer ${tokenCollab}`)
          .send({
            statusKanban: 'em_recuperacao',
            observacoes: 'Colaborador avançou etapa',
          }),
        client
          .post(`/api/tutoria/kanban/${raceCardId}/transferir`)
          .set('Authorization', `Bearer ${tokenLead}`)
          .send({
            novoTutorId: 'tutor-new-3',
            notaTransicao: 'Passagem simultânea de bastão para Tutor C',
          }),
      ]);

      expect(moveRes.status).toBe(200);
      expect(transferRes.status).toBe(200);

      const card = mockDb._state.kanbanCards.get(raceCardId)!;
      expect(card.status_kanban).toBe('em_recuperacao');
      expect(card.tutor_responsavel_id).toBe('tutor-new-3');

      const timeline = await client
        .get(`/api/tutoria/aluno/RACE2026/timeline?atendimentoId=${raceCardId}`)
        .set('Authorization', `Bearer ${tokenLead}`)
        .expect(200);

      const eventTypes = timeline.body.map((e: any) => e.tipoEvento);
      expect(eventTypes).toContain('mudanca_status');
      expect(eventTypes).toContain('passagem_bastao');
    });

    it('TC-T5-ADV-08: Rapid chained multi-hop baton pass sequence (Tutor A -> B -> C -> A) preserves unbroken historical lineage', async () => {
      // Hop 1: Lead -> Collab
      await client
        .post(`/api/tutoria/kanban/${raceCardId}/transferir`)
        .set('Authorization', `Bearer ${tokenLead}`)
        .send({
          novoTutorId: 'tutor-collab-2',
          notaTransicao: 'Hop 1: Passagem para Marina',
        })
        .expect(200);

      // Hop 2: Collab -> Successor
      await client
        .post(`/api/tutoria/kanban/${raceCardId}/transferir`)
        .set('Authorization', `Bearer ${tokenCollab}`)
        .send({
          novoTutorId: 'tutor-new-3',
          notaTransicao: 'Hop 2: Passagem para Roberto',
        })
        .expect(200);

      // Hop 3: Successor -> Lead
      await client
        .post(`/api/tutoria/kanban/${raceCardId}/transferir`)
        .set('Authorization', `Bearer ${tokenSuccessor}`)
        .send({
          novoTutorId: 'tutor-lead-1',
          notaTransicao: 'Hop 3: Retorno do bastão para Carlos',
        })
        .expect(200);

      const card = mockDb._state.kanbanCards.get(raceCardId)!;
      expect(card.tutor_responsavel_id).toBe('tutor-lead-1');

      const timeline = await client
        .get(`/api/tutoria/aluno/RACE2026/timeline?atendimentoId=${raceCardId}`)
        .set('Authorization', `Bearer ${tokenLead}`)
        .expect(200);

      const batonEvents = timeline.body.filter(
        (e: any) => e.tipoEvento === 'passagem_bastao',
      );
      expect(batonEvents.length).toBe(3);
      expect(batonEvents[0].tutorResponsavelNovoId).toBe('tutor-collab-2');
      expect(batonEvents[1].tutorResponsavelNovoId).toBe('tutor-new-3');
      expect(batonEvents[2].tutorResponsavelNovoId).toBe('tutor-lead-1');
    });
  });

  // --------------------------------------------------------------------------
  // SUITE 3: Boundary Extremes, Unicode, Emojis & Injection Resistance (ADV-BND)
  // --------------------------------------------------------------------------
  describe('Suite 3: Boundary Extremes, Unicode, Emojis & Injection Resistance (ADV-BND)', () => {
    let boundaryCardId: string;

    beforeEach(async () => {
      boundaryCardId = `card-bnd-${Date.now()}`;
      mockDb._state.kanbanCards.set(boundaryCardId, {
        id: boundaryCardId,
        matricula: 'BND2026',
        aluno_nome: 'Aluno Limites',
        periodo: '2026-2',
        status_kanban: 'pendente',
        tutor_responsavel_id: 'tutor-lead-1',
        tutor_iniciador_id: 'tutor-lead-1',
        observacoes: 'Card para testes de limites',
        canal_contato_utilizado: null,
        ultimo_contato_em: null,
        ultima_intervencao_em: null,
        qtd_intervencoes: 0,
        data_resolucao: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });

    it('TC-T5-ADV-09: Massive 10,000-character pedagogical note stress test persists without truncation', async () => {
      const massiveNote = 'A'.repeat(5000) + ' ' + 'B'.repeat(4999);
      const res = await client
        .post('/api/tutoria/intervencoes')
        .set('Authorization', `Bearer ${tokenLead}`)
        .send({
          atendimentoId: boundaryCardId,
          matricula: 'BND2026',
          tipoEvento: 'intervencao_manual',
          observacoes: massiveNote,
        })
        .expect(201);

      expect(res.body.observacoes.length).toBe(10000);

      const timeline = await client
        .get('/api/tutoria/aluno/BND2026/timeline')
        .set('Authorization', `Bearer ${tokenLead}`)
        .expect(200);

      const matchedEvent = timeline.body.find((e: any) => e.id === res.body.id);
      expect(matchedEvent).toBeDefined();
      expect(matchedEvent.observacoes.length).toBe(10000);
    });

    it('TC-T5-ADV-10: Multilingual Unicode, Accents, and Emojis are preserved with 100% fidelity', async () => {
      const complexUnicodeText =
        '🎓 💬 🚀 ⚠️ Notificação Pedagógica: Estudante Müller com pendências em Análise & Algoritmos! 日本語テスト / مرحبا بالعالم';

      const res = await client
        .post('/api/tutoria/intervencoes')
        .set('Authorization', `Bearer ${tokenCollab}`)
        .send({
          atendimentoId: boundaryCardId,
          matricula: 'BND2026',
          tipoEvento: 'contato_enviado',
          canalContato: 'whatsapp',
          observacoes: complexUnicodeText,
        })
        .expect(201);

      expect(res.body.observacoes).toBe(complexUnicodeText);

      const timeline = await client
        .get('/api/tutoria/aluno/BND2026/timeline')
        .set('Authorization', `Bearer ${tokenLead}`)
        .expect(200);

      const event = timeline.body.find((e: any) => e.id === res.body.id);
      expect(event.observacoes).toBe(complexUnicodeText);
    });

    it('TC-T5-ADV-11: SQL Injection attempt in matricula and note payloads is completely neutralized', async () => {
      const sqlInjectionMatricula =
        "BND2026'; DROP TABLE tutoria_atendimentos_kanban; --";
      const sqlInjectionNote = "' OR '1'='1'; SELECT * FROM \"user\"; --";

      await client
        .post('/api/tutoria/intervencoes')
        .set('Authorization', `Bearer ${tokenLead}`)
        .send({
          matricula: sqlInjectionMatricula,
          tipoEvento: 'intervencao_manual',
          observacoes: sqlInjectionNote,
        })
        .expect(201);

      expect(mockDb._state.kanbanCards.size).toBeGreaterThan(0);
      expect(mockDb._state.kanbanCards.has(boundaryCardId)).toBe(true);

      const res = await client
        .get(
          `/api/tutoria/aluno/${encodeURIComponent(sqlInjectionMatricula)}/timeline`,
        )
        .set('Authorization', `Bearer ${tokenLead}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
      expect(res.body[0].observacoes).toBe(sqlInjectionNote);
    });

    it('TC-T5-ADV-12: XSS script payloads in transition notes and interventions are stored safely as literal strings', async () => {
      const xssPayload =
        '<script>alert("XSS")</script><img src=x onerror="javascript:alert(1)">';

      const batonRes = await client
        .post(`/api/tutoria/kanban/${boundaryCardId}/transferir`)
        .set('Authorization', `Bearer ${tokenLead}`)
        .send({
          novoTutorId: 'tutor-new-3',
          notaTransicao: xssPayload,
        })
        .expect(200);

      expect(batonRes.body.evento.observacoes).toBe(xssPayload);

      const timeline = await client
        .get('/api/tutoria/aluno/BND2026/timeline')
        .set('Authorization', `Bearer ${tokenLead}`)
        .expect(200);

      const event = timeline.body.find(
        (e: any) => e.tipoEvento === 'passagem_bastao',
      );
      expect(event.observacoes).toBe(xssPayload);
    });

    it('TC-T5-ADV-13: Deeply nested JSON object (depth 5) in metadata attribute is serialized and retrieved intact', async () => {
      const nestedMetadata = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: 'deep_value',
                tags: ['urgent', 'financial_risk'],
              },
            },
          },
        },
      };

      const res = await client
        .post('/api/tutoria/intervencoes')
        .set('Authorization', `Bearer ${tokenLead}`)
        .send({
          atendimentoId: boundaryCardId,
          matricula: 'BND2026',
          tipoEvento: 'intervencao_manual',
          observacoes: 'Intervenção com metadados estruturados profundos',
          metadata: nestedMetadata,
        })
        .expect(201);

      expect(res.body.metadata).toEqual(nestedMetadata);

      const timeline = await client
        .get('/api/tutoria/aluno/BND2026/timeline')
        .set('Authorization', `Bearer ${tokenLead}`)
        .expect(200);

      const event = timeline.body.find((e: any) => e.id === res.body.id);
      expect(event.metadata).toEqual(nestedMetadata);
    });
  });

  // --------------------------------------------------------------------------
  // SUITE 4: Validation Strictness & Inactive/Malformed Tutor Handling (ADV-VAL)
  // --------------------------------------------------------------------------
  describe('Suite 4: Validation Strictness & Inactive/Malformed Tutor Handling (ADV-VAL)', () => {
    let valCardId: string;

    beforeEach(async () => {
      valCardId = `card-val-${Date.now()}`;
      mockDb._state.kanbanCards.set(valCardId, {
        id: valCardId,
        matricula: 'VAL2026',
        aluno_nome: 'Aluno Validacao',
        periodo: '2026-2',
        status_kanban: 'pendente',
        tutor_responsavel_id: 'tutor-lead-1',
        tutor_iniciador_id: 'tutor-lead-1',
        observacoes: 'Card para testes de validação',
        canal_contato_utilizado: null,
        ultimo_contato_em: null,
        ultima_intervencao_em: null,
        qtd_intervencoes: 0,
        data_resolucao: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });

    it('TC-T5-ADV-14: Baton pass targeting self (lead tutor -> lead tutor) is rejected with 400 Bad Request', async () => {
      const res = await client
        .post(`/api/tutoria/kanban/${valCardId}/transferir`)
        .set('Authorization', `Bearer ${tokenLead}`)
        .send({
          novoTutorId: 'tutor-lead-1',
          notaTransicao: 'Tentando transferir para mim mesmo',
        })
        .expect(400);

      expect(res.body.message).toMatch(/já está atribuído a este tutor/i);
    });

    it('TC-T5-ADV-15: Baton pass targeting an inactive tutor is rejected with 400 Bad Request', async () => {
      const res = await client
        .post(`/api/tutoria/kanban/${valCardId}/transferir`)
        .set('Authorization', `Bearer ${tokenLead}`)
        .send({
          novoTutorId: 'inactive-tutor-8',
          notaTransicao: 'Transferência para professor desligado',
        })
        .expect(400);

      expect(res.body.message).toMatch(/inativo/i);
    });

    it('TC-T5-ADV-16: Baton pass targeting non-existent tutor is rejected with 404 Not Found', async () => {
      const res = await client
        .post(`/api/tutoria/kanban/${valCardId}/transferir`)
        .set('Authorization', `Bearer ${tokenLead}`)
        .send({
          novoTutorId: 'tutor-inexistente-999',
          notaTransicao: 'Transferência para tutor fantasma',
        })
        .expect(404);

      expect(res.body.message).toMatch(/não encontrado/i);
    });

    it('TC-T5-ADV-17: Baton pass with whitespace-only transition note is rejected with 400 Bad Request', async () => {
      await client
        .post(`/api/tutoria/kanban/${valCardId}/transferir`)
        .set('Authorization', `Bearer ${tokenLead}`)
        .send({
          novoTutorId: 'tutor-new-3',
          notaTransicao: '     ',
        })
        .expect(400);
    });

    it('TC-T5-ADV-18: Interventions with invalid enum values for tipoEvento or canalContato are rejected with 400 Bad Request', async () => {
      await client
        .post('/api/tutoria/intervencoes')
        .set('Authorization', `Bearer ${tokenLead}`)
        .send({
          matricula: 'VAL2026',
          tipoEvento: 'evento_alienigena_desconhecido',
          observacoes: 'Teste enum',
        })
        .expect(400);

      await client
        .post('/api/tutoria/intervencoes')
        .set('Authorization', `Bearer ${tokenLead}`)
        .send({
          matricula: 'VAL2026',
          tipoEvento: 'contato_enviado',
          canalContato: 'pombo_correio',
          observacoes: 'Teste canal inválido',
        })
        .expect(400);
    });

    it('TC-T5-ADV-19: Invalid kanban column status transition is rejected with 400 Bad Request', async () => {
      await client
        .patch(`/api/tutoria/kanban/${valCardId}`)
        .set('Authorization', `Bearer ${tokenLead}`)
        .send({
          statusKanban: 'status_fantasma',
        })
        .expect(400);
    });

    it('TC-T5-ADV-20: Timeline query with invalid/too-short atendimentoId query parameter is rejected with 400 Bad Request', async () => {
      await client
        .get('/api/tutoria/aluno/VAL2026/timeline?atendimentoId=abc')
        .set('Authorization', `Bearer ${tokenLead}`)
        .expect(400);
    });
  });

  // --------------------------------------------------------------------------
  // SUITE 5: Audit Trail Immutability & Denormalization Fidelity (ADV-AUDIT)
  // --------------------------------------------------------------------------
  describe('Suite 5: Audit Trail Immutability & Denormalization Fidelity (ADV-AUDIT)', () => {
    let auditCardId: string;

    beforeEach(async () => {
      auditCardId = `card-audit-${Date.now()}`;
      mockDb._state.kanbanCards.set(auditCardId, {
        id: auditCardId,
        matricula: 'AUDIT2026',
        aluno_nome: 'Aluno Auditoria',
        periodo: '2026-2',
        status_kanban: 'pendente',
        tutor_responsavel_id: 'tutor-lead-1',
        tutor_iniciador_id: 'tutor-lead-1',
        observacoes: 'Card para auditoria',
        canal_contato_utilizado: null,
        ultimo_contato_em: null,
        ultima_intervencao_em: null,
        qtd_intervencoes: 0,
        data_resolucao: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });

    it('TC-T5-ADV-21: Audit trail immutability verification: No API endpoint allows modifying or deleting audit entries', async () => {
      const res = await client
        .post('/api/tutoria/intervencoes')
        .set('Authorization', `Bearer ${tokenLead}`)
        .send({
          atendimentoId: auditCardId,
          matricula: 'AUDIT2026',
          tipoEvento: 'intervencao_manual',
          observacoes: 'Registro original que nunca deve ser alterado',
        })
        .expect(201);

      const eventId = res.body.id;

      await client
        .delete(`/api/tutoria/timeline/${eventId}`)
        .set('Authorization', `Bearer ${tokenLead}`)
        .expect(404);

      await client
        .patch(`/api/tutoria/timeline/${eventId}`)
        .set('Authorization', `Bearer ${tokenLead}`)
        .send({ observacoes: 'Tentativa de adulteração' })
        .expect(404);

      const timeline = await client
        .get('/api/tutoria/aluno/AUDIT2026/timeline')
        .set('Authorization', `Bearer ${tokenLead}`)
        .expect(200);

      const auditEvent = timeline.body.find((e: any) => e.id === eventId);
      expect(auditEvent.observacoes).toBe(
        'Registro original que nunca deve ser alterado',
      );
    });

    it('TC-T5-ADV-22: Denormalized author snapshot persists permanently even if user profile changes later', async () => {
      const res = await client
        .post('/api/tutoria/intervencoes')
        .set('Authorization', `Bearer ${tokenLead}`)
        .send({
          atendimentoId: auditCardId,
          matricula: 'AUDIT2026',
          tipoEvento: 'intervencao_manual',
          observacoes: 'Intervenção com snapshot de autor',
        })
        .expect(201);

      expect(res.body.autorNome).toBe('Prof. Carlos Titular');

      // Profile rename in users table
      const user = mockDb._state.users.get('tutor-lead-1')!;
      user.name = 'Prof. Carlos Silva (Nome Alterado)';

      const timeline = await client
        .get('/api/tutoria/aluno/AUDIT2026/timeline')
        .set('Authorization', `Bearer ${tokenLead}`)
        .expect(200);

      const event = timeline.body.find((e: any) => e.id === res.body.id);
      expect(event.autorNome).toBe('Prof. Carlos Titular');
    });

    it('TC-T5-ADV-23: Historical continuity across student attendance cycles is preserved in ascending order', async () => {
      await client
        .patch(`/api/tutoria/kanban/${auditCardId}`)
        .set('Authorization', `Bearer ${tokenCollab}`)
        .send({ statusKanban: 'em_contato', observacoes: 'Primeiro contato' })
        .expect(200);

      await client
        .post(`/api/tutoria/kanban/${auditCardId}/transferir`)
        .set('Authorization', `Bearer ${tokenLead}`)
        .send({ novoTutorId: 'tutor-new-3', notaTransicao: 'Transição' })
        .expect(200);

      await client
        .patch(`/api/tutoria/kanban/${auditCardId}`)
        .set('Authorization', `Bearer ${tokenSuccessor}`)
        .send({ statusKanban: 'revertido', observacoes: 'Aluno recuperado' })
        .expect(200);

      const timeline = await client
        .get('/api/tutoria/aluno/AUDIT2026/timeline')
        .set('Authorization', `Bearer ${tokenLead}`)
        .expect(200);

      expect(timeline.body.length).toBeGreaterThanOrEqual(3);

      for (let i = 1; i < timeline.body.length; i++) {
        const prev = new Date(timeline.body[i - 1].createdAt).getTime();
        const curr = new Date(timeline.body[i].createdAt).getTime();
        expect(curr).toBeGreaterThanOrEqual(prev);
      }
    });

    it('TC-T5-ADV-24: Student with attendance card but zero history records triggers legacy fallback abertura event', async () => {
      const legacyCardId = `card-legacy-${Date.now()}`;
      mockDb._state.kanbanCards.set(legacyCardId, {
        id: legacyCardId,
        matricula: 'LEGACY2026',
        aluno_nome: 'Aluno Legado',
        periodo: '2026-2',
        sourceInstitution: 'ead',
        status_kanban: 'aguardando_retorno',
        tutor_responsavel_id: 'tutor-lead-1',
        tutor_iniciador_id: 'tutor-lead-1',
        observacoes: 'Card antigo sem histórico prévio',
        canal_contato_utilizado: null,
        ultimo_contato_em: null,
        ultima_intervencao_em: null,
        qtd_intervencoes: 0,
        data_resolucao: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const res = await client
        .get('/api/tutoria/aluno/LEGACY2026/timeline')
        .set('Authorization', `Bearer ${tokenLead}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
      expect(res.body[0].tipoEvento).toBe('abertura');
      expect(res.body[0].id).toContain('legacy-');
      expect(res.body[0].estadoNovo).toBe('aguardando_retorno');
    });
  });
});
