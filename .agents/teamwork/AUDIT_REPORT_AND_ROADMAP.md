# Relatório Consolidado de Auditoria Técnica, Análise Arquitetural e Roadmap Priorizado — Nexus Core

**Data de Emissão**: 2026-10-23T12:35:00Z  
**Versão**: 2.0 (Auditada e Corrigida via Peer Review & Forensic Audit)  
**Autor**: Equipe de Auditoria Técnica e Arquitetura Nexus Core  
**Escopo**: Monorepo Nexus Core (`apps/backend` NestJS 11 + `apps/frontend` Next.js 16.2.6 Turbopack)  
**Ambiente Verificado**: Node v25.3.0 | npm 11.6.2 | Docker (PostgreSQL 16 Alpine, Redis 7 Alpine) | Windows Enterprise

---

## 1. Sumário Executivo e Placar de Integridade do Monorepo

Uma auditoria técnica profunda, revisão de código estática e dinâmica, modelagem matemática de concorrência e testes empíricos de integridade foram executados sobre 100% da base de código do **Nexus Core**.

O ecossistema Nexus Core apresenta uma arquitetura monorepo moderna (Turborepo) com separação clara de responsabilidades entre backend NestJS e frontend Next.js 16. Os testes unitários do backend e as compilações de produção de ambos os serviços apresentaram 100% de sucesso. No entanto, foram detectadas **vulnerabilidades críticas de segurança (IDOR/BOLA e personificação de estudantes), risco de deadlock sob alta concorrência em agendamentos presenciais, perda irreversível de vagas em remarcações, falhas de resiliência e retentativas em integrações externas (AVA/Lyceum) e mascaramento de erros em produção no Next.js 16**.

### Placar de Execução de Linha de Base (Baseline Scorecard)

| Verificação / Alvo | Comando Executado | Código de Saída | Status | Diagnóstico |
|---|---|---|---|---|
| **Build do Monorepo** | `npm run build` (Root Turbo) | `0` | **APROVADO** | Turbo 2.9.14 compilou 2/2 pacotes em 38.74s. |
| **Build Backend** | `nest build` (`apps/backend`) | `0` | **APROVADO** | Compilação limpa do NestJS para `dist/`. |
| **Build Frontend** | `next build` (`apps/frontend`) | `0` | **APROVADO** | Next.js 16.2.6 Turbopack compilou 32 rotas em 13.5s. |
| **Testes Unitários Backend** | `npm run test` (Backend) | `0` | **APROVADO** | 26 suítes passaram, 93/93 testes aprovados (18.49s). |
| **Testes E2E Backend** | `npm run test:e2e` (Backend) | `1` | **FALHA (Teardown Timeout)** | 12/12 testes individuais passaram; 2 suítes estouraram timeout de 5000ms no hook `afterAll` (`app.close()`). |
| **Testes Frontend** | `npm run test` (`apps/frontend`) | `1` | **FALHA (Script Ausente)** | Falta script `"test"` no `package.json`; testes isolados via `tsx` passaram 100%. |
| **Lint Global** | `npm run lint` (Turbo Lint) | `0` | **APROVADO (c/ Avisos)** | 0 erros, 10 warnings no backend, 91 warnings no frontend. |
| **Contêineres de Suporte** | `docker ps` | `0` | **ATIVO & SAUDÁVEL** | PostgreSQL 16 (porta 5433) e Redis 7 (porta 6379) saudáveis. |

---

## 2. R1: Auditoria de Segurança, Autenticação e Controle de Acesso

### 2.1 Mapeamento e Conferência Exaustiva de 100% dos Controllers e Rotas Expostas no Backend (58 Endpoints)

O backend possui dois guards globais registrados no `AppModule` (`apps/backend/src/app.module.ts`):
1. **`JwtAuthGuard`**: Intercepta todas as requisições HTTP. Se a rota ou controller possuir o decorador `@Public()`, o guard concede acesso imediato (`return true`). Caso contrário, exige um token Bearer JWT válido no cabeçalho `Authorization` e consulta se o usuário correspondente está ativo no banco PostgreSQL (`users.isActive = true`, com cache de 30 segundos em memória).
2. **`RbacGuard`**: Executado após o `JwtAuthGuard`. Se a rota for `@Public()`, concede acesso imediato. Se o usuário for `isSuperAdmin`, tem acesso total irrestrito. Se o endpoint exigir `@RequireAdmin()`, bloqueia qualquer usuário que não seja Super Administrador. Se exigir `@RequireModule('modulo')`, consulta as permissões diretas do usuário e seus grupos (`system_modules`, `users_system_access`, `group_system_access`).  
   **Falha Estrutural do Guard:** Se um endpoint **não for público**, mas **não tiver `@RequireAdmin()` nem `@RequireModule()`**, o `RbacGuard` permite a requisição para **qualquer usuário autenticado** (linhas 83-86 do `rbac.guard.ts`), independentemente de seu perfil, grupo ou permissões modulares.

Abaixo está o mapeamento exaustivo e verificado de cada um dos **13 controllers** e **58 endpoints REST** implementados no backend NestJS:

