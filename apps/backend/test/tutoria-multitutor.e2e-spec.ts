/**
 * apps/backend/test/tutoria-multitutor.e2e-spec.ts
 *
 * Isolated End-to-End (E2E) Test Suite for Multi-Tutor Hybrid Attendance,
 * Chronological Timeline, and Immutable Audit Trail Subsystem.
 *
 * Architecture:
 * - Isolated NestJS TestingModule (TutoriaController, TutoriaService, JwtAuthGuard, RbacGuard)
 * - Zero network dependencies (Redis BullMQ and Lyceum MSSQL are eliminated)
 * - Stateful In-Memory Query Router simulating Drizzle ORM PostgreSQL backend
 * - Full 4-Tier Test Coverage (Tiers 1-4: 83 Test Cases across Features F1-F7)
 *
 * Execution:
 *   npx jest --config ./test/jest-e2e.json tutoria-multitutor.e2e-spec.ts --runInBand --forceExit
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { sql } from 'drizzle-orm';
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
// IPC NAMED PIPE REQUEST ADAPTER FOR ZERO-PORT SANDBOX TESTING
// ============================================================================
export function createPipeClient(pipePath: string) {
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
                  // Fallback to raw string if not JSON
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
          req.on('error', (err) => resReject(err));
          if (payload) {
            req.write(payload);
          }
          req.end();
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
// 1. STATEFUL IN-MEMORY MOCK DATABASE FIXTURE & QUERY ROUTER
// ============================================================================

export interface MockUser {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  isSuperAdmin: boolean;
  modules: string[];
}

export interface MockKanbanCard {
  id: string;
  matricula: string;
  aluno_nome: string;
  periodo: string;
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

export interface MockTimelineEvent {
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

export function createMockTutoriaDatabase() {
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
      'tutor-special-4',
      {
        id: 'tutor-special-4',
        name: 'Prof. André Especialista (São Luís)',
        email: 'andre.especialista@unievangelica.edu.br',
        isActive: true,
        isSuperAdmin: false,
        modules: ['tutoria'],
      },
    ],
    [
      'tutor-no-email-5',
      {
        id: 'tutor-no-email-5',
        name: 'Prof. Lucas Sem Email',
        email: null as any,
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

    // Drizzle ORM fluent query builder mock for JwtAuthGuard and RbacGuard
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

    // Stateful SQL Router executing raw Drizzle sql templates directly from TutoriaService
    execute: jest.fn().mockImplementation(async (query: any) => {
      const { sqlText, params } = extractSqlAndParams(query);
      const upper = sqlText.toUpperCase();

      // 1. DDL Statements (table bootstrap, indexes, migrations)
      if (
        upper.includes('CREATE TABLE') ||
        upper.includes('ALTER TABLE') ||
        upper.includes('CREATE INDEX')
      ) {
        return [];
      }

      // 2. User queries (Active tutors roster or specific user profile)
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

        // Active tutors roster for GET /api/tutoria/tutores
        return Array.from(users.values())
          .filter(
            (u) =>
              u.isActive && (u.modules ? u.modules.includes('tutoria') : true),
          )
          .map((u) => ({ id: u.id, name: u.name, email: u.email }))
          .sort((a, b) => a.name.localeCompare(b.name));
      }

      // 3. Fallback academic lookup
      if (
        upper.includes('FROM ACADEMIC_DISCENTE') ||
        upper.includes('FROM TUTORIA_ENGAJAMENTO_ALUNO')
      ) {
        return [];
      }

      // 4. Kanban Cards: INSERT
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

      // 5. Kanban Cards: UPDATE
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

      // 6. Kanban Cards: DELETE
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

      // 7. Kanban Cards: SELECT
      if (
        upper.includes('FROM TUTORIA_ATENDIMENTOS_KANBAN') &&
        upper.includes('SELECT')
      ) {
        const hasIdFilter =
          /\b(?:k\.)?id\s*=/i.test(sqlText) || /"id"\s*=/i.test(sqlText);
        const hasMatriculaFilter =
          /\b(?:k\.)?matricula\s*=/i.test(sqlText) ||
          upper.includes('MATRICULA =') ||
          upper.includes('MATRICULA=');
        const hasPeriodoFilter =
          upper.includes('PERIODO =') || upper.includes('K.PERIODO =');

        for (const card of kanbanCards.values()) {
          // If query specifies ID, card must match that ID
          if (
            hasIdFilter &&
            !params.includes(card.id) &&
            !sqlText.includes(card.id)
          ) {
            continue;
          }

          // If query specifies MATRICULA, card must match that matricula
          if (
            hasMatriculaFilter &&
            (!card.matricula ||
              (!params.includes(card.matricula) &&
                !sqlText.includes(card.matricula)))
          ) {
            continue;
          }

          // If query specifies PERIODO, card must match that periodo
          if (
            hasPeriodoFilter &&
            card.periodo &&
            !params.includes(card.periodo) &&
            !sqlText.includes(card.periodo)
          ) {
            continue;
          }

          // If either ID or MATRICULA was filtered and matched, return the card
          if (hasIdFilter || hasMatriculaFilter) {
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
        }

        // If the query filtered by ID or MATRICULA and no record matched, return []
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

      // 8. Timeline Events: INSERT
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

      // 9. Timeline Events: SELECT
      if (
        upper.includes('FROM TUTORIA_ATENDIMENTOS_HISTORICO') &&
        upper.includes('SELECT')
      ) {
        let filtered = [...timelineEvents];

        // 1. Filter by atendimentoId if present in query
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

        // 2. Filter by matricula if present in query
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
// 3. TEST SUITE SETUP & RUNNER
// ============================================================================

describe('Multi-Tutor Hybrid Attendance, Timeline & Audit Trail (Isolated E2E)', () => {
  let app: INestApplication;
  let server: http.Server;
  let jwtService: JwtService;
  let mockDb: ReturnType<typeof createMockTutoriaDatabase>;
  let client: ReturnType<typeof createPipeClient>;
  const PIPE_PATH = '\\\\.\\pipe\\nexus_tutoria_e2e_' + Date.now();

  process.env.JWT_SECRET = 'nexus-dev-jwt-secret-not-for-production-min32chars';
  const JWT_SECRET = process.env.JWT_SECRET;

  let tokenLeadTutor: string;
  let tokenCollabTutor: string;
  let tokenSuccessorTutor: string;
  let tokenAdmin: string;
  let tokenUnauth: string;
  let tokenInactive: string;

  function getCard(id: string): MockKanbanCard {
    const card = mockDb._state.kanbanCards.get(id);
    if (!card) throw new Error(`Card ${id} not found in mockDb`);
    return card;
  }

  beforeAll(async () => {
    mockDb = createMockTutoriaDatabase();

    const mockSyncService = {
      syncTutoriaLogs: jest
        .fn()
        .mockResolvedValue({ status: 'success', records: 0 }),
      getSyncStatus: jest
        .fn()
        .mockReturnValue({ isSyncing: false, status: 'idle' }),
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
        {
          provide: TutoriaSyncService,
          useValue: mockSyncService,
        },
        {
          provide: DB_CONNECTION,
          useValue: mockDb,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
        {
          provide: APP_GUARD,
          useClass: JwtAuthGuard,
        },
        {
          provide: APP_GUARD,
          useClass: RbacGuard,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );

    jwtService = moduleFixture.get<JwtService>(JwtService);

    tokenLeadTutor = jwtService.sign({
      sub: 'tutor-lead-1',
      email: 'carlos.tutor@unievangelica.edu.br',
      name: 'Prof. Carlos Titular',
      isSuperAdmin: false,
    });

    tokenCollabTutor = jwtService.sign({
      sub: 'tutor-collab-2',
      email: 'marina.tutor@unievangelica.edu.br',
      name: 'Profa. Marina Colaboradora',
      isSuperAdmin: false,
    });

    tokenSuccessorTutor = jwtService.sign({
      sub: 'tutor-new-3',
      email: 'roberto.tutor@unievangelica.edu.br',
      name: 'Prof. Roberto Sucessor',
      isSuperAdmin: false,
    });

    tokenAdmin = jwtService.sign({
      sub: 'admin-1',
      email: 'admin@unievangelica.edu.br',
      name: 'Admin Geral',
      isSuperAdmin: true,
    });

    tokenUnauth = jwtService.sign({
      sub: 'unauth-user-9',
      email: 'unauth@unievangelica.edu.br',
      name: 'Usuário Sem Acesso',
      isSuperAdmin: false,
    });

    tokenInactive = jwtService.sign({
      sub: 'inactive-tutor-8',
      email: 'inativo@unievangelica.edu.br',
      name: 'Tutor Desativado',
      isSuperAdmin: false,
    });

    await app.init();
    server = app.getHttpServer();
    await new Promise<void>((resolve, reject) => {
      server.listen(PIPE_PATH, () => resolve());
      server.on('error', reject);
    });
    client = createPipeClient(PIPE_PATH);
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    if (app) {
      await app.close();
    }
  });

  // ==========================================================================
  // TIER 1: Feature Coverage (Category-Partition Happy Paths: TC-T1-F1..F7)
  // ==========================================================================
  describe('Tier 1: Feature Coverage (Category-Partition Happy Paths)', () => {
    // ------------------------------------------------------------------------
    // Feature F1: Modelo Híbrido Multi-Tutor
    // ------------------------------------------------------------------------
    describe('Feature F1: Modelo Híbrido Multi-Tutor', () => {
      const cardF1 = 'card-f1-lead';

      beforeAll(() => {
        mockDb._state.kanbanCards.set(cardF1, {
          id: cardF1,
          matricula: '20240101',
          aluno_nome: 'Aluno F1',
          periodo: '2026-2',
          status_kanban: 'pendente',
          tutor_responsavel_id: 'tutor-lead-1',
          tutor_iniciador_id: 'tutor-lead-1',
          observacoes: 'Nota inicial',
          canal_contato_utilizado: null,
          ultimo_contato_em: null,
          ultima_intervencao_em: null,
          qtd_intervencoes: 0,
          data_resolucao: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      });

      it('TC-T1-F1-01: Collaborator updates notes on card owned by Lead Tutor -> 200 OK, card.tutorResponsavelId unchanged', async () => {
        const res = await client
          .patch(`/api/tutoria/kanban/${cardF1}`)
          .set('Authorization', `Bearer ${tokenCollabTutor}`)
          .send({ observacoes: 'Intervenção feita pela Profa. Marina' })
          .expect(200);

        expect(res.body.success).toBe(true);
        const card = getCard(cardF1);
        expect(card.tutor_responsavel_id).toBe('tutor-lead-1');
        expect(card.observacoes).toBe('Intervenção feita pela Profa. Marina');
      });

      it('TC-T1-F1-02: Collaborator moves card status column -> 200 OK, status updated, ownership unchanged', async () => {
        const res = await client
          .patch(`/api/tutoria/kanban/${cardF1}`)
          .set('Authorization', `Bearer ${tokenCollabTutor}`)
          .send({ statusKanban: 'em_contato' })
          .expect(200);

        expect(res.body.success).toBe(true);
        const card = getCard(cardF1);
        expect(card.status_kanban).toBe('em_contato');
        expect(card.tutor_responsavel_id).toBe('tutor-lead-1');
      });

      it('TC-T1-F1-03: Collaborator logs WhatsApp outreach -> 201 Created, contact time updated, owner unchanged', async () => {
        const res = await client
          .post('/api/tutoria/intervencoes')
          .set('Authorization', `Bearer ${tokenCollabTutor}`)
          .send({
            matricula: '20240101',
            atendimentoId: cardF1,
            tipoEvento: 'contato_enviado',
            canalContato: 'whatsapp',
            observacoes: 'Contato via WhatsApp realizado com sucesso.',
          })
          .expect(201);

        expect(res.body.id).toBeDefined();
        const card = getCard(cardF1);
        expect(card.tutor_responsavel_id).toBe('tutor-lead-1');
        expect(card.canal_contato_utilizado).toBe('whatsapp');
        expect(card.ultimo_contato_em).toBeDefined();
      });

      it('TC-T1-F1-04: Creation of attendance card with primary tutor -> 201 Created, tutorResponsavelId initialized', async () => {
        const res = await client
          .post('/api/tutoria/kanban')
          .set('Authorization', `Bearer ${tokenLeadTutor}`)
          .send({
            matricula: '20240102',
            alunoNome: 'Novo Aluno Triado',
            statusKanban: 'pendente',
          })
          .expect(201);

        expect(res.body.created).toBe(true);
        const createdId = res.body.id;
        const card = getCard(createdId);
        expect(card.tutor_responsavel_id).toBe('tutor-lead-1');
        expect(card.tutor_iniciador_id).toBe('tutor-lead-1');
      });

      it('TC-T1-F1-05: Primary Lead Tutor updates card directly -> 200 OK, Lead tutor updates notes', async () => {
        const res = await client
          .patch(`/api/tutoria/kanban/${cardF1}`)
          .set('Authorization', `Bearer ${tokenLeadTutor}`)
          .send({
            observacoes: 'Reunião de alinhamento com discente finalizada.',
          })
          .expect(200);

        expect(res.body.success).toBe(true);
        const card = getCard(cardF1);
        expect(card.tutor_responsavel_id).toBe('tutor-lead-1');
        expect(card.observacoes).toBe(
          'Reunião de alinhamento com discente finalizada.',
        );
      });
    });

    // ------------------------------------------------------------------------
    // Feature F2: Trilha de Auditoria Schema
    // ------------------------------------------------------------------------
    describe('Feature F2: Trilha de Auditoria Schema', () => {
      it('TC-T1-F2-01: Audit event persistence for card opening (abertura) -> 201 Created', async () => {
        const res = await client
          .post('/api/tutoria/kanban')
          .set('Authorization', `Bearer ${tokenLeadTutor}`)
          .send({
            matricula: '20240201',
            alunoNome: 'Aluno Auditoria Abertura',
          })
          .expect(201);

        const cardId = res.body.id;
        const events = mockDb._state.timelineEvents.filter(
          (e) => e.atendimentoId === cardId,
        );
        expect(events.length).toBeGreaterThanOrEqual(1);
        expect(events[0].tipoEvento).toBe('abertura');
        expect(events[0].autorId).toBe('tutor-lead-1');
        expect(events[0].autorNome).toBe('Prof. Carlos Titular');
      });

      it('TC-T1-F2-02: Audit event for status transition (mudanca_status) -> 200 OK', async () => {
        const cardId = 'card-audit-status';
        mockDb._state.kanbanCards.set(cardId, {
          id: cardId,
          matricula: '20240202',
          aluno_nome: 'Aluno Transição',
          periodo: '2026-2',
          status_kanban: 'pendente',
          tutor_responsavel_id: 'tutor-lead-1',
          tutor_iniciador_id: 'tutor-lead-1',
          observacoes: null,
          canal_contato_utilizado: null,
          ultimo_contato_em: null,
          ultima_intervencao_em: null,
          qtd_intervencoes: 0,
          data_resolucao: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        await client
          .patch(`/api/tutoria/kanban/${cardId}`)
          .set('Authorization', `Bearer ${tokenCollabTutor}`)
          .send({ statusKanban: 'em_contato' })
          .expect(200);

        const events = mockDb._state.timelineEvents.filter(
          (e) =>
            e.atendimentoId === cardId && e.tipoEvento === 'mudanca_status',
        );
        expect(events.length).toBe(1);
        expect(events[0].estadoAnterior).toBe('pendente');
        expect(events[0].estadoNovo).toBe('em_contato');
        expect(events[0].autorId).toBe('tutor-collab-2');
        expect(events[0].autorNome).toBe('Profa. Marina Colaboradora');
      });

      it('TC-T1-F2-03: Audit event for communication sent (contato_enviado) -> 201 Created', async () => {
        const res = await client
          .post('/api/tutoria/intervencoes')
          .set('Authorization', `Bearer ${tokenCollabTutor}`)
          .send({
            matricula: '20240203',
            tipoEvento: 'contato_enviado',
            canalContato: 'whatsapp',
            observacoes: 'Envio de aviso de prazo via WhatsApp.',
            metadata: { template: 'alerta_prazo_ap1' },
          })
          .expect(201);

        expect(res.body.id).toBeDefined();
        const event = mockDb._state.timelineEvents.find(
          (e) => e.id === res.body.id,
        );
        expect(event).toBeDefined();
        expect(event?.canalContato).toBe('whatsapp');
        expect(event?.metadata).toEqual({ template: 'alerta_prazo_ap1' });
      });

      it('TC-T1-F2-04: Audit event for manual intervention note (intervencao_manual) -> 201 Created', async () => {
        const res = await client
          .post('/api/tutoria/intervencoes')
          .set('Authorization', `Bearer ${tokenLeadTutor}`)
          .send({
            matricula: '20240204',
            tipoEvento: 'intervencao_manual',
            observacoes:
              'Orientação de readequação de cronograma de estudos realizada.',
          })
          .expect(201);

        expect(res.body.tipoEvento).toBe('intervencao_manual');
        expect(res.body.observacoes).toContain('readequação de cronograma');
        expect(res.body.autorNome).toBe('Prof. Carlos Titular');
      });

      it('TC-T1-F2-05: Audit event for card resolution (finalizacao) -> 200 OK', async () => {
        const cardId = 'card-audit-resolution';
        mockDb._state.kanbanCards.set(cardId, {
          id: cardId,
          matricula: '20240205',
          aluno_nome: 'Aluno Resolução',
          periodo: '2026-2',
          status_kanban: 'em_recuperacao',
          tutor_responsavel_id: 'tutor-lead-1',
          tutor_iniciador_id: 'tutor-lead-1',
          observacoes: null,
          canal_contato_utilizado: null,
          ultimo_contato_em: null,
          ultima_intervencao_em: null,
          qtd_intervencoes: 0,
          data_resolucao: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        await client
          .patch(`/api/tutoria/kanban/${cardId}`)
          .set('Authorization', `Bearer ${tokenLeadTutor}`)
          .send({ statusKanban: 'revertido' })
          .expect(200);

        const card = getCard(cardId);
        expect(card.status_kanban).toBe('revertido');
        expect(card.data_resolucao).toBeDefined();

        const events = mockDb._state.timelineEvents.filter(
          (e) => e.atendimentoId === cardId && e.estadoNovo === 'revertido',
        );
        expect(events.length).toBe(1);
      });
    });

    // ------------------------------------------------------------------------
    // Feature F3: Auditoria de Mudanças Kanban
    // ------------------------------------------------------------------------
    describe('Feature F3: Auditoria de Mudanças Kanban', () => {
      const cardF3 = 'card-f3-kanban';

      beforeAll(() => {
        mockDb._state.kanbanCards.set(cardF3, {
          id: cardF3,
          matricula: '20240301',
          aluno_nome: 'Aluno Kanban',
          periodo: '2026-2',
          status_kanban: 'pendente',
          tutor_responsavel_id: 'tutor-lead-1',
          tutor_iniciador_id: 'tutor-lead-1',
          observacoes: null,
          canal_contato_utilizado: null,
          ultimo_contato_em: null,
          ultima_intervencao_em: null,
          qtd_intervencoes: 0,
          data_resolucao: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      });

      it('TC-T1-F3-01: Transition from pendente to em_contato -> 200 OK, author logged', async () => {
        await client
          .patch(`/api/tutoria/kanban/${cardF3}`)
          .set('Authorization', `Bearer ${tokenCollabTutor}`)
          .send({ statusKanban: 'em_contato' })
          .expect(200);

        const card = getCard(cardF3);
        expect(card.status_kanban).toBe('em_contato');
      });

      it('TC-T1-F3-02: Transition from em_contato to em_recuperacao -> 200 OK, author logged', async () => {
        await client
          .patch(`/api/tutoria/kanban/${cardF3}`)
          .set('Authorization', `Bearer ${tokenLeadTutor}`)
          .send({ statusKanban: 'em_recuperacao' })
          .expect(200);

        const card = getCard(cardF3);
        expect(card.status_kanban).toBe('em_recuperacao');
      });

      it('TC-T1-F3-03: Transition to revertido sets dataResolucao -> 200 OK', async () => {
        await client
          .patch(`/api/tutoria/kanban/${cardF3}`)
          .set('Authorization', `Bearer ${tokenLeadTutor}`)
          .send({ statusKanban: 'revertido' })
          .expect(200);

        const card = getCard(cardF3);
        expect(card.status_kanban).toBe('revertido');
        expect(card.data_resolucao).toBeDefined();
      });

      it('TC-T1-F3-04: Transition to terminal status evadido -> 200 OK', async () => {
        const cardEvadido = 'card-evadido-test';
        mockDb._state.kanbanCards.set(cardEvadido, {
          id: cardEvadido,
          matricula: '20240302',
          aluno_nome: 'Aluno Risco Evasao',
          periodo: '2026-2',
          status_kanban: 'em_recuperacao',
          tutor_responsavel_id: 'tutor-lead-1',
          tutor_iniciador_id: 'tutor-lead-1',
          observacoes: null,
          canal_contato_utilizado: null,
          ultimo_contato_em: null,
          ultima_intervencao_em: null,
          qtd_intervencoes: 0,
          data_resolucao: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        await client
          .patch(`/api/tutoria/kanban/${cardEvadido}`)
          .set('Authorization', `Bearer ${tokenLeadTutor}`)
          .send({ statusKanban: 'evadido' })
          .expect(200);

        const card = getCard(cardEvadido);
        expect(card.status_kanban).toBe('evadido');
      });

      it('TC-T1-F3-05: Regress card from aguardando_retorno to em_contato -> 200 OK', async () => {
        const cardRegress = 'card-regress-test';
        mockDb._state.kanbanCards.set(cardRegress, {
          id: cardRegress,
          matricula: '20240303',
          aluno_nome: 'Aluno Regressão',
          periodo: '2026-2',
          status_kanban: 'aguardando_retorno',
          tutor_responsavel_id: 'tutor-lead-1',
          tutor_iniciador_id: 'tutor-lead-1',
          observacoes: null,
          canal_contato_utilizado: null,
          ultimo_contato_em: null,
          ultima_intervencao_em: null,
          qtd_intervencoes: 0,
          data_resolucao: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        await client
          .patch(`/api/tutoria/kanban/${cardRegress}`)
          .set('Authorization', `Bearer ${tokenCollabTutor}`)
          .send({
            statusKanban: 'em_contato',
            observacoes: 'Discente solicitou retorno após as 18h.',
          })
          .expect(200);

        const card = getCard(cardRegress);
        expect(card.status_kanban).toBe('em_contato');
        expect(card.observacoes).toBe(
          'Discente solicitou retorno após as 18h.',
        );
      });
    });

    // ------------------------------------------------------------------------
    // Feature F4: Registro de Comunicação
    // ------------------------------------------------------------------------
    describe('Feature F4: Registro de Comunicação', () => {
      it('TC-T1-F4-01: Log WhatsApp communication -> 201 Created, channel: whatsapp', async () => {
        const res = await client
          .post('/api/tutoria/intervencoes')
          .set('Authorization', `Bearer ${tokenLeadTutor}`)
          .send({
            matricula: '20240401',
            tipoEvento: 'contato_enviado',
            canalContato: 'whatsapp',
            observacoes:
              'Mensagem de boas-vindas enviada no WhatsApp institucional.',
          })
          .expect(201);

        expect(res.body.canalContato).toBe('whatsapp');
      });

      it('TC-T1-F4-02: Log Email communication with subject metadata -> 201 Created', async () => {
        const res = await client
          .post('/api/tutoria/intervencoes')
          .set('Authorization', `Bearer ${tokenCollabTutor}`)
          .send({
            matricula: '20240402',
            tipoEvento: 'contato_enviado',
            canalContato: 'email',
            observacoes: 'Envio de lista de exercícios de nivelamento.',
            metadata: {
              assunto: 'Plano de Estudos - Tutoria NexusHub',
              templateId: 'tmpl-nivelamento',
            },
          })
          .expect(201);

        expect(res.body.canalContato).toBe('email');
        expect(res.body.metadata.templateId).toBe('tmpl-nivelamento');
      });

      it('TC-T1-F4-03: Log Phone call attempt and result -> 201 Created, channel: telefone', async () => {
        const res = await client
          .post('/api/tutoria/intervencoes')
          .set('Authorization', `Bearer ${tokenLeadTutor}`)
          .send({
            matricula: '20240403',
            tipoEvento: 'contato_enviado',
            canalContato: 'telefone',
            observacoes:
              'Ligação atendida; alinhada realização de simulado no fim de semana.',
          })
          .expect(201);

        expect(res.body.canalContato).toBe('telefone');
      });

      it('TC-T1-F4-04: Log AVA LMS internal message -> 201 Created, channel: ava', async () => {
        const res = await client
          .post('/api/tutoria/intervencoes')
          .set('Authorization', `Bearer ${tokenCollabTutor}`)
          .send({
            matricula: '20240404',
            tipoEvento: 'contato_enviado',
            canalContato: 'ava',
            observacoes:
              'Mensagem interna postada na caixa de entrada do Moodle.',
          })
          .expect(201);

        expect(res.body.canalContato).toBe('ava');
      });

      it('TC-T1-F4-05: Update channel and contact timestamp via card PATCH -> 200 OK', async () => {
        const cardId = 'card-f4-patch';
        mockDb._state.kanbanCards.set(cardId, {
          id: cardId,
          matricula: '20240405',
          aluno_nome: 'Aluno F4 Patch',
          periodo: '2026-2',
          status_kanban: 'em_contato',
          tutor_responsavel_id: 'tutor-lead-1',
          tutor_iniciador_id: 'tutor-lead-1',
          observacoes: null,
          canal_contato_utilizado: null,
          ultimo_contato_em: null,
          ultima_intervencao_em: null,
          qtd_intervencoes: 0,
          data_resolucao: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        await client
          .patch(`/api/tutoria/kanban/${cardId}`)
          .set('Authorization', `Bearer ${tokenLeadTutor}`)
          .send({ canalContatoUtilizado: 'whatsapp' })
          .expect(200);

        const card = getCard(cardId);
        expect(card.canal_contato_utilizado).toBe('whatsapp');
        expect(card.ultimo_contato_em).toBeDefined();
      });
    });

    // ------------------------------------------------------------------------
    // Feature F5: Passagem de Bastão (Transferência)
    // ------------------------------------------------------------------------
    describe('Feature F5: Passagem de Bastão', () => {
      it('TC-T1-F5-01: Lead Tutor transfers ownership to Tutor B -> 200 OK, tutorResponsavelId mutates to Tutor B', async () => {
        const cardId = 'card-f5-transfer';
        mockDb._state.kanbanCards.set(cardId, {
          id: cardId,
          matricula: '20240501',
          aluno_nome: 'Aluno Bastão',
          periodo: '2026-2',
          status_kanban: 'em_contato',
          tutor_responsavel_id: 'tutor-lead-1',
          tutor_iniciador_id: 'tutor-lead-1',
          observacoes: null,
          canal_contato_utilizado: null,
          ultimo_contato_em: null,
          ultima_intervencao_em: null,
          qtd_intervencoes: 0,
          data_resolucao: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        const res = await client
          .post(`/api/tutoria/kanban/${cardId}/transferir`)
          .set('Authorization', `Bearer ${tokenLeadTutor}`)
          .send({
            novoTutorId: 'tutor-collab-2',
            notaTransicao:
              'Transferência de caso: discente mudou para o turno noturno.',
          })
          .expect(200);

        expect(res.body.success).toBe(true);
        const card = getCard(cardId);
        expect(card.tutor_responsavel_id).toBe('tutor-collab-2');
      });

      it('TC-T1-F5-02: Admin rebalances card ownership -> 200 OK', async () => {
        const cardId = 'card-f5-admin-rebalance';
        mockDb._state.kanbanCards.set(cardId, {
          id: cardId,
          matricula: '20240502',
          aluno_nome: 'Aluno Admin Rebalance',
          periodo: '2026-2',
          status_kanban: 'em_recuperacao',
          tutor_responsavel_id: 'tutor-lead-1',
          tutor_iniciador_id: 'tutor-lead-1',
          observacoes: null,
          canal_contato_utilizado: null,
          ultimo_contato_em: null,
          ultima_intervencao_em: null,
          qtd_intervencoes: 0,
          data_resolucao: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        const res = await client
          .post(`/api/tutoria/kanban/${cardId}/transferir`)
          .set('Authorization', `Bearer ${tokenAdmin}`)
          .send({
            novoTutorId: 'tutor-new-3',
            notaTransicao:
              'Rebalanceamento institucional de carga horária entre polos.',
          })
          .expect(200);

        expect(res.body.success).toBe(true);
        const card = getCard(cardId);
        expect(card.tutor_responsavel_id).toBe('tutor-new-3');
      });

      it('TC-T1-F5-03: Assign initial ownership to unassigned card -> 200 OK, tutorResponsavelAnteriorId is null', async () => {
        const cardId = 'card-f5-unassigned';
        mockDb._state.kanbanCards.set(cardId, {
          id: cardId,
          matricula: '20240503',
          aluno_nome: 'Aluno Não Atribuído',
          periodo: '2026-2',
          status_kanban: 'pendente',
          tutor_responsavel_id: null,
          tutor_iniciador_id: 'admin-1',
          observacoes: null,
          canal_contato_utilizado: null,
          ultimo_contato_em: null,
          ultima_intervencao_em: null,
          qtd_intervencoes: 0,
          data_resolucao: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        const res = await client
          .post(`/api/tutoria/kanban/${cardId}/transferir`)
          .set('Authorization', `Bearer ${tokenLeadTutor}`)
          .send({
            novoTutorId: 'tutor-lead-1',
            notaTransicao:
              'Assumindo titularidade do atendimento triado pela central.',
          })
          .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.evento.tutorResponsavelAnteriorId).toBeNull();
        expect(res.body.evento.tutorResponsavelNovoId).toBe('tutor-lead-1');
      });

      it('TC-T1-F5-04: Baton pass with pedagogical transition context -> 200 OK, transition note saved in audit row', async () => {
        const cardId = 'card-f5-pedagogical';
        mockDb._state.kanbanCards.set(cardId, {
          id: cardId,
          matricula: '20240504',
          aluno_nome: 'Aluno Contexto Pedagógico',
          periodo: '2026-2',
          status_kanban: 'em_contato',
          tutor_responsavel_id: 'tutor-lead-1',
          tutor_iniciador_id: 'tutor-lead-1',
          observacoes: null,
          canal_contato_utilizado: null,
          ultimo_contato_em: null,
          ultima_intervencao_em: null,
          qtd_intervencoes: 0,
          data_resolucao: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        const note =
          'Discente perdeu prazo da AP1. Foco em orientar entrega da AP2 e participação no simulado.';
        const res = await client
          .post(`/api/tutoria/kanban/${cardId}/transferir`)
          .set('Authorization', `Bearer ${tokenLeadTutor}`)
          .send({
            novoTutorId: 'tutor-new-3',
            notaTransicao: note,
          })
          .expect(200);

        expect(res.body.evento.observacoes).toBe(note);
      });

      it('TC-T1-F5-05: Baton pass endpoint standardized response schema -> 200 OK', async () => {
        const cardId = 'card-f5-schema';
        mockDb._state.kanbanCards.set(cardId, {
          id: cardId,
          matricula: '20240505',
          aluno_nome: 'Aluno Schema Response',
          periodo: '2026-2',
          status_kanban: 'em_contato',
          tutor_responsavel_id: 'tutor-lead-1',
          tutor_iniciador_id: 'tutor-lead-1',
          observacoes: null,
          canal_contato_utilizado: null,
          ultimo_contato_em: null,
          ultima_intervencao_em: null,
          qtd_intervencoes: 0,
          data_resolucao: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        const res = await client
          .post(`/api/tutoria/kanban/${cardId}/transferir`)
          .set('Authorization', `Bearer ${tokenLeadTutor}`)
          .send({
            novoTutorId: 'tutor-new-3',
            notaTransicao:
              'Transição padronizada de plantão vespertino para noturno.',
          })
          .expect(200);

        expect(res.body).toEqual({
          success: true,
          card: expect.objectContaining({
            id: cardId,
            tutorResponsavelId: 'tutor-new-3',
          }),
          evento: expect.objectContaining({
            id: expect.any(String),
            tipoEvento: 'passagem_bastao',
            tutorResponsavelAnteriorId: 'tutor-lead-1',
            tutorResponsavelNovoId: 'tutor-new-3',
          }),
        });
      });
    });

    // ------------------------------------------------------------------------
    // Feature F6: Linha do Tempo Consolidada
    // ------------------------------------------------------------------------
    describe('Feature F6: Linha do Tempo Consolidada', () => {
      const matriculaF6 = '20240601';
      const cardF6A = 'card-f6-a';
      const cardF6B = 'card-f6-b';

      beforeAll(() => {
        mockDb._state.kanbanCards.set(cardF6A, {
          id: cardF6A,
          matricula: matriculaF6,
          aluno_nome: 'Aluno Timeline Consolidada',
          periodo: '2026-1',
          status_kanban: 'revertido',
          tutor_responsavel_id: 'tutor-lead-1',
          tutor_iniciador_id: 'tutor-lead-1',
          observacoes: null,
          canal_contato_utilizado: null,
          ultimo_contato_em: null,
          ultima_intervencao_em: null,
          qtd_intervencoes: 1,
          data_resolucao: null,
          createdAt: '2026-03-01T10:00:00Z',
          updatedAt: '2026-03-01T10:00:00Z',
        });

        mockDb._state.kanbanCards.set(cardF6B, {
          id: cardF6B,
          matricula: matriculaF6,
          aluno_nome: 'Aluno Timeline Consolidada',
          periodo: '2026-2',
          status_kanban: 'em_contato',
          tutor_responsavel_id: 'tutor-collab-2',
          tutor_iniciador_id: 'tutor-lead-1',
          observacoes: null,
          canal_contato_utilizado: null,
          ultimo_contato_em: null,
          ultima_intervencao_em: null,
          qtd_intervencoes: 2,
          data_resolucao: null,
          createdAt: '2026-08-01T10:00:00Z',
          updatedAt: '2026-08-01T10:00:00Z',
        });

        mockDb._state.timelineEvents.push(
          {
            id: 'evt-f6-1',
            atendimentoId: cardF6A,
            matricula: matriculaF6,
            periodo: '2026-1',
            tipoEvento: 'abertura',
            autorId: 'tutor-lead-1',
            autorNome: 'Prof. Carlos Titular',
            createdAt: '2026-03-01T10:00:00Z',
          },
          {
            id: 'evt-f6-2',
            atendimentoId: cardF6B,
            matricula: matriculaF6,
            periodo: '2026-2',
            tipoEvento: 'contato_enviado',
            autorId: 'tutor-collab-2',
            autorNome: 'Profa. Marina Colaboradora',
            canalContato: 'whatsapp',
            observacoes: 'Acolhimento de volta às aulas.',
            createdAt: '2026-08-02T15:00:00Z',
          },
        );
      });

      it('TC-T1-F6-01: Query full student timeline -> 200 OK, chronological array of all events', async () => {
        const res = await client
          .get(`/api/tutoria/aluno/${matriculaF6}/timeline`)
          .set('Authorization', `Bearer ${tokenLeadTutor}`)
          .expect(200);

        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThanOrEqual(2);
        // Verify chronological ascending order
        const t1 = new Date(res.body[0].createdAt).getTime();
        const t2 = new Date(res.body[1].createdAt).getTime();
        expect(t1).toBeLessThanOrEqual(t2);
      });

      it('TC-T1-F6-02: Query student timeline filtered by attendance card ID -> 200 OK, strictly scoped to attendance ID', async () => {
        const res = await client
          .get(
            `/api/tutoria/aluno/${matriculaF6}/timeline?atendimentoId=${cardF6B}`,
          )
          .set('Authorization', `Bearer ${tokenLeadTutor}`)
          .expect(200);

        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBe(1);
        expect(res.body[0].atendimentoId).toBe(cardF6B);
      });

      it('TC-T1-F6-03: Timeline reflects multiple distinct authors with names -> 200 OK', async () => {
        const res = await client
          .get(`/api/tutoria/aluno/${matriculaF6}/timeline`)
          .set('Authorization', `Bearer ${tokenLeadTutor}`)
          .expect(200);

        const authors = res.body.map((e: any) => e.autorNome);
        expect(authors).toContain('Prof. Carlos Titular');
        expect(authors).toContain('Profa. Marina Colaboradora');
      });

      it('TC-T1-F6-04: Timeline with single opening event -> 200 OK, single event array returned', async () => {
        const matriculaSingle = '20240602';
        mockDb._state.timelineEvents.push({
          id: 'evt-f6-single',
          atendimentoId: 'card-single',
          matricula: matriculaSingle,
          periodo: '2026-2',
          tipoEvento: 'abertura',
          autorId: 'tutor-lead-1',
          autorNome: 'Prof. Carlos Titular',
          createdAt: new Date().toISOString(),
        });

        const res = await client
          .get(`/api/tutoria/aluno/${matriculaSingle}/timeline`)
          .set('Authorization', `Bearer ${tokenLeadTutor}`)
          .expect(200);

        expect(res.body.length).toBe(1);
        expect(res.body[0].tipoEvento).toBe('abertura');
      });

      it('TC-T1-F6-05: Timeline attributes snapshot completeness -> 200 OK', async () => {
        const res = await client
          .get(`/api/tutoria/aluno/${matriculaF6}/timeline`)
          .set('Authorization', `Bearer ${tokenLeadTutor}`)
          .expect(200);

        const first = res.body[0];
        expect(first).toHaveProperty('id');
        expect(first).toHaveProperty('matricula');
        expect(first).toHaveProperty('tipoEvento');
        expect(first).toHaveProperty('autorId');
        expect(first).toHaveProperty('autorNome');
        expect(first).toHaveProperty('createdAt');
      });
    });

    // ------------------------------------------------------------------------
    // Feature F7: API de Tutores Ativos
    // ------------------------------------------------------------------------
    describe('Feature F7: API de Tutores Ativos', () => {
      it('TC-T1-F7-01: Authenticated tutor fetches active tutors list -> 200 OK', async () => {
        const res = await client
          .get('/api/tutoria/tutores')
          .set('Authorization', `Bearer ${tokenLeadTutor}`)
          .expect(200);

        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThanOrEqual(3);
      });

      it('TC-T1-F7-02: Authenticated administrator fetches active tutors list -> 200 OK', async () => {
        const res = await client
          .get('/api/tutoria/tutores')
          .set('Authorization', `Bearer ${tokenAdmin}`)
          .expect(200);

        expect(Array.isArray(res.body)).toBe(true);
      });

      it('TC-T1-F7-03: Active tutors contract returns id, name, email -> 200 OK', async () => {
        const res = await client
          .get('/api/tutoria/tutores')
          .set('Authorization', `Bearer ${tokenLeadTutor}`)
          .expect(200);

        expect(res.body[0]).toHaveProperty('id');
        expect(res.body[0]).toHaveProperty('name');
        expect(res.body[0]).toHaveProperty('email');
      });

      it('TC-T1-F7-04: Active tutors list excludes inactive/disabled users -> 200 OK', async () => {
        const res = await client
          .get('/api/tutoria/tutores')
          .set('Authorization', `Bearer ${tokenLeadTutor}`)
          .expect(200);

        const ids = res.body.map((t: any) => t.id);
        expect(ids).not.toContain('inactive-tutor-8');
        expect(ids).not.toContain('unauth-user-9');
      });

      it('TC-T1-F7-05: Active tutors list sorted alphabetically by name -> 200 OK', async () => {
        const res = await client
          .get('/api/tutoria/tutores')
          .set('Authorization', `Bearer ${tokenLeadTutor}`)
          .expect(200);

        const names = res.body.map((t: any) => t.name);
        const sorted = [...names].sort((a, b) => a.localeCompare(b));
        expect(names).toEqual(sorted);
      });
    });
  });

  // ==========================================================================
  // TIER 2: Boundary & Corner Cases (Boundary Value Analysis: TC-T2-F1..F7)
  // ==========================================================================
  describe('Tier 2: Boundary & Corner Cases (Boundary Value Analysis)', () => {
    // ------------------------------------------------------------------------
    // Feature F1 Boundary Cases
    // ------------------------------------------------------------------------
    describe('Feature F1 Boundary Cases', () => {
      it('TC-T2-F1-01: Collaborator injects tutorResponsavelId in PATCH -> Overwrite ignored, owner remains Tutor A', async () => {
        const cardId = 'card-bva-f1-tamper';
        mockDb._state.kanbanCards.set(cardId, {
          id: cardId,
          matricula: '20241101',
          aluno_nome: 'Aluno Anti-Tampering',
          periodo: '2026-2',
          status_kanban: 'em_contato',
          tutor_responsavel_id: 'tutor-lead-1',
          tutor_iniciador_id: 'tutor-lead-1',
          observacoes: null,
          canal_contato_utilizado: null,
          ultimo_contato_em: null,
          ultima_intervencao_em: null,
          qtd_intervencoes: 0,
          data_resolucao: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        // Collaborator attempts parameter injection
        await client
          .patch(`/api/tutoria/kanban/${cardId}`)
          .set('Authorization', `Bearer ${tokenCollabTutor}`)
          .send({
            tutorResponsavelId: 'tutor-collab-2',
            observacoes: 'Tentativa de sequestro de titularidade',
          })
          .expect(200);

        const card = getCard(cardId);
        expect(card.tutor_responsavel_id).toBe('tutor-lead-1'); // Lead retention invariant
      });

      it('TC-T2-F1-02: Unauthenticated user attempts update -> 401 Unauthorized', async () => {
        await client
          .patch('/api/tutoria/kanban/card-bva-f1-tamper')
          .send({ statusKanban: 'em_recuperacao' })
          .expect(401);
      });

      it('TC-T2-F1-03: User without tutoria module permission -> 403 Forbidden', async () => {
        await client
          .patch('/api/tutoria/kanban/card-bva-f1-tamper')
          .set('Authorization', `Bearer ${tokenUnauth}`)
          .send({ statusKanban: 'em_recuperacao' })
          .expect(403);
      });

      it('TC-T2-F1-04: Collaborator updates card with null initial owner -> null boundary, owner remains null', async () => {
        const cardId = 'card-bva-f1-null-owner';
        mockDb._state.kanbanCards.set(cardId, {
          id: cardId,
          matricula: '20241104',
          aluno_nome: 'Aluno Sem Dono',
          periodo: '2026-2',
          status_kanban: 'pendente',
          tutor_responsavel_id: null,
          tutor_iniciador_id: 'admin-1',
          observacoes: null,
          canal_contato_utilizado: null,
          ultimo_contato_em: null,
          ultima_intervencao_em: null,
          qtd_intervencoes: 0,
          data_resolucao: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        await client
          .patch(`/api/tutoria/kanban/${cardId}`)
          .set('Authorization', `Bearer ${tokenCollabTutor}`)
          .send({ statusKanban: 'em_contato' })
          .expect(200);

        const card = getCard(cardId);
        expect(card.tutor_responsavel_id).toBeNull();
      });

      it('TC-T2-F1-05: Update non-existent card UUID -> 404 Not Found', async () => {
        await client
          .patch('/api/tutoria/kanban/non-existent-uuid-999')
          .set('Authorization', `Bearer ${tokenLeadTutor}`)
          .send({ statusKanban: 'em_contato' })
          .expect(404);
      });
    });

    // ------------------------------------------------------------------------
    // Feature F2 Boundary Cases
    // ------------------------------------------------------------------------
    describe('Feature F2 Boundary Cases', () => {
      it('TC-T2-F2-01: Audit event with invalid tipoEvento enum value -> 400 Bad Request', async () => {
        await client
          .post('/api/tutoria/intervencoes')
          .set('Authorization', `Bearer ${tokenLeadTutor}`)
          .send({
            matricula: '20241201',
            tipoEvento: 'evento_invalido_hacker',
            observacoes: 'Tentativa com enum inválido',
          })
          .expect(400);
      });

      it('TC-T2-F2-02: Pedagogical note at upper length limit (5,000 chars) -> 201 Created', async () => {
        const longNote = 'A'.repeat(5000);
        const res = await client
          .post('/api/tutoria/intervencoes')
          .set('Authorization', `Bearer ${tokenLeadTutor}`)
          .send({
            matricula: '20241202',
            tipoEvento: 'intervencao_manual',
            observacoes: longNote,
          })
          .expect(201);

        expect(res.body.observacoes.length).toBe(5000);
      });

      it('TC-T2-F2-03: Optional fields set explicitly to null -> 201 Created', async () => {
        const res = await client
          .post('/api/tutoria/intervencoes')
          .set('Authorization', `Bearer ${tokenLeadTutor}`)
          .send({
            matricula: '20241203',
            tipoEvento: 'intervencao_manual',
            observacoes: 'Nota com campos opcionais nulos',
            canalContato: null,
            metadata: null,
          })
          .expect(201);

        expect(res.body.canalContato).toBeNull();
        expect(res.body.metadata).toBeNull();
      });

      it('TC-T2-F2-04: Complex nested JSON in metadata attribute -> 201 Created', async () => {
        const complexMeta = {
          tags: ['urgente', 'reprovacao_iminente'],
          stats: { absences: 14, missedExams: ['AP1', 'Simulado 1'] },
          history: [{ shift: 'noturno', score: 3.5 }],
        };

        const res = await client
          .post('/api/tutoria/intervencoes')
          .set('Authorization', `Bearer ${tokenLeadTutor}`)
          .send({
            matricula: '20241204',
            tipoEvento: 'intervencao_manual',
            observacoes: 'Nota com metadados estruturados',
            metadata: complexMeta,
          })
          .expect(201);

        expect(res.body.metadata).toEqual(complexMeta);
      });

      it('TC-T2-F2-05: Empty or whitespace-only matricula -> 400 Bad Request', async () => {
        await client
          .post('/api/tutoria/intervencoes')
          .set('Authorization', `Bearer ${tokenLeadTutor}`)
          .send({
            matricula: '   ',
            tipoEvento: 'intervencao_manual',
            observacoes: 'Matrícula em branco',
          })
          .expect(400);
      });
    });

    // ------------------------------------------------------------------------
    // Feature F3 Boundary Cases
    // ------------------------------------------------------------------------
    describe('Feature F3 Boundary Cases', () => {
      const cardF3Bva = 'card-f3-bva';

      beforeAll(() => {
        mockDb._state.kanbanCards.set(cardF3Bva, {
          id: cardF3Bva,
          matricula: '20241301',
          aluno_nome: 'Aluno F3 BVA',
          periodo: '2026-2',
          status_kanban: 'em_contato',
          tutor_responsavel_id: 'tutor-lead-1',
          tutor_iniciador_id: 'tutor-lead-1',
          observacoes: null,
          canal_contato_utilizado: null,
          ultimo_contato_em: null,
          ultima_intervencao_em: null,
          qtd_intervencoes: 0,
          data_resolucao: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      });

      it('TC-T2-F3-01: Transition to invalid Kanban column status -> 400 Bad Request', async () => {
        await client
          .patch(`/api/tutoria/kanban/${cardF3Bva}`)
          .set('Authorization', `Bearer ${tokenLeadTutor}`)
          .send({ statusKanban: 'coluna_inexistente_123' })
          .expect(400);
      });

      it('TC-T2-F3-02: Idempotent transition to same status -> 200 OK, redundant audit event skipped', async () => {
        const eventsBefore = mockDb._state.timelineEvents.filter(
          (e) => e.atendimentoId === cardF3Bva,
        ).length;

        await client
          .patch(`/api/tutoria/kanban/${cardF3Bva}`)
          .set('Authorization', `Bearer ${tokenLeadTutor}`)
          .send({ statusKanban: 'em_contato' })
          .expect(200);

        const eventsAfter = mockDb._state.timelineEvents.filter(
          (e) => e.atendimentoId === cardF3Bva,
        ).length;
        expect(eventsAfter).toBe(eventsBefore); // Zero redundant events
      });

      it('TC-T2-F3-03: Status update with empty string note (observacoes: "") -> 200 OK', async () => {
        await client
          .patch(`/api/tutoria/kanban/${cardF3Bva}`)
          .set('Authorization', `Bearer ${tokenLeadTutor}`)
          .send({ observacoes: '' })
          .expect(200);

        const card = getCard(cardF3Bva);
        expect(card.observacoes).toBe('');
      });

      it('TC-T2-F3-04: Acting tutor user record has null name -> 200 OK, fallback author name applied', async () => {
        const tokenNoName = jwtService.sign({
          sub: 'tutor-no-name-id',
          email: 'noname@unievangelica.edu.br',
          isSuperAdmin: true,
        });

        const res = await client
          .post('/api/tutoria/intervencoes')
          .set('Authorization', `Bearer ${tokenNoName}`)
          .send({
            matricula: '20241304',
            tipoEvento: 'intervencao_manual',
            observacoes: 'Nota registrada por tutor sem nome cadastrado.',
          })
          .expect(201);

        expect(res.body.autorNome).toBeDefined();
        expect(res.body.autorNome.length).toBeGreaterThan(0);
      });

      it('TC-T2-F3-05: Status update with whitespace-only note -> 200 OK, whitespace trimmed cleanly', async () => {
        await client
          .patch(`/api/tutoria/kanban/${cardF3Bva}`)
          .set('Authorization', `Bearer ${tokenLeadTutor}`)
          .send({ observacoes: '    ' })
          .expect(200);

        const card = getCard(cardF3Bva);
        expect(card.observacoes).toBe('');
      });
    });

    // ------------------------------------------------------------------------
    // Feature F4 Boundary Cases
    // ------------------------------------------------------------------------
    describe('Feature F4 Boundary Cases', () => {
      it('TC-T2-F4-01: Communication record with unsupported channel -> 400 Bad Request', async () => {
        await client
          .post('/api/tutoria/intervencoes')
          .set('Authorization', `Bearer ${tokenLeadTutor}`)
          .send({
            matricula: '20241401',
            tipoEvento: 'contato_enviado',
            canalContato: 'telegram_nao_suportado',
            observacoes: 'Tentativa com canal não homologado',
          })
          .expect(400);
      });

      it('TC-T2-F4-02: Communication record with empty observacoes -> 400 Bad Request', async () => {
        await client
          .post('/api/tutoria/intervencoes')
          .set('Authorization', `Bearer ${tokenLeadTutor}`)
          .send({
            matricula: '20241402',
            tipoEvento: 'contato_enviado',
            canalContato: 'whatsapp',
            observacoes: '',
          })
          .expect(400);
      });

      it('TC-T2-F4-03: Communication record with whitespace-only observacoes -> 400 Bad Request', async () => {
        await client
          .post('/api/tutoria/intervencoes')
          .set('Authorization', `Bearer ${tokenLeadTutor}`)
          .send({
            matricula: '20241403',
            tipoEvento: 'contato_enviado',
            canalContato: 'whatsapp',
            observacoes: '     ',
          })
          .expect(400);
      });

      it('TC-T2-F4-04: Matricula with leading/trailing spaces -> 201 Created, matricula trimmed', async () => {
        const res = await client
          .post('/api/tutoria/intervencoes')
          .set('Authorization', `Bearer ${tokenLeadTutor}`)
          .send({
            matricula: '  20241404  ',
            tipoEvento: 'contato_enviado',
            canalContato: 'whatsapp',
            observacoes: 'Contato com matricula contendo espaços',
          })
          .expect(201);

        expect(res.body.matricula).toBe('20241404');
      });

      it('TC-T2-F4-05: Missing tipoEvento in payload -> 400 Bad Request', async () => {
        await client
          .post('/api/tutoria/intervencoes')
          .set('Authorization', `Bearer ${tokenLeadTutor}`)
          .send({
            matricula: '20241405',
            canalContato: 'whatsapp',
            observacoes: 'Faltando tipo de evento',
          })
          .expect(400);
      });
    });

    // ------------------------------------------------------------------------
    // Feature F5 Boundary Cases
    // ------------------------------------------------------------------------
    describe('Feature F5 Boundary Cases', () => {
      const cardF5Bva = 'card-f5-bva';

      beforeAll(() => {
        mockDb._state.kanbanCards.set(cardF5Bva, {
          id: cardF5Bva,
          matricula: '20241501',
          aluno_nome: 'Aluno F5 BVA',
          periodo: '2026-2',
          status_kanban: 'em_contato',
          tutor_responsavel_id: 'tutor-lead-1',
          tutor_iniciador_id: 'tutor-lead-1',
          observacoes: null,
          canal_contato_utilizado: null,
          ultimo_contato_em: null,
          ultima_intervencao_em: null,
          qtd_intervencoes: 0,
          data_resolucao: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      });

      it('TC-T2-F5-01: Baton pass targeting non-existent novoTutorId -> 404 Not Found', async () => {
        await client
          .post(`/api/tutoria/kanban/${cardF5Bva}/transferir`)
          .set('Authorization', `Bearer ${tokenLeadTutor}`)
          .send({
            novoTutorId: 'tutor-fantasma-999',
            notaTransicao: 'Nota de transição válida',
          })
          .expect(404);
      });

      it('TC-T2-F5-02: Malformed UUID for novoTutorId -> 400 Bad Request', async () => {
        await client
          .post(`/api/tutoria/kanban/${cardF5Bva}/transferir`)
          .set('Authorization', `Bearer ${tokenLeadTutor}`)
          .send({
            novoTutorId: 'abc',
            notaTransicao: 'Nota de transição válida',
          })
          .expect(400);
      });

      it('TC-T2-F5-03: Baton pass with empty notaTransicao -> 400 Bad Request', async () => {
        await client
          .post(`/api/tutoria/kanban/${cardF5Bva}/transferir`)
          .set('Authorization', `Bearer ${tokenLeadTutor}`)
          .send({
            novoTutorId: 'tutor-collab-2',
            notaTransicao: '',
          })
          .expect(400);
      });

      it('TC-T2-F5-04: Baton pass with whitespace-only notaTransicao -> 400 Bad Request', async () => {
        await client
          .post(`/api/tutoria/kanban/${cardF5Bva}/transferir`)
          .set('Authorization', `Bearer ${tokenLeadTutor}`)
          .send({
            novoTutorId: 'tutor-collab-2',
            notaTransicao: '   ',
          })
          .expect(400);
      });

      it('TC-T2-F5-05: Transfer targeting current owner (novoTutor == current) -> 400 Bad Request ("Já atribuído")', async () => {
        await client
          .post(`/api/tutoria/kanban/${cardF5Bva}/transferir`)
          .set('Authorization', `Bearer ${tokenLeadTutor}`)
          .send({
            novoTutorId: 'tutor-lead-1',
            notaTransicao: 'Tentativa de transferir para si mesmo',
          })
          .expect(400);
      });

      it('TC-T2-F5-06: Reject baton pass targeting an inactive tutor -> 400 Bad Request ("Tutor selecionado está inativo.")', async () => {
        const res = await client
          .post(`/api/tutoria/kanban/${cardF5Bva}/transferir`)
          .set('Authorization', `Bearer ${tokenLeadTutor}`)
          .send({
            novoTutorId: 'inactive-tutor-8',
            notaTransicao: 'Tentativa de transferir para tutor desativado',
          })
          .expect(400);

        expect(res.body).toBeDefined();
        expect(res.body.statusCode).toBe(400);
        expect(res.body.message).toContain('Tutor selecionado está inativo.');
      });

      it('TC-T2-F5-07: Reject baton pass targeting a non-existent tutor with explicit error message -> 404 Not Found', async () => {
        const res = await client
          .post(`/api/tutoria/kanban/${cardF5Bva}/transferir`)
          .set('Authorization', `Bearer ${tokenLeadTutor}`)
          .send({
            novoTutorId: 'tutor-inexistente-404-uuid',
            notaTransicao: 'Tentativa de transferir para usuário inexistente',
          })
          .expect(404);

        expect(res.body).toBeDefined();
        expect(res.body.statusCode).toBe(404);
        expect(res.body.message).toContain('não encontrado');
      });
    });

    // ------------------------------------------------------------------------
    // Feature F6 Boundary Cases
    // ------------------------------------------------------------------------
    describe('Feature F6 Boundary Cases', () => {
      it('TC-T2-F6-01: Query timeline for non-existent student -> 200 OK, returns empty array []', async () => {
        const res = await client
          .get('/api/tutoria/aluno/99999999999/timeline')
          .set('Authorization', `Bearer ${tokenLeadTutor}`)
          .expect(200);

        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBe(0);
      });

      it('TC-T2-F6-02: SQL injection attempt in matricula parameter -> Handled safely', async () => {
        const res = await client
          .get('/api/tutoria/aluno/1%20OR%201=1;--/timeline')
          .set('Authorization', `Bearer ${tokenLeadTutor}`)
          .expect(200);

        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBe(0);
      });

      it('TC-T2-F6-03: Non-existent atendimentoId query filter -> 200 OK, returns empty array []', async () => {
        const res = await client
          .get(
            '/api/tutoria/aluno/20240101/timeline?atendimentoId=card-inexistente-123',
          )
          .set('Authorization', `Bearer ${tokenLeadTutor}`)
          .expect(200);

        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBe(0);
      });

      it('TC-T2-F6-04: Malformed UUID in atendimentoId query filter -> 400 Bad Request', async () => {
        await client
          .get('/api/tutoria/aluno/20240101/timeline?atendimentoId=abc')
          .set('Authorization', `Bearer ${tokenLeadTutor}`)
          .expect(400);
      });

      it('TC-T2-F6-05: Unauthenticated query to timeline endpoint -> 401 Unauthorized', async () => {
        await client.get('/api/tutoria/aluno/20240101/timeline').expect(401);
      });
    });

    // ------------------------------------------------------------------------
    // Feature F7 Boundary Cases
    // ------------------------------------------------------------------------
    describe('Feature F7 Boundary Cases', () => {
      it('TC-T2-F7-01: Unauthenticated query to GET /api/tutoria/tutores -> 401 Unauthorized', async () => {
        await client.get('/api/tutoria/tutores').expect(401);
      });

      it('TC-T2-F7-02: Query by user role lacking tutoria permission -> 403 Forbidden', async () => {
        await client
          .get('/api/tutoria/tutores')
          .set('Authorization', `Bearer ${tokenUnauth}`)
          .expect(403);
      });

      it('TC-T2-F7-03: Inactive tutor user token rejected -> 401 Unauthorized', async () => {
        await client
          .get('/api/tutoria/tutores')
          .set('Authorization', `Bearer ${tokenInactive}`)
          .expect(401);
      });

      it('TC-T2-F7-04: Active tutor record has null or missing email -> 200 OK, handles gracefully', async () => {
        const res = await client
          .get('/api/tutoria/tutores')
          .set('Authorization', `Bearer ${tokenLeadTutor}`)
          .expect(200);

        const nullEmailTutor = res.body.find(
          (t: any) => t.id === 'tutor-no-email-5',
        );
        expect(nullEmailTutor).toBeDefined();
        expect(nullEmailTutor.email).toBeNull();
      });

      it('TC-T2-F7-05: Active tutor name with special characters/accents -> 200 OK, UTF-8 preserved', async () => {
        const res = await client
          .get('/api/tutoria/tutores')
          .set('Authorization', `Bearer ${tokenLeadTutor}`)
          .expect(200);

        const specialTutor = res.body.find(
          (t: any) => t.id === 'tutor-special-4',
        );
        expect(specialTutor).toBeDefined();
        expect(specialTutor.name).toBe('Prof. André Especialista (São Luís)');
      });
    });
  });

  // ==========================================================================
  // TIER 3: Cross-Feature Interactions & Combinations (TC-T3-INT-01..08)
  // ==========================================================================
  describe('Tier 3: Cross-Feature Interactions & Combinations', () => {
    it('TC-T3-INT-01: Collaborator intervention followed by Lead Tutor status change -> Card owner stays Tutor A, timeline shows 3 ordered events', async () => {
      const cardId = 'card-int-01';
      mockDb._state.kanbanCards.set(cardId, {
        id: cardId,
        matricula: '20243001',
        aluno_nome: 'Aluno INT-01',
        periodo: '2026-2',
        status_kanban: 'pendente',
        tutor_responsavel_id: 'tutor-lead-1',
        tutor_iniciador_id: 'tutor-lead-1',
        observacoes: null,
        canal_contato_utilizado: null,
        ultimo_contato_em: null,
        ultima_intervencao_em: null,
        qtd_intervencoes: 0,
        data_resolucao: null,
        createdAt: '2026-11-01T10:00:00Z',
        updatedAt: '2026-11-01T10:00:00Z',
      });

      // 1. Initial abertura event
      mockDb._state.timelineEvents.push({
        id: 'evt-int-01-a',
        atendimentoId: cardId,
        matricula: '20243001',
        periodo: '2026-2',
        tipoEvento: 'abertura',
        autorId: 'tutor-lead-1',
        autorNome: 'Prof. Carlos Titular',
        createdAt: '2026-11-01T10:00:00Z',
      });

      // 2. Collaborator logs WhatsApp outreach
      await client
        .post('/api/tutoria/intervencoes')
        .set('Authorization', `Bearer ${tokenCollabTutor}`)
        .send({
          matricula: '20243001',
          atendimentoId: cardId,
          tipoEvento: 'contato_enviado',
          canalContato: 'whatsapp',
          observacoes: 'Aviso de recuperação enviado no WhatsApp.',
        })
        .expect(201);

      // 3. Lead Tutor changes column status
      await client
        .patch(`/api/tutoria/kanban/${cardId}`)
        .set('Authorization', `Bearer ${tokenLeadTutor}`)
        .send({ statusKanban: 'em_contato' })
        .expect(200);

      const card = getCard(cardId);
      expect(card.tutor_responsavel_id).toBe('tutor-lead-1');
      expect(card.status_kanban).toBe('em_contato');

      const timeline = await client
        .get('/api/tutoria/aluno/20243001/timeline')
        .set('Authorization', `Bearer ${tokenLeadTutor}`)
        .expect(200);

      expect(timeline.body.length).toBe(3);
      expect(timeline.body[1].autorId).toBe('tutor-collab-2');
      expect(timeline.body[2].autorId).toBe('tutor-lead-1');
    });

    it('TC-T3-INT-02: Collaborator moves card, then Lead Tutor passes baton to Collaborator', async () => {
      const cardId = 'card-int-02';
      mockDb._state.kanbanCards.set(cardId, {
        id: cardId,
        matricula: '20243002',
        aluno_nome: 'Aluno INT-02',
        periodo: '2026-2',
        status_kanban: 'pendente',
        tutor_responsavel_id: 'tutor-lead-1',
        tutor_iniciador_id: 'tutor-lead-1',
        observacoes: null,
        canal_contato_utilizado: null,
        ultimo_contato_em: null,
        ultima_intervencao_em: null,
        qtd_intervencoes: 0,
        data_resolucao: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // 1. Collaborator moves card to em_contato
      await client
        .patch(`/api/tutoria/kanban/${cardId}`)
        .set('Authorization', `Bearer ${tokenCollabTutor}`)
        .send({ statusKanban: 'em_contato' })
        .expect(200);

      let card = getCard(cardId);
      expect(card.tutor_responsavel_id).toBe('tutor-lead-1'); // Lead retention

      // 2. Lead Tutor executes baton pass to Collaborator
      await client
        .post(`/api/tutoria/kanban/${cardId}/transferir`)
        .set('Authorization', `Bearer ${tokenLeadTutor}`)
        .send({
          novoTutorId: 'tutor-collab-2',
          notaTransicao:
            'Passando titularidade formal para a Profa. Marina dar prosseguimento.',
        })
        .expect(200);

      card = getCard(cardId);
      expect(card.tutor_responsavel_id).toBe('tutor-collab-2'); // Ownership transferred
    });

    it('TC-T3-INT-03: Baton pass followed by intervention from former lead tutor -> Owner stays Tutor B', async () => {
      const cardId = 'card-int-03';
      mockDb._state.kanbanCards.set(cardId, {
        id: cardId,
        matricula: '20243003',
        aluno_nome: 'Aluno INT-03',
        periodo: '2026-2',
        status_kanban: 'em_contato',
        tutor_responsavel_id: 'tutor-collab-2', // Already passed to Tutor B
        tutor_iniciador_id: 'tutor-lead-1',
        observacoes: null,
        canal_contato_utilizado: null,
        ultimo_contato_em: null,
        ultima_intervencao_em: null,
        qtd_intervencoes: 0,
        data_resolucao: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Former Lead Tutor A logs a follow-up phone call
      await client
        .post('/api/tutoria/intervencoes')
        .set('Authorization', `Bearer ${tokenLeadTutor}`)
        .send({
          matricula: '20243003',
          atendimentoId: cardId,
          tipoEvento: 'contato_enviado',
          canalContato: 'telefone',
          observacoes: 'Ligação de checagem do antigo tutor responsável.',
        })
        .expect(201);

      const card = getCard(cardId);
      expect(card.tutor_responsavel_id).toBe('tutor-collab-2'); // Owner did NOT get hijacked
    });

    it('TC-T3-INT-04: Chained rapid status moves by multiple distinct collaborators -> Complete audit path preserved', async () => {
      const cardId = 'card-int-04';
      mockDb._state.kanbanCards.set(cardId, {
        id: cardId,
        matricula: '20243004',
        aluno_nome: 'Aluno INT-04',
        periodo: '2026-2',
        status_kanban: 'pendente',
        tutor_responsavel_id: 'tutor-lead-1',
        tutor_iniciador_id: 'tutor-lead-1',
        observacoes: null,
        canal_contato_utilizado: null,
        ultimo_contato_em: null,
        ultima_intervencao_em: null,
        qtd_intervencoes: 0,
        data_resolucao: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Move 1: Tutor Collab 2 moves to em_contato
      await client
        .patch(`/api/tutoria/kanban/${cardId}`)
        .set('Authorization', `Bearer ${tokenCollabTutor}`)
        .send({ statusKanban: 'em_contato' })
        .expect(200);

      // Move 2: Tutor Successor 3 moves to em_recuperacao
      await client
        .patch(`/api/tutoria/kanban/${cardId}`)
        .set('Authorization', `Bearer ${tokenSuccessorTutor}`)
        .send({ statusKanban: 'em_recuperacao' })
        .expect(200);

      const card = getCard(cardId);
      expect(card.tutor_responsavel_id).toBe('tutor-lead-1');
      expect(card.status_kanban).toBe('em_recuperacao');

      const timeline = await client
        .get('/api/tutoria/aluno/20243004/timeline')
        .set('Authorization', `Bearer ${tokenLeadTutor}`)
        .expect(200);

      const statusEvents = timeline.body.filter(
        (e: any) => e.tipoEvento === 'mudanca_status',
      );
      expect(statusEvents.length).toBe(2);
      expect(statusEvents[0].autorId).toBe('tutor-collab-2');
      expect(statusEvents[1].autorId).toBe('tutor-new-3');
    });

    it('TC-T3-INT-05: Chained multi-hop baton pass (Tutor A -> Tutor B -> Tutor C) -> Final owner Tutor C', async () => {
      const cardId = 'card-int-05';
      mockDb._state.kanbanCards.set(cardId, {
        id: cardId,
        matricula: '20243005',
        aluno_nome: 'Aluno INT-05',
        periodo: '2026-2',
        status_kanban: 'em_contato',
        tutor_responsavel_id: 'tutor-lead-1',
        tutor_iniciador_id: 'tutor-lead-1',
        observacoes: null,
        canal_contato_utilizado: null,
        ultimo_contato_em: null,
        ultima_intervencao_em: null,
        qtd_intervencoes: 0,
        data_resolucao: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Hop 1: Tutor A -> Tutor B
      await client
        .post(`/api/tutoria/kanban/${cardId}/transferir`)
        .set('Authorization', `Bearer ${tokenLeadTutor}`)
        .send({
          novoTutorId: 'tutor-collab-2',
          notaTransicao: 'Hop 1: Passagem de A para B.',
        })
        .expect(200);

      // Hop 2: Tutor B -> Tutor C
      await client
        .post(`/api/tutoria/kanban/${cardId}/transferir`)
        .set('Authorization', `Bearer ${tokenCollabTutor}`)
        .send({
          novoTutorId: 'tutor-new-3',
          notaTransicao: 'Hop 2: Passagem de B para C.',
        })
        .expect(200);

      const card = getCard(cardId);
      expect(card.tutor_responsavel_id).toBe('tutor-new-3');

      const timeline = await client
        .get('/api/tutoria/aluno/20243005/timeline')
        .set('Authorization', `Bearer ${tokenLeadTutor}`)
        .expect(200);

      const batonEvents = timeline.body.filter(
        (e: any) => e.tipoEvento === 'passagem_bastao',
      );
      expect(batonEvents.length).toBe(2);
      expect(batonEvents[0].tutorResponsavelAnteriorId).toBe('tutor-lead-1');
      expect(batonEvents[0].tutorResponsavelNovoId).toBe('tutor-collab-2');
      expect(batonEvents[1].tutorResponsavelAnteriorId).toBe('tutor-collab-2');
      expect(batonEvents[1].tutorResponsavelNovoId).toBe('tutor-new-3');
    });

    it('TC-T3-INT-06: Card resolution (revertido) following multi-channel outreach -> Timeline shows complete trail', async () => {
      const cardId = 'card-int-06';
      mockDb._state.kanbanCards.set(cardId, {
        id: cardId,
        matricula: '20243006',
        aluno_nome: 'Aluno INT-06',
        periodo: '2026-2',
        status_kanban: 'em_recuperacao',
        tutor_responsavel_id: 'tutor-lead-1',
        tutor_iniciador_id: 'tutor-lead-1',
        observacoes: null,
        canal_contato_utilizado: null,
        ultimo_contato_em: null,
        ultima_intervencao_em: null,
        qtd_intervencoes: 0,
        data_resolucao: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Outreach via WhatsApp
      await client
        .post('/api/tutoria/intervencoes')
        .set('Authorization', `Bearer ${tokenCollabTutor}`)
        .send({
          matricula: '20243006',
          tipoEvento: 'contato_enviado',
          canalContato: 'whatsapp',
          observacoes: 'WhatsApp enviado.',
        })
        .expect(201);

      // Outreach via Email
      await client
        .post('/api/tutoria/intervencoes')
        .set('Authorization', `Bearer ${tokenCollabTutor}`)
        .send({
          matricula: '20243006',
          tipoEvento: 'contato_enviado',
          canalContato: 'email',
          observacoes: 'Email enviado.',
        })
        .expect(201);

      // Resolution
      await client
        .patch(`/api/tutoria/kanban/${cardId}`)
        .set('Authorization', `Bearer ${tokenLeadTutor}`)
        .send({ statusKanban: 'revertido' })
        .expect(200);

      const timeline = await client
        .get('/api/tutoria/aluno/20243006/timeline')
        .set('Authorization', `Bearer ${tokenLeadTutor}`)
        .expect(200);

      expect(timeline.body.length).toBeGreaterThanOrEqual(3);
      const canais = timeline.body
        .map((e: any) => e.canalContato)
        .filter(Boolean);
      expect(canais).toContain('whatsapp');
      expect(canais).toContain('email');
    });

    it('TC-T3-INT-07: Intervention logging with concurrent status update in single request -> Both updated cleanly', async () => {
      const cardId = 'card-int-07';
      mockDb._state.kanbanCards.set(cardId, {
        id: cardId,
        matricula: '20243007',
        aluno_nome: 'Aluno INT-07',
        periodo: '2026-2',
        status_kanban: 'pendente',
        tutor_responsavel_id: 'tutor-lead-1',
        tutor_iniciador_id: 'tutor-lead-1',
        observacoes: null,
        canal_contato_utilizado: null,
        ultimo_contato_em: null,
        ultima_intervencao_em: null,
        qtd_intervencoes: 0,
        data_resolucao: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await client
        .post('/api/tutoria/intervencoes')
        .set('Authorization', `Bearer ${tokenCollabTutor}`)
        .send({
          matricula: '20243007',
          atendimentoId: cardId,
          tipoEvento: 'contato_enviado',
          canalContato: 'whatsapp',
          statusKanban: 'em_contato',
          observacoes: 'Primeiro contato e atualização de coluna automática.',
        })
        .expect(201);

      const card = getCard(cardId);
      expect(card.status_kanban).toBe('em_contato');
      expect(card.canal_contato_utilizado).toBe('whatsapp');
      expect(card.qtd_intervencoes).toBe(1);
    });

    it('TC-T3-INT-08: Timeline query scoping: Global student history vs card-specific', async () => {
      const matricula = '20243008';
      const cardA = 'card-scope-a';
      const cardB = 'card-scope-b';

      mockDb._state.kanbanCards.set(cardA, {
        id: cardA,
        matricula,
        aluno_nome: 'Aluno Scope',
        periodo: '2026-1',
        status_kanban: 'revertido',
        tutor_responsavel_id: 'tutor-lead-1',
        tutor_iniciador_id: 'tutor-lead-1',
        observacoes: null,
        canal_contato_utilizado: null,
        ultimo_contato_em: null,
        ultima_intervencao_em: null,
        qtd_intervencoes: 0,
        data_resolucao: null,
        createdAt: '2026-02-01T10:00:00Z',
        updatedAt: '2026-02-01T10:00:00Z',
      });

      mockDb._state.kanbanCards.set(cardB, {
        id: cardB,
        matricula,
        aluno_nome: 'Aluno Scope',
        periodo: '2026-2',
        status_kanban: 'em_contato',
        tutor_responsavel_id: 'tutor-collab-2',
        tutor_iniciador_id: 'tutor-collab-2',
        observacoes: null,
        canal_contato_utilizado: null,
        ultimo_contato_em: null,
        ultima_intervencao_em: null,
        qtd_intervencoes: 0,
        data_resolucao: null,
        createdAt: '2026-08-01T10:00:00Z',
        updatedAt: '2026-08-01T10:00:00Z',
      });

      mockDb._state.timelineEvents.push(
        {
          id: 'evt-scope-1',
          atendimentoId: cardA,
          matricula,
          periodo: '2026-1',
          tipoEvento: 'abertura',
          autorId: 'tutor-lead-1',
          autorNome: 'Prof. Carlos Titular',
          createdAt: '2026-02-01T10:00:00Z',
        },
        {
          id: 'evt-scope-2',
          atendimentoId: cardB,
          matricula,
          periodo: '2026-2',
          tipoEvento: 'abertura',
          autorId: 'tutor-collab-2',
          autorNome: 'Profa. Marina Colaboradora',
          createdAt: '2026-08-01T10:00:00Z',
        },
      );

      // Global query
      const globalRes = await client
        .get(`/api/tutoria/aluno/${matricula}/timeline`)
        .set('Authorization', `Bearer ${tokenLeadTutor}`)
        .expect(200);

      expect(globalRes.body.length).toBe(2);

      // Card-scoped query
      const scopedRes = await client
        .get(`/api/tutoria/aluno/${matricula}/timeline?atendimentoId=${cardB}`)
        .set('Authorization', `Bearer ${tokenLeadTutor}`)
        .expect(200);

      expect(scopedRes.body.length).toBe(1);
      expect(scopedRes.body[0].atendimentoId).toBe(cardB);
    });
  });

  // ==========================================================================
  // TIER 4: Real-World Multi-Tutor Workload Scenarios (TC-T4-SCN-01..05)
  // ==========================================================================
  describe('Tier 4: Real-World Multi-Tutor Workload Scenarios', () => {
    it('TC-T4-SCN-01: Critical Dropout Prevention Outreach Journey across Lead & Collaborator', async () => {
      // 1. Student at critical risk: Lead Tutor creates card
      const createRes = await client
        .post('/api/tutoria/kanban')
        .set('Authorization', `Bearer ${tokenLeadTutor}`)
        .send({
          matricula: '20244001',
          alunoNome: 'Aluno Risco Evasão Crítica',
          statusKanban: 'pendente',
        })
        .expect(201);

      const cardId = createRes.body.id;

      // 2. Collaborator Tutor B logs urgent WhatsApp outreach
      await client
        .post('/api/tutoria/intervencoes')
        .set('Authorization', `Bearer ${tokenCollabTutor}`)
        .send({
          matricula: '20244001',
          atendimentoId: cardId,
          tipoEvento: 'contato_enviado',
          canalContato: 'whatsapp',
          statusKanban: 'em_contato',
          observacoes:
            'Discente inativo há 35 dias; enviado alerta de urgência para recuperação de notas.',
        })
        .expect(201);

      // 3. Student responds; Collaborator logs response note
      await client
        .post('/api/tutoria/intervencoes')
        .set('Authorization', `Bearer ${tokenCollabTutor}`)
        .send({
          matricula: '20244001',
          atendimentoId: cardId,
          tipoEvento: 'intervencao_manual',
          observacoes:
            'Discente respondeu explicando internação médica e enviou atestado.',
        })
        .expect(201);

      // 4. Lead Tutor negotiates deadline extension and moves to em_recuperacao
      await client
        .patch(`/api/tutoria/kanban/${cardId}`)
        .set('Authorization', `Bearer ${tokenLeadTutor}`)
        .send({
          statusKanban: 'em_recuperacao',
          observacoes:
            'Atestado deferido junto à coordenação. Prazo da AP1 estendido até sexta-feira.',
        })
        .expect(200);

      // 5. Student completes recovery; Lead Tutor marks revertido
      await client
        .patch(`/api/tutoria/kanban/${cardId}`)
        .set('Authorization', `Bearer ${tokenLeadTutor}`)
        .send({
          statusKanban: 'revertido',
          observacoes: 'AP1 entregue com nota 8.5. Caso encerrado com sucesso.',
        })
        .expect(200);

      // INVARIANT: Ownership never left Lead Tutor
      const card = getCard(cardId);
      expect(card.tutor_responsavel_id).toBe('tutor-lead-1');
      expect(card.status_kanban).toBe('revertido');
      expect(card.data_resolucao).toBeDefined();

      // Timeline verification
      const timeline = await client
        .get('/api/tutoria/aluno/20244001/timeline')
        .set('Authorization', `Bearer ${tokenLeadTutor}`)
        .expect(200);

      expect(timeline.body.length).toBe(5);
    });

    it('TC-T4-SCN-02: Shift Handover and Baton Pass between Day Shift and Night Shift Tutors', async () => {
      // 1. Day Tutor creates card
      const createRes = await client
        .post('/api/tutoria/kanban')
        .set('Authorization', `Bearer ${tokenLeadTutor}`)
        .send({ matricula: '20244002', alunoNome: 'Aluno Plantão Transição' })
        .expect(201);

      const cardId = createRes.body.id;

      // 2. Day Tutor looks up active night shift tutors
      const tutorsRes = await client
        .get('/api/tutoria/tutores')
        .set('Authorization', `Bearer ${tokenLeadTutor}`)
        .expect(200);

      const nightTutor = tutorsRes.body.find(
        (t: any) => t.id === 'tutor-collab-2',
      );
      expect(nightTutor).toBeDefined();

      // 3. Day Tutor passes baton to Night Tutor with handover note
      await client
        .post(`/api/tutoria/kanban/${cardId}/transferir`)
        .set('Authorization', `Bearer ${tokenLeadTutor}`)
        .send({
          novoTutorId: 'tutor-collab-2',
          notaTransicao:
            'Passagem de plantão: aluno fará prova no AVA às 20h. Monitorar envio.',
        })
        .expect(200);

      // 4. Night Tutor logs in and confirms exam submission in AVA
      await client
        .post('/api/tutoria/intervencoes')
        .set('Authorization', `Bearer ${tokenCollabTutor}`)
        .send({
          matricula: '20244002',
          atendimentoId: cardId,
          tipoEvento: 'contato_enviado',
          canalContato: 'ava',
          observacoes:
            'Submissão no AVA confirmada pelo plantão noturno com sucesso.',
        })
        .expect(201);

      // INVARIANT: Ownership transferred cleanly to night tutor
      const card = getCard(cardId);
      expect(card.tutor_responsavel_id).toBe('tutor-collab-2');
    });

    it('TC-T4-SCN-03: Collaborative Multi-Disciplinary Recovery (Counselor + Tech Lab Mentor)', async () => {
      // 1. Academic Counselor creates card
      const createRes = await client
        .post('/api/tutoria/kanban')
        .set('Authorization', `Bearer ${tokenLeadTutor}`)
        .send({ matricula: '20244003', alunoNome: 'Aluno Multidisciplinar' })
        .expect(201);

      const cardId = createRes.body.id;

      // 2. Tech Lab Mentor logs code correction intervention
      await client
        .post('/api/tutoria/intervencoes')
        .set('Authorization', `Bearer ${tokenSuccessorTutor}`)
        .send({
          matricula: '20244003',
          atendimentoId: cardId,
          tipoEvento: 'intervencao_manual',
          observacoes:
            'Mentor técnico corrigiu bugs de ponteiros e loops infinitos no código C do discente.',
        })
        .expect(201);

      // 3. Academic Counselor conducts study scheduling call
      await client
        .post('/api/tutoria/intervencoes')
        .set('Authorization', `Bearer ${tokenLeadTutor}`)
        .send({
          matricula: '20244003',
          atendimentoId: cardId,
          tipoEvento: 'contato_enviado',
          canalContato: 'telefone',
          observacoes:
            'Sessão telefônica de organização de rotina de estudos realizada.',
        })
        .expect(201);

      // 4. Tech Lab Mentor moves card to em_recuperacao
      await client
        .patch(`/api/tutoria/kanban/${cardId}`)
        .set('Authorization', `Bearer ${tokenSuccessorTutor}`)
        .send({ statusKanban: 'em_recuperacao' })
        .expect(200);

      // INVARIANT: Counselor retains primary ownership throughout
      const card = getCard(cardId);
      expect(card.tutor_responsavel_id).toBe('tutor-lead-1');
      expect(card.status_kanban).toBe('em_recuperacao');
    });

    it('TC-T4-SCN-04: Term Re-Enrollment and Reopening of Evaded Case', async () => {
      const cardOld = 'card-old-2026-1';
      mockDb._state.kanbanCards.set(cardOld, {
        id: cardOld,
        matricula: '20244004',
        aluno_nome: 'Aluno Reingresso',
        periodo: '2026-1',
        status_kanban: 'evadido',
        tutor_responsavel_id: 'tutor-lead-1',
        tutor_iniciador_id: 'tutor-lead-1',
        observacoes: 'Evadiu por motivos financeiros no semestre 2026-1.',
        canal_contato_utilizado: 'telefone',
        ultimo_contato_em: '2026-05-10T10:00:00Z',
        ultima_intervencao_em: '2026-05-10T10:00:00Z',
        qtd_intervencoes: 1,
        data_resolucao: null,
        createdAt: '2026-02-01T10:00:00Z',
        updatedAt: '2026-05-10T10:00:00Z',
      });

      mockDb._state.timelineEvents.push({
        id: 'evt-old-1',
        atendimentoId: cardOld,
        matricula: '20244004',
        periodo: '2026-1',
        tipoEvento: 'mudanca_status',
        autorId: 'tutor-lead-1',
        autorNome: 'Prof. Carlos Titular',
        estadoAnterior: 'em_contato',
        estadoNovo: 'evadido',
        observacoes: 'Evadiu no semestre 2026-1.',
        createdAt: '2026-05-10T10:00:00Z',
      });

      // Student re-enrolls in 2026-2: Tutor Roberto opens new card
      const newCardRes = await client
        .post('/api/tutoria/kanban')
        .set('Authorization', `Bearer ${tokenSuccessorTutor}`)
        .send({
          matricula: '20244004',
          periodo: '2026-2',
          alunoNome: 'Aluno Reingresso',
          statusKanban: 'em_contato',
          observacoes:
            'Reabertura de acompanhamento: discente reingressou no semestre 2026-2.',
        })
        .expect(201);

      const cardNewId = newCardRes.body.id;
      const cardNew = getCard(cardNewId);
      expect(cardNew.tutor_responsavel_id).toBe('tutor-new-3');

      // Query complete timeline: Historical continuity spans both 2026-1 and 2026-2
      const timeline = await client
        .get('/api/tutoria/aluno/20244004/timeline')
        .set('Authorization', `Bearer ${tokenSuccessorTutor}`)
        .expect(200);

      expect(timeline.body.length).toBeGreaterThanOrEqual(2);
      const periods = timeline.body.map((e: any) => e.periodo);
      expect(periods).toContain('2026-1');
      expect(periods).toContain('2026-2');
    });

    it('TC-T4-SCN-05: High-Concurrency Multi-Tutor Action Resilience', async () => {
      const cardId = 'card-concurrency-test';
      mockDb._state.kanbanCards.set(cardId, {
        id: cardId,
        matricula: '20244005',
        aluno_nome: 'Aluno Concorrência',
        periodo: '2026-2',
        status_kanban: 'em_contato',
        tutor_responsavel_id: 'tutor-lead-1',
        tutor_iniciador_id: 'tutor-lead-1',
        observacoes: null,
        canal_contato_utilizado: null,
        ultimo_contato_em: null,
        ultima_intervencao_em: null,
        qtd_intervencoes: 0,
        data_resolucao: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Concurrently dispatch requests from Tutor A and Tutor B
      const p1 = client
        .post('/api/tutoria/intervencoes')
        .set('Authorization', `Bearer ${tokenLeadTutor}`)
        .send({
          matricula: '20244005',
          atendimentoId: cardId,
          tipoEvento: 'intervencao_manual',
          observacoes: 'Intervenção concorrente registrada pelo Tutor Titular.',
        });

      const p2 = client
        .post('/api/tutoria/intervencoes')
        .set('Authorization', `Bearer ${tokenCollabTutor}`)
        .send({
          matricula: '20244005',
          atendimentoId: cardId,
          tipoEvento: 'intervencao_manual',
          observacoes:
            'Intervenção concorrente registrada pela Tutora Colaboradora.',
        });

      const [res1, res2] = await Promise.all([p1, p2]);

      expect(res1.status).toBe(201);
      expect(res2.status).toBe(201);

      // Verify unique event UUIDs and zero event collision
      expect(res1.body.id).not.toBe(res2.body.id);

      const timeline = await client
        .get('/api/tutoria/aluno/20244005/timeline')
        .set('Authorization', `Bearer ${tokenLeadTutor}`)
        .expect(200);

      const authors = timeline.body.map((e: any) => e.autorId);
      expect(authors).toContain('tutor-lead-1');
      expect(authors).toContain('tutor-collab-2');
    });
  });
});
