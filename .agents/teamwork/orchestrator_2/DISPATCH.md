## 2026-11-11T00:33:58Z

Planejamento arquitetural e implementação completa para suporte a múltiplos tutores simultâneos, modelo híbrido de posse de atendimento, linha do tempo e trilha de auditoria no módulo de tutoria do NexusHub (frontend em Next.js e backend em NestJS com Drizzle ORM).

Integrity mode: development

## Requirements

### R1. Regras de Negócio e Modelo Híbrido Multi-Tutor
Implementar o modelo de atendimento híbrido multi-tutor, onde cada discente possui um tutor responsável principal atribuído, permitindo simultaneamente que outros tutores realizem intervenções, enviem contatos ou passem a titularidade do atendimento (passagem de bastão) com notas de transição.

### R2. Modelagem de Dados e Trilha de Auditoria (Backend)
No backend (`apps/backend`), atualizar o schema Drizzle (`apps/backend/src/db/schema.ts`) e o `TutoriaModule` para persistir o ciclo completo de auditoria e linha do tempo de cada discente/atendimento:
- Abertura de atendimento e tutor iniciador.
- Mudanças de coluna/etapa no Kanban (etapas: `pendente`, `em_contato`, `em_recuperacao`, `revertido`, `evadido`).
- Tentativas e envios de comunicação (WhatsApp ou outros canais).
- Notas de transição entre tutores e passagem de bastão / alteração de tutor responsável.
- Finalização e reabertura de atendimentos.
Cada evento deve registrar data/hora, identificador e nome do tutor atuante, tipo de evento, estado anterior e novo, e observações pertinentes.

### R3. APIs de Atendimento e Histórico (Backend)
Disponibilizar endpoints no NestJS (`TutoriaModule`) para:
- Registrar intervenções manuais e automáticas na trilha de auditoria de atendimento.
- Transferir a titularidade principal do atendimento entre tutores com nota explicativa.
- Consultar a linha do tempo cronológica consolidada de intervenções por discente.

### R4. Linha do Tempo e Interface Multi-Tutor (Frontend)
No frontend (`apps/frontend`), atualizar as telas do módulo de tutoria:
- Modal de Detalhes (`/tutoria` - `TutoriaDashboard.tsx`): Exibir a linha do tempo cronológica com o histórico completo de intervenções (quem iniciou, quem deu continuidade, mensagens, transições de status e passagens de bastão) e permitir registro de novas intervenções ou transferência de tutor responsável.
- Quadro Kanban (`/tutoria/kanban` - `TutoriaKanbanClient.tsx`): Exibir o tutor responsável principal em cada card, indicar visualmente atendimentos com intervenções recentes e registrar automaticamente no histórico as transições de coluna realizadas por qualquer tutor autenticado.

## Acceptance Criteria

### Trilha de Auditoria e Banco de Dados
- [ ] Schema Drizzle no backend inclui tabela para eventos de auditoria e histórico de atendimento com chaves estrangeiras, índices cronológicos e campos para autor (id/nome), tipo de ação, payload de transição, notas e timestamp.
- [ ] Migrations do banco de dados são geradas e executadas sem erros de integridade referencial.

### Backend e Regras de Negócio
- [ ] Endpoints do `TutoriaModule` permitem registrar intervenções, transferir tutor responsável com justificativa e recuperar a timeline consolidada ordenada cronologicamente por discente.
- [ ] Ações realizadas em atendimentos (mudança de status kanban, envio de mensagem, registro de nota pedagógica) geram registros correspondentes na tabela de histórico vinculando o tutor autenticado.

### Frontend e Visualização da Timeline
- [ ] Modal de detalhes do discente em `/tutoria` renderiza a timeline cronológica exibindo autor da ação, avatar/nome do tutor, data/hora formatada, tipo de evento e conteúdo/observações.
- [ ] Quadro Kanban (`/tutoria/kanban`) reflete o tutor responsável ativo nos cards e registra o autor correto no histórico ao arrastar/mover cards entre colunas.
- [ ] Interface permite explicitamente passar o bastão (transferir tutor responsável) com inserção de nota/justificativa, refletindo a alteração na timeline e no card.

### Verificação e Build
- [ ] Build do monorepo (`npm run build` ou equivalente no Turborepo) executa com sucesso no backend e frontend sem erros de tipagem TypeScript ou lint.
- [ ] Testes existentes ou novos testes unitários/integração do `TutoriaModule` executam com sucesso.

---

State folder: c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\orchestrator_2
Working directory: c:\Users\ricardo.dias\develop\projetos\nexus-core
Original request file: c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\ORIGINAL_REQUEST.md

CONTEXT FOR CONTINUATION:
- Master specification document exists at `c:\Users\ricardo.dias\develop\projetos\nexus-core\PROJECT.md`.
- Milestone 1 (Backend Schema & Migrations) is COMPLETED and verified (Gate: PASS, forensic audit CLEAN) — see `.agents/teamwork/sub_orch_m1/handoff.md`.
- Milestone 2 (Backend Tutoria APIs & Hybrid Ownership) is COMPLETED and verified (Gate: PASS, forensic audit CLEAN) — see `.agents/teamwork/sub_orch_m2/handoff.md`.
- Milestone 3 (Frontend Timeline & Interventions UI) has completed its exploration phase — see `.agents/teamwork/sub_orch_m3/`.
- Proceed immediately with Milestone 3 implementation (Worker -> Reviewers -> Challengers -> Auditor), Milestone 4 (Kanban Multi-Tutor & Baton Pass UI), Milestone 5 (Build/Lint verification), and final E2E test verification.


## 2026-11-11T05:30:21Z (from sub_orch_m6)

**Context**: Milestone 6 Status Update (Phase 1 Survey)
**Content**: Transient 429 quota window has cleared. Explorer 3 (`dba43ba8-b5d6-40cf-adf1-3d00859d76f3`) has been successfully dispatched to assess all E2E test suites (backend isolated harness, frontend standalone runner, unit/adversarial tests) against TEST_INFRA.md.
**Action**: Currently awaiting Explorer 3 handoff to proceed with Phase 1 validation and publication of TEST_READY.md.