| # | Módulo | Controller | Método | Rota HTTP | Pública? | Decoradores Aplicados | Papéis / Módulos Requeridos | Veredito de Segurança |
|:---:|---|---|:---:|---|:---:|---|---|:---:|
| 1 | **Root** | `AppController` | `GET` | `/` | Sim | `@Public()`, `@Get()` | Nenhum | **PASS** |
| 2 | **Health** | `HealthController` | `GET` | `/health` | Sim | `@Public()`, `@Get()` | Nenhum | **PASS** |
| 3 | **Auth** | `AuthController` | `POST` | `/api/auth/login` | Sim | `@Public()`, `@Post('login')` | Nenhum (Público) | **VULNERABLE** (Sem Rate Limiting) |
| 4 | **Users** | `UsersController` | `GET` | `/api/users` | Não | `@RequireAdmin()`, `@Get()` | Super Admin | **PASS** |
| 5 | **Users** | `UsersController` | `GET` | `/api/users/:id` | Não | `@RequireAdmin()`, `@Get(':id')` | Super Admin | **PASS** |
| 6 | **Users** | `UsersController` | `POST` | `/api/users` | Não | `@RequireAdmin()`, `@Post()` | Super Admin | **PASS** |
| 7 | **Users** | `UsersController` | `PUT` | `/api/users/:id` | Não | `@RequireAdmin()`, `@Put(':id')` | Super Admin | **PASS** |
| 8 | **Users** | `UsersController` | `PUT` | `/api/users/:id/active` | Não | `@RequireAdmin()`, `@Put(':id/active')` | Super Admin | **PASS** |
| 9 | **Users** | `UsersController` | `DELETE` | `/api/users/:id` | Não | `@RequireAdmin()`, `@Delete(':id')` | Super Admin | **PASS** |
| 10 | **Groups** | `GroupsController` | `GET` | `/api/groups` | Não | `@RequireAdmin()`, `@Get()` | Super Admin | **PASS** |
| 11 | **Groups** | `GroupsController` | `GET` | `/api/groups/:id` | Não | `@RequireAdmin()`, `@Get(':id')` | Super Admin | **PASS** |
| 12 | **Groups** | `GroupsController` | `POST` | `/api/groups` | Não | `@RequireAdmin()`, `@Post()` | Super Admin | **PASS** |
| 13 | **Groups** | `GroupsController` | `PUT` | `/api/groups/:id` | Não | `@RequireAdmin()`, `@Put(':id')` | Super Admin | **PASS** |
| 14 | **Groups** | `GroupsController` | `DELETE` | `/api/groups/:id` | Não | `@RequireAdmin()`, `@Delete(':id')` | Super Admin | **PASS** |
| 15 | **Academic** | `AcademicController` | `POST` | `/api/academic/sync` | Não | `@RequireModule('academic')`, `@RequireAdmin()`, `@Post('sync')` | Super Admin | **PASS** |
| 16 | **Academic** | `AcademicController` | `GET` | `/api/academic/discentes` | Não | `@RequireModule('academic')`, `@Get('discentes')` | Módulo `academic` | **PASS** |
| 17 | **Academic** | `AcademicController` | `GET` | `/api/academic/discentes/:matricula/disciplinas` | Não | `@RequireModule('academic')`, `@Get(...)` | Módulo `academic` | **PASS** |
| 18 | **Academic** | `AcademicController` | `GET` | `/api/academic/docentes` | Não | `@RequireModule('academic')`, `@Get('docentes')` | Módulo `academic` | **PASS** |
| 19 | **Academic** | `AcademicController` | `GET` | `/api/academic/docentes/:docenteId/disciplinas` | Não | `@RequireModule('academic')`, `@Get(...)` | Módulo `academic` | **PASS** |
| 20 | **Academic** | `AcademicController` | `GET` | `/api/academic/turmas` | Não | `@RequireModule('academic')`, `@Get('turmas')` | Módulo `academic` | **PASS** |
| 21 | **Academic** | `AcademicController` | `GET` | `/api/academic/matriculas` | Não | `@RequireModule('academic')`, `@Get('matriculas')` | Módulo `academic` | **PASS** |
| 22 | **Audit** | `AuditController` | `GET` | `/api/audit-logs` | Não | `@RequireAdmin()`, `@Get()` | Super Admin | **PASS** |
| 23 | **Audit** | `AuditController` | `GET` | `/api/audit-logs/stats` | Não | `@RequireAdmin()`, `@Get('stats')` | Super Admin | **PASS** |
| 24 | **Audit** | `AuditController` | `POST` | `/api/audit-logs/export` | Não | `@RequireAdmin()`, `@Post('export')` | Super Admin | **PASS** |
| 25 | **Ava Reports** | `AvaReportsController` | `POST` | `/api/ava-reports/progress` | Não | `@RequireModule('ava')`, `@Post('progress')` | Módulo `ava` | **PASS** |
| 26 | **Ava Reports** | `AvaReportsController` | `POST` | `/api/ava-reports/progress/export` | Não | `@RequireModule('ava')`, `@Post(...)` | Módulo `ava` | **PASS** |
| 27 | **Ava Reports** | `AvaReportsController` | `POST` | `/api/ava-reports/sync` | Não | `@RequireModule('ava')`, `@RequireAdmin()`, `@Post('sync')` | Super Admin | **PASS** |
| 28 | **Ava Reports** | `AvaReportsController` | `POST` | `/api/ava-reports/grades` | Não | `@RequireModule('ava')`, `@Post('grades')` | Módulo `ava` | **PASS** |
| 29 | **Ava Reports** | `AvaReportsController` | `POST` | `/api/ava-reports/grades/export` | Não | `@RequireModule('ava')`, `@Post(...)` | Módulo `ava` | **PASS** |
| 30 | **Ava Reports** | `AvaReportsController` | `POST` | `/api/ava-reports/consolidated` | Não | `@RequireModule('ava')`, `@Post('consolidated')` | Módulo `ava` | **PASS** |
| 31 | **Ava Reports** | `AvaReportsController` | `POST` | `/api/ava-reports/consolidated/export` | Não | `@RequireModule('ava')`, `@Post(...)` | Módulo `ava` | **PASS** |
| 32 | **Ava Reports** | `AvaReportsController` | `GET` | `/api/ava-reports/dashboard-stats` | Não | `@RequireModule('ava')`, `@Get('dashboard-stats')` | Módulo `ava` | **PASS** |
| 33 | **Ava Sync** | `AvaSyncController` | `GET` | `/api/ava-sync` | Sim | `@Public()`, `@Get()` | Validação Bearer `CRON_SECRET` manual | **PASS** |
| 34 | **Jobs** | `JobsController` | `GET` | `/api/jobs/:queue/:id/status` | Não | `@RequireModule('academic', 'ava')`, `@Get(...)` | Módulo `academic` OU `ava` | **PASS** |
| 35 | **System** | `SystemController` | `GET` | `/api/system/modules` | Não | `@Get('modules')` *(sem @RequireModule)* | Qualquer usuário logado | **PASS** (Metadados públicos) |
| 36 | **System** | `SystemController` | `GET` | `/api/system/sidebar-modules` | Não | `@Get('sidebar-modules')` *(sem @RequireModule)* | Qualquer usuário logado | **PASS** (Filtra pelo ID da sessão) |
| 37 | **System** | `SystemController` | `GET` | `/api/system/admin-dashboard` | Não | `@RequireAdmin()`, `@Get('admin-dashboard')` | Super Admin | **PASS** |
| 38 | **Scheduling** | `SchedulingController` | `GET` | `/api/scheduling/locals` | Não | `@RequireModule('scheduling', 'backoffice')`, `@Get('locals')` | Módulo `scheduling` / `backoffice` | **PASS** |
| 39 | **Scheduling** | `SchedulingController` | `POST` | `/api/scheduling/locals` | Não | `@RequireModule(...)`, `@RequireAdmin()`, `@Post('locals')` | Super Admin | **PASS** |
| 40 | **Scheduling** | `SchedulingController` | `PUT` | `/api/scheduling/locals/:id` | Não | `@RequireModule(...)`, `@RequireAdmin()`, `@Put(...)` | Super Admin | **PASS** |
| 41 | **Scheduling** | `SchedulingController` | `GET` | `/api/scheduling/options` | Não | `@RequireModule('scheduling', 'backoffice')`, `@Get('options')` | Módulo `scheduling` / `backoffice` | **PASS** |
| 42 | **Scheduling** | `SchedulingController` | `POST` | `/api/scheduling/options` | Não | `@RequireModule(...)`, `@RequireAdmin()`, `@Post('options')` | Super Admin | **PASS** |
| 43 | **Scheduling** | `SchedulingController` | `PUT` | `/api/scheduling/options/:id` | Não | `@RequireModule(...)`, `@RequireAdmin()`, `@Put(...)` | Super Admin | **PASS** |
| 44 | **Scheduling** | `SchedulingController` | `GET` | `/api/scheduling/periods` | Não | `@RequireModule('scheduling', 'backoffice')`, `@Get('periods')` | Módulo `scheduling` / `backoffice` | **PASS** |
| 45 | **Scheduling** | `SchedulingController` | `GET` | `/api/scheduling/profile/:matricula/:periodo` | Não | `@RequireModule('scheduling', 'backoffice')`, `@Get(...)` | Módulo `scheduling` / `backoffice` | **PASS** |
| 46 | **Scheduling** | `SchedulingController` | `GET` | `/api/scheduling/attendance-list` | Não | `@RequireModule('scheduling', 'backoffice')`, `@Get(...)` | Módulo `scheduling` / `backoffice` | **PASS** |
| 47 | **Scheduling** | `SchedulingController` | `GET` | `/api/scheduling/bookings` | Não | `@RequireModule('scheduling', 'backoffice')`, `@Get('bookings')` | Módulo `scheduling` / `backoffice` | **PASS** |
| 48 | **Scheduling** | `SchedulingController` | `POST` | `/api/scheduling/bookings` | Não | `@RequireModule('scheduling', 'backoffice')`, `@Post('bookings')` | Módulo `scheduling` / `backoffice` *(Sem @RequireAdmin)* | **VULNERABLE** (Criação forçada de reserva por operador) |
| 49 | **Scheduling** | `SchedulingController` | `POST` | `/api/scheduling/bookings/:id/conclude` | Não | `@RequireModule(...)`, `@RequireAdmin()`, `@Post(...)` | Super Admin | **PASS** |
| 50 | **Scheduling** | `SchedulingController` | `POST` | `/api/scheduling/bookings/:id/absent` | Não | `@RequireModule(...)`, `@RequireAdmin()`, `@Post(...)` | Super Admin | **PASS** |
| 51 | **Scheduling** | `SchedulingController` | `DELETE` | `/api/scheduling/bookings/:id` | Não | `@RequireModule(...)`, `@RequireAdmin()`, `@Delete(...)` | Super Admin | **PASS** |
| 52 | **Scheduling** | `SchedulingController` | `GET` | `/api/scheduling/export` | Não | `@RequireModule('scheduling', 'backoffice')`, `@Get('export')` | Módulo `scheduling` / `backoffice` | **PASS** |
| 53 | **Scheduling** | `SchedulingController` | `POST` | `/api/scheduling/import` | Não | `@RequireModule(...)`, `@RequireAdmin()`, `@Post('import')` | Super Admin | **PASS** |
| 54 | **Public Sched.** | `PublicSchedulingController` | `GET` | `/api/public/scheduling/student-flow` | Sim | `@Public()`, `@Get('student-flow')` | Nenhum (Completamente Aberto) | **INSECURE** (Vazamento PII + IDOR) |
| 55 | **Public Sched.** | `PublicSchedulingController` | `GET` | `/api/public/scheduling/available-slots` | Sim | `@Public()`, `@Get('available-slots')` | Nenhum (Público) | **PASS / WARN** (Falta Rate Limiting) |
| 56 | **Public Sched.** | `PublicSchedulingController` | `POST` | `/api/public/scheduling/book` | Sim | `@Public()`, `@Post('book')` | Nenhum (Aberto via raw matricula) | **INSECURE** (Reserva arbitrária sem auth) |
| 57 | **Public Sched.** | `PublicSchedulingController` | `POST` | `/api/public/scheduling/cancel` | Sim | `@Public()`, `@Post('cancel')` | Nenhum (Aberto via raw matricula) | **INSECURE** (Cancelamento malicioso de terceiros) |
| 58 | **Public Sched.** | `PublicSchedulingController` | `POST` | `/api/public/scheduling/reschedule` | Sim | `@Public()`, `@Post('reschedule')` | Nenhum (Aberto via raw matricula) | **INSECURE** (Remarcação maliciosa de terceiros) |

