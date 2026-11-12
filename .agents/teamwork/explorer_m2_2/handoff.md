# Handoff Report: TutoriaController & DTO Design (Milestone 2)

**Author**: Explorer 2 (Milestone 2 — Backend Tutoria APIs & Hybrid Ownership)  
**Recipient**: Sub-Orchestrator Milestone 2 (`7eeca256-7483-44cc-8dd1-1e2137a194ab`)  
**Timestamp**: 2026-11-10T21:15:00Z  
**Scope**: Controller route specifications, DTO design (`create-intervencao.dto.ts`, `transferir-tutor.dto.ts`), auth guards/decorators, user extraction, and error handling for Milestone 2  
**Status**: COMPLETE  

---

## 1. Observation

Direct observations from examining the codebase, configuration, schemas, tests, and contracts:

### 1.1 Auth Guards, Decorators & User Context
- **Global Guard Registration (`apps/backend/src/app.module.ts:59-67`)**:
  Both `JwtAuthGuard` and `RbacGuard` are registered globally as `APP_GUARD`.
  Therefore, every route in the backend is guarded by default. Controllers and individual route methods do **not** need redundant `@UseGuards(JwtAuthGuard)` decorators.
- **Module RBAC Decorator (`apps/backend/src/tutoria/tutoria.controller.ts:19-23`)**:
  `TutoriaController` is decorated with `@RequireModule('tutoria')` at class level:
  ```ts
  @RequireModule('tutoria')
  @Controller('api/tutoria')
  export class TutoriaController { ... }
  ```
  `RbacGuard` (`apps/backend/src/auth/rbac.guard.ts:77-98`) reads `REQUIRE_MODULES_KEY` via `Reflector`, validates user permissions against cached direct/group system access, and throws `ForbiddenException('Acesso negado. Requer permissão em: tutoria.')` if access is denied. Super Admins bypass this check (`user.isSuperAdmin === true`).
- **`req.user` Payload Structure (`apps/backend/src/auth/jwt-auth.guard.ts:96-101`)**:
  `JwtAuthGuard` populates `request['user']` with:
  ```ts
  request['user'] = {
    id: payload.sub,
    email: payload.email,
    isSuperAdmin: payload.isSuperAdmin,
    isDisabled: !isActive,
  };
  ```
  **Critical Finding**: `payload` generated in `AuthService.login()` (`apps/backend/src/auth/auth.service.ts:109-114`) does **not** include `name`. Thus, `req.user.name` is `undefined` in standard requests. In `TutoriaController`, user extraction is done via `@Req() req: any`, extracting `req.user?.id`. The service layer (`TutoriaService`) must provide fallback database resolution for `autorNome` via `SELECT name, email FROM "user" WHERE id = ${autorId} LIMIT 1;` when inserting into `tutoria_atendimentos_historico`.

### 1.2 Global Validation Pipe & Existing DTOs
- **ValidationPipe Setup (`apps/backend/src/main.ts:52-61`)**:
  ```ts
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
  ```
  **Crucial Rule**: Because `whitelist: true` is active, any property submitted in request payloads that lacks a `class-validator` decorator is silently stripped. All fields must have explicit validation decorators (e.g. `@IsOptional()`, `@IsString()`, `@IsIn()`, `@IsObject()`).
- **Existing DTOs (`apps/backend/src/tutoria/dto/`)**:
  - `create-kanban-card.dto.ts`: Uses `@IsNotEmpty()`, `@IsOptional()`, `@IsString()`.
  - `update-kanban-card.dto.ts`: Uses `@IsOptional()`, `@IsString()`.
  - `engagement-filter.dto.ts`: Uses `@IsOptional()`, `@IsString()`, `@IsIn([...])`, `@IsInt()`, `@Min(1)`, `@Type(() => Number)`.
  - `kanban-filter.dto.ts`: Uses `@IsOptional()`, `@IsString()`.

### 1.3 Schema Types & Enums (`apps/backend/src/db/schema.ts:924-948`)
The schema exports:
- `TutoriaTipoEvento`: `'abertura' | 'mudanca_status' | 'contato_enviado' | 'intervencao_manual' | 'passagem_bastao' | 'finalizacao' | 'reabertura'`
- `TutoriaCanalContato`: `'whatsapp' | 'email' | 'telefone' | 'ava' | 'outro'`
- Table `tutoriaAtendimentosHistorico` stores `metadata` as `text('metadata')`, requiring serialization/deserialization for JSON objects.

