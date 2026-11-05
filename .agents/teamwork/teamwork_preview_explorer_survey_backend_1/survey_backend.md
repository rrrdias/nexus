# Relatório Técnico de Auditoria Backend: Arquitetura, Segurança, RBAC, Banco de Dados e Concorrência de Agendamento

**Projeto**: Nexus Core Backend (`@nexus-core/backend` - NestJS 11 + Drizzle ORM + PostgreSQL + Redis + BullMQ)  
**Ambiente de Execução**: `apps/backend` e integração de proxies em `apps/frontend`  
**Data da Auditoria**: 23 de Outubro de 2026  
**Status dos Testes & Compilação**:
- `npm run build` (Backend): **Sucesso (Exit code 0)**
- `npm run test` (Backend): **26 Test Suites aprovadas, 93 testes aprovados (Exit code 0)**
- `npm run build` (Frontend): **Sucesso (Exit code 0)**

---

## 1. Resumo Executivo e Visão Geral da Arquitetura

O backend do Nexus Core foi concebido sobre o framework **NestJS 11**, operando com um banco de dados relacional primário **PostgreSQL** gerenciado via **Drizzle ORM (v0.45.2)**, filas assíncronas com **BullMQ (v6.3.6)** sobre **Redis (ioredis v6.0.0)** e integração com sistemas legados acadêmicos (banco **Lyceum em Microsoft SQL Server** via `mssql v12.5.4` e **Moodle AVA** via APIs REST externas).

A aplicação implementa autenticação administrativa via **JWT (HS256)** associada a um mecanismo de controle de acesso baseado em papéis (**RBAC**) por módulos do sistema (`system_module`) e perfil de superadministrador (`isSuperAdmin`). Adicionalmente, foi introduzido recentemente um fluxo público para agendamento presencial de provas da Graduação EaD (`/api/public/scheduling`).

### Principais Diagnósticos Identificados:
1. **Quebra de Isolamento no Agendamento Público (Severidade Crítica)**: O cookie de sessão `nexus_student_session` gerado pelo Next.js armazena a matrícula do aluno em texto puro, sem assinatura criptográfica (HMAC) e sem entropia. O backend NestJS não valida nenhum cookie ou token de sessão nos endpoints públicos de agendamento, aceitando qualquer matrícula informada no corpo JSON ou query string. Qualquer terceiro pode consultar dados pessoais protegidos pela LGPD, cancelar ou remarcar provas de qualquer estudante.
2. **Reserva Não-Atômica na Remarcação (Severidade Alta)**: O método `rescheduleStudentBooking` cancela a vaga anterior do aluno e efetua o novo agendamento em passos transacionais separados. Em caso de concorrência ou falha na segunda etapa, o agendamento original já foi cancelado e a tentativa de reversão no bloco `catch` pode falhar silenciosamente, deixando o aluno sem agendamento.
3. **Ordem Inconsistente de Locks Pessimistas (Severidade Alta)**: No método `createBooking`, o lock pessimista (`FOR UPDATE`) é adquirido primeiro sobre a vaga inicial (`opcaoId`) e, em seguida, sobre o conjunto de vagas consecutivas ordenadas por `hora`. Essa inconsistência na ordem de aquisição cria riscos de deadlocks sob alta concorrência de múltiplos alunos disputando blocos sobrepostos de horários.
4. **Ausência de Rate Limiting e Payload Exagerado (Severidade Alta)**: Não há implementação de rate limiting (`@nestjs/throttler` ou equivalente) em nenhum endpoint da aplicação (nem em `/api/auth/login`, nem no fluxo público de agendamento), e o limite global de payload está fixado em `50MB` (`main.ts`), expondo o servidor a ataques de força bruta e DoS.
5. **Gargalo Extremo no Snapshot Consolidado do AVA (Severidade Média-Alta)**: A sincronização consolidada (`refreshConsolidatedSnapshot` em `ava-sync.service.ts`) realiza um `LEFT JOIN` entre relatórios de progresso e notas utilizando múltiplas chamadas `regexp_replace` em ambos os lados da cláusula `ON`, inviabilizando o uso de índices e causando *full sequential scan* e saturação de CPU no PostgreSQL.

---

## 2. Mapeamento Exaustivo de Controllers, Rotas e Controle de Acesso (RBAC)

A aplicação conta com **13 Controllers** e **37 endpoints**. A proteção global é configurada em `app.module.ts` via dois guards aplicados a todas as rotas:
- **`JwtAuthGuard`**: Verifica o token Bearer JWT e consulta a atividade do usuário no banco com cache em memória de 30s.
- **`RbacGuard`**: Valida decoradores `@RequireAdmin()` e `@RequireModule(...)` com cache em Redis (5 min) e fallback local (60s).
- Ambas as proteções são desativadas quando a rota ou controller possui o decorador `@Public()`.