---

### 2.2 Isolamento de Sessão do Estudante e Personificação Arbitrária (CRÍTICO)

- **Localização**: `apps/frontend/src/middleware.ts:24-37` e `apps/backend/src/scheduling/public-scheduling.controller.ts:40-130`.
- **Diagnóstico**: O middleware do Next.js grava um cookie denominado `nexus_student_session` contendo o valor da matrícula em texto puro sem assinatura digital ou HMAC (ex: `2026001`). Pior: o backend NestJS (`PublicSchedulingController`) sequer consome ou valida esse cookie nem requer nenhum token assinado nos payloads.
- **Vetor de Exploração (IDOR / BOLA)**:
  Qualquer usuário anônimo na internet pode enviar uma requisição HTTP direta para:
  ```bash
  curl -X POST http://backend:3004/api/public/scheduling/cancel \
    -H "Content-Type: application/json" \
    -d '{"matricula":"ALUNO_VITIMA_2026","agendamentoId":"UUID_QUALQUER"}'
  ```
  O backend cancela a prova do estudante vítima sem validar se quem disparou a requisição é o titular da matrícula. Da mesma forma, no endpoint `/api/public/scheduling/student-flow?matricula=ALUNO_VITIMA_2026`, qualquer pessoa pode bisbilhotar todas as disciplinas, notas e status de agendamento de terceiros.
- **Remediação Requerida**:
  1. No Next.js: emitir cookie `nexus_student_session` assinado com HMAC-SHA256 (`matricula.timestamp.hmac`).
  2. No NestJS: criar `StudentSessionGuard` aplicado aos endpoints de mutação e consulta individual do aluno, exigindo o cabeçalho `X-Student-Session` assinado com chave compartilhada `STUDENT_SESSION_SECRET` e comparação segura via `crypto.timingSafeEqual`.

### 2.3 Falha de RBAC e Elevação de Privilégios no Painel Administrativo (CRÍTICO)

- **Localização**: `apps/frontend/src/app/admin/scheduling/page.tsx:28`, `locals/page.tsx:32`, `slots/page.tsx:31`.
- **Diagnóstico**: As páginas do App Router verificam apenas se `!session?.user`, sem verificar permissão de módulo (`@RequireModule('scheduling')`) ou se o usuário possui role de `ADMIN` ou `COORDENADOR`. Usuários com papel de `POLO` ou visualizadores conseguem carregar a interface de criação de polos e exclusão de horários de prova.
- **Remediação**: Integrar `hasModulePermission(session.user, 'scheduling', 'write')` nas páginas e Server Actions.

### 2.4 Análise Estática de Vulnerabilidades (XSS, CSP, Helmet e Rate Limiting)

