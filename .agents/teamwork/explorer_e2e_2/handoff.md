# Handoff Report: Comprehensive 4-Tier E2E Test Matrix (NexusHub Tutoria Multi-Tutor)

**Agent**: Explorer E2E 2 (E2E Test Case Designer & Test Matrix Architect)  
**State Folder**: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\explorer_e2e_2`  
**Working Directory**: `c:\Users\ricardo.dias\develop\projetos\nexus-core`  
**Date**: 2026-11-10T20:35:00Z  

---

## 1. Observation

### 1.1 Codebase & Schema Baseline Observations
1. **Accidental Ownership Overwrite in Baseline Code**:
   - In `apps/backend/src/tutoria/tutoria.service.ts:837-848`:
     ```typescript
     if (tutorId) {
       try {
         const u = await this.db.execute(
           sql`SELECT id FROM "user" WHERE id = ${tutorId} LIMIT 1;`,
         );
         if (u.length > 0) {
           updates.push(sql`tutor_responsavel_id = ${tutorId}`);
         }
       } catch {
         // Ignora se id de tutor inválido
       }
     }
     ```
     *Finding*: Whenever any authenticated tutor updates a Kanban card via `PATCH /api/tutoria/kanban/:id`, the card's `tutor_responsavel_id` is automatically overwritten with the acting tutor's ID. This violates the hybrid multi-tutor ownership model (ORIGINAL_REQUEST R1 and PROJECT.md).

2. **Database Schema for Attendance Cards & Audit Trail**:
   - In `apps/backend/src/db/schema.ts:763-805`, `tutoriaAtendimentosKanban` contains:
     - `id`: text UUID (PK)
     - `statusKanban`: text (`pendente`, `em_contato`, `aguardando_retorno`, `em_recuperacao`, `revertido`, `evadido`)
     - `tutorResponsavelId`: text FK to `user.id`
     - `canalContatoUtilizado`: text (`whatsapp`, `email`, `telefone`, `ava`, `outro`)
     - `ultimoContatoEm`: timestamp
     - `dataResolucao`: timestamp
   - In `PROJECT.md` and `SCOPE.md`, table `tutoria_atendimentos_historico` specifies the audit schema:
     - `id`: uuid (PK)
     - `atendimentoId`: uuid FK to `tutoria_atendimentos_kanban.id`
     - `matricula`: text
     - `periodo`: text
     - `tipoEvento`: text enum (`abertura`, `mudanca_status`, `contato_enviado`, `intervencao_manual`, `passagem_bastao`, `finalizacao`, `reabertura`)
     - `autorId`: uuid FK to `user.id`
     - `autorNome`: text (denormalized snapshot)
     - `tutorResponsavelAnteriorId`: uuid null
     - `tutorResponsavelNovoId`: uuid null
     - `estadoAnterior`: text null
     - `estadoNovo`: text null
     - `canalContato`: text null (`whatsapp`, `email`, `telefone`, `ava`, `outro`)
     - `observacoes`: text null
     - `metadata`: json null
     - `createdAt`: timestamp

3. **Backend API Endpoints Under Test**:
   - `GET /api/tutoria/aluno/:matricula/timeline?atendimentoId=...`
   - `POST /api/tutoria/intervencoes`
   - `POST /api/tutoria/kanban/:id/transferir`
   - `GET /api/tutoria/tutores`
   - `PATCH /api/tutoria/kanban/:id`

4. **Frontend Server Actions in `apps/frontend/src/app/actions/tutoria.ts`**:
   - `getTutoriaKanbanCards`, `createTutoriaKanbanCard`, `updateTutoriaKanbanCard`, `deleteTutoriaKanbanCard`, `getTutoriaTimeline`, `recordTutoriaIntervention`, `transferTutoriaOwnership`, `getActiveTutors`.

---

## 2. Logic Chain

1. **Premise 1**: The hybrid multi-tutor attendance model requires that attendance cards have a fixed primary tutor (`tutorResponsavelId`) that cannot be implicitly overridden by collaborators performing notes, channel outreach, or status changes.
2. **Premise 2**: Ownership can only change through an explicit baton pass (`POST /api/tutoria/kanban/:id/transferir`), which requires a valid new tutor ID and a mandatory pedagogical transition note.
3. **Premise 3**: Every action (creation, status move, communication outreach, manual intervention note, baton pass, resolution) must generate an immutable record in `tutoria_atendimentos_historico` capturing the acting author, event type, previous/new states, channels, and observations.
4. **Premise 4**: End-to-end quality demands a 4-Tier verification architecture:
   - **Tier 1 (Feature Coverage)**: Validates happy paths for all 8 features (F1 to F8) with >=5 test cases per feature (40 tests).
   - **Tier 2 (Boundary & Corner Cases)**: Validates edge limits, empty/whitespace notes, invalid UUIDs, unauthorized roles, and non-existent entities with >=5 test cases per feature (40 tests).
   - **Tier 3 (Cross-Feature Combinations)**: Validates pairwise and sequential interactions (collaborator interventions followed by status moves, baton passes followed by prior owner follow-ups, concurrent actions) (8 tests).
   - **Tier 4 (Real-World Pedagogical Workloads)**: Simulates end-to-end multi-tutor journeys (critical dropout recovery, shift handovers, joint multi-disciplinary interventions, term re-enrollments, and concurrency resilience) (5 tests).
5. **Inference**: A test catalog of 93 fully specified test cases provides complete, deterministic test coverage for implementation runners (Jest in backend and tsx in frontend).

---

## 3. Comprehensive 4-Tier Test Matrix

### 3.1 Tier 1: Feature Coverage (Category-Partition Happy Paths)
*Minimum 5 test cases per feature covering F1 through F8 (Total: 40 test cases).*

#### Feature F1: Modelo Híbrido Multi-Tutor (Primary Lead Retention & Collaboration)
| Test ID | Description | Input / Request | Expected HTTP | Expected State Mutation | Expected Audit Log Record |
|---|---|---|---|---|---|
| **TC-T1-F1-01** | Collaborator Tutor B updates notes on card owned by Tutor A | `PATCH /api/tutoria/kanban/:cardId`<br>Auth: Tutor B<br>Body: `{"observacoes": "Discente avisou que enviará atividade amanhã"}` | 200 OK | `card.tutorResponsavelId` remains `Tutor A`<br>`card.observacoes` updated | `tipoEvento: "intervencao_manual"`, `autorId: Tutor B`, `autorNome: "Tutor B"`, `observacoes: "Discente avisou..."` |
| **TC-T1-F1-02** | Collaborator Tutor C moves status on card owned by Tutor A | `PATCH /api/tutoria/kanban/:cardId`<br>Auth: Tutor C<br>Body: `{"statusKanban": "em_recuperacao"}` | 200 OK | `card.tutorResponsavelId` remains `Tutor A`<br>`card.statusKanban = "em_recuperacao"` | `tipoEvento: "mudanca_status"`, `autorId: Tutor C`, `estadoAnterior: "em_contato"`, `estadoNovo: "em_recuperacao"` |
| **TC-T1-F1-03** | Collaborator Tutor B logs WhatsApp outreach on card owned by Tutor A | `POST /api/tutoria/intervencoes`<br>Auth: Tutor B<br>Body: `{"matricula": "20240199", "tipoEvento": "contato_enviado", "canalContato": "whatsapp", "observacoes": "Mensagem padrão enviada"}` | 201 Created | `card.tutorResponsavelId` remains `Tutor A`<br>`card.ultimoContatoEm` updated to current time | `tipoEvento: "contato_enviado"`, `autorId: Tutor B`, `canalContato: "whatsapp"`, `observacoes: "Mensagem padrão enviada"` |
| **TC-T1-F1-04** | Creation of new attendance card with explicit primary lead tutor | `POST /api/tutoria/kanban`<br>Auth: Tutor A<br>Body: `{"matricula": "20240199", "periodo": "2026-2", "statusKanban": "pendente"}` | 201 Created | Card created with `tutorResponsavelId = Tutor A`<br>`statusKanban = "pendente"` | `tipoEvento: "abertura"`, `autorId: Tutor A`, `estadoNovo: "pendente"` |
| **TC-T1-F1-05** | Primary Lead Tutor A updates card notes directly | `PATCH /api/tutoria/kanban/:cardId`<br>Auth: Tutor A<br>Body: `{"observacoes": "Reunião pedagógica realizada"}` | 200 OK | `card.tutorResponsavelId` remains `Tutor A`<br>`card.observacoes` updated | `tipoEvento: "intervencao_manual"`, `autorId: Tutor A`, `autorNome: "Tutor A"` |

#### Feature F2: Trilha de Auditoria Schema (Audit Trail Persistence & Attributes)
| Test ID | Description | Input / Request | Expected HTTP | Expected State Mutation | Expected Audit Log Record |
|---|---|---|---|---|---|
| **TC-T1-F2-01** | Audit event persistence for card opening (`abertura`) | `POST /api/tutoria/kanban`<br>Auth: Tutor A<br>Body: `{"matricula": "20240101", "periodo": "2026-2"}` | 201 Created | Row inserted in `tutoria_atendimentos_kanban` | `tutoria_atendimentos_historico`: `tipoEvento: "abertura"`, `matricula: "20240101"`, `autorId: Tutor A`, `createdAt` populated |
| **TC-T1-F2-02** | Audit event persistence for status transition (`mudanca_status`) | `PATCH /api/tutoria/kanban/:cardId`<br>Auth: Tutor A<br>Body: `{"statusKanban": "em_contato"}` | 200 OK | `card.statusKanban = "em_contato"` | `tutoria_atendimentos_historico`: `tipoEvento: "mudanca_status"`, `estadoAnterior: "pendente"`, `estadoNovo: "em_contato"`, `autorId: Tutor A` |
| **TC-T1-F2-03** | Audit event persistence for communication sent (`contato_enviado`) | `POST /api/tutoria/intervencoes`<br>Auth: Tutor B<br>Body: `{"matricula": "20240101", "tipoEvento": "contato_enviado", "canalContato": "whatsapp", "observacoes": "Msg enviada", "metadata": {"template": "alerta_prazo"}}` | 201 Created | `card.ultimoContatoEm = now()` | `tutoria_atendimentos_historico`: `tipoEvento: "contato_enviado"`, `canalContato: "whatsapp"`, `metadata: {"template": "alerta_prazo"}` |
| **TC-T1-F2-04** | Audit event persistence for manual intervention note (`intervencao_manual`) | `POST /api/tutoria/intervencoes`<br>Auth: Tutor A<br>Body: `{"matricula": "20240101", "tipoEvento": "intervencao_manual", "observacoes": "Orientação de readequação de cronograma de estudos."}` | 201 Created | Card updated with latest intervention | `tutoria_atendimentos_historico`: `tipoEvento: "intervencao_manual"`, `observacoes: "Orientação de readequação..."`, `autorNome: "Tutor A"` |
| **TC-T1-F2-05** | Audit event persistence for card resolution/finalization (`finalizacao`) | `PATCH /api/tutoria/kanban/:cardId`<br>Auth: Tutor A<br>Body: `{"statusKanban": "revertido"}` | 200 OK | `card.statusKanban = "revertido"`, `card.dataResolucao = now()` | `tutoria_atendimentos_historico`: `tipoEvento: "finalizacao"` or `mudanca_status` with `estadoNovo: "revertido"` |

#### Feature F3: Auditoria de Mudanças Kanban (Kanban Column Transition Audit)
| Test ID | Description | Input / Request | Expected HTTP | Expected State Mutation | Expected Audit Log Record |
|---|---|---|---|---|---|
| **TC-T1-F3-01** | Transition card from `pendente` to `em_contato` | `PATCH /api/tutoria/kanban/:cardId`<br>Auth: Tutor B<br>Body: `{"statusKanban": "em_contato"}` | 200 OK | `card.statusKanban = "em_contato"` | `tipoEvento: "mudanca_status"`, `estadoAnterior: "pendente"`, `estadoNovo: "em_contato"`, `autorId: Tutor B` |
| **TC-T1-F3-02** | Transition card from `em_contato` to `em_recuperacao` | `PATCH /api/tutoria/kanban/:cardId`<br>Auth: Tutor A<br>Body: `{"statusKanban": "em_recuperacao"}` | 200 OK | `card.statusKanban = "em_recuperacao"` | `tipoEvento: "mudanca_status"`, `estadoAnterior: "em_contato"`, `estadoNovo: "em_recuperacao"`, `autorId: Tutor A` |
| **TC-T1-F3-03** | Transition card from `em_recuperacao` to `revertido` sets `dataResolucao` | `PATCH /api/tutoria/kanban/:cardId`<br>Auth: Tutor A<br>Body: `{"statusKanban": "revertido"}` | 200 OK | `card.statusKanban = "revertido"`, `card.dataResolucao` populated | `tipoEvento: "mudanca_status"`, `estadoAnterior: "em_recuperacao"`, `estadoNovo: "revertido"` |
| **TC-T1-F3-04** | Transition card from `em_recuperacao` to `evadido` sets terminal status | `PATCH /api/tutoria/kanban/:cardId`<br>Auth: Tutor A<br>Body: `{"statusKanban": "evadido"}` | 200 OK | `card.statusKanban = "evadido"` | `tipoEvento: "mudanca_status"`, `estadoAnterior: "em_recuperacao"`, `estadoNovo: "evadido"` |
| **TC-T1-F3-05** | Regress card from `aguardando_retorno` back to `em_contato` with explanation | `PATCH /api/tutoria/kanban/:cardId`<br>Auth: Tutor C<br>Body: `{"statusKanban": "em_contato", "observacoes": "Discente solicitou novo contato após as 18h"}` | 200 OK | `card.statusKanban = "em_contato"`, `card.observacoes` updated | `tipoEvento: "mudanca_status"`, `estadoAnterior: "aguardando_retorno"`, `estadoNovo: "em_contato"`, `observacoes: "Discente solicitou..."` |

#### Feature F4: Registro de Comunicação (Multi-Channel Outreach Logging)
| Test ID | Description | Input / Request | Expected HTTP | Expected State Mutation | Expected Audit Log Record |
|---|---|---|---|---|---|
| **TC-T1-F4-01** | Record WhatsApp communication via interventions endpoint | `POST /api/tutoria/intervencoes`<br>Auth: Tutor A<br>Body: `{"matricula": "20240199", "tipoEvento": "contato_enviado", "canalContato": "whatsapp", "observacoes": "Enviado alerta de prova final via WhatsApp."}` | 201 Created | Associated card `ultimoContatoEm` updated | `tipoEvento: "contato_enviado"`, `canalContato: "whatsapp"`, `observacoes: "Enviado alerta de prova final..."` |
| **TC-T1-F4-02** | Record Email communication with delivery metadata | `POST /api/tutoria/intervencoes`<br>Auth: Tutor B<br>Body: `{"matricula": "20240199", "tipoEvento": "contato_enviado", "canalContato": "email", "observacoes": "E-mail com lista de exercícios", "metadata": {"assunto": "Recuperação", "templateId": "tmpl-02"}}` | 201 Created | Associated card `ultimoContatoEm` updated | `tipoEvento: "contato_enviado"`, `canalContato: "email"`, `metadata.assunto: "Recuperação"` |
| **TC-T1-F4-03** | Record Phone call attempt and result | `POST /api/tutoria/intervencoes`<br>Auth: Tutor A<br>Body: `{"matricula": "20240199", "tipoEvento": "contato_enviado", "canalContato": "telefone", "observacoes": "Ligação atendida; discente explicou motivo de ausência."}` | 201 Created | Associated card `ultimoContatoEm` updated | `tipoEvento: "contato_enviado"`, `canalContato: "telefone"`, `observacoes: "Ligação atendida..."` |
| **TC-T1-F4-04** | Record AVA (LMS) internal message | `POST /api/tutoria/intervencoes`<br>Auth: Tutor C<br>Body: `{"matricula": "20240199", "tipoEvento": "contato_enviado", "canalContato": "ava", "observacoes": "Mensagem enviada no fórum de tutoria da disciplina."}` | 201 Created | Associated card `ultimoContatoEm` updated | `tipoEvento: "contato_enviado"`, `canalContato: "ava"` |
| **TC-T1-F4-05** | Update channel and contact timestamp via card PATCH | `PATCH /api/tutoria/kanban/:cardId`<br>Auth: Tutor A<br>Body: `{"canalContatoUtilizado": "whatsapp"}` | 200 OK | `card.canalContatoUtilizado = "whatsapp"`, `card.ultimoContatoEm = now()` | `tipoEvento: "contato_enviado"` or `intervencao_manual`, `canalContato: "whatsapp"` |

#### Feature F5: Passagem de Bastão (Baton Pass / Ownership Transfer)
| Test ID | Description | Input / Request | Expected HTTP | Expected State Mutation | Expected Audit Log Record |
|---|---|---|---|---|---|
| **TC-T1-F5-01** | Lead Tutor A transfers card to Tutor B with transition note | `POST /api/tutoria/kanban/:cardId/transferir`<br>Auth: Tutor A<br>Body: `{"novoTutorId": "UUID-TUTOR-B", "notaTransicao": "Transferindo discente para acompanhamento pedagógico avançado com Tutor B."}` | 200 OK | `card.tutorResponsavelId = "UUID-TUTOR-B"` | `tipoEvento: "passagem_bastao"`, `autorId: Tutor A`, `tutorResponsavelAnteriorId: Tutor A`, `tutorResponsavelNovoId: Tutor B`, `observacoes: "Transferindo..."` |
| **TC-T1-F5-02** | Administrator reassigns card from Tutor A to Tutor C | `POST /api/tutoria/kanban/:cardId/transferir`<br>Auth: Admin<br>Body: `{"novoTutorId": "UUID-TUTOR-C", "notaTransicao": "Rebalanceamento de carga horária entre polos."}` | 200 OK | `card.tutorResponsavelId = "UUID-TUTOR-C"` | `tipoEvento: "passagem_bastao"`, `autorId: Admin`, `tutorResponsavelAnteriorId: Tutor A`, `tutorResponsavelNovoId: Tutor C` |
| **TC-T1-F5-03** | Assign unassigned card (null tutor) to Tutor A | `POST /api/tutoria/kanban/:cardId/transferir`<br>Auth: Tutor A<br>Body: `{"novoTutorId": "UUID-TUTOR-A", "notaTransicao": "Assumindo titularidade do atendimento triado."}` | 200 OK | `card.tutorResponsavelId = "UUID-TUTOR-A"` | `tipoEvento: "passagem_bastao"`, `tutorResponsavelAnteriorId: null`, `tutorResponsavelNovoId: Tutor A` |
| **TC-T1-F5-04** | Baton pass with academic context in transition note | `POST /api/tutoria/kanban/:cardId/transferir`<br>Auth: Tutor B<br>Body: `{"novoTutorId": "UUID-TUTOR-C", "notaTransicao": "Discente perdeu prazo da AP1. Foco em orientar entrega da AP2 e simulado."}` | 200 OK | `card.tutorResponsavelId = "UUID-TUTOR-C"` | `tipoEvento: "passagem_bastao"`, `observacoes: "Discente perdeu prazo da AP1..."` |
| **TC-T1-F5-05** | Baton pass endpoint returns standardized response schema | `POST /api/tutoria/kanban/:cardId/transferir`<br>Auth: Tutor A<br>Body: `{"novoTutorId": "UUID-TUTOR-B", "notaTransicao": "Transição de turno vespertino para noturno."}` | 200 OK | Response JSON contains `{ "success": true, "card": { "id", "tutorResponsavelId" }, "evento": { "id", "tipoEvento": "passagem_bastao" } }` | Verified via response body assertion |

#### Feature F6: API de Linha do Tempo Consolidada (Consolidated Student Timeline)
| Test ID | Description | Input / Request | Expected HTTP | Expected State Mutation | Expected Audit Log Record |
|---|---|---|---|---|---|
| **TC-T1-F6-01** | Query full student timeline returns all chronological events | `GET /api/tutoria/aluno/20240199/timeline`<br>Auth: Tutor A | 200 OK | Read-only; array of events returned ordered chronologically (newest first or oldest first) | Every prior event (`abertura`, `contato_enviado`, `mudanca_status`, `passagem_bastao`) present in response array |
| **TC-T1-F6-02** | Query student timeline filtered by specific attendance ID | `GET /api/tutoria/aluno/20240199/timeline?atendimentoId=UUID-CARD-1`<br>Auth: Tutor A | 200 OK | Read-only; returns only events belonging to `UUID-CARD-1` | Events filtered strictly by `atendimentoId == "UUID-CARD-1"` |
| **TC-T1-F6-03** | Timeline reflects multiple distinct authors with names | `GET /api/tutoria/aluno/20240199/timeline`<br>Auth: Tutor A | 200 OK | Read-only | Array contains events with `autorNome: "Tutor A"`, `autorNome: "Tutor B"`, `autorNome: "Tutor C"` |
| **TC-T1-F6-04** | Query timeline for student with single `abertura` event | `GET /api/tutoria/aluno/20240105/timeline`<br>Auth: Tutor A | 200 OK | Read-only | Single item array containing `{ tipoEvento: "abertura", autorId: Tutor A }` |
| **TC-T1-F6-05** | Timeline payload includes denormalized snapshot attributes | `GET /api/tutoria/aluno/20240199/timeline`<br>Auth: Tutor A | 200 OK | Read-only | Each event object includes `id`, `atendimentoId`, `matricula`, `tipoEvento`, `autorNome`, `createdAt` |

#### Feature F7: API de Tutores Ativos (Active Tutors Roster API)
| Test ID | Description | Input / Request | Expected HTTP | Expected State Mutation | Expected Audit Log Record |
|---|---|---|---|---|---|
| **TC-T1-F7-01** | Authenticated tutor fetches list of active tutors | `GET /api/tutoria/tutores`<br>Auth: Tutor A (Role: tutor) | 200 OK | Read-only; returns array of active tutor objects | None (read-only query) |
| **TC-T1-F7-02** | Authenticated administrator fetches list of active tutors | `GET /api/tutoria/tutores`<br>Auth: Admin (Role: admin) | 200 OK | Read-only; returns array of active tutor objects | None (read-only query) |
| **TC-T1-F7-03** | Active tutors contract returns required fields: id, name, email | `GET /api/tutoria/tutores`<br>Auth: Tutor A | 200 OK | Read-only | Array items conform to `{ id: string, name: string, email: string }` |
| **TC-T1-F7-04** | Active tutors list filters out inactive/disabled accounts | `GET /api/tutoria/tutores`<br>Auth: Tutor A | 200 OK | Read-only | Inactive tutor accounts (`isActive: false`) are excluded from response array |
| **TC-T1-F7-05** | Active tutors list sorted alphabetically by name | `GET /api/tutoria/tutores`<br>Auth: Tutor A | 200 OK | Read-only | Names returned in ascending alphabetical order for UI dropdown consumption |

#### Feature F8: Validação de Ações Frontend (Frontend Server Actions & Validation)
| Test ID | Description | Input / Request | Expected HTTP / Return | Expected State Mutation | Expected Audit Log Record |
|---|---|---|---|---|---|
| **TC-T1-F8-01** | Server action `getTutoriaTimeline` parses and returns backend timeline | Invocation: `getTutoriaTimeline("20240199")`<br>Session: Tutor A | Returns `{ success: true, data: [...] }` | Read-only frontend action | Backend API called; events mapped to UI format |
| **TC-T1-F8-02** | Server action `recordTutoriaIntervention` submits valid payload | Invocation: `recordTutoriaIntervention({ matricula: "20240199", tipoEvento: "intervencao_manual", observacoes: "Orientação realizada" })` | Returns `{ success: true, data: event }` | Backend event created | Audit event persisted via backend POST |
| **TC-T1-F8-03** | Server action `transferTutoriaOwnership` executes baton pass | Invocation: `transferTutoriaOwnership("UUID-CARD-1", "UUID-TUTOR-B", "Nota de transição")` | Returns `{ success: true, card, evento }` | Card owner updated in backend | Audit event `passagem_bastao` created |
| **TC-T1-F8-04** | Server action `getActiveTutors` returns tutor list | Invocation: `getActiveTutors()` | Returns `{ success: true, data: Tutor[] }` | Read-only frontend action | Tutors list available for `BatonPassDialog` |
| **TC-T1-F8-05** | Server action `updateTutoriaKanbanCard` preserves collaborator token | Invocation: `updateTutoriaKanbanCard("UUID-CARD-1", { statusKanban: "em_contato" })` | Returns `{ success: true, message: "..." }` | Backend card status updated | Backend audit event created with collaborator session |

---

### 3.2 Tier 2: Boundary & Corner Cases (Boundary Value Analysis)
*Minimum 5 test cases per feature covering F1 through F8 (Total: 40 test cases).*

#### Feature F1: Modelo Híbrido Multi-Tutor (Boundary & Corner Cases)
| Test ID | Description | Input / Request | Expected HTTP | Expected State Mutation | Expected Audit Log Record |
|---|---|---|---|---|---|
| **TC-T2-F1-01** | Collaborator attempts to inject `tutorResponsavelId` in PATCH payload | `PATCH /api/tutoria/kanban/:cardId`<br>Auth: Tutor B<br>Body: `{"statusKanban": "em_recuperacao", "tutorResponsavelId": "UUID-TUTOR-B"}` | 200 OK | Card `tutorResponsavelId` remains `Tutor A` (unauthorized overwrite stripped/ignored) | `tipoEvento: "mudanca_status"`, `autorId: Tutor B`, `tutorResponsavelAnteriorId: Tutor A`, `tutorResponsavelNovoId: Tutor A` |
| **TC-T2-F1-02** | Unauthenticated user attempts to update card | `PATCH /api/tutoria/kanban/:cardId`<br>No Authorization header | 401 Unauthorized | No state mutation | No audit event generated |
| **TC-T2-F1-03** | User with unrelated role (e.g., student or unprivileged user) attempts update | `PATCH /api/tutoria/kanban/:cardId`<br>Auth: Student Token (no tutoria module permission) | 403 Forbidden | No state mutation | No audit event generated |
| **TC-T2-F1-04** | Collaborator updates card that currently has `tutorResponsavelId = null` | `PATCH /api/tutoria/kanban/:cardId`<br>Auth: Tutor B<br>Body: `{"observacoes": "Primeira análise"}` | 200 OK | `card.tutorResponsavelId` remains `null` (only explicit transfer assigns ownership) | `tipoEvento: "intervencao_manual"`, `autorId: Tutor B` |
| **TC-T2-F1-05** | Collaborator attempts update on non-existent card UUID | `PATCH /api/tutoria/kanban/00000000-0000-0000-0000-000000000000`<br>Auth: Tutor B<br>Body: `{"statusKanban": "em_contato"}` | 404 Not Found | No state mutation (`Cartão de atendimento ... não encontrado`) | No audit event generated |

#### Feature F2: Trilha de Auditoria Schema (Boundary & Corner Cases)
| Test ID | Description | Input / Request | Expected HTTP | Expected State Mutation | Expected Audit Log Record |
|---|---|---|---|---|---|
| **TC-T2-F2-01** | Insert audit event with invalid `tipoEvento` enum value | `POST /api/tutoria/intervencoes`<br>Auth: Tutor A<br>Body: `{"matricula": "20240199", "tipoEvento": "evento_invalido_xyz", "observacoes": "Teste"}` | 400 Bad Request | No state mutation (DTO validation rejected) | No audit event generated |
| **TC-T2-F2-02** | Audit event with maximum length pedagogical note (boundary: 5,000 chars) | `POST /api/tutoria/intervencoes`<br>Auth: Tutor A<br>Body: `{"matricula": "20240199", "tipoEvento": "intervencao_manual", "observacoes": "A".repeat(5000)}` | 201 Created | Card updated | `tutoria_atendimentos_historico` stores complete 5,000 char note without truncation |
| **TC-T2-F2-03** | Audit event with all optional fields explicitly set to `null` | `POST /api/tutoria/intervencoes`<br>Auth: Tutor A<br>Body: `{"matricula": "20240199", "tipoEvento": "intervencao_manual", "canalContato": null, "metadata": null, "observacoes": "Nota mínima"}` | 201 Created | Card updated | Event stored cleanly with `canalContato: null`, `metadata: null` |
| **TC-T2-F2-04** | Audit event with deeply nested JSON in `metadata` field | `POST /api/tutoria/intervencoes`<br>Auth: Tutor A<br>Body: `{"matricula": "20240199", "tipoEvento": "intervencao_manual", "observacoes": "Nota", "metadata": {"lms": {"courseId": 123, "attempts": [1, 2, 3], "scores": {"ap1": 8.5}}}}` | 201 Created | Card updated | Event stored with full JSON metadata preserved and deserialized as object |
| **TC-T2-F2-05** | Audit event creation with empty/whitespace `matricula` | `POST /api/tutoria/intervencoes`<br>Auth: Tutor A<br>Body: `{"matricula": "   ", "tipoEvento": "intervencao_manual", "observacoes": "Nota"}` | 400 Bad Request | No state mutation | No audit event generated |

#### Feature F3: Auditoria de Mudanças Kanban (Boundary & Corner Cases)
| Test ID | Description | Input / Request | Expected HTTP | Expected State Mutation | Expected Audit Log Record |
|---|---|---|---|---|---|
| **TC-T2-F3-01** | Transition card to unsupported/invalid Kanban status | `PATCH /api/tutoria/kanban/:cardId`<br>Auth: Tutor A<br>Body: `{"statusKanban": "status_inexistente"}` | 400 Bad Request | No state mutation | No audit event generated |
| **TC-T2-F3-02** | Idempotent transition: update card with same existing status | `PATCH /api/tutoria/kanban/:cardId`<br>Auth: Tutor A<br>Body: `{"statusKanban": "pendente"}` (already in `pendente`) | 200 OK | Card status unchanged (`pendente`) | No redundant `mudanca_status` audit event logged |
| **TC-T2-F3-03** | Update card status with empty string note (`observacoes: ""`) | `PATCH /api/tutoria/kanban/:cardId`<br>Auth: Tutor A<br>Body: `{"statusKanban": "em_contato", "observacoes": ""}` | 200 OK | Card status updated to `em_contato` | `tipoEvento: "mudanca_status"`, `observacoes: null` or `""` (no crash) |
| **TC-T2-F3-04** | Acting user token has missing/null `name` attribute | `PATCH /api/tutoria/kanban/:cardId`<br>Auth: Token with `{ id: "...", name: null }`<br>Body: `{"statusKanban": "em_recuperacao"}` | 200 OK | Card status updated | Event saved with fallback `autorNome: "Tutor"` or email, avoiding null crash |
| **TC-T2-F3-05** | Update card with whitespace-only notes (`observacoes: "   "`) | `PATCH /api/tutoria/kanban/:cardId`<br>Auth: Tutor A<br>Body: `{"statusKanban": "em_contato", "observacoes": "   \n\t  "}` | 200 OK | Card status updated | `tipoEvento: "mudanca_status"`, notes trimmed cleanly |

#### Feature F4: Registro de Comunicação (Boundary & Corner Cases)
| Test ID | Description | Input / Request | Expected HTTP | Expected State Mutation | Expected Audit Log Record |
|---|---|---|---|---|---|
| **TC-T2-F4-01** | Communication record with invalid/unsupported channel | `POST /api/tutoria/intervencoes`<br>Auth: Tutor A<br>Body: `{"matricula": "20240199", "tipoEvento": "contato_enviado", "canalContato": "pombo_correio", "observacoes": "Msg"}` | 400 Bad Request | No state mutation | No audit event generated |
| **TC-T2-F4-02** | Communication record with empty `observacoes` string | `POST /api/tutoria/intervencoes`<br>Auth: Tutor A<br>Body: `{"matricula": "20240199", "tipoEvento": "contato_enviado", "canalContato": "whatsapp", "observacoes": ""}` | 400 Bad Request | No state mutation (`observacoes` is mandatory) | No audit event generated |
| **TC-T2-F4-03** | Communication record with whitespace-only `observacoes` | `POST /api/tutoria/intervencoes`<br>Auth: Tutor A<br>Body: `{"matricula": "20240199", "tipoEvento": "contato_enviado", "canalContato": "whatsapp", "observacoes": "     "}` | 400 Bad Request | No state mutation | No audit event generated |
| **TC-T2-F4-04** | Communication record for student matricula with leading/trailing spaces | `POST /api/tutoria/intervencoes`<br>Auth: Tutor A<br>Body: `{"matricula": "  20240199  ", "tipoEvento": "contato_enviado", "canalContato": "email", "observacoes": "E-mail de boas-vindas"}` | 201 Created | Card for trimmed matricula updated | Event recorded with trimmed `matricula: "20240199"` |
| **TC-T2-F4-05** | Communication record with missing `tipoEvento` | `POST /api/tutoria/intervencoes`<br>Auth: Tutor A<br>Body: `{"matricula": "20240199", "canalContato": "whatsapp", "observacoes": "Texto sem tipo"}` | 400 Bad Request | No state mutation | No audit event generated |

#### Feature F5: Passagem de Bastão (Boundary & Corner Cases)
| Test ID | Description | Input / Request | Expected HTTP | Expected State Mutation | Expected Audit Log Record |
|---|---|---|---|---|---|
| **TC-T2-F5-01** | Baton pass targeting a non-existent `novoTutorId` (random UUID) | `POST /api/tutoria/kanban/:cardId/transferir`<br>Auth: Tutor A<br>Body: `{"novoTutorId": "00000000-0000-0000-0000-000000000000", "notaTransicao": "Tentativa para tutor inexistente"}` | 404 Not Found or 400 Bad Request | Card `tutorResponsavelId` unchanged | No audit event generated |
| **TC-T2-F5-02** | Baton pass with malformed `novoTutorId` (not a valid UUID string) | `POST /api/tutoria/kanban/:cardId/transferir`<br>Auth: Tutor A<br>Body: `{"novoTutorId": "tutor-123-not-uuid", "notaTransicao": "Tentativa UUID inválido"}` | 400 Bad Request | Card `tutorResponsavelId` unchanged | No audit event generated |
| **TC-T2-F5-03** | Baton pass with empty `notaTransicao` (`""`) | `POST /api/tutoria/kanban/:cardId/transferir`<br>Auth: Tutor A<br>Body: `{"novoTutorId": "UUID-TUTOR-B", "notaTransicao": ""}` | 400 Bad Request | Card `tutorResponsavelId` unchanged (`A nota de transição é obrigatória`) | No audit event generated |
| **TC-T2-F5-04** | Baton pass with whitespace-only `notaTransicao` (`"    "`) | `POST /api/tutoria/kanban/:cardId/transferir`<br>Auth: Tutor A<br>Body: `{"novoTutorId": "UUID-TUTOR-B", "notaTransicao": "   \t\n   "}` | 400 Bad Request | Card `tutorResponsavelId` unchanged | No audit event generated |
| **TC-T2-F5-05** | Baton pass targeting the CURRENT primary tutor (`novoTutorId == card.tutorResponsavelId`) | `POST /api/tutoria/kanban/:cardId/transferir`<br>Auth: Tutor A<br>Body: `{"novoTutorId": "UUID-TUTOR-A", "notaTransicao": "Transferindo para mim mesmo"}` | 400 Bad Request | Card `tutorResponsavelId` unchanged (`O discente já está atribuído a este tutor`) | No audit event generated |

#### Feature F6: API de Linha do Tempo Consolidada (Boundary & Corner Cases)
| Test ID | Description | Input / Request | Expected HTTP | Expected State Mutation | Expected Audit Log Record |
|---|---|---|---|---|---|
| **TC-T2-F6-01** | Query timeline for non-existent matricula (no student or events) | `GET /api/tutoria/aluno/99999999/timeline`<br>Auth: Tutor A | 200 OK | Read-only | Returns empty array `[]` (graceful empty state, not 500) |
| **TC-T2-F6-02** | Query timeline with SQL injection attempt in matricula parameter | `GET /api/tutoria/aluno/'%20OR%20'1'='1/timeline`<br>Auth: Tutor A | 200 OK or 400 Bad Request | Read-only; parameterized SQL prevents injection | Returns empty array `[]` |
| **TC-T2-F6-03** | Query timeline with non-existent `atendimentoId` query param | `GET /api/tutoria/aluno/20240199/timeline?atendimentoId=00000000-0000-0000-0000-000000000000`<br>Auth: Tutor A | 200 OK | Read-only | Returns empty array `[]` |
| **TC-T2-F6-04** | Query timeline with malformed UUID for `atendimentoId` | `GET /api/tutoria/aluno/20240199/timeline?atendimentoId=malformed-uuid`<br>Auth: Tutor A | 400 Bad Request | Read-only | None |
| **TC-T2-F6-05** | Unauthenticated request to timeline endpoint | `GET /api/tutoria/aluno/20240199/timeline`<br>No Authorization header | 401 Unauthorized | Read-only | None |

#### Feature F7: API de Tutores Ativos (Boundary & Corner Cases)
| Test ID | Description | Input / Request | Expected HTTP | Expected State Mutation | Expected Audit Log Record |
|---|---|---|---|---|---|
| **TC-T2-F7-01** | Unauthenticated call to `GET /api/tutoria/tutores` | `GET /api/tutoria/tutores`<br>No Authorization header | 401 Unauthorized | Read-only | None |
| **TC-T2-F7-02** | Call by user role without tutoria permission | `GET /api/tutoria/tutores`<br>Auth: Student Token | 403 Forbidden | Read-only | None |
| **TC-T2-F7-03** | Database returns zero active tutors (edge condition) | `GET /api/tutoria/tutores`<br>Auth: Tutor A (isolated mock DB with 0 tutors) | 200 OK | Read-only | Returns empty array `[]` without throwing exception |
| **TC-T2-F7-04** | Active tutor record has null or missing email | `GET /api/tutoria/tutores`<br>Auth: Tutor A | 200 OK | Read-only | Array items handle null email gracefully: `{ id: "...", name: "Tutor Sem Email", email: "" }` |
| **TC-T2-F7-05** | Active tutor record contains special characters/accents in name | `GET /api/tutoria/tutores`<br>Auth: Tutor A | 200 OK | Read-only | Returns correctly UTF-8 encoded names (e.g. "Cláudia Mendonça", "João Álvares") |

#### Feature F8: Validação de Ações Frontend (Boundary & Corner Cases)
| Test ID | Description | Input / Request | Expected Return | Expected State Mutation | Expected Audit Log Record |
|---|---|---|---|---|---|
| **TC-T2-F8-01** | `recordTutoriaIntervention` called with missing `observacoes` | Action: `recordTutoriaIntervention({ matricula: "20240199", tipoEvento: "intervencao_manual", observacoes: "" })` | Returns `{ success: false, error: "Observações obrigatórias" }` | Rejection on frontend validation layer before API call | No backend call |
| **TC-T2-F8-02** | `transferTutoriaOwnership` called with whitespace `notaTransicao` | Action: `transferTutoriaOwnership("UUID-CARD", "UUID-TUTOR", "   ")` | Returns `{ success: false, error: "Nota de transição é obrigatória" }` | Rejected before API call | No backend call |
| **TC-T2-F8-03** | `getTutoriaTimeline` handles backend 500 Internal Server Error | Action: `getTutoriaTimeline("20240199")`<br>(Backend mocked to return 500) | Returns `{ success: false, data: [], error: "Erro ao buscar linha do tempo" }` | No client unhandled exception; UI renders fallback | None |
| **TC-T2-F8-04** | `updateTutoriaKanbanCard` handles non-existent card ID (404) | Action: `updateTutoriaKanbanCard("invalid-id", { statusKanban: "em_contato" })` | Returns `{ success: false, error: "Cartão de atendimento invalid-id não encontrado." }` | Graceful error response | None |
| **TC-T2-F8-05** | `getActiveTutors` handles network timeout/fetch failure | Action: `getActiveTutors()`<br>(Backend simulated timeout) | Returns `{ success: false, data: [], error: "Timeout" }` | Safe fallback preventing UI crash | None |

---

### 3.3 Tier 3: Cross-Feature Interactions & Combinations (Pairwise & Sequential Flows)

| Test ID | Name & Features Involved | Test Flow & Sequential Actions | Invariants & Assertions |
|---|---|---|---|
| **TC-T3-INT-01** | **Intervention by Collaborator followed by Status Move by Lead Tutor**<br>(F1 + F2 + F3 + F4) | 1. Tutor A (lead) creates card in `pendente`.<br>2. Tutor B (collaborator) logs WhatsApp outreach note via `POST /api/tutoria/intervencoes`.<br>3. Tutor A moves card to `em_contato` via `PATCH /api/tutoria/kanban/:id`. | - `card.tutorResponsavelId` stays `Tutor A` through both actions.<br>- Timeline displays 3 events in order: `abertura` (Tutor A), `contato_enviado` (Tutor B), `mudanca_status` (Tutor A).<br>- `card.ultimoContatoEm` reflects Tutor B's timestamp. |
| **TC-T3-INT-02** | **Status Move by Collaborator followed by Baton Pass to Collaborator**<br>(F1 + F3 + F5 + F6) | 1. Tutor A owns card in `em_contato`.<br>2. Tutor B moves card to `em_recuperacao`.<br>3. Tutor A executes baton pass transferring card to Tutor B with note: "Você assume o plano de estudos". | - Step 2: `card.tutorResponsavelId` remains `Tutor A`; audit event logs Tutor B as actor.<br>- Step 3: `card.tutorResponsavelId` mutates to `Tutor B`.<br>- Audit event records `tutorResponsavelAnteriorId: Tutor A`, `tutorResponsavelNovoId: Tutor B`. |
| **TC-T3-INT-03** | **Baton Pass followed by Intervention from Prior Lead Tutor**<br>(F1 + F4 + F5 + F6) | 1. Tutor A transfers card to Tutor B.<br>2. Two days later, former lead Tutor A contacts student and logs phone outreach note via `POST /api/tutoria/intervencoes`. | - Step 1: `card.tutorResponsavelId` becomes `Tutor B`.<br>- Step 2: `card.tutorResponsavelId` remains `Tutor B` (Tutor A does NOT steal ownership back).<br>- Timeline shows `passagem_bastao` followed by `contato_enviado` authored by Tutor A. |
| **TC-T3-INT-04** | **Rapid Successive Status Moves by Multiple Collaborators**<br>(F1 + F3 + F6) | 1. Tutor A owns card.<br>2. Tutor B moves `pendente` -> `em_contato`.<br>3. Tutor C moves `em_contato` -> `aguardando_retorno`.<br>4. Tutor D moves `aguardando_retorno` -> `em_recuperacao`. | - `card.tutorResponsavelId` remains `Tutor A` throughout all moves.<br>- Card final `statusKanban` is `em_recuperacao`.<br>- Timeline contains all 3 transition events with respective authors Tutor B, Tutor C, and Tutor D. |
| **TC-T3-INT-05** | **Chained Multi-Hop Baton Pass (Tutor A -> Tutor B -> Tutor C)**<br>(F5 + F6 + F7) | 1. Tutor A transfers card to Tutor B with note N1.<br>2. Tutor B transfers card to Tutor C with note N2. | - Card final `tutorResponsavelId` is `Tutor C`.<br>- Event 1: `tutorResponsavelAnteriorId: Tutor A`, `tutorResponsavelNovoId: Tutor B`, `observacoes: N1`.<br>- Event 2: `tutorResponsavelAnteriorId: Tutor B`, `tutorResponsavelNovoId: Tutor C`, `observacoes: N2`. |
| **TC-T3-INT-06** | **Resolution (`revertido`) with Multi-Channel History**<br>(F2 + F3 + F4 + F6) | 1. Card has history: WhatsApp contact by Tutor B, Email by Tutor C, Phone call by Tutor A.<br>2. Tutor A sets status to `revertido`. | - Card `dataResolucao` populated with timestamp.<br>- Timeline query returns all 4 events; verified that resolution event marks successful recovery following multi-channel touches. |
| **TC-T3-INT-07** | **Intervention Logging with Simultaneous Status Update in Single Payload**<br>(F3 + F4 + F6) | 1. Tutor B calls `POST /api/tutoria/intervencoes` with body containing both `observacoes: "Acordo de entrega"` AND `statusKanban: "em_recuperacao"`. | - Card status updated to `em_recuperacao`.<br>- `card.tutorResponsavelId` remains unchanged.<br>- Timeline logs intervention and status transition accurately linked to Tutor B. |
| **TC-T3-INT-08** | **Timeline Query Scoping: Global Student vs Attendance Card Specific**<br>(F2 + F6) | 1. Discente has 2 attendances: Card 1 (Period 2026-1, resolved) with 3 events, and Card 2 (Period 2026-2, active) with 2 events.<br>2. Query `GET /api/tutoria/aluno/:matricula/timeline`.<br>3. Query `GET /api/tutoria/aluno/:matricula/timeline?atendimentoId=UUID-CARD-2`. | - Query 2 returns 5 events total across the student's entire history.<br>- Query 3 returns strictly the 2 events belonging to `UUID-CARD-2`. |

---

### 3.4 Tier 4: Real-World Multi-Tutor Workload Scenarios (Realistic Pedagogical Flows)

#### Scenario TC-T4-SCN-01: Critical Dropout Prevention Outreach Journey (Resgate de Discente Crítico)
- **Pedagogical Narrative**:
  Student "Mariana Silva" (matricula `20240188`) has 35 days without LMS access, triggering critical risk. Tutor A (primary lead tutor) initiates an attendance card in `pendente`. The night shift tutor (Tutor B) reviews pending alerts, sends an urgent WhatsApp outreach message, and updates the card to `em_contato`. Mariana replies on WhatsApp citing work schedule conflicts. Tutor B logs Mariana's response notes. The following morning, Lead Tutor A coordinates with the course professor for an activity extension and records a structured pedagogical intervention plan. Mariana submits her pending AP1 activity, and Tutor A transitions the card to `revertido`.
- **E2E Step Execution Sequence**:
  1. `POST /api/tutoria/kanban` (Auth: Tutor A) -> Creates card with `tutorResponsavelId = Tutor A`, `statusKanban = "pendente"`. Generates `abertura` event.
  2. `POST /api/tutoria/intervencoes` (Auth: Tutor B) -> Body: `{ matricula: "20240188", tipoEvento: "contato_enviado", canalContato: "whatsapp", observacoes: "Olá Mariana, notamos que você não acessou a disciplina nos últimos 30 dias. Podemos ajudar?", statusKanban: "em_contato" }`. Card moves to `em_contato`; `tutorResponsavelId` remains Tutor A.
  3. `POST /api/tutoria/intervencoes` (Auth: Tutor B) -> Body: `{ matricula: "20240188", tipoEvento: "intervencao_manual", canalContato: "whatsapp", observacoes: "Mariana respondeu via WhatsApp informando turno de trabalho dobrado. Solicitou extensão de prazo para envio da AP1." }`.
  4. `POST /api/tutoria/intervencoes` (Auth: Tutor A) -> Body: `{ matricula: "20240188", tipoEvento: "intervencao_manual", canalContato: "ava", observacoes: "Alinhado com prof. da disciplina: prazo prorrogado até domingo às 23h59. Enviado link da atividade.", statusKanban: "em_recuperacao" }`.
  5. `PATCH /api/tutoria/kanban/:cardId` (Auth: Tutor A) -> Body: `{ statusKanban: "revertido", observacoes: "Discente enviou a AP1 com nota 8.0. Atendimento concluído com sucesso." }`.
- **Expected Invariants**:
  - `card.tutorResponsavelId` is `Tutor A` from start to finish.
  - `card.statusKanban` is `revertido`; `card.dataResolucao` is non-null.
  - `GET /api/tutoria/aluno/20240188/timeline` returns 5 chronological events with alternating author identities (`Tutor A` -> `Tutor B` -> `Tutor B` -> `Tutor A` -> `Tutor A`).

#### Scenario TC-T4-SCN-02: Shift Handover and Baton Pass (Passagem de Bastão entre Turnos)
- **Pedagogical Narrative**:
  Tutor A (daytime shift) is managing student "Lucas Mendes" who is scheduled to take a critical recovery exam at 20:00. Tutor A must transfer case ownership to Tutor B (evening shift) before clocking out at 18:00.
- **E2E Step Execution Sequence**:
  1. Tutor A fetches available tutors: `GET /api/tutoria/tutores` -> Verifies Tutor B is active.
  2. Tutor A transfers ownership: `POST /api/tutoria/kanban/:cardId/transferir` (Auth: Tutor A) with `{ novoTutorId: "UUID-TUTOR-B", notaTransicao: "Discente fará prova de recuperação às 20h. Confirmar recebimento do arquivo no AVA e verificar se precisa de auxílio com o upload." }`.
  3. Assertion: `card.tutorResponsavelId` changes to `UUID-TUTOR-B`. Audit log records `passagem_bastao` with Tutor A as author.
  4. At 20:30, Tutor B logs in and records intervention: `POST /api/tutoria/intervencoes` (Auth: Tutor B) with `{ matricula: "20240212", tipoEvento: "intervencao_manual", canalContato: "ava", observacoes: "Prova enviada com sucesso no AVA às 20h25. Confirmação emitida para o aluno." }`.
  5. Tutor B updates card: `PATCH /api/tutoria/kanban/:cardId` (Auth: Tutor B) with `{ statusKanban: "revertido" }`.
- **Expected Invariants**:
  - `card.tutorResponsavelId` permanently transferred to `Tutor B`.
  - Timeline highlights the transition note in the `passagem_bastao` event card.
  - Post-transfer actions by Tutor B operate as the new primary lead tutor.

#### Scenario TC-T4-SCN-03: Collaborative Multi-Disciplinary Recovery (Tutor Pedagógico + Mentor Técnico)
- **Pedagogical Narrative**:
  Student "Felipe Rocha" is enrolled in Computer Science and failing Data Structures due to both conceptual algorithm difficulties and study organization problems. Lead Tutor A (pedagogical counselor) handles attendance ownership, while Tutor C (technical lab mentor) provides coding assistance.
- **E2E Step Execution Sequence**:
  1. Tutor A creates card in `em_contato`.
  2. Tutor C reviews student code submissions and logs technical guidance note: `POST /api/tutoria/intervencoes` (Auth: Tutor C) with `{ tipoEvento: "intervencao_manual", canalContato: "ava", observacoes: "Realizada mentoria técnica assíncrona: corrigido ponteiro nulo no exercício de Árvore Binária. Código agora compila sem erros." }`.
  3. Tutor A conducts 1-on-1 study planning phone call: `POST /api/tutoria/intervencoes` (Auth: Tutor A) with `{ tipoEvento: "contato_enviado", canalContato: "telefone", observacoes: "Elaborado cronograma de estudos diário de 1h30 para as semanas de prova." }`.
  4. Tutor C updates card status to `em_recuperacao`: `PATCH /api/tutoria/kanban/:cardId` (Auth: Tutor C) with `{ statusKanban: "em_recuperacao" }`.
- **Expected Invariants**:
  - Neither of Tutor C's actions overwrites `card.tutorResponsavelId` (remains Tutor A).
  - Timeline displays collaborative participation of both tutors clearly distinguished by author badges.

#### Scenario TC-T4-SCN-04: Term Re-Enrollment and Reopening of Evaded Case (Reabertura Pós-Evasão)
- **Pedagogical Narrative**:
  Student "Ana Paula" was marked as `evadido` in academic period 2026-1 under former Tutor X. In 2026-2, Ana Paula re-enrolls. New Tutor D identifies the inactive attendance and reopens the case.
- **E2E Step Execution Sequence**:
  1. Historic state: Card exists with `statusKanban = "evadido"`, `tutorResponsavelId = Tutor X`, with historical events from period 2026-1.
  2. Tutor D reopens attendance: `PATCH /api/tutoria/kanban/:cardId` (Auth: Tutor D) with `{ statusKanban: "em_contato", observacoes: "Discente realizou rematrícula no período 2026-2. Reabrindo acompanhamento." }`.
  3. Tutor D executes baton pass to self: `POST /api/tutoria/kanban/:cardId/transferir` (Auth: Tutor D) with `{ novoTutorId: "UUID-TUTOR-D", notaTransicao: "Assumindo discente reingressante após desligamento de Tutor X." }`.
  4. Tutor D records welcome communication: `POST /api/tutoria/intervencoes` (Auth: Tutor D) with `{ tipoEvento: "contato_enviado", canalContato: "email", observacoes: "Enviado e-mail de boas-vindas com manual do calouro reingressante." }`.
- **Expected Invariants**:
  - Timeline preserves complete historical continuity across both semesters (original `abertura` -> `evadido` in 2026-1, followed by `mudanca_status` -> `passagem_bastao` -> `contato_enviado` in 2026-2).
  - New owner is Tutor D; former owner Tutor X preserved in transition history.

#### Scenario TC-T4-SCN-05: High-Concurrency Multi-Tutor Action Resilience (Concorrência Simultânea)
- **Pedagogical Narrative**:
  During a peak tutoring sprint, Tutor A and Collaborator Tutor B both open the modal for the same student within milliseconds. Tutor A posts a pedagogical observation while Tutor B records a WhatsApp contact log.
- **E2E Step Execution Sequence**:
  1. Concurrently fire `POST /api/tutoria/intervencoes` from Tutor A and `POST /api/tutoria/intervencoes` from Tutor B for the same student `matricula`.
  2. Both requests resolve with 201 Created without deadlock or unique key constraint violations.
  3. Assertion on DB state: Exactly two audit event rows are inserted in `tutoria_atendimentos_historico`.
  4. Timeline query `GET /api/tutoria/aluno/:matricula/timeline` returns both events sorted cleanly by timestamp.
  5. Card `tutorResponsavelId` remains strictly intact.

---

## 4. Caveats

1. **Test Runner Execution Dependency**: This report designs the 4-Tier Test Matrix specification. The physical execution harness for NestJS supertest is designed by Explorer 1 (`apps/backend/test/tutoria-multitutor.e2e-spec.ts`), and the frontend action runner is designed by Explorer 3 (`apps/frontend/src/lib/tutoria-e2e.test.ts`).
2. **Database Mocking vs Real PostgreSQL**: In local dev/CI environments without live PostgreSQL or Docker, mock database fixtures must implement the schema constraints and query routing (as detailed in Explorer 1's mockDb specification) to accurately simulate foreign key checks on `user.id` and `tutoria_atendimentos_kanban.id`.
3. **RBAC Guard Mocking**: In isolated E2E tests, JWT tokens must carry mock payloads containing `{ sub: userId, id: userId, email: "...", role: "tutor" | "admin", modules: ["tutoria"] }` to pass the `@RequireModule('tutoria')` guard.

---

## 5. Conclusion

1. **4-Tier Matrix Fully Articulated**:
   - **Tier 1 (Feature Coverage)**: 40 Category-Partition happy path test cases covering all 8 features (F1 through F8) with exactly 5 test cases per feature.
   - **Tier 2 (Boundary & Corner Cases)**: 40 Boundary Value Analysis test cases covering invalid payloads, whitespace notes, authorization boundaries, non-existent UUIDs, and SQL injection safety.
   - **Tier 3 (Cross-Feature Interactions)**: 8 pairwise and sequential interaction test cases verifying multi-tutor transitions, owner retention, chained baton passes, and multi-channel resolutions.
   - **Tier 4 (Real-World Multi-Tutor Scenarios)**: 5 realistic pedagogical workflows modeling critical dropout recovery, shift handovers, joint multi-disciplinary interventions, term re-enrollments, and concurrency resilience.
   - **Total Test Catalog**: **93 concrete test cases** with explicitly defined Test IDs, Tiers, Features, Descriptions, Input Payloads, Expected HTTP Statuses, Expected State Mutations, and Expected Audit Log Records.
2. **Defect Prevention**: The test catalog explicitly challenges the known baseline defect in `tutoria.service.ts:843` ensuring that `tutorResponsavelId` cannot be stolen during collaborator updates.

---

## 6. Verification Method

To independently verify this test catalog:
1. **Catalog Completeness Verification**:
   - Inspect `handoff.md` and verify that all 8 features (F1 to F8) have at least 5 test cases in Tier 1 and 5 in Tier 2.
   - Count: Tier 1 (40) + Tier 2 (40) + Tier 3 (8) + Tier 4 (5) = 93 test cases.
2. **Backend Test Harness Execution**:
   - Once workers implement the test spec:
     ```powershell
     cd c:\Users\ricardo.dias\develop\projetos\nexus-core\apps\backend
     npm run test:e2e -- test/tutoria-multitutor.e2e-spec.ts
     ```
3. **Frontend Actions Runner Execution**:
   - Once workers implement the frontend test runner:
     ```powershell
     cd c:\Users\ricardo.dias\develop\projetos\nexus-core
     npx tsx apps/frontend/src/lib/tutoria-e2e.test.ts
     ```
4. **Invalidation Conditions**:
   - If any test case lacks an expected audit log assertion, it must be flagged for revision.
   - If `tutorResponsavelId` is altered without an explicit baton pass (`/transferir`), the test suite must fail.