### Tabela Completa de Mapeamento de Rotas

| Controller | Método | Rota | Decoradores / Guards | Autenticação / RBAC Exigido | Status de Exposição & Riscos |
|---|---|---|---|---|---|
| **AppController** (`app.controller.ts:5`) | `GET` | `/` | `@Public()` | Nenhuma | Rota de boas-vindas / ping público. |
| **HealthController** (`health.controller.ts:6`) | `GET` | `/health` | `@Public()` | Nenhuma | Status do banco PostgreSQL e Redis. |
| **AuthController** (`auth.controller.ts:6`) | `POST` | `/api/auth/login` | `@Public()`, `@HttpCode(200)` | Nenhuma | Login administrativo. **Sem rate limiting** (força bruta). |
| **PublicSchedulingController** (`public-scheduling.controller.ts:14`) | `GET` | `/api/public/scheduling/student-flow` | `@Public()` (classe) | Nenhuma | **Exposição Indevida**: Retorna nome, e-mail, telefone e disciplinas de qualquer matrícula sem autenticação. |
| **PublicSchedulingController** (`public-scheduling.controller.ts:14`) | `GET` | `/api/public/scheduling/available-slots` | `@Public()` (classe) | Nenhuma | Consulta pública de horários disponíveis por polo. |
| **PublicSchedulingController** (`public-scheduling.controller.ts:14`) | `POST` | `/api/public/scheduling/book` | `@Public()` (classe) | Nenhuma | Reserva de prova. **Sem CSRF e sem rate limit**. |
| **PublicSchedulingController** (`public-scheduling.controller.ts:14`) | `POST` | `/api/public/scheduling/cancel` | `@Public()` (classe) | Nenhuma | **Vulnerabilidade Crítica**: Permite cancelamento de prova de terceiros apenas com matrícula e ID. |
| **PublicSchedulingController** (`public-scheduling.controller.ts:14`) | `POST` | `/api/public/scheduling/reschedule` | `@Public()` (classe) | Nenhuma | **Vulnerabilidade Crítica**: Permite sequestro/alteração de prova de terceiros. |
| **SchedulingController** (`scheduling.controller.ts:23`) | `GET` | `/api/scheduling/locals` | `@RequireModule('scheduling', 'backoffice')` | JWT + Módulo `scheduling` ou `backoffice` | Adequado para operadores do polo/backoffice. |
| **SchedulingController** (`scheduling.controller.ts:23`) | `POST` | `/api/scheduling/locals` | `@RequireAdmin()` | JWT + Super Admin | Criação de polo. Adequado. |
| **SchedulingController** (`scheduling.controller.ts:23`) | `PUT` | `/api/scheduling/locals/:id` | `@RequireAdmin()` | JWT + Super Admin | Atualização de polo. Adequado. |
| **SchedulingController** (`scheduling.controller.ts:23`) | `GET` | `/api/scheduling/options` | `@RequireModule(...)` | JWT + Módulo `scheduling` ou `backoffice` | Listagem de slots para o backoffice. |
| **SchedulingController** (`scheduling.controller.ts:23`) | `POST` | `/api/scheduling/options` | `@RequireAdmin()` | JWT + Super Admin | Criação em lote de slots de 30 min. |
| **SchedulingController** (`scheduling.controller.ts:23`) | `PUT` | `/api/scheduling/options/:id` | `@RequireAdmin()` | JWT + Super Admin | Edição de capacidade e status do slot. |
| **SchedulingController** (`scheduling.controller.ts:23`) | `GET` | `/api/scheduling/periods` | `@RequireModule(...)` | JWT + Módulo `scheduling` ou `backoffice` | Semestres disponíveis. |
| **SchedulingController** (`scheduling.controller.ts:23`) | `GET` | `/api/scheduling/profile/:matricula/:periodo` | `@RequireModule(...)` | JWT + Módulo `scheduling` ou `backoffice` | Perfil do aluno para o atendente do polo. |
| **SchedulingController** (`scheduling.controller.ts:23`) | `GET` | `/api/scheduling/attendance-list` | `@RequireModule(...)` | JWT + Módulo `scheduling` ou `backoffice` | Lista de presença de provas (folha A4). |
| **SchedulingController** (`scheduling.controller.ts:23`) | `GET` | `/api/scheduling/bookings` | `@RequireModule(...)` | JWT + Módulo `scheduling` ou `backoffice` | Listagem paginada de agendamentos. |
| **SchedulingController** (`scheduling.controller.ts:23`) | `POST` | `/api/scheduling/bookings` | `@RequireModule(...)` | JWT + Módulo `scheduling` ou `backoffice` | Agendamento manual realizado por operador. |
| **SchedulingController** (`scheduling.controller.ts:23`) | `POST` | `/api/scheduling/bookings/:id/conclude` | `@RequireAdmin()` | JWT + Super Admin | Marcação de presença. |
| **SchedulingController** (`scheduling.controller.ts:23`) | `POST` | `/api/scheduling/bookings/:id/absent` | `@RequireAdmin()` | JWT + Super Admin | Marcação de ausência. |
| **SchedulingController** (`scheduling.controller.ts:23`) | `DELETE` | `/api/scheduling/bookings/:id` | `@RequireAdmin()` | JWT + Super Admin | Cancelamento administrativo de prova. |
| **SchedulingController** (`scheduling.controller.ts:23`) | `GET` | `/api/scheduling/export` | `@RequireModule(...)` | JWT + Módulo `scheduling` ou `backoffice` | Exportação de planilha CSV com dados de alunos. |
| **SchedulingController** (`scheduling.controller.ts:23`) | `POST` | `/api/scheduling/import` | `@RequireAdmin()` | JWT + Super Admin | Importação em massa de agendamentos. |
| **AcademicController** (`academic.controller.ts:16`) | `POST` | `/api/academic/sync` | `@RequireAdmin()` | JWT + Super Admin | Disparo de sincronização com Lyceum (BullMQ). |
| **AcademicController** (`academic.controller.ts:16`) | `GET` | `/api/academic/discentes` | `@RequireModule('academic')` | JWT + Módulo `academic` | Consulta de discentes do Lyceum. |
| **AcademicController** (`academic.controller.ts:16`) | `GET` | `/api/academic/discentes/:matricula/disciplinas` | `@RequireModule('academic')` | JWT + Módulo `academic` | Disciplinas do aluno no Lyceum. |
| **AcademicController** (`academic.controller.ts:16`) | `GET` | `/api/academic/docentes` | `@RequireModule('academic')` | JWT + Módulo `academic` | Consulta de docentes do Lyceum. |
| **AcademicController** (`academic.controller.ts:16`) | `GET` | `/api/academic/docentes/:docenteId/disciplinas` | `@RequireModule('academic')` | JWT + Módulo `academic` | Disciplinas vinculadas ao docente. |
| **AcademicController** (`academic.controller.ts:16`) | `GET` | `/api/academic/turmas` | `@RequireModule('academic')` | JWT + Módulo `academic` | Turmas ativas do Lyceum. |
| **AcademicController** (`academic.controller.ts:16`) | `GET` | `/api/academic/matriculas` | `@RequireModule('academic')` | JWT + Módulo `academic` | Matrículas em turmas no Lyceum. |
| **AvaReportsController** (`ava-reports.controller.ts:9`) | `POST` | `/api/ava-reports/progress` | `@RequireModule('ava')` | JWT + Módulo `ava` | Relatório de progresso Moodle. |
| **AvaReportsController** (`ava-reports.controller.ts:9`) | `POST` | `/api/ava-reports/progress/export` | `@RequireModule('ava')` | JWT + Módulo `ava` | Exportação de progresso. |
| **AvaReportsController** (`ava-reports.controller.ts:9`) | `POST` | `/api/ava-reports/sync` | `@RequireAdmin()` | JWT + Super Admin | Enfileiramento de sync Moodle via BullMQ. |
| **AvaReportsController** (`ava-reports.controller.ts:9`) | `POST` | `/api/ava-reports/grades` | `@RequireModule('ava')` | JWT + Módulo `ava` | Relatório de notas Moodle. |
| **AvaReportsController** (`ava-reports.controller.ts:9`) | `POST` | `/api/ava-reports/grades/export` | `@RequireModule('ava')` | JWT + Módulo `ava` | Exportação de notas. |
| **AvaReportsController** (`ava-reports.controller.ts:9`) | `POST` | `/api/ava-reports/consolidated` | `@RequireModule('ava')` | JWT + Módulo `ava` | Relatório consolidado (progresso + notas). |
| **AvaReportsController** (`ava-reports.controller.ts:9`) | `POST` | `/api/ava-reports/consolidated/export` | `@RequireModule('ava')` | JWT + Módulo `ava` | Exportação consolidada. |
| **AvaReportsController** (`ava-reports.controller.ts:9`) | `GET` | `/api/ava-reports/dashboard-stats` | `@RequireModule('ava')` | JWT + Módulo `ava` | Indicadores de engajamento do AVA. |
| **AvaSyncController** (`ava-sync.controller.ts:8`) | `GET` | `/api/ava-sync` | `@Public()` | Header `Authorization: Bearer <CRON_SECRET>` | Webhook/Cron externo para sync. Validação com `timingSafeEqual`. |
| **AuditController** (`audit.controller.ts:7`) | `GET` | `/api/audit-logs` | `@RequireAdmin()` | JWT + Super Admin | Consulta de logs de auditoria. |
| **AuditController** (`audit.controller.ts:7`) | `GET` | `/api/audit-logs/stats` | `@RequireAdmin()` | JWT + Super Admin | Estatísticas de auditoria. |
| **AuditController** (`audit.controller.ts:7`) | `POST` | `/api/audit-logs/export` | `@RequireAdmin()` | JWT + Super Admin | Exportação de logs de auditoria. |
| **GroupsController** (`groups.controller.ts:17`) | `CRUD` | `/api/groups` (5 rotas) | `@RequireAdmin()` | JWT + Super Admin | Gerenciamento de grupos de permissão. |
| **JobsController** (`jobs.controller.ts:6`) | `GET` | `/api/jobs/:queue/:id/status` | `@RequireModule('academic', 'ava')` | JWT + Módulo `academic` ou `ava` | Consulta de status de jobs BullMQ. |
| **SystemController** (`system.controller.ts:5`) | `GET` | `/api/system/modules` | Autenticado básico (sem restrição) | JWT válido | Lista de módulos ativos do sistema. |
| **SystemController** (`system.controller.ts:5`) | `GET` | `/api/system/sidebar-modules` | Autenticado básico (sem restrição) | JWT válido | Módulos permitidos ao usuário logado. |
| **SystemController** (`system.controller.ts:5`) | `GET` | `/api/system/admin-dashboard` | `@RequireAdmin()` | JWT + Super Admin | Indicadores globais de uso do sistema. |
| **UsersController** (`users.controller.ts:18`) | `CRUD` | `/api/users` (6 rotas) | `@RequireAdmin()` | JWT + Super Admin | Gestão completa de usuários e privilégios. |