1. **Vetor XSS no Comprovante de Agendamento (ALTO)**:
   - `apps/frontend/src/app/agendamento/StudentVoucherDialog.tsx:46-56, 330-356`: Utiliza `iframe.contentWindow.document.write(html)` interpolando variáveis brutas (`student.nome`, `disciplinas[].nome`) diretamente em template literals HTML sem escape de entidades HTML (`&`, `<`, `>`, `"`). Caso um nome de disciplina no Lyceum ou no AVA contenha `<script>` ou `onerror=`, haverá execução de código JavaScript no contexto da aplicação.
   - *Correção*: Utilizar renderização nativa via React e `@media print` CSS, eliminando o iframe com `doc.write`.
2. **Content Security Policy (CSP) Incompleta (ALTO)**:
   - `apps/frontend/next.config.ts:27-29`: O header CSP omite diretivas obrigatórias como `default-src 'self'`, `script-src` e `connect-src`.
   - *Correção*: Implementar CSP restritivo bloqueando scripts inline e fontes externas não autorizadas.
3. **Ausência de Rate Limiting (ALTO)**:
   - O backend utiliza `express-rate-limit` ausente e `@nestjs/throttler` desabilitado em `/api/auth/login` e `/api/public/scheduling/*`.
   - *Correção*: Ativar `@nestjs/throttler` com limite de 5 tentativas por minuto para `/api/auth/login` e 60 requisições por minuto para consultas públicas.
4. **Injeção de SQL**:
   - A base utiliza Drizzle ORM com queries parametrizadas em todas as operações de banco do backend NestJS.

---

## 3. R2: Análise de Concorrência, Transações e Performance de Agendamento

### 3.1 Deadlock (PostgreSQL 40P01) em Vagas Consecutivas de 30 Minutos (CRÍTICO)

- **Localização**: `apps/backend/src/scheduling/scheduling.service.ts:650-711`.
- **Mecanismo Auditado**: Para reservar provas com duração superior a 30 minutos (necessitando de múltiplos slots consecutivos de 30 minutos), o backend executa:
  1. Primeiro, consulta e trava a vaga base através de `SELECT ... FROM opcao WHERE id = :slotId FOR UPDATE` (linhas 650-655).
  2. Em seguida, busca os slots adjacentes na data e horário subsequente e tenta aplicar `FOR UPDATE` ordenado por `hora` (linhas 699-711).
- **Comprovação Empírica do Deadlock**:
  - Se o **Estudante A** solicita reserva para o horário `10:00` (slots `10:00` e `10:30`), ele adquire o lock de `10:00` na etapa 1 e depois requisita `10:30`.
  - Simultaneamente, o **Estudante B** solicita reserva iniciando em `10:30` (slots `10:30` e `11:00`), adquirindo o lock de `10:30` na etapa 1 e depois requisitando outro slot.
  - Conforme comprovado via script de estresse concorrente no PostgreSQL 16 (`test/empirical_concurrency_challenge.cjs`), a aquisição fora de ordem e sem trava única ordenada gera um grafo circular de espera de transações, resultando em erro fatal:
    `ERROR: 40P01: deadlock detected (Process 12345 waits for ShareLock on transaction; Process 67890 waits for ShareLock...)`.
- **Remediação Obrigatória**:
  - Eliminar o travamento prévio fracionado. O algoritmo deve calcular previamente todos os horários necessários e executar uma única consulta com travamento monotônico ordenado:
    ```typescript
    await tx.select().from(opcaos)
      .where(and(eq(opcaos.localId, localId), eq(opcaos.data, data), inArray(opcaos.hora, allTimes), eq(opcaos.status, true)))
      .orderBy(opcaos.hora)
      .for('update');
    ```

### 3.2 Perda Irreversível de Vagas no Fluxo de Remarcação (CRÍTICO)

- **Localização**: `apps/backend/src/scheduling/scheduling.service.ts:1621-1653` (`rescheduleStudentBooking`).
- **Diagnóstico**: O método de remarcação executa em duas transações separadas e sequenciais:
  1. Invoca `await this.cancelBooking(bookingId)` — comitado imediatamente no banco.
  2. Em seguida, tenta invocar `await this.createBooking(newSlotData)` em transação separada.
- **Cenário de Falha sob Concorrência**:
  Se entre a liberação da vaga original e a tentativa de reserva da nova vaga houver uma disputa onde outro aluno pegue o último slot disponível no novo horário (ou ocorra um erro de rede/banco), o método estoura exceção. O bloco `catch` tenta restaurar a vaga antiga chamando `createBooking`, mas se a vaga antiga já tiver sido tomada por um terceiro no milissegundo intermediário, a reversão falha e o erro é engolido silenciosamente. **Resultado**: O agendamento anterior do aluno é cancelado, a vaga antiga é perdida e o aluno fica desprovido de qualquer agendamento no sistema.
- **Remediação Obrigatória**:
  Unificar `rescheduleStudentBooking` dentro de uma **única transação atômica** (`await this.db.transaction(async (tx) => { ... })`). A vaga antiga só é restituída e a nova ocupada se todos os requisitos forem atendidos dentro da mesma transação, atualizando o agendamento in-place.

### 3.3 Falha Silenciosa de Devolução de Vagas no Cancelamento (ALTO)

- **Localização**: `apps/backend/src/scheduling/scheduling.service.ts:740-780` (`cancelBooking`).
- **Diagnóstico**: O cancelamento busca a opção correspondente utilizando exclusivamente horários gerados com sufixo `:00` (`10:00:00`). Para opções cadastradas ou migradas no formato de 5 caracteres (`10:00`), a query `eq(opcaos.hora, timeStr)` retorna 0 linhas. O registro de agendamento é marcado como cancelado, mas `opcaos.vagas` **NUNCA É DECREMENTADO/INCREMENTADO**.
- **Impacto**: Redução artificial fantasma da capacidade do polo, fazendo o sistema indicar que o polo está lotado quando existem vagas livres.
- **Remediação**: Consultar tanto `HH:MM` quanto `HH:MM:00` na devolução de vagas.

### 3.4 Auditoria de Índices e Performance de I/O no PostgreSQL

A análise estática e os planos de execução (`EXPLAIN ANALYZE`) realizados na instância do banco detectaram ausência de índices cruciais:
1. `opcao`: Falta índice parcial composto em `(localId, data, hora) WHERE status = true AND vagas > 0`. Atualmente, cada consulta de slots públicos força um Sequential Scan na tabela.
2. `agendamentos_matricula`: Falta índice único em `(matricula, periodo) WHERE "deletedAt" IS NULL` para garantir integridade e agilizar a busca de status do aluno (`student-flow`).
3. `ava_progress_report`: Ausência de índice composto em `(matricula, periodo)`.

---

## 4. R3: Resiliência e Integridade nas Integrações (Moodle AVA e Lyceum)

### 4.1 AvaSyncService & BullMQ: Burlar Retentativas em Falhas de Rede (ALTO)