### 1.4 Test Requirements & E2E Validation (`apps/backend/test/tutoria-multitutor.e2e-spec.ts:507-720`)
The isolated E2E suite exercises 83 test cases across Tiers 1-4 for Features F1-F7. Key constraints verified:
- `POST /api/tutoria/intervencoes`: Status `201 Created`. Increments `qtd_intervencoes`, updates `ultima_intervencao_em`, links `atendimentoId`, records author snapshot.
- `POST /api/tutoria/kanban/:id/transferir`: Status `200 OK` (requires `@HttpCode(HttpStatus.OK)`). Fails with `404` if card or new tutor not found; fails with `400` if target tutor is already current owner or note is empty. Updates `tutor_responsavel_id` and records `passagem_bastao`.
- `GET /api/tutoria/aluno/:matricula/timeline`: Status `200 OK`. Returns chronological list sorted by `createdAt ASC` (oldest to newest). Accepts optional `?atendimentoId=...`.
- `GET /api/tutoria/tutores`: Status `200 OK`. Returns active users `{ id, name, email }` sorted by `name ASC`. Protected by `@RequireModule('tutoria')`.
- `PATCH /api/tutoria/kanban/:id`: Status `200 OK`. Must preserve `tutor_responsavel_id` (fixing the overwrite bug) and record status change or intervention in audit history.

---

## 2. Logic Chain

1. **Guard and Authorization Architecture**:
   - Given that `AppModule` installs `JwtAuthGuard` and `RbacGuard` globally, placing `@UseGuards(JwtAuthGuard)` on `TutoriaController` or its methods is unnecessary and redundant.
   - Decorating `TutoriaController` with `@RequireModule('tutoria')` enforces that only authenticated users with module access can reach these endpoints.
2. **Actor Extraction & Resilience**:
   - `req.user?.id` is reliably present from the validated JWT payload.
   - `req.user?.name` is not in the JWT payload; therefore, the controller passes `req.user` to the service, and the service uses a fallback database query to fetch `user.name` if absent, defaulting to `'Tutor Atuante'` if not found.
3. **DTO Whitelist Compatibility**:
   - Because `ValidationPipe({ whitelist: true })` strips unadorned fields, all DTO fields in `CreateIntervencaoDto` and `TransferirTutorDto` must be decorated with `class-validator` rules.
   - For optional fields like `canalContato`, validating against allowed enum strings while tolerating undefined/null/empty string ensures frontend select menus submit cleanly.
4. **Endpoint Semantics & HTTP Status Codes**:
   - NestJS `@Post()` handlers default to HTTP `201 Created`. For `POST /api/tutoria/kanban/:id/transferir`, the interface contract in `PROJECT.md` and E2E test assertions expect `200 OK`. Hence, explicit `@HttpCode(HttpStatus.OK)` is mandatory.
   - `POST /api/tutoria/intervencoes` adheres to standard REST resource creation: `201 Created`.
   - `GET /api/tutoria/aluno/:matricula/timeline` and `GET /api/tutoria/tutores` return `200 OK`.
5. **Hybrid Multi-Tutor Ownership Preservation in `updateKanbanCard`**:
   - In `apps/backend/src/tutoria/tutoria.service.ts:928-939`, the legacy code had `updates.push(sql'tutor_responsavel_id = ${tutorId}')`. This violated hybrid ownership.
   - In Milestone 2, `updateKanbanCard(id, dto, req.user)` preserves `tutor_responsavel_id`. It only updates status, notes, contact details, sets `ultima_intervencao_em = now()`, increments `qtd_intervencoes`, and appends an audit event to `tutoria_atendimentos_historico`.

---

## 3. Recommended Implementation Designs

### 3.1 DTO 1: `CreateIntervencaoDto`
File: `apps/backend/src/tutoria/dto/create-intervencao.dto.ts`