---

## 3. Análise da Sessão Temporária do Estudante (`nexus_student_session`)

### 3.1. Arquitetura Atual
A sessão do estudante é orquestrada exclusivamente pelo frontend Next.js em `apps/frontend/src/middleware.ts` (linhas 20-39) e `apps/frontend/src/app/agendamento/page.tsx` (linhas 37-42):

```typescript
// apps/frontend/src/middleware.ts (linhas 21-37)
const urlMat =
  req.nextUrl.searchParams.get('matricula')?.trim() ||
  req.nextUrl.searchParams.get('userid')?.trim()
const existingCookie = req.cookies.get('nexus_student_session')?.value?.trim()
const activeMatricula = urlMat || existingCookie

if (activeMatricula) {
  const res = NextResponse.next()
  res.cookies.set('nexus_student_session', activeMatricula, {
    maxAge: 30 * 60, // 30 minutos (1800s)
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  })
  return res
}
```

### 3.2. Vulnerabilidades Críticas e Falhas de Design
1. **Entropia Zero e Ausência de Assinatura Criptográfica**:
   - O cookie `nexus_student_session` armazena o valor literal da matrícula (ex.: `"2026001"`).
   - O cookie não possui assinatura criptográfica (sem HMAC via secret key), permitindo que qualquer usuário altere o valor do cookie diretamente no navegador ou via cabeçalho HTTP para se passar por qualquer aluno.