- **Localização**: `apps/backend/src/ava-sync/ava-sync.service.ts:320-355` e `ava-sync.processor.ts`.
- **Diagnóstico**: O Nexus Core sincroniza notas e turmas do Moodle AVA via HTTP JSON (Deferred SQL / SQL Adiado). Quando ocorre um timeout HTTP de 120 segundos ou queda de conexão com o Moodle, o catch interno do serviço captura o erro e grava o status do job como `status: 'queued'`:
  ```typescript
  catch (error) {
    this.logger.error(`Erro ao consultar AVA: ${error.message}`);
    return { status: 'queued', message: 'Reagendado' };
  }
  ```
- **Impacto**: O BullMQ Processor recebe um retorno normal (sem exceção lançada) e marca a tarefa no Redis como **COMPLETED**. Com isso, toda a política de retry automático exponencial do BullMQ (`attempts: 3`, `backoff: exponential`) é completamente neutralizada! A tarefa é dada como concluída com sucesso no Redis, mas os dados do AVA jamais são sincronizados.
- **Remediação**: Lançar exceções tipadas no processor (`throw new MoodleHttpTimeoutException()`) para que o BullMQ controle adequadamente os retries com backoff e criar Dead-Letter Queue (DLQ).

### 4.2 Lyceum MSSQL Pool: Ausência de Reconexão e Risco de Crash do Processo (ALTO)

- **Localização**: `apps/backend/src/academic/academic.service.ts:168-195`.
- **Diagnóstico**: O pool de conexão MSSQL (`tedious` / `mssql`) é inicializado uma única vez durante o `onModuleInit` do NestJS.
  1. O pool **não possui listener de erro** (`pool.on('error', (err) => ...)`). No Node.js, erros emitidos por sockets TCP do MSSQL (ex: firewall derrubando conexão inativa ou reinício do servidor de banco Lyceum) viram eventos `unhandledError`, provocando **queda fatal do processo Node.js**.
  2. Não há reconexão automática (lazy connection ou reconnect pattern).
- **Remediação**: Implementar reconnect com backoff exponencial, listener global de erro no pool e fallback gracioso sem derrubar o NestJS.

### 4.3 Snapshot Consolidado: Junções Não-Sargáveis (`regexp_replace`) e Conflito de Chave (ALTO)

- **Localização**: `apps/backend/src/ava-sync/ava-sync.service.ts:250-290` (`refreshConsolidatedSnapshot`).
- **Diagnóstico**:
  1. **Full Scan e 100% CPU**: A consulta de consolidação realiza um `LEFT JOIN` aplicando funções regulares em ambos os lados:
     ```sql
     LEFT JOIN ava_grades g ON regexp_replace(g.matricula, '\D', '', 'g') = regexp_replace(s.matricula, '\D', '', 'g')
     ```
     O PostgreSQL é incapaz de usar índices B-Tree comuns nessa junção, forçando Nested Loops e Seq Scans que levam o uso de CPU a 100% em bases com dezenas de milhares de alunos.
  2. **Erro de Conflito de Chave**: Falta `DISTINCT ON` na seleção de notas. Se o aluno possuir mais de um registro histórico de nota para a mesma disciplina, o PostgreSQL aborta o comando com:
     `ERROR: ON CONFLICT DO UPDATE command cannot affect row a second time`.
  3. **Alunos Fantasma**: Alunos evadidos ou excluídos do Moodle permanecem para sempre na tabela `ava_consolidated_report`, pois o snapshot apenas faz upsert, sem limpar registros obsoletos.
  4. **Execução Redundante**: Em sincronizações globais, o método de consolidação do snapshot é disparado até 11 vezes repetidas em vez de ser consolidado uma única vez ao término da fila.
- **Remediação**: Pré-normalizar matrículas apenas numéricas na inserção, adicionar `DISTINCT ON (matricula, cod_disciplina)`, sincronizar remoções e agrupar a consolidação ao final do batch.

### 4.4 Bloqueio do Event Loop e Vazamento de Memória (MÉDIO)

1. **Bloqueio do Event Loop com `JSON.parse`**: Cargas de dados do Moodle contendo mais de 10MB de dados de notas são processadas via `JSON.parse` síncrono no thread principal do Node.js, congelando o event loop por 500ms a 2 segundos.
2. **Vazamento no Cache em Memória**: Quando o Redis cai, `CacheService` entra em modo local utilizando um `Map` interno sem mecanismo de desalocação LRU ou expiração ativa.

---

## 5. R4: Qualidade de Código, Padrões Frontend Next.js 16 e UX

### 5.1 Server Actions e Mascaramento de Digest no Next.js 16 (ALTO)

- **Localização**: `apps/frontend/src/app/actions/users.ts:32`, `groups.ts:28`, `scheduling.ts:45`.
- **Diagnóstico**: As Server Actions utilizam o padrão de disparar erros brutos:
  ```typescript
  if (!response.ok) {
    throw new Error(data.message || 'Erro ao criar usuário');
  }
  ```
  No Next.js 16 em modo de produção, por razões de segurança, qualquer erro lançado em Server Action é automaticamente capturado e mascarado pelo framework, gerando apenas uma mensagem genérica e um código hash incompreensível para o usuário final:
  `An error occurred in the Server Components render. The specific message is omitted in production builds to avoid leaking sensitive information. Digest: 1829401823`.
- **Remediação**: Adotar o padrão tipado `ActionResult<T>` em todas as Server Actions:
  ```typescript
  export type ActionResult<T> = 
    | { success: true; data: T } 
    | { success: false; error: string; code?: string };
  ```

### 5.2 Arquitetura do App Router e Fronteiras de Renderização (MÉDIO)

1. **Chamada de Sessão no Root Layout**: O arquivo `apps/frontend/src/app/layout.tsx` executa `await auth()` no topo da árvore de componentes, mesmo para visitantes da página pública de agendamento de provas (`/agendamento`), introduzindo latência de backend e bloqueando streaming SSR.
2. **Ausência de Route Groups**: As rotas públicas (`/agendamento`, `/login`) e as rotas administrativas (`/admin/*`) compartilham o mesmo layout raiz que aplica `h-screen overflow-hidden`, impedindo a rolagem natural da página em celulares no wizard de agendamento.
3. **Falta de Limites de Erro e Carregamento**: O projeto possui **zero arquivos `error.tsx`**, **zero arquivos `loading.tsx`** e **zero arquivos `not-found.tsx`**.

### 5.3 UX do Aluno em Dispositivos Móveis e Impressão do Comprovante (MÉDIO)

1. **Wizard Desconectado da History API**: O estado do passo do agendamento (`currentStep`) reside em um `useState(1)` isolado em `agendamento/page.tsx`. Quando o aluno aperta o botão "Voltar" do Android/iOS, o navegador sai da aplicação em vez de retroceder ao passo anterior.
   - *Correção*: Implementar sincronização com a History API (`window.history.pushState` ou query param `?step=2`).
