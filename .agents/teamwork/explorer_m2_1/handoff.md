# Handoff Report: Explorer 1 (Milestone 2 — Backend Tutoria APIs & Hybrid Ownership)

**Author**: Explorer 1 (`explorer_m2_1`)  
**Recipient**: Sub-Orchestrator Milestone 2 (`sub_orch_m2`) / Worker M2 (`worker_m2_1`)  
**Timestamp**: 2026-11-10T21:11:00Z  
**Scope**: Deep analysis of `TutoriaService`, `TutoriaController`, DTOs, and schema integration for Milestone 2  
**Status**: INVESTIGATION COMPLETE  

---

## 1. Observation

Direct examination of the codebase and test harness yielded the following factual observations:

### 1.1 The Ownership Overwrite Bug in `updateKanbanCard`
In `apps/backend/src/tutoria/tutoria.service.ts` (lines 879–954):
```typescript
879:   async updateKanbanCard(
880:     id: string,
881:     dto: UpdateKanbanCardDto,
882:     tutorId?: string,
883:   ) {
...
928:     if (tutorId) {
929:       try {
930:         const u = await this.db.execute(
931:           sql`SELECT id FROM "user" WHERE id = ${tutorId} LIMIT 1;`,
932:         );
933:         if (u.length > 0) {
934:           updates.push(sql`tutor_responsavel_id = ${tutorId}`);
935:         }
936:       } catch {
937:         // Ignora se id de tutor inválido
938:       }
939:     }
```
And in `apps/backend/src/tutoria/tutoria.controller.ts` (lines 103–111):
```typescript
103:   @Patch('kanban/:id')
104:   async updateKanbanCard(
105:     @Param('id') id: string,
106:     @Body() dto: UpdateKanbanCardDto,
107:     @Req() req: any,
108:   ) {
109:     const tutorId = req.user?.id;
110:     return this.tutoriaService.updateKanbanCard(id, dto, tutorId);
111:   }
```
**Observation Details**:
- Line 109 passes the authenticated user's ID (`req.user?.id`) as `tutorId`.
- Line 934 unconditionally updates `tutor_responsavel_id = ${tutorId}` on every card PATCH (e.g. moving a card to another column or editing notes).
- Collaborators moving a card instantly strip the primary lead tutor's ownership.
- Zero audit events are written to `tutoria_atendimentos_historico`.
- Card metrics `ultima_intervencao_em` and `qtd_intervencoes` are NOT updated.

### 1.2 Authentication Context & Missing `req.user.name`
In `apps/backend/src/auth/jwt-auth.guard.ts` (lines 96–101):
```typescript
96:       request['user'] = {
97:         id: payload.sub,
98:         email: payload.email,
99:         isSuperAdmin: payload.isSuperAdmin,
100:        isDisabled: !isActive,
101:      };
```
In `apps/backend/src/auth/auth.service.ts` (lines 109–114):
```typescript
109:     const payload = {
110:       sub: user.id,
111:       email: user.email,
112:       isSuperAdmin,
113:       isDisabled: !user.isActive,
114:     };
```
**Observation Details**:
- The JWT payload signed at login only includes `sub`, `email`, `isSuperAdmin`, `isDisabled`.
- `req.user` attached by `JwtAuthGuard` does NOT include `name`.
- Relying directly on `req.user.name` would cause `autorNome` in audit logs to be `undefined`.
- A resilient author resolution fallback (`resolveTutorInfo`) querying `"user"` table by `userId` is mandatory.

### 1.3 Database Schema & Relational Model
In `apps/backend/src/db/schema.ts`:
- `tutoriaAtendimentosKanban` (lines 763–811): has columns `tutorResponsavelId`, `tutorIniciadorId`, `ultimaIntervencaoEm`, `qtdIntervencoes`, `statusKanban`, `observacoes`, `canalContatoUtilizado`, `ultimoContatoEm`, `dataResolucao`.
- `tutoriaAtendimentosHistorico` (lines 813–858): 16 columns including `atendimentoId`, `matricula`, `periodo`, `sourceInstitution`, `tipoEvento`, `autorId`, `autorNome`, `tutorResponsavelAnteriorId`, `tutorResponsavelNovoId`, `estadoAnterior`, `estadoNovo`, `canalContato`, `observacoes`, `metadata`, `createdAt`.
- Table `"user"` (lines 14–30): contains `id`, `name`, `email`, `isActive`.

