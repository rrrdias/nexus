# Task Assignment: Explorer 1 (Drizzle Schema Specialist)

## Mission
Investigate `apps/backend/src/db/schema.ts` and related Drizzle schema files to prepare the exact implementation plan for:
1. `tutoriaAtendimentosHistorico` table definition with all required fields:
   - `id`: text primary key ($defaultFn(() => crypto.randomUUID()))
   - `atendimentoId`: text nullable foreign key referencing `tutoriaAtendimentosKanban.id` with onDelete 'cascade'
   - `matricula`: text not null
   - `periodo`: text not null
   - `sourceInstitution`: text not null default 'ead'
   - `tipoEvento`: text not null ('abertura', 'mudanca_status', 'contato_enviado', 'intervencao_manual', 'passagem_bastao', 'finalizacao', 'reabertura')
   - `autorId`: text nullable foreign key referencing `users.id` with onDelete 'set null'
   - `autorNome`: text nullable
   - `tutorResponsavelAnteriorId`: text nullable foreign key referencing `users.id` with onDelete 'set null'
   - `tutorResponsavelNovoId`: text nullable foreign key referencing `users.id` with onDelete 'set null'
   - `estadoAnterior`: text nullable
   - `estadoNovo`: text nullable
   - `canalContato`: text nullable ('whatsapp', 'email', 'telefone', 'ava', 'outro')
   - `observacoes`: text nullable
   - `metadata`: text nullable (JSON string)
   - `createdAt`: timestamp not null defaultNow()
2. Indexes for `tutoriaAtendimentosHistorico`:
   - `idx_tutoria_hist_atendimento` on `atendimentoId`
   - `idx_tutoria_hist_matricula` on `matricula`
   - `idx_tutoria_hist_created_at` on `createdAt`
   - `idx_tutoria_hist_tipo` on `tipoEvento`
   - `idx_tutoria_hist_autor` on `autorId`
3. Additional columns for `tutoriaAtendimentosKanban`:
   - `tutorIniciadorId`: text nullable foreign key referencing `users.id` with onDelete 'set null'
   - `ultimaIntervencaoEm`: timestamp nullable
   - `qtdIntervencoes`: integer not null default 0
4. Drizzle `relations()`:
   - `tutoriaAtendimentosHistoricoRelations` referencing `tutoriaAtendimentosKanban`, `users` (as autor, tutorAnterior, tutorNovo).
   - Update `tutoriaAtendimentosKanbanRelations` to include `historico: many(tutoriaAtendimentosHistorico)` and `tutorIniciador`.

## Authoritative Context Documents
- ORIGINAL_REQUEST: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\ORIGINAL_REQUEST.md`
- PROJECT_DEFINITION: `c:\Users\ricardo.dias\develop\projetos\nexus-core\PROJECT.md`
- MILESTONE_SCOPE: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\sub_orch_m1\SCOPE.md`

## Output Requirements
Write your investigation report and recommendations to `handoff.md` in your state folder:
`c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\explorer_m1_1\handoff.md`
Then send a completion message to the sub-orchestrator. Do NOT write any source code.


## 2026-11-10T20:30:48Z
Notification from ace68dba-ed41-44d1-855e-edda9d576e4a:
You are Explorer 1 (Drizzle Schema Specialist) for Milestone 1.
Read your full dispatch instructions at:
`c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\explorer_m1_1\DISPATCH.md`