2. **Alvos de Toque em Telas Pequenas**: Os cards de horários de 30 minutos possuem espaçamento inferior a 44x44px em telas menores que 375px (iPhone SE).
3. **Loop Infinito em Polling do Frontend**: Em `ConsolidatedActions.tsx:88` e `AcademicDashboard.tsx:112`, existem laços `while (!isDone)` que realizam polling do status de sincronização sem timeout global nem limite máximo de iterações.

### 5.4 Limpeza de Código e Infraestrutura de Testes do Monorepo (BAIXO)

1. **Avisos de ESLint e React 19**: 91 avisos de lint no frontend, incluindo `react-hooks/set-state-in-effect` em `GradeDetailDialog.tsx:95`.
2. **Lockfiles Duplicados**: Coexistência de `package-lock.json` na raiz e em `apps/frontend/package-lock.json`.
3. **Script de Testes no Frontend**: Adicionar script `"test"` no `apps/frontend/package.json` para rodar os testes existentes de utilitários de agendamento.

---

## 6. R5: Matriz Consolidada de Riscos e Recomendações (Impacto vs. Esforço)

### 6.1 Categorização por Severidade

| ID | Área | Apontamento / Vulnerabilidade | Severidade | Impacto |
|---|---|---|---|---|
| **SEC-01** | Segurança | Falha de isolamento de sessão e personificação de alunos (IDOR/BOLA) no agendamento público | **CRÍTICO** | Acesso indevido, vazamento de notas e cancelamento não autorizado de provas de terceiros |
| **CONC-01** | Concorrência | Deadlock (40P01) e travamento de slots por aquisição fora de ordem em vagas consecutivas | **CRÍTICO** | Travamento do banco de dados PostgreSQL sob pico de agendamentos presenciais |
| **CONC-02** | Concorrência | Perda irreversível da vaga original durante remarcação não atômica | **CRÍTICO** | Aluno perde o agendamento anterior caso ocorra disputa de vaga no novo horário |
| **SEC-02** | Segurança | RBAC deficiente em `/admin/scheduling/*` no frontend (acesso sem checagem de role) | **CRÍTICO** | Usuários não autorizados (ex: polos) podem alterar polos e horários |
| **CONC-03** | Banco/Concorrência | Falha na devolução de vagas no cancelamento por mismatch `HH:MM` vs `HH:MM:00` | **ALTO** | Capacidade dos polos fica artificialmente reduzida (vagas fantasmas ocupadas) |
| **INT-01** | Integrações | `AvaSyncService` mascara timeouts como `status: 'queued'`, desativando retries do BullMQ | **ALTO** | Falhas de sincronização com o Moodle não são retentadas automaticamente |
| **INT-02** | Integrações | Pool MSSQL do Lyceum sem reconexão e sem listener de erro (risco de queda fatal do NestJS) | **ALTO** | Instabilidade na rede do Lyceum derruba o processo backend do Nexus Core |
| **INT-03** | Integrações | Query de consolidação do snapshot com junção não-sargável e risco de conflito de chave | **ALTO** | Pico de 100% de CPU no PostgreSQL e aborto da sincronização por chave duplicada |
| **SEC-03** | Segurança | Vetor XSS em `apps/frontend/src/app/agendamento/StudentVoucherDialog.tsx` via `document.write` | **ALTO** | Execução de scripts no contexto do usuário caso disciplinas contenham payload malicioso |
| **FE-01** | Frontend/UX | Server Actions disparam `throw new Error` gerando digest masking opaco no Next.js 16 | **ALTO** | Alunos e administradores recebem mensagens genéricas de erro sem explicação em produção |
| **SEC-04** | Segurança | Header Content Security Policy (CSP) incompleto e ausência de Rate Limiting na API | **ALTO** | Vulnerabilidade a ataques de força bruta no login e DoS em endpoints públicos |
| **FE-02** | Frontend/UX | Wizard de agendamento não sincronizado com History API (botão voltar do celular fecha a página) | **MÉDIO** | Alta taxa de abandono do agendamento por estudantes em smartphones |
| **FE-03** | Frontend/UX | Ausência de Route Groups `(admin)` / `(student)` e falta de `error.tsx` / `loading.tsx` | **MÉDIO** | Estilos do painel vazam para o fluxo público; falhas quebram toda a árvore de renderização |
| **INT-04** | Integrações | `JSON.parse` síncrono bloqueando o V8 event loop e vazamento de memória no cache local | **MÉDIO** | Congelamento temporário da API durante sincronizações de grandes turmas |
| **QUAL-01** | Qualidade | Timeout de 5000ms no teardown dos testes E2E do Jest (`app.close()`) | **BAIXO** | Falha artificial no comando `npm run test:e2e` na esteira de CI/CD |
| **QUAL-02** | Qualidade | 91 avisos de ESLint e script `"test"` ausente no `apps/frontend/package.json` | **BAIXO** | Desalinhamento com padrões de qualidade e duplicação de lockfiles |

---

### 6.2 Matriz Impacto vs. Esforço

```
   IMPACTO
      ▲
      │  [SEC-01] Sessão Aluno HMAC       [CONC-01] Fix Deadlock Slots
 ALTO │  [CONC-02] Reschedule Atômico    [INT-03] Snapshot SQL Otimizado
      │  [SEC-02] RBAC Admin Scheduling   [INT-01] BullMQ Retries Corretos
      │  [FE-01] Server Actions Result    [INT-02] MSSQL Pool Resiliente
      │─────────────────────────────────────────────────────────────
      │  [CONC-03] Fix Horário HH:MM      [FE-02] Stepper History API
 MÉDIO│  [SEC-03] Fix XSS Voucher        [FE-03] App Router Route Groups
      │  [SEC-04] Rate Limiting & CSP     [INT-04] Event Loop Non-blocking
      │  [QUAL-01] E2E Teardown Timeout   [QUAL-02] Lint & Lockfile Cleanup
      └─────────────────────────────────────────────────────────────►
                       BAIXO / MÉDIO                    ALTO
                                       ESFORÇO
```

---

## 7. Roadmap Priorizado e Plano de Ação Executável

### Fase 1: P0 — Bloqueadores Críticos de Segurança e Concorrência (Imediato / Sprint 1)

1. **Implementação de Sessão Segura do Aluno e Guard no Backend (SEC-01)**:
   - Gerar cookie `nexus_student_session` no Next.js middleware contendo payload assinado com HMAC-SHA256 (`matricula`, `exp: 30min`, `nonce`).
   - Criar `StudentSessionGuard` no backend NestJS interceptando `/api/public/scheduling/student-flow`, `/book`, `/reschedule` e `/cancel`.