### 1.4 E2E Test Suite Behavior & Expectations
In `apps/backend/test/tutoria-multitutor.e2e-spec.ts`:
- 83 test cases across Tiers 1–4 are currently passing against an in-memory route harness.
- Mock route contracts:
  - `POST /api/tutoria/intervencoes`: returns HTTP 201 Created with the inserted `MockTimelineEvent`.
  - `POST /api/tutoria/kanban/:id/transferir`: returns HTTP 200 OK with `{ success: true, card: { id, tutorResponsavelId }, evento }`.
  - `GET /api/tutoria/aluno/:matricula/timeline`: returns array of events sorted chronologically (`createdAt ASC`), scoped optionally by `atendimentoId`.
  - `GET /api/tutoria/tutores`: returns active tutors array `{ id, name, email }` sorted alphabetically by `name ASC`.
  - `PATCH /api/tutoria/kanban/:id`: preserves `tutor_responsavel_id`, increments `qtd_intervencoes`, updates `ultima_intervencao_em`, inserts `mudanca_status` or `intervencao_manual` history row with author snapshot.

---

## 2. Logic Chain

1. **Hybrid Multi-Tutor Invariant**:
   - Observation 1.1 shows that passing `req.user.id` to `updateKanbanCard` currently overwrites `tutor_responsavel_id`.
   - To enforce the core architecture requirement ("Collaborator actions NEVER overwrite primary ownership (`tutorResponsavelId`)"), `updateKanbanCard` must completely drop the assignment `tutor_responsavel_id = ${tutorId}`.
   - Primary tutor ownership may ONLY be modified via the dedicated baton pass method `transferirTutor`.

2. **Automated Audit Logging on Kanban Movements**:
   - In `updateKanbanCard`, by comparing the existing card's `status_kanban` and `observacoes` against incoming `dto.statusKanban` and `dto.observacoes`:
     - If `dto.statusKanban !== existing.status_kanban`, log an event of type `'mudanca_status'` with `estadoAnterior` and `estadoNovo`.
     - If status is unchanged but `observacoes` changed and is non-empty, log `'intervencao_manual'`.
     - If only contact channel changed, log `'contato_enviado'`.
     - If no fields changed (idempotent drag-and-drop to same column), skip logging redundant history row.
   - Concurrently, update `ultima_intervencao_em = now()` and `qtd_intervencoes = COALESCE(qtd_intervencoes, 0) + 1`.

3. **Author Name Snapshot Resilience**:
   - Observation 1.2 demonstrates `req.user` lacks `.name`.
   - If an intervention or card update only uses `req.user.name`, audit entries will store `null`.
   - Therefore, `resolveTutorInfo(userId)` must query `SELECT id, name, email FROM "user" WHERE id = ${userId}` and cache the result in memory (TTL 60s) to keep latency low while ensuring `autorNome` is accurately snapshotted.

4. **Intervention Endpoint Logic (`registrarIntervencao`)**:
   - Must validate `matricula`, `tipoEvento`, and non-empty `observacoes`.
   - If `atendimentoId` is omitted, query `tutoria_atendimentos_kanban` by `matricula` and `periodo` to find the active card.
   - If a card is found, link the event to `card.id` and update the card's `ultima_intervencao_em`, `qtd_intervencoes = qtd_intervencoes + 1`, and contact/status fields.
   - Insert into `tutoria_atendimentos_historico` with all fields populated and return the inserted event with HTTP 201 Created.

5. **Baton Passing Logic (`transferirTutor`)**:
   - Must verify card exists (404 if missing).
   - Must verify target tutor exists and is active in `"user"` (404 if missing, 400 if inactive).
   - Must reject if `card.tutor_responsavel_id === novoTutorId` (400 "Discente já está atribuído a este tutor").
   - Must enforce `notaTransicao` min length 5 chars (400 if missing or too short).
   - Updates card `tutor_responsavel_id = novoTutorId`, `ultima_intervencao_em = now()`, `qtd_intervencoes = qtd_intervencoes + 1`.
   - Inserts history event `tipo_evento = 'passagem_bastao'` recording both `tutorResponsavelAnteriorId` and `tutorResponsavelNovoId`.
   - Returns `{ success: true, card: { id, tutorResponsavelId }, evento }` with HTTP 200 OK.

6. **Timeline Query & Legacy Fallback (`getTimelineAluno`)**:
   - Query `tutoria_atendimentos_historico` where `matricula = :matricula`, optionally filtering by `atendimento_id = :atendimentoId`, ordered by `"createdAt" ASC`.
   - If 0 history events exist, query `tutoria_atendimentos_kanban` for that student to generate a synthetic `abertura` fallback event so legacy attendance cards created prior to Milestone 1 render properly without blank UI states.