```typescript
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsIn,
  IsObject,
} from 'class-validator';
import type { TutoriaTipoEvento, TutoriaCanalContato } from '../../db/schema';

export const TUTORIA_TIPOS_EVENTO: TutoriaTipoEvento[] = [
  'abertura',
  'mudanca_status',
  'contato_enviado',
  'intervencao_manual',
  'passagem_bastao',
  'finalizacao',
  'reabertura',
];

export const TUTORIA_CANAIS_CONTATO: TutoriaCanalContato[] = [
  'whatsapp',
  'email',
  'telefone',
  'ava',
  'outro',
];

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

  @IsOptional()
  @IsString()
  @IsIn(TUTORIA_TIPOS_EVENTO, {
    message: `tipoEvento deve ser um dos seguintes valores: ${TUTORIA_TIPOS_EVENTO.join(', ')}`,
  })
  tipoEvento?: TutoriaTipoEvento = 'intervencao_manual';

  @IsOptional()
  @IsString()
  @IsIn(TUTORIA_CANAIS_CONTATO, {
    message: `canalContato deve ser um dos seguintes valores: ${TUTORIA_CANAIS_CONTATO.join(', ')}`,
  })
  canalContato?: TutoriaCanalContato;

  @IsNotEmpty({ message: 'Observações são obrigatórias para registrar intervenção.' })
  @IsString()
  observacoes: string;

  @IsOptional()
  @IsString()
  statusKanban?: string;

  @IsOptional()
  @IsObject({ message: 'metadata deve ser um objeto JSON válido.' })
  metadata?: Record<string, any>;
}
```

### 3.2 DTO 2: `TransferirTutorDto`
File: `apps/backend/src/tutoria/dto/transferir-tutor.dto.ts`

```typescript
import { IsNotEmpty, IsString } from 'class-validator';

export class TransferirTutorDto {
  @IsNotEmpty({ message: 'ID do novo tutor responsável é obrigatório.' })
  @IsString()
  novoTutorId: string;

  @IsNotEmpty({ message: 'A nota pedagógica de transição é obrigatória.' })
  @IsString()
  notaTransicao: string;
}
```

### 3.3 DTO Index / Exports
File: `apps/backend/src/tutoria/dto/index.ts` (or re-exported in `tutoria.service.ts`):
```typescript
export * from './engagement-filter.dto';
export * from './kanban-filter.dto';
export * from './create-kanban-card.dto';
export * from './update-kanban-card.dto';
export * from './create-intervencao.dto';
export * from './transferir-tutor.dto';
```