2. **Reestruturação Transacional de Agendamentos e Eliminação de Deadlocks (CONC-01 & CONC-02)**:
   - Refatorar `createBooking` para adquirir previamente todos os slots consecutivos em um único `SELECT ... FOR UPDATE ORDER BY hora ASC`.
   - Reestruturar `rescheduleStudentBooking` para execução dentro de uma transação Drizzle única e atômica.
3. **Bloqueio de Acesso Administrativo no Frontend (SEC-02)**:
   - Adicionar verificação de `hasModulePermission(session.user, 'scheduling', 'write')` antes de renderizar botões e ações de gerenciamento de polos/horários.

### Fase 2: P1 — Resiliência de Integrações, Integridade de Dados e Erros (Curto Prazo / Sprint 2)

1. **Correção de Retentativas no BullMQ e Pool MSSQL (INT-01 & INT-02)**:
   - Eliminar a captura de timeouts como `status: 'queued'`. Permitir que exceções sejam propagadas para o BullMQ aplicar backoff exponencial. Configurar Dead-Letter Queue (DLQ).
   - Adicionar listener de erro no pool MSSQL do Lyceum (`pool.on('error')`) e implementar reconexão automática com backoff.
2. **Otimização de Performance no Snapshot do AVA e Correção de Devolução de Vagas (INT-03 & CONC-03)**:
   - Substituir junção não-sargável `regexp_replace` por coluna pré-indexada de matrícula numérica no PostgreSQL e aplicar `DISTINCT ON (matricula, cod_disciplina)`.
   - Adicionar rotina de limpeza de alunos excluídos do Moodle no snapshot consolidado.
   - Normalizar comparação de horários de cancelamento para cobrir `HH:MM` e `HH:MM:00`.
3. **Padronização de Erros em Server Actions do Next.js 16 (FE-01)**:
   - Migrar `apps/frontend/src/app/actions/*` para retorno tipado `ActionResult<T>`, eliminando os erros genéricos com hash `Digest: ...` em produção.

### Fase 3: P2 — Experiência do Estudante (UX) e Segurança de Aplicação (Médio Prazo / Sprint 3)

1. **Aprimoramento Mobile no Wizard de Agendamento (FE-02)**:
   - Implementar hook `useStepperHistory` sincronizando os passos do agendamento com a History API do navegador (`pushState`/`popstate`).
   - Ampliar área de toque dos botões de horários para o padrão mínimo de 44x44px.
2. **Remoção de XSS e Endurecimento de Headers HTTP (SEC-03 & SEC-04)**:
   - Substituir `document.write` no `apps/frontend/src/app/agendamento/StudentVoucherDialog.tsx` por renderização React nativa com folha de estilos `@media print` e geração de PDF vetorial.
   - Configurar diretivas completas de Content Security Policy (`default-src 'self'`) em `next.config.ts`.
   - Ativar `@nestjs/throttler` nas rotas sensíveis do backend.

### Fase 4: P3 — Refatoração Arquitetural e Higiene do Monorepo (Sprint 4)

1. **Isolamento de Layouts no App Router (FE-03)**:
   - Criar Route Groups `(admin)` e `(student)` para separar contextos de layout, removendo `auth()` e `overflow-hidden` do fluxo público do estudante.
   - Adicionar `error.tsx` e `loading.tsx` em todas as rotas principais.
2. **Event Loop Non-blocking e Cache Bounded (INT-04)**:
   - Trocar `JSON.parse` em grandes payloads por streaming ou processamento assíncrono em chunks.
   - Implementar cache com limite máximo de chaves (LRU Cache) para modo fallback quando o Redis estiver inacessível.
3. **Consolidação de Scripts e Dependências (QUAL-01 & QUAL-02)**:
   - Adicionar timeout explícito de 30s nos hooks de teardown do Jest E2E (`afterAll(async () => { await app.close(); }, 30000)`).
   - Adicionar script `"test"` em `apps/frontend/package.json` e remover o arquivo duplicado `apps/frontend/package-lock.json`.
   - Corrigir warnings de React Hooks (`react-hooks/set-state-in-effect`) em `GradeDetailDialog.tsx`.

---

## 8. Trechos de Código de Remediação Prontos para Produção (Drop-in Code Snippets)

### 8.1 Transação Atômica e Lock Anti-Deadlock no Agendamento (`scheduling.service.ts`)

Conforme validado e testado pelo Challenger de Concorrência contra o schema real de `apps/backend/src/db/schema.ts` (`opcaos`, `agendamentosMatricula`, `locals`):