2. **Desconexão Total entre Frontend e Backend**:
   - O backend NestJS (`PublicSchedulingController`) **não lê, não valida e não tem ciência do cookie `nexus_student_session`**.
   - As Server Actions do Next.js (`apps/frontend/src/app/actions/student-scheduling.ts`) não enviam o cookie nem nenhum token para a API backend.
   - Os endpoints backend recebem a matrícula como parâmetro arbitrário de query ou body JSON.
3. **Substituição Trivial de Sessão via URL Parameter**:
   - Em `apps/frontend/src/app/agendamento/page.tsx`:
     ```typescript
     const activeMatricula = matricula?.trim() || userid?.trim() || sessionCookie?.trim() || ""
     ```
   - Se um atacante induzir um aluno a clicar em um link contendo `?matricula=OUTRA_MATRICULA`, o parâmetro sobrescreve o cookie do aluno, sequestrando o fluxo.
4. **Ausência de Tokens CSRF nos Endpoints Públicos**:
   - Com `sameSite: 'lax'` e ausência de verificação de cabeçalhos de origem (`Origin` / `Referer`) ou tokens anti-CSRF no NestJS, scripts ou formulários podem disparar `POST /api/public/scheduling/cancel` ou `POST /api/public/scheduling/book`.

---

## 4. Análise do Esquema do Banco de Dados (Drizzle ORM)

O schema está consolidado em `apps/backend/src/db/schema.ts`. Foram auditadas as tabelas centrais: `opcaos`, `agendamentos_matricula`, `locals`, `ava_progress_report`, `ava_grades_report` e `ava_consolidated_report`.