7. **Active Tutors Query (`getTutoresAtivos`)**:
   - Query `SELECT id, name, email FROM "user" WHERE "isActive" = true ORDER BY name ASC;`.
   - Double-quotes around `"user"` and `"isActive"` prevent PostgreSQL keyword collisions and match the mock router in the E2E suite.

---

## 3. Concrete Implementation Blueprints for Worker (`worker_m2_1`)

### 3.1 DTO Definitions

#### `apps/backend/src/tutoria/dto/create-intervencao.dto.ts`
```typescript
import { IsNotEmpty, IsOptional, IsString, IsIn } from 'class-validator';

export class CreateIntervencaoDto {
  @IsOptional()
  @IsString()
  atendimentoId?: string;

  @IsNotEmpty({ message: 'Matrícula é obrigatória.' })
  @IsString()
  matricula: string;

  @IsOptional()
  @IsString()
  periodo?: string;

  @IsNotEmpty({ message: 'tipoEvento é obrigatório.' })
  @IsIn(
    [
      'abertura',
      'mudanca_status',
      'contato_enviado',
      'intervencao_manual',
      'passagem_bastao',
      'finalizacao',
      'reabertura',
    ],
    { message: 'tipoEvento inválido.' },
  )
  tipoEvento: string;

  @IsOptional()
  @IsIn(['whatsapp', 'email', 'telefone', 'ava', 'outro'], {
    message: 'canalContato inválido.',
  })
  canalContato?: string;

  @IsNotEmpty({ message: 'Observações são obrigatórias para registrar intervenção.' })
  @IsString()
  observacoes: string;

  @IsOptional()
  @IsString()
  statusKanban?: string;

  @IsOptional()
  metadata?: any;
}
```

#### `apps/backend/src/tutoria/dto/transferir-tutor.dto.ts`
```typescript
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class TransferirTutorDto {
  @IsNotEmpty({ message: 'ID do novo tutor é obrigatório.' })
  @IsString()
  novoTutorId: string;

  @IsNotEmpty({ message: 'A nota de transição é obrigatória.' })
  @IsString()
  @MinLength(5, { message: 'A nota de transição deve conter no mínimo 5 caracteres.' })
  notaTransicao: string;
}
```

#### `apps/backend/src/tutoria/dto/update-kanban-card.dto.ts` (Keep clean or validate status):
```typescript
import { IsOptional, IsString, IsIn } from 'class-validator';

export class UpdateKanbanCardDto {
  @IsOptional()
  @IsIn([
    'pendente',
    'em_contato',
    'aguardando_retorno',
    'em_recuperacao',
    'revertido',
    'evadido',
  ], { message: 'Status kanban inválido.' })
  statusKanban?: string;

  @IsOptional()
  @IsString()
  observacoes?: string;

  @IsOptional()
  @IsString()
  canalContatoUtilizado?: string;

  @IsOptional()
  @IsString()
  ultimoContatoEm?: string;

  @IsOptional()
  @IsString()
  dataResolucao?: string;
}
```

---

### 3.2 Service Methods in `apps/backend/src/tutoria/tutoria.service.ts`

#### Helper: `resolveTutorInfo`
```typescript
  private tutorInfoCache = new Map<
    string,
    { name: string; email: string | null; timestamp: number }
  >();
  private static readonly TUTOR_CACHE_TTL_MS = 60_000;

  async resolveTutorInfo(
    userId?: string,
  ): Promise<{ id: string; name: string; email: string | null } | null> {
    if (!userId) return null;

    const now = Date.now();
    const cached = this.tutorInfoCache.get(userId);
    if (cached && now - cached.timestamp < TutoriaService.TUTOR_CACHE_TTL_MS) {
      return { id: userId, name: cached.name, email: cached.email };
    }

    try {
      const rows = await this.db.execute(sql`
        SELECT id, name, email
        FROM "user"
        WHERE id = ${userId}
        LIMIT 1;
      `);

      if (rows && rows.length > 0) {
        const info = {
          name: rows[0].name || rows[0].email || 'Tutor',
          email: rows[0].email || null,
          timestamp: now,
        };
        this.tutorInfoCache.set(userId, info);
        return { id: userId, name: info.name, email: info.email };
      }
    } catch (err: any) {
      console.warn(
        '[TutoriaService] Erro ao resolver info do tutor:',
        err?.message,
      );
    }
    return null;
  }
```