### 3.4 Controller Route Specifications (`apps/backend/src/tutoria/tutoria.controller.ts`)

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

  // ... (Summary, Engajamento, Disciplinas, Exportar, Aluno Lookup, Sync endpoints mantidos)

  // =========================================================================
  // F7: Lista de Tutores Ativos para Seleção no Baton Pass
  // =========================================================================
  @Get('tutores')
  async getActiveTutors() {
    return this.tutoriaService.getActiveTutors();
  }

  // =========================================================================
  // F6: Linha do Tempo Consolidada do Discente
  // =========================================================================
  @Get('aluno/:matricula/timeline')
  async getStudentTimeline(
    @Param('matricula') matricula: string,
    @Query('atendimentoId') atendimentoId?: string,
  ) {
    return this.tutoriaService.getStudentTimeline(matricula, atendimentoId);
  }

  // =========================================================================
  // F1, F2, F4: Registro de Intervenção Manual e Comunicação Multicanal
  // =========================================================================
  @Post('intervencoes')
  @HttpCode(HttpStatus.CREATED)
  async createIntervencao(@Body() dto: CreateIntervencaoDto, @Req() req: any) {
    return this.tutoriaService.createIntervencao(dto, req.user);
  }

  // =========================================================================
  // F1, F5: Passagem de Bastão (Transferência de Tutor Titular com Nota)
  // =========================================================================
  @Post('kanban/:id/transferir')
  @HttpCode(HttpStatus.OK)
  async transferirTutor(
    @Param('id') id: string,
    @Body() dto: TransferirTutorDto,
    @Req() req: any,
  ) {
    return this.tutoriaService.transferirTutor(id, dto, req.user);
  }

  // =========================================================================
  // Kanban de Atendimentos
  // =========================================================================
  @Get('kanban')
  async getKanbanCards(@Query() query: KanbanFilterDto) {
    return this.tutoriaService.getKanbanCards(query);
  }

  @Post('kanban')
  async createKanbanCard(@Body() dto: CreateKanbanCardDto, @Req() req: any) {
    return this.tutoriaService.createKanbanCard(dto, req.user?.id);
  }

  @Patch('kanban/:id')
  async updateKanbanCard(
    @Param('id') id: string,
    @Body() dto: UpdateKanbanCardDto,
    @Req() req: any,
  ) {
    return this.tutoriaService.updateKanbanCard(id, dto, req.user);
  }

  @Delete('kanban/:id')
  async deleteKanbanCard(@Param('id') id: string) {
    return this.tutoriaService.deleteKanbanCard(id);
  }
}
```

### 3.5 Exception and Error Mapping Table

| Endpoint | Condition | Exception | HTTP Status | Response Payload |
|---|---|---|---|---|
| Any `/api/tutoria/*` | Token absent or invalid | `UnauthorizedException` | 401 | `{ statusCode: 401, message: 'Unauthorized' }` |
| Any `/api/tutoria/*` | User lacks `tutoria` permission | `ForbiddenException` | 403 | `{ statusCode: 403, message: 'Acesso negado. Requer permissão em: tutoria.' }` |
| `POST /api/tutoria/intervencoes` | Empty `matricula` or `observacoes` | `BadRequestException` | 400 | `{ statusCode: 400, message: ['...'] }` |
| `POST /api/tutoria/intervencoes` | Invalid `tipoEvento` or `canalContato` | `BadRequestException` | 400 | `{ statusCode: 400, message: ['...'] }` |
| `POST /api/tutoria/kanban/:id/transferir` | Card `:id` not in DB | `NotFoundException` | 404 | `{ statusCode: 404, message: 'Cartão de atendimento ${id} não encontrado.' }` |
| `POST /api/tutoria/kanban/:id/transferir` | `novoTutorId` not in `users` | `NotFoundException` | 404 | `{ statusCode: 404, message: 'Novo tutor responsável não encontrado.' }` |
| `POST /api/tutoria/kanban/:id/transferir` | Card already owned by `novoTutorId` | `BadRequestException` | 400 | `{ statusCode: 400, message: 'O discente já está atribuído a este tutor.' }` |
| `POST /api/tutoria/kanban/:id/transferir` | Empty `notaTransicao` | `BadRequestException` | 400 | `{ statusCode: 400, message: ['A nota pedagógica de transição é obrigatória.'] }` |
| `GET /api/tutoria/aluno/:matricula/timeline` | Blank `matricula` | `BadRequestException` | 400 | `{ statusCode: 400, message: 'Matrícula inválida.' }` |

---

## 4. Caveats

1. **`autorNome` Fallback**: Since JWT access tokens generated by `AuthService.login()` do not bundle user `name`, `req.user?.name` will evaluate to `undefined` in standard requests. `TutoriaService` must query `users` or maintain an author cache.
2. **`metadata` Field Storage**: `tutoria_atendimentos_historico.metadata` is `text` in Postgres. Incoming `dto.metadata` (object) must be serialized via `JSON.stringify()` on insert, and parsed with `JSON.parse()` when querying the timeline so the frontend receives a JSON object.
3. **Empty String in Select Fields**: If HTML forms send `""` for optional `canalContato`, class-validator `@IsIn(...)` may reject empty strings unless sanitized. Using `@Transform(({ value }) => value === '' ? undefined : value)` prevents spurious 400 errors.
4. **Read-Only Investigation**: In accordance with the Teamwork Explorer protocol, no source files were modified during this investigation.

---

## 5. Conclusion

The controller routing and DTO design for Milestone 2 are cleanly aligned with NestJS architecture and the project's interface contracts:
- `CreateIntervencaoDto` and `TransferirTutorDto` provide comprehensive validation via `class-validator` under the global `whitelist: true` pipe.
- All 5 required endpoints (`POST intervencoes`, `POST kanban/:id/transferir`, `GET aluno/:matricula/timeline`, `GET tutores`, `PATCH kanban/:id`) have exact decorator, status code, and parameter signatures.
- Hybrid ownership rules are strictly preserved: collaborators can log interventions and move columns without overwriting `tutorResponsavelId`; baton passing requires explicit transfer with pedagogical justification.

---

## 6. Verification Method

To verify these designs independently once implemented by Worker:

```powershell
# 1. Typecheck the entire backend
npx tsc --noEmit -p apps/backend/tsconfig.json

# 2. Run backend unit tests for tutoria
npm run test --prefix apps/backend -- tutoria.service.spec.ts

# 3. Run the isolated multi-tutor E2E test suite (83 test cases)
npx jest --config apps/backend/test/jest-e2e.json tutoria-multitutor.e2e-spec.ts --runInBand --forceExit

# 4. Run ESLint to verify clean syntax and formatting
npx eslint -c apps/backend/eslint.config.mjs apps/backend/src/tutoria/tutoria.controller.ts apps/backend/src/tutoria/dto/
```