### 4.1. Tabela `opcao` (`opcaos` em `schema.ts:369-390`)
- **Campos**: `id` (PK, uuid text), `localId` (FK -> `local.id`), `data` (timestamp mode date), `hora` (text, formato `HH:MM:00`), `vagas` (integer), `status` (boolean), `createdAt`, `updatedAt`.
- **Índices Existentes**:
  - `idx_opcao_local`: `(localId)`
  - `idx_opcao_data`: `(data)`
  - `idx_opcao_local_status_data`: `(localId, status, data)`
- **Fragilidades Encontradas**:
  - **Falta de Constraint UNIQUE `(localId, data, hora)`**: Nada impede que dois administradores ou scripts de importação concorrentes criem dois registros de slots idênticos para o mesmo polo, na mesma data e no mesmo horário.
  - **Desnormalização de Contagem de Vagas**: O campo `vagas` armazena o saldo disponível de vagas e é decrementado/incrementado manualmente. Caso ocorra uma falha de atualização ou exclusão manual no banco, o saldo desvia irremediavelmente do número real de agendamentos vinculados.

### 4.2. Tabela `agendamentos_matricula` (`schema.ts:392-418`)
- **Campos**: `id` (PK, uuid text), `opcaoId` (FK -> `opcao.id`), `matricula` (text), `descricao` (text com disciplinas separadas por `;`), `status` (text: `'ativo' | 'concluido' | 'cancelado' | 'ausente' | 'presente'`), `periodo` (text), `data` (timestamp), `createdAt`, `updatedAt`, `deletedAt` (timestamp).
- **Índices Existentes**:
  - `uniqueIndex('unq_agendamento_matricula_periodo_ativo').on(t.matricula, t.periodo).where(sql\`"deletedAt" IS NULL\`)`
  - `idx_agendamento_opcao`: `(opcaoId)`
  - `idx_agendamento_matricula`: `(matricula)`
  - `idx_agendamento_periodo_status`: `(periodo, status)`
- **Fragilidades Encontradas**:
  - **Sensibilidade a Maiúsculas/Minúsculas no Índice Único**: O índice único condicional do PostgreSQL compara strings de texto com distinção de maiúsculas/minúsculas. Se um aluno submeter `G2610162` e em seguida `g2610162`, o banco permite a inserção duplicada de agendamentos no mesmo período. O índice deve ser criado sobre `(upper(matricula), periodo)`.
  - **Índice para Contagem de Vagas Ocupadas**: `idx_agendamento_opcao` indexa apenas `(opcaoId)`. Consultas de vagas precisam verificar `deletedAt IS NULL AND status = 'ativo'`, exigindo index scans com filtragem adicional em heap.

### 4.3. Tabela `local` (`locals` em `schema.ts:356-367`)
- **Campos**: `id` (PK), `nome` (text), `endereco` (text), `linkLocal` (text), `telefone` (text), `status` (boolean), `createdAt`, `updatedAt`.
- **Fragilidades Encontradas**:
  - Não possui nenhum índice além da chave primária. Consultas ordenadas por `nome` (`orderBy(locals.nome)`) ou filtradas por `status` executam *sequential scan*. Recomenda-se índice em `(status, nome)`.

### 4.4. Tabelas de Relatórios AVA (`schema.ts:136-350`)
- `ava_progress_report` e `ava_grades_report` contam com índices compostos para filtros de perfil e índices GIN trgm para busca textual.
- A tabela `ava_consolidated_report` possui constraint única em `("sourceInstitution", aluno_id, curso)`. No entanto, como demonstrado na Seção 6, a query de carga do snapshot possui um gargalo crítico de join.

---

## 5. Análise de Concorrência, Transações e Reserva de Vagas

O processo de agendamento presencial é modelado em torno de blocos consecutivos de 30 minutos (1 bloco de 30 minutos por disciplina regular matriculada).

### 5.1. Mecanismo de Reserva (`createBooking` em `scheduling.service.ts:617-760`)
1. **Verificação de Agendamento Prévio (Linhas 632-649)**:
   ```typescript
   const existing = await tx
     .select()
     .from(agendamentosMatricula)
     .where(
       and(
         ilike(agendamentosMatricula.matricula, profile.matricula),
         eq(agendamentosMatricula.periodo, periodo),
         eq(agendamentosMatricula.status, 'ativo'),
         isNull(agendamentosMatricula.deletedAt),
       ),
     )
     .limit(1);
   ```
   *Nota*: A consulta não utiliza `FOR UPDATE`, porém o banco possui a constraint parcial única `unq_agendamento_matricula_periodo_ativo`.
2. **Lock Pessimista da Opção Base (Linhas 652-657)**:
   ```typescript
   const [opcao] = await tx
     .select()
     .from(opcaos)
     .where(eq(opcaos.id, opcaoId))
     .for('update');
   ```