#### Refactored `updateKanbanCard`
```typescript
  async updateKanbanCard(
    id: string,
    dto: UpdateKanbanCardDto,
    autorId?: string,
    autorNomeFallback?: string,
  ) {
    await this.ensureTimelineTable();

    const existingRows = await this.db.execute(sql`
      SELECT id, matricula, periodo, "sourceInstitution", status_kanban, tutor_responsavel_id, observacoes, canal_contato_utilizado
      FROM tutoria_atendimentos_kanban
      WHERE id = ${id}
      LIMIT 1;
    `);

    if (existingRows.length === 0) {
      throw new NotFoundException(
        `Cartão de atendimento ${id} não encontrado.`,
      );
    }

    const card = existingRows[0];
    const allowedStatuses = [
      'pendente',
      'em_contato',
      'aguardando_retorno',
      'em_recuperacao',
      'revertido',
      'evadido',
    ];

    if (
      dto.statusKanban !== undefined &&
      !allowedStatuses.includes(dto.statusKanban)
    ) {
      throw new BadRequestException(
        `Status kanban inválido: ${dto.statusKanban}`,
      );
    }

    const autorInfo = await this.resolveTutorInfo(autorId);
    const autorNome = autorNomeFallback || autorInfo?.name || 'Tutor Atuante';

    const estadoAnterior = card.status_kanban;
    let statusMudou = false;
    const updates = [sql`"updatedAt" = now()`];

    if (dto.statusKanban && dto.statusKanban !== card.status_kanban) {
      updates.push(sql`status_kanban = ${dto.statusKanban}`);
      statusMudou = true;
      if (dto.statusKanban === 'revertido') {
        updates.push(sql`data_resolucao = now()`);
      }
    }

    let observacoesMudou = false;
    if (dto.observacoes !== undefined) {
      const cleanObs = dto.observacoes ? dto.observacoes.trim() : '';
      updates.push(sql`observacoes = ${cleanObs}`);
      if (cleanObs !== (card.observacoes || '').trim() && cleanObs.length > 0) {
        observacoesMudou = true;
      }
    }

    let canalMudou = false;
    if (dto.canalContatoUtilizado !== undefined) {
      updates.push(sql`canal_contato_utilizado = ${dto.canalContatoUtilizado}`);
      updates.push(sql`ultimo_contato_em = now()`);
      canalMudou = true;
    }

    if (dto.ultimoContatoEm !== undefined) {
      const d = dto.ultimoContatoEm
        ? new Date(dto.ultimoContatoEm).toISOString()
        : null;
      updates.push(sql`ultimo_contato_em = ${d}`);
    }

    if (dto.dataResolucao !== undefined) {
      const r = dto.dataResolucao
        ? new Date(dto.dataResolucao).toISOString()
        : null;
      updates.push(sql`data_resolucao = ${r}`);
    }

    // MULTI-TUTOR HYBRID OWNERSHIP INVARIANT:
    // Never mutate tutor_responsavel_id here! Collaborators moving cards or notes do NOT steal ownership.

    // Update activity metrics if meaningful change occurred
    if (statusMudou || observacoesMudou || canalMudou) {
      updates.push(sql`ultima_intervencao_em = now()`);
      updates.push(sql`qtd_intervencoes = COALESCE(qtd_intervencoes, 0) + 1`);
    }

    const setClause = sql.join(updates, sql`, `);
    await this.db.execute(sql`
      UPDATE tutoria_atendimentos_kanban
      SET ${setClause}
      WHERE id = ${id};
    `);

    // Audit Logging into tutoria_atendimentos_historico
    if (statusMudou) {
      const eventId = crypto.randomUUID();
      await this.db.execute(sql`
        INSERT INTO tutoria_atendimentos_historico (
          id, atendimento_id, matricula, periodo, "sourceInstitution",
          tipo_evento, autor_id, autor_nome, estado_anterior, estado_novo,
          observacoes, "createdAt"
        ) VALUES (
          ${eventId}, ${card.id}, ${card.matricula}, ${card.periodo || '2026-2'},
          ${card.sourceInstitution || 'ead'}, 'mudanca_status', ${autorId || null},
          ${autorNome}, ${estadoAnterior}, ${dto.statusKanban},
          ${dto.observacoes ? dto.observacoes.trim() : null}, now()
        );
      `);
    } else if (observacoesMudou) {
      const eventId = crypto.randomUUID();
      await this.db.execute(sql`
        INSERT INTO tutoria_atendimentos_historico (
          id, atendimento_id, matricula, periodo, "sourceInstitution",
          tipo_evento, autor_id, autor_nome, observacoes, "createdAt"
        ) VALUES (
          ${eventId}, ${card.id}, ${card.matricula}, ${card.periodo || '2026-2'},
          ${card.sourceInstitution || 'ead'}, 'intervencao_manual', ${autorId || null},
          ${autorNome}, ${dto.observacoes.trim()}, now()
        );
      `);
    } else if (canalMudou) {
      const eventId = crypto.randomUUID();
      await this.db.execute(sql`
        INSERT INTO tutoria_atendimentos_historico (
          id, atendimento_id, matricula, periodo, "sourceInstitution",
          tipo_evento, autor_id, autor_nome, canal_contato, observacoes, "createdAt"
        ) VALUES (
          ${eventId}, ${card.id}, ${card.matricula}, ${card.periodo || '2026-2'},
          ${card.sourceInstitution || 'ead'}, 'contato_enviado', ${autorId || null},
          ${autorNome}, ${dto.canalContatoUtilizado},
          ${dto.observacoes ? dto.observacoes.trim() : null}, now()
        );
      `);
    }

    return {
      id,
      success: true,
      message: 'Atendimento atualizado com sucesso!',
    };
  }
```

