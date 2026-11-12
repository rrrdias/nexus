# Scope: Milestone 1 (Backend Schema & Migrations)

## Architecture
- Sub-system: `apps/backend` Drizzle ORM schema and PostgreSQL migration / runtime bootstrap.
- Primary Data Model:
  - Table `tutoria_atendimentos_historico` (`tutoriaAtendimentosHistorico` in Drizzle):
    - `id`: UUID text primary key
    - `atendimentoId`: text nullable FK -> `tutoria_atendimentos_kanban.id` (onDelete cascade)
    - `matricula`: text not null
    - `periodo`: text not null
    - `sourceInstitution`: text not null default 'ead'
    - `tipoEvento`: text not null ('abertura', 'mudanca_status', 'contato_enviado', 'intervencao_manual', 'passagem_bastao', 'finalizacao', 'reabertura')
    - `autorId`: text nullable FK -> `users.id` (onDelete set null)
    - `autorNome`: text nullable
    - `tutorResponsavelAnteriorId`: text nullable FK -> `users.id` (onDelete set null)
    - `tutorResponsavelNovoId`: text nullable FK -> `users.id` (onDelete set null)
    - `estadoAnterior`: text nullable
    - `estadoNovo`: text nullable
    - `canalContato`: text nullable ('whatsapp', 'email', 'telefone', 'ava', 'outro')
    - `observacoes`: text nullable
    - `metadata`: text nullable (JSON string)
    - `createdAt`: timestamp not null defaultNow()
  - Columns added to `tutoria_atendimentos_kanban`:
    - `tutorIniciadorId`: text nullable FK -> `users.id` (onDelete set null)
    - `ultimaIntervencaoEm`: timestamp nullable
    - `qtdIntervencoes`: integer not null default 0
- Migration & Bootstrap:
  - `apps/backend/src/db/migrate-tutoria-multitutor.ts` using idempotent SQL (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`)
  - `package.json` script `"db:migrate-tutoria-multitutor": "tsx src/db/migrate-tutoria-multitutor.ts"`
  - `TutoriaService.onModuleInit()`: `ensureTimelineTable()` executes idempotent DDL at application boot.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 2 | F2: Trilha de Auditoria Schema Drizzle | Tabela `tutoria_atendimentos_historico` com FKs, índices e campos de auditoria | M1 | R2 |
| 14 | F14: Migrações Idempotentes e Boot | Script `migrate-tutoria-multitutor.ts` e hook `ensureTimelineTable()` | M1 | R2 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1.1 | Schema & Relation Definitions | `apps/backend/src/db/schema.ts` updates | none | DONE |
| M1.2 | Migration Script & Package Registration | `migrate-tutoria-multitutor.ts` & `package.json` | M1.1 | DONE |
| M1.3 | Runtime Bootstrap in TutoriaService | `ensureTimelineTable()` in `tutoria.service.ts` | M1.1 | DONE |
| M1.4 | Compilation & Verification | `npm run build` and `tsc --noEmit` in `apps/backend` | M1.1, M1.2, M1.3 | DONE |

## Interface Contracts
### Drizzle Schema Exports
- `tutoriaAtendimentosHistorico`
- `tutoriaAtendimentosHistoricoRelations`
- Updated `tutoriaAtendimentosKanban`
- Updated `tutoriaAtendimentosKanbanRelations`

## Code Layout
- `apps/backend/src/db/schema.ts` (owned by Worker for M1)
- `apps/backend/src/db/migrate-tutoria-multitutor.ts` (owned by Worker for M1)
- `apps/backend/package.json` (owned by Worker for M1)
- `apps/backend/src/tutoria/tutoria.service.ts` (owned by Worker for M1 - `ensureTimelineTable` addition only)