3. **Cálculo de Horários Consecutivos (Linhas 681-695)**:
   Para um estudante com $N$ disciplinas, gera os horários: $H_0, H_0 + 30\text{min}, \dots, H_0 + (N-1) \times 30\text{min}$.
4. **Lock Pessimista dos Slots Consecutivos (Linhas 697-710)**:
   ```typescript
   const slots = await tx
     .select()
     .from(opcaos)
     .where(
       and(
         eq(opcaos.localId, opcao.localId),
         eq(opcaos.data, opcao.data),
         inArray(opcaos.hora, allPossibleTimes),
         eq(opcaos.status, true),
       ),
     )
     .orderBy(opcaos.hora)
     .for('update');
   ```
5. **Decremento de Vagas e Inserção (Linhas 730-753)**:
   Atualiza `vagas = slot.vagas - 1` para cada slot do bloco e insere o registro em `agendamentosMatricula`.

### 5.2. Riscos de Deadlock e Inconsistência de Lock
- **Ordem de Aquisição dos Locks**:
  A linha 656 adquire lock em `opcaoId` arbitrário antes do conjunto ordenado da linha 709.
  Considere o seguinte cenário com dois alunos concorrendo no mesmo polo e data:
  - Aluno 1 necessita de 2 slots (08:30 e 09:00), selecionando a opção base 08:30.
  - Aluno 2 necessita de 2 slots (08:00 e 08:30), selecionando a opção base 08:00.
  - Transação 1 bloqueia `08:30` (linha 656).
  - Transação 2 bloqueia `08:00` (linha 656).
  - Transação 2 executa a linha 709 para ordenar e bloquear `[08:00, 08:30]`: obtém `08:00` e bloqueia aguardando `08:30` (em posse da Transação 1).
  - Se houver outro fluxo invertendo o acesso ou locks adicionais, pode ocorrer deadlock.
  *Recomendação*: Não travar a opção base separadamente. Calcular primeiro os horários necessários e executar um **único** `SELECT ... FOR UPDATE` ordenado por `(data, hora)`.

### 5.3. Cancelamento e Remarcação: Quebra de Atomicidade

#### A. Falha de Atomicidade em `rescheduleStudentBooking` (`scheduling.service.ts:1583-1646`):
```typescript
// 1. Libera a vaga do agendamento antigo (EFETUA COMMIT NO BANCO)
await this.cancelBooking(bookingId);

try {
  // 2. Reserva o novo horário (OUTRA TRANSAÇÃO SEPARADA)
  const newBooking = await this.createBooking({
    opcaoId: newOpcaoId,
    matricula,
    periodo,
  });
  return newBooking;
} catch (err: any) {
  // 3. Em caso de falha, tenta restaurar o agendamento anterior
  try {
    await this.createBooking({
      opcaoId: booking.opcaoId,
      matricula,
      periodo,
    });
  } catch {
    // SILENCIOSO SE NÃO CONSEGUIR REVERTER!
  }
  throw err;
}
```
**Impacto Grave**:
Se o aluno tentar remarcar para um horário que esgotou no mesmo milissegundo:
1. Sua vaga anterior já foi cancelada e devolvida ao polo.
2. A tentativa de novo agendamento falha.
3. No bloco `catch`, outro aluno já pode ter reservado a vaga original dele. A reversão falha silenciosamente (`catch {}`) e o aluno perde o agendamento original, ficando sem vaga e sem comprovação no sistema!
**Solução**: Toda a operação de remarcação deve ocorrer dentro de um único bloco `db.transaction(async (tx) => { ... })`.

#### B. Mismatch de Formato de Hora em `cancelBooking` (`scheduling.service.ts:786-802`):
Em `createBooking`, o sistema previne divergências de formatação buscando tanto `HH:MM` quanto `HH:MM:00` (`allPossibleTimes`).  
Porém, no cancelamento (`cancelBooking`, linha 798):
```typescript
inArray(opcaos.hora, requiredTimes) // requiredTimes gera apenas '08:00:00'
```
Se a opção foi cadastrada com hora `'08:00'` (5 caracteres), a consulta `inArray` não retorna nenhuma linha. As vagas não são incrementadas e o polo perde capacidade permanentemente a cada cancelamento!

---

## 6. Resiliência e Integridade nas Integrações (Moodle AVA e Lyceum)