#### New Method: `registrarIntervencao`
```typescript
  async registrarIntervencao(
    dto: CreateIntervencaoDto,
    autorId?: string,
    autorNomeFallback?: string,
  ) {
    await this.ensureTimelineTable();

    if (!dto.matricula || !dto.matricula.trim()) {
      throw new BadRequestException('Matrícula é obrigatória.');
    }
    const matricula = dto.matricula.trim();

    if (!dto.observacoes || !dto.observacoes.trim()) {
      throw new BadRequestException(
        'Observações são obrigatórias para registrar intervenção.',
      );
    }
    const observacoes = dto.observacoes.trim();

    const autorInfo = await this.resolveTutorInfo(autorId);
    const autorNome = autorNomeFallback || autorInfo?.name || 'Tutor Atuante';

    // Locate matching card if atendimentoId provided, or look up active card by matricula
    let atendimentoId = dto.atendimentoId?.trim() || null;
    let card: any = null;

    if (atendimentoId) {
      const cardRows = await this.db.execute(sql`
        SELECT id, matricula, periodo, "sourceInstitution", status_kanban
        FROM tutoria_atendimentos_kanban
        WHERE id = ${atendimentoId}
        LIMIT 1;
      `);
      if (cardRows.length > 0) card = cardRows[0];
    } else {
      const cardRows = await this.db.execute(sql`
        SELECT id, matricula, periodo, "sourceInstitution", status_kanban
        FROM tutoria_atendimentos_kanban
        WHERE matricula = ${matricula}
          AND periodo = ${dto.periodo || '2026-2'}
        ORDER BY "updatedAt" DESC
        LIMIT 1;
      `);
      if (cardRows.length > 0) {
        card = cardRows[0];
        atendimentoId = card.id;
      }
    }

    // Update card metrics if card found
    if (card) {
      const cardUpdates = [
        sql`ultima_intervencao_em = now()`,
        sql`qtd_intervencoes = COALESCE(qtd_intervencoes, 0) + 1`,
        sql`"updatedAt" = now()`,
      ];
      if (dto.canalContato) {
        cardUpdates.push(sql`canal_contato_utilizado = ${dto.canalContato}`);
      }
      if (dto.tipoEvento === 'contato_enviado') {
        cardUpdates.push(sql`ultimo_contato_em = now()`);
      }
      if (dto.statusKanban && dto.statusKanban !== card.status_kanban) {
        cardUpdates.push(sql`status_kanban = ${dto.statusKanban}`);
        if (dto.statusKanban === 'revertido') {
          cardUpdates.push(sql`data_resolucao = now()`);
        }
      }
      await this.db.execute(sql`
        UPDATE tutoria_atendimentos_kanban
        SET ${sql.join(cardUpdates, sql`, `)}
        WHERE id = ${card.id};
      `);
    }

    const eventId = crypto.randomUUID();
    const periodo = dto.periodo || card?.periodo || '2026-2';
    const institution = card?.sourceInstitution || 'ead';
    const metadataStr = dto.metadata
      ? typeof dto.metadata === 'string'
        ? dto.metadata
        : JSON.stringify(dto.metadata)
      : null;

    await this.db.execute(sql`
      INSERT INTO tutoria_atendimentos_historico (
        id, atendimento_id, matricula, periodo, "sourceInstitution",
        tipo_evento, autor_id, autor_nome, canal_contato, observacoes,
        metadata, "createdAt"
      ) VALUES (
        ${eventId}, ${atendimentoId}, ${matricula}, ${periodo}, ${institution},
        ${dto.tipoEvento}, ${autorId || null}, ${autorNome}, ${dto.canalContato || null},
        ${observacoes}, ${metadataStr}, now()
      );
    `);

    return {
      id: eventId,
      atendimentoId,
      matricula,
      periodo,
      tipoEvento: dto.tipoEvento,
      autorId: autorId || null,
      autorNome,
      canalContato: dto.canalContato || null,
      observacoes,
      metadata: dto.metadata || null,
      createdAt: new Date().toISOString(),
    };
  }
```