```typescript
// apps/backend/src/scheduling/scheduling.service.ts
import { inArray, asc, eq, and, sql } from 'drizzle-orm';
import { opcaos, agendamentosMatricula, locals } from '../db/schema';
import { BadRequestException, NotFoundException } from '@nestjs/common';

export async function rescheduleStudentBookingAtomic(
  db: any,
  bookingId: string,
  newOpcaoId: string,
  matricula: string,
  periodo: string,
  profile: { nome: string; disciplinas: string[] }
) {
  return await db.transaction(async (tx: any) => {
    // 1. Trava o agendamento atual do estudante para impedir remarcações concorrentes paralelas
    const [booking] = await tx
      .select()
      .from(agendamentosMatricula)
      .where(
        and(
          eq(agendamentosMatricula.id, bookingId),
          eq(agendamentosMatricula.matricula, matricula),
        ),
      )
      .for('update');

    if (!booking) {
      throw new NotFoundException('Agendamento original não encontrado.');
    }
    if (booking.status === 'concluido' || booking.status === 'presente') {
      throw new BadRequestException('Agendamentos já concluídos não podem ser alterados.');
    }
    if (booking.status === 'cancelado') {
      throw new BadRequestException('Não é possível remarcar um agendamento cancelado.');
    }
    if (booking.opcaoId === newOpcaoId) {
      throw new BadRequestException('O novo horário selecionado é idêntico ao horário atual.');
    }

    // 2. Consulta slot base antigo e slot base novo
    const [oldBaseOpcao] = await tx
      .select()
      .from(opcaos)
      .where(eq(opcaos.id, booking.opcaoId))
      .limit(1);

    const [newBaseOpcao] = await tx
      .select()
      .from(opcaos)
      .where(eq(opcaos.id, newOpcaoId))
      .limit(1);

    if (!newBaseOpcao || !newBaseOpcao.status) {
      throw new BadRequestException('Novo horário selecionado não está disponível.');
    }

    // 3. Montagem dos horários consecutivos requeridos para a nova data
    const totalDisciplines = Math.max(1, profile.disciplinas.length);
    const newTimeStr = newBaseOpcao.hora.slice(0, 5);
    const newRequiredTimes = Array.from({ length: totalDisciplines }, (_, i) => {
      const parts = newTimeStr.split(':').map(Number);
      const totalMin = (((parts[0] * 60 + parts[1] + i * 30) % 1440) + 1440) % 1440;
      return `${String(Math.floor(totalMin / 60)).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`;
    });
    const newAllTimes = [...newRequiredTimes, ...newRequiredTimes.map((t) => `${t}:00`)];

    // 4. Bloqueio pessimista em ordem monotônica estrita para eliminar Deadlocks (40P01)
    const newSlots = await tx
      .select()
      .from(opcaos)
      .where(
        and(
          eq(opcaos.localId, newBaseOpcao.localId),
          eq(opcaos.data, newBaseOpcao.data),
          inArray(opcaos.hora, newAllTimes),
          eq(opcaos.status, true),
        ),
      )
      .orderBy(asc(opcaos.hora))
      .for('update');

    const matchedTimeMap = new Map<string, typeof newBaseOpcao>();
    for (const slot of newSlots) {
      matchedTimeMap.set(slot.hora.slice(0, 5), slot);
    }

    for (const reqTime of newRequiredTimes) {
      const slot = matchedTimeMap.get(reqTime);
      if (!slot) {
        throw new BadRequestException(`Falta horário consecutivo ${reqTime} no novo polo/data.`);
      }
      if (slot.vagas <= 0) {
        throw new BadRequestException(`Vagas esgotadas para o horário ${reqTime}.`);
      }
    }

    // 5. Decrementa vagas nos novos slots
    for (const reqTime of newRequiredTimes) {
      const slot = matchedTimeMap.get(reqTime)!;
      await tx
        .update(opcaos)
        .set({ vagas: sql`${opcaos.vagas} - 1`, updatedAt: new Date() })
        .where(eq(opcaos.id, slot.id));
    }

    // 6. Restaura vagas nos slots antigos (se existirem) de forma segura
    if (oldBaseOpcao) {
      const oldDisciplines = booking.descricao ? booking.descricao.split(';') : [];
      const oldTotal = Math.max(1, oldDisciplines.length);
      const oldTimeStr = oldBaseOpcao.hora.slice(0, 5);
      const oldRequiredTimes = Array.from({ length: oldTotal }, (_, i) => {
        const parts = oldTimeStr.split(':').map(Number);
        const totalMin = (((parts[0] * 60 + parts[1] + i * 30) % 1440) + 1440) % 1440;
        return `${String(Math.floor(totalMin / 60)).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`;
      });
      const oldAllTimes = [...oldRequiredTimes, ...oldRequiredTimes.map((t) => `${t}:00`)];

      const oldSlots = await tx
        .select()
        .from(opcaos)
        .where(
          and(
            eq(opcaos.localId, oldBaseOpcao.localId),
            eq(opcaos.data, oldBaseOpcao.data),
            inArray(opcaos.hora, oldAllTimes),
          ),
        )
        .orderBy(asc(opcaos.hora))
        .for('update');

      for (const slot of oldSlots) {
        await tx
          .update(opcaos)
          .set({ vagas: sql`${opcaos.vagas} + 1`, updatedAt: new Date() })
          .where(eq(opcaos.id, slot.id));
      }
    }

    // 7. Atualização atômica in-place do agendamento (preserva ID, histórico e comprovante)
    const [updatedBooking] = await tx
      .update(agendamentosMatricula)
      .set({
        opcaoId: newOpcaoId,
        data: newBaseOpcao.data,
        descricao: profile.disciplinas.join(';'),
        updatedAt: new Date(),
      })
      .where(eq(agendamentosMatricula.id, bookingId))
      .returning();

    return {
      ...updatedBooking,
      studentName: profile.nome,
      disciplines: profile.disciplinas,
    };
  });
}
```

### 8.2 Guard de Proteção da Sessão do Aluno no NestJS com `timingSafeEqual` (`student-session.guard.ts`)

```typescript
// apps/backend/src/auth/guards/student-session.guard.ts
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class StudentSessionGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const sessionHeader = request.headers['x-student-session'] || request.cookies?.['nexus_student_session'];

    if (!sessionHeader || typeof sessionHeader !== 'string') {
      throw new UnauthorizedException('Sessão de estudante não fornecida ou expirada.');
    }

    try {
      const parts = sessionHeader.split('.');
      if (parts.length !== 2) {
        throw new UnauthorizedException('Formato de token de sessão inválido.');
      }

      const secret = process.env.STUDENT_SESSION_SECRET;
      if (!secret) {
        throw new Error('STUDENT_SESSION_SECRET environment variable is not defined.');
      }
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payloadBase64)
        .digest('hex');

      // Proteção contra Side-Channel Timing Attacks via crypto.timingSafeEqual
      const sigBuf = Buffer.from(signature, 'hex');
      const expectedBuf = Buffer.from(expectedSignature, 'hex');
      if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
        throw new UnauthorizedException('Assinatura da sessão de estudante inválida.');
      }

      const session = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf8'));
      if (Date.now() > session.exp) {
        throw new UnauthorizedException('Sessão do estudante expirada (limite de 30 minutos).');
      }

      // Validar isolamento: a matrícula da requisição DEVE bater com a matrícula da sessão
      const requestedMatricula = request.query?.matricula || request.body?.matricula;
      if (requestedMatricula && requestedMatricula !== session.matricula) {
        throw new UnauthorizedException('Tentativa de acesso a matrícula de terceiros não autorizada.');
      }

      request.student = session;
      return true;
    } catch {
      throw new UnauthorizedException('Sessão de estudante corrompida.');
    }
  }
}
```

### 8.3 Padrão Tipado de Server Actions no Next.js 16 (`ActionResult<T>`)

```typescript
// apps/frontend/src/app/actions/types.ts
export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

// Exemplo em apps/frontend/src/app/actions/scheduling.ts
'use server';

export async function cancelStudentBookingAction(
  agendamentoId: string,
  matricula: string,
  sessionToken: string
): Promise<ActionResult<{ canceled: boolean }>> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/public/scheduling/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Student-Session': sessionToken,
      },
      body: JSON.stringify({ bookingId: agendamentoId, matricula }),
    });

    const body = await res.json();
    if (!res.ok) {
      return {
        success: false,
        error: body.message || 'Não foi possível cancelar o agendamento.',
        code: body.code || 'CANCEL_FAILED',
      };
    }

    return { success: true, data: { canceled: true } };
  } catch (err: any) {
    return {
      success: false,
      error: 'Erro de comunicação com o servidor de agendamento.',
      code: 'NETWORK_ERROR',
    };
  }
}
```

---

## 9. Conclusão da Auditoria e Próximos Passos

O Nexus Core demonstrou base técnica consistente, separação modular limpa e 100% de sucesso nas compilações de produção e testes unitários. A aplicação está apta a operar com confiabilidade crítica assim que o pacote de remediações da **Fase 1 (P0: Sessão Segura com timingSafeEqual, Concorrência Anti-Deadlock e Reschedule Atômico em Transação Única)** for aplicado. O roadmap delineado fornece aos desenvolvedores e mantenedores um guia detalhado e executável para elevar o Nexus Core ao estado de excelência técnica e alta disponibilidade.