### 6.1. Sincronização Moodle AVA (`AvaSyncService` e `AvaSyncProcessor`)
- Execução assíncrona desacoplada via BullMQ (`QUEUE_AVA_SYNC`, concorrência 2).
- Tratamento de status da API Moodle: gerencia retornos com status `'queued'` (OpenLMS assíncrono).
- **Gargalo Crítico de Performance no Snapshot Consolidado**:
  Em `ava-sync.service.ts` (linhas 223-233), o `LEFT JOIN` entre `ava_progress_report` e `ava_grades_report` utiliza:
  ```sql
  LEFT JOIN ava_grades_report g
    ON p."sourceInstitution" = g."sourceInstitution"
   AND (p.aluno_id = g.user_id OR p.matricula = g.user_identification)
   AND (
     p.curso = g.course_fullname 
     OR p.curso = g.course_shortname
     OR regexp_replace(p.curso, '[^a-zA-Z0-9]', '', 'g') = regexp_replace(g.course_fullname, '[^a-zA-Z0-9]', '', 'g')
     OR regexp_replace(p.curso, '[^a-zA-Z0-9]', '', 'g') = regexp_replace(g.course_shortname, '[^a-zA-Z0-9]', '', 'g')
   )
  ```
  O uso de `regexp_replace` em ambos os lados de um `OR` em joins impede o planejador do PostgreSQL de utilizar índices btree ou hash. Para 50.000 alunos e cursos, o banco avalia até 2,5 bilhões de regex dinâmicos, causando travamentos de CPU (100%) e esgotamento do pool de conexões.
  *Solução*: Criar uma coluna gerada ou pré-calculada `curso_normalized` em ambas as tabelas indexada com btree comum.

### 6.2. Sincronização Lyceum MSSQL (`AcademicSyncService` e `AcademicSyncProcessor`)
- Execução agendada diária às 03:00 via `@Cron('0 3 * * *')` e sob demanda via fila BullMQ (`QUEUE_ACADEMIC_SYNC`, concorrência 1).
- Processamento em lotes de 1.000 registros para evitar estouro de memória no Node.js.
- **Interpolação de Strings SQL em Queries MSSQL**:
  Em `academic-sync.service.ts` (linhas 65 e 74):
  ```typescript
  const periodsInStr = activePeriods.map((p) => `'${p}'`).join(',');
  const turmasRes = await lyceumPool.request().query(`
    ... WHERE T.PERIODO IN (${periodsInStr})
  `);
  ```
  Embora `activePeriods` provenha de variável de ambiente, a prática de interpolação em strings SQL expõe riscos de injeção caso o valor seja alterado ou injetado dinamicamente no futuro. Deve ser utilizado `request.input()`.

---

## 7. Análise de Vulnerabilidades de Segurança, Sanitização, CORS e Headers HTTP

### 7.1. Injeção de SQL
- **PostgreSQL / Drizzle ORM**: Praticamente todas as queries utilizam os helpers do Drizzle (`eq`, `and`, `or`, `inArray`, `sql` tagged template) que compilam para queries parametrizadas (`$1`, `$2`), impedindo SQL injection no Postgres.
- **MSSQL (Lyceum)**: Identificadas interpolações diretas de strings em `academic-sync.service.ts:74` e em `academic.service.ts:296` (`SELECT COLUMN_NAME FROM ... WHERE TABLE_NAME = '${viewName}'`).

### 7.2. Sanitização e Validação de Entrada
- Em `main.ts` (linhas 52-61), o `ValidationPipe` global está configurado com `forbidNonWhitelisted: false`. Parâmetros não mapeados são silenciosamente descartados em vez de rejeitados com erro 400.
- Vários endpoints utilizam tipos inline (`body: { bookingId: string; matricula: string }` em `public-scheduling.controller.ts:60, 76` e `body: { bookings: any[] }` em `scheduling.controller.ts:199`). Como tipos inline não emitem metadados de classe no runtime do TypeScript, o `ValidationPipe` não aplica nenhuma validação a essas entradas.

### 7.3. Configuração de CORS
- Definida em `main.ts:32-49` e `config/app-config.ts:76-92`.
- Suporta origens configuradas via variáveis de ambiente (`CORS_ALLOWED_ORIGINS`, `FRONTEND_URL`, etc.) e padrões com curinga (ex.: `*.unievangelica.edu.br`).
- Permite requisições sem origem (`if (!origin) return true;`) para integrações server-to-server.
- `credentials: true` está ativo.

### 7.4. Headers de Segurança (Helmet)
- Configuração em `main.ts:16-21`:
  ```typescript
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );
  ```
- **Risco**: CSP (`Content-Security-Policy`) está completamente desligada no backend.
- Headers ativos: `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Strict-Transport-Security` (quando em HTTPS), `X-DNS-Prefetch-Control`.

### 7.5. Ausência de Rate Limiting e Limite de Payload
- **Rate Limiting**: Inexistente. A biblioteca `@nestjs/throttler` não está instalada nem configurada.
- **Payload Limit**: Configurado para `50mb` globalmente (`app.use(json({ limit: '50mb' }))`). Qualquer usuário ou bot pode enviar payloads gigantescos para endpoints públicos, provocando sobrecarga de memória e congelamento do event loop durante a desserialização JSON.