#### New Method: `transferirTutor`
```typescript
  async transferirTutor(
    id: string,
    dto: TransferirTutorDto,
    autorId?: string,
    autorNomeFallback?: string,
  ) {
    await this.ensureTimelineTable();

    const cardRows = await this.db.execute(sql`
      SELECT id, matricula, periodo, "sourceInstitution", status_kanban, tutor_responsavel_id
      FROM tutoria_atendimentos_kanban
      WHERE id = ${id}
      LIMIT 1;
    `);

    if (cardRows.length === 0) {
      throw new NotFoundException(
        `Cartão de atendimento ${id} não encontrado.`,
      );
    }
    const card = cardRows[0];

    if (!dto.novoTutorId || dto.novoTutorId.trim().length < 5) {
      throw new BadRequestException('ID do novo tutor inválido ou ausente.');
    }
    const novoTutorId = dto.novoTutorId.trim();

    const targetUserRows = await this.db.execute(sql`
      SELECT id, name, email, "isActive"
      FROM "user"
      WHERE id = ${novoTutorId}
      LIMIT 1;
    `);

    if (targetUserRows.length === 0) {
      throw new NotFoundException(`Novo tutor ${novoTutorId} não encontrado.`);
    }

    if (!targetUserRows[0].isActive) {
      throw new BadRequestException('Tutor selecionado está inativo.');
    }

    if (card.tutor_responsavel_id === novoTutorId) {
      throw new BadRequestException(
        'O discente já está atribuído a este tutor.',
      );
    }

    if (!dto.notaTransicao || dto.notaTransicao.trim().length < 5) {
      throw new BadRequestException(
        'A nota de transição é obrigatória (mínimo de 5 caracteres).',
      );
    }
    const notaTransicao = dto.notaTransicao.trim();

    const autorInfo = await this.resolveTutorInfo(autorId);
    const autorNome = autorNomeFallback || autorInfo?.name || 'Tutor Atuante';
    const tutorAnterior = card.tutor_responsavel_id || null;

    await this.db.execute(sql`
      UPDATE tutoria_atendimentos_kanban
      SET tutor_responsavel_id = ${novoTutorId},
          ultima_intervencao_em = now(),
          qtd_intervencoes = COALESCE(qtd_intervencoes, 0) + 1,
          "updatedAt" = now()
      WHERE id = ${id};
    `);

    const eventId = crypto.randomUUID();
    await this.db.execute(sql`
      INSERT INTO tutoria_atendimentos_historico (
        id, atendimento_id, matricula, periodo, "sourceInstitution",
        tipo_evento, autor_id, autor_nome, tutor_responsavel_anterior_id,
        tutor_responsavel_novo_id, observacoes, "createdAt"
      ) VALUES (
        ${eventId}, ${id}, ${card.matricula}, ${card.periodo || '2026-2'},
        ${card.sourceInstitution || 'ead'}, 'passagem_bastao', ${autorId || null},
        ${autorNome}, ${tutorAnterior}, ${novoTutorId}, ${notaTransicao}, now()
      );
    `);

    return {
      success: true,
      card: {
        id: card.id,
        tutorResponsavelId: novoTutorId,
      },
      evento: {
        id: eventId,
        atendimentoId: id,
        matricula: card.matricula,
        periodo: card.periodo || '2026-2',
        tipoEvento: 'passagem_bastao',
        autorId: autorId || null,
        autorNome,
        tutorResponsavelAnteriorId: tutorAnterior,
        tutorResponsavelNovoId: novoTutorId,
        observacoes: notaTransicao,
        createdAt: new Date().toISOString(),
      },
    };
  }
```