---

## 8. Matriz de Recomendações e Roadmap Priorizado

### Classificação por Gravidade

| ID | Classificação | Apontamento / Vulnerabilidade | Impacto | Esforço | Arquivos Envolvidos |
|---|---|---|---|---|---|
| **SEC-01** | **Crítico** | Falta de proteção/autenticação no fluxo de agendamento público (`student-flow`, `cancel`, `reschedule`). Vazamento de dados de estudantes e cancelamento indevido de provas por terceiros. | Alto | Médio | `public-scheduling.controller.ts`<br>`student-scheduling.ts`<br>`middleware.ts` |
| **CONC-01** | **Crítico** | Quebra de atomicidade no reagendamento de provas (`rescheduleStudentBooking`). Cancelamento prévio sem garantia do novo agendamento. | Alto | Médio | `scheduling.service.ts:1583` |
| **SEC-02** | **Alto** | Cookie `nexus_student_session` sem assinatura criptográfica (HMAC) e sem validação no backend NestJS. | Alto | Médio | `apps/frontend/src/middleware.ts`<br>`auth/jwt-auth.guard.ts` |
| **SEC-03** | **Alto** | Ausência completa de Rate Limiting nos endpoints de login (`/api/auth/login`) e agendamento público (`/api/public/scheduling/*`). | Alto | Baixo | `main.ts`<br>`app.module.ts` |
| **CONC-02** | **Alto** | Mismatch de formato de hora (`HH:MM` vs `HH:MM:00`) no cancelamento de vagas (`cancelBooking`), impedindo a devolução de vagas ao polo. | Alto | Baixo | `scheduling.service.ts:798` |
| **PERF-01** | **Alto** | Junção com `regexp_replace` dinâmico em ambos os lados no snapshot consolidado do Moodle AVA, causando 100% de CPU no PostgreSQL. | Alto | Médio | `ava-sync.service.ts:223` |
| **DB-01** | **Médio** | Falta de constraint única `(localId, data, hora)` na tabela `opcao`, permitindo criação duplicada de horários para a mesma sala/polo. | Médio | Baixo | `db/schema.ts:370` |
| **DB-02** | **Médio** | Sensibilidade de caixa (case-sensitivity) no índice único condicional de `agendamentos_matricula`. | Médio | Baixo | `db/schema.ts:411` |
| **SEC-04** | **Médio** | Limite global de payload de 50MB sem proteção específica para rotas públicas e ausência de DTOs tipados em cancelamento/remarcação. | Médio | Baixo | `main.ts:27`<br>`public-scheduling.controller.ts:60` |
| **SEC-05** | **Baixo** | Interpolação direta de parâmetros em strings SQL no cliente MSSQL do Lyceum. | Baixo | Baixo | `academic-sync.service.ts:65` |

---

### Plano de Ação Recomendado (Próximos Passos)

1. **Implementar `StudentSessionGuard` com JWT Assinado ou Sessão Redis**:
   - Criar endpoint para validação da matrícula e emissão de um token de sessão assinado (JWT com secret temporário ou token de alta entropia armazenado no Redis com TTL de 30 minutos).
   - O cookie `nexus_student_session` deve armazenar este token criptográfico.
   - O `PublicSchedulingController` deve exigir o token em todas as operações de agendamento, cancelamento e remarcação, garantindo que o requisitante só possa agir sobre a matrícula vinculada à sua sessão.

2. **Tornar o Reagendamento Estritamente Atômico**:
   - Refatorar `rescheduleStudentBooking` para executar dentro de uma única transação Drizzle `db.transaction(async (tx) => { ... })`.
   - Adquirir os locks do agendamento atual, dos slots liberados e dos novos slots necessários em sequência ordenada.
   - Realizar o swap das vagas e atualizar a referência `opcaoId` em uma única operação ACID.

3. **Instalar `@nestjs/throttler`**:
   - Configurar rate limiting global (ex.: 100 req/min por IP) e restrições severas em `/api/auth/login` (ex.: 5 tentativas/min) e `/api/public/scheduling/book` (ex.: 10 req/min).

4. **Padronizar e Normalizar Chaves de Busca no Banco**:
   - Alterar o índice parcial único de agendamentos para `CREATE UNIQUE INDEX ... ON agendamentos_matricula (UPPER(matricula), periodo) WHERE "deletedAt" IS NULL`.
   - Normalizar strings de curso nas tabelas de relatórios AVA para colunas pré-calculadas `curso_normalized`, eliminando `regexp_replace` dos joins em tempo de execução.
   - Corrigir a query de devolução de vagas em `cancelBooking` para aceitar formatos de hora normalizados com `allPossibleTimes`.