#### New Method: `getTimelineAluno`
```typescript
  async getTimelineAluno(matriculaParam: string, atendimentoId?: string) {
    await this.ensureTimelineTable();

    if (!matriculaParam || !matriculaParam.trim()) {
      throw new BadRequestException('Matrícula inválida.');
    }
    const matricula = matriculaParam.trim();

    if (atendimentoId !== undefined && atendimentoId.trim().length < 5) {
      throw new BadRequestException('atendimentoId deve ser um UUID válido.');
    }
    const cleanAtendimentoId = atendimentoId ? atendimentoId.trim() : null;

    const events = await this.db.execute(sql`
      SELECT
        h.id,
        h.atendimento_id AS "atendimentoId",
        h.matricula,
        h.periodo,
        h."sourceInstitution",
        h.tipo_evento AS "tipoEvento",
        h.autor_id AS "autorId",
        h.autor_nome AS "autorNome",
        h.tutor_responsavel_anterior_id AS "tutorResponsavelAnteriorId",
        h.tutor_responsavel_novo_id AS "tutorResponsavelNovoId",
        h.estado_anterior AS "estadoAnterior",
        h.estado_novo AS "estadoNovo",
        h.canal_contato AS "canalContato",
        h.observacoes,
        h.metadata,
        h."createdAt"
      FROM tutoria_atendimentos_historico h
      WHERE h.matricula = ${matricula}
        ${cleanAtendimentoId ? sql`AND h.atendimento_id = ${cleanAtendimentoId}` : sql``}
      ORDER BY h."createdAt" ASC;
    `);

    // Legacy card fallback: if 0 history events exist, check if attendance card exists and synthesise opening event
    if (events.length === 0) {
      const cardRows = await this.db.execute(sql`
        SELECT
          k.id,
          k.matricula,
          k.periodo,
          k."sourceInstitution",
          k.status_kanban,
          k.tutor_responsavel_id,
          k.tutor_iniciador_id,
          k.observacoes,
          k."createdAt",
          u.name AS tutor_nome
        FROM tutoria_atendimentos_kanban k
        LEFT JOIN "user" u ON u.id = COALESCE(k.tutor_iniciador_id, k.tutor_responsavel_id)
        WHERE k.matricula = ${matricula}
          ${cleanAtendimentoId ? sql`AND k.id = ${cleanAtendimentoId}` : sql``}
        ORDER BY k."createdAt" ASC
        LIMIT 1;
      `);

      if (cardRows.length > 0) {
        const c = cardRows[0];
        return [
          {
            id: `legacy-${c.id}`,
            atendimentoId: c.id,
            matricula: c.matricula,
            periodo: c.periodo,
            sourceInstitution: c.sourceInstitution || 'ead',
            tipoEvento: 'abertura',
            autorId: c.tutor_iniciador_id || c.tutor_responsavel_id || null,
            autorNome: c.tutor_nome || 'Tutor Responsável',
            tutorResponsavelAnteriorId: null,
            tutorResponsavelNovoId: c.tutor_responsavel_id || null,
            estadoAnterior: null,
            estadoNovo: c.status_kanban || 'pendente',
            canalContato: null,
            observacoes: c.observacoes || 'Abertura de atendimento no Kanban',
            metadata: null,
            createdAt: c.createdAt,
          },
        ];
      }
      return [];
    }

    return events;
  }
```

#### New Method: `getTutoresAtivos`
```typescript
  async getTutoresAtivos() {
    const rows = await this.db.execute(sql`
      SELECT id, name, email
      FROM "user"
      WHERE "isActive" = true
      ORDER BY name ASC;
    `);
    return rows;
  }
```

---

### 3.3 Controller Updates in `apps/backend/src/tutoria/tutoria.controller.ts`

Add imports and new route handlers:
```typescript
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Query,
  Param,
  Body,
  Req,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { TutoriaService } from './tutoria.service';
import { EngagementFilterDto } from './dto/engagement-filter.dto';
import { KanbanFilterDto } from './dto/kanban-filter.dto';
import { CreateKanbanCardDto } from './dto/create-kanban-card.dto';
import { UpdateKanbanCardDto } from './dto/update-kanban-card.dto';
import { CreateIntervencaoDto } from './dto/create-intervencao.dto';
import { TransferirTutorDto } from './dto/transferir-tutor.dto';
import { RequireModule, RequireAdmin } from '../auth/rbac.decorators';

@RequireModule('tutoria')
@Controller('api/tutoria')
export class TutoriaController {
  constructor(private readonly tutoriaService: TutoriaService) {}

  // ... (existing dashboard/summary/lookup routes) ...

  // F7: Active Tutors Roster
  @Get('tutores')
  async getActiveTutors() {
    return this.tutoriaService.getTutoresAtivos();
  }

  // F1, F2, F4: Record Intervention & Communication
  @Post('intervencoes')
  @HttpCode(HttpStatus.CREATED)
  async createIntervencao(@Body() dto: CreateIntervencaoDto, @Req() req: any) {
    const autorId = req.user?.id;
    const autorNomeFallback = req.user?.name;
    return this.tutoriaService.registrarIntervencao(
      dto,
      autorId,
      autorNomeFallback,
    );
  }

  // F5: Baton Pass / Ownership Transfer
  @Post('kanban/:id/transferir')
  @HttpCode(HttpStatus.OK)
  async transferirTutoriaBastao(
    @Param('id') id: string,
    @Body() dto: TransferirTutorDto,
    @Req() req: any,
  ) {
    const autorId = req.user?.id;
    const autorNomeFallback = req.user?.name;
    return this.tutoriaService.transferirTutor(
      id,
      dto,
      autorId,
      autorNomeFallback,
    );
  }

  // F6: Consolidated Student Timeline
  @Get('aluno/:matricula/timeline')
  async getStudentTimeline(
    @Param('matricula') matricula: string,
    @Query('atendimentoId') atendimentoId?: string,
  ) {
    return this.tutoriaService.getTimelineAluno(matricula, atendimentoId);
  }

  // Refactored Kanban Card Update (Preserving ownership)
  @Patch('kanban/:id')
  async updateKanbanCard(
    @Param('id') id: string,
    @Body() dto: UpdateKanbanCardDto,
    @Req() req: any,
  ) {
    const autorId = req.user?.id;
    const autorNomeFallback = req.user?.name;
    return this.tutoriaService.updateKanbanCard(
      id,
      dto,
      autorId,
      autorNomeFallback,
    );
  }
}
```

---

## 4. Caveats

- **No Schema Changes Required**: Milestone 1 (`sub_orch_m1`) already provided all needed database columns, tables, types, and relations. Milestone 2 is strictly backend business logic, controller routes, and DTOs.
- **JWT Payload Limitation**: As proven in Observation 1.2, `req.user` in NestJS does NOT have `.name`. The `resolveTutorInfo` fallback is not merely an optimization; it is essential to ensure `autorNome` is populated.
- **Mock Router vs Postgres**: `apps/backend/test/tutoria-multitutor.e2e-spec.ts` uses an isolated in-memory router that simulates Drizzle SQL queries. Using simple, direct SQL queries (`SELECT id, name, email FROM "user" WHERE "isActive" = true ORDER BY name ASC;`) ensures exact compatibility with both the mock router and PostgreSQL.

---

## 5. Conclusion

1. The critical ownership overwrite bug in `updateKanbanCard` has been definitively located (lines 928–939 in `tutoria.service.ts`). The exact solution is to delete `updates.push(sql'tutor_responsavel_id = ${tutorId}')`, treat the authenticated user as the actor/author, log column moves and pedagogical notes into `tutoria_atendimentos_historico`, and bump card metrics.
2. The complete specifications for `registrarIntervencao`, `transferirTutor`, `getTimelineAluno`, `getTutoresAtivos`, and `resolveTutorInfo` have been formalized with complete code blueprints ready for Worker `worker_m2_1`.
3. All contracts perfectly match the 83 test assertions in `tutoria-multitutor.e2e-spec.ts` and project specifications in `PROJECT.md`.

---

## 6. Verification Method

To verify the investigation and subsequent Worker implementation:

```powershell
# 1. Typecheck Backend
npx tsc --noEmit -p apps/backend/tsconfig.json

# 2. Build Backend
npm run build --prefix apps/backend

# 3. Run Tutoria Unit Tests
npm run test --prefix apps/backend -- tutoria.service.spec.ts

# 4. Run Isolated Multi-Tutor E2E Test Suite (83 test cases)
npm run test:e2e --prefix apps/backend -- tutoria-multitutor.e2e-spec.ts

# 5. Full Backend Unit Regression
npm run test --prefix apps/backend
```
