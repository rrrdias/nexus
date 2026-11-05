# Relatório de Revisão Independente e Crítica Adversarial — Auditoria Nexus Core

**Documento Auditado**: `AUDIT_REPORT_AND_ROADMAP.md`  
**Data da Revisão**: 2026-10-23T12:38:00Z  
**Revisor / Crítico**: Secondary Reviewer & Adversarial Critic (`teamwork_preview_reviewer_2`)  
**Parent Conversation ID**: `27e91390-bd43-444c-a451-05eaa934d0b8`  

---

## 1. Sumário da Revisão e Veredito Executivo

### **Verdict: REQUEST_CHANGES**

### Justificativa do Veredito:
Embora o documento `AUDIT_REPORT_AND_ROADMAP.md` apresente uma síntese de alta qualidade das vulnerabilidades sistêmicas do Nexus Core (especialmente nos diagnósticos conceituais de concorrência, deadlocks, XSS, RBAC e falhas de resiliência no AVA/Lyceum), a auditoria independente e o teste de estresse adversarial identificaram **inconsistências graves que impedem a aprovação no estado atual**:

1. **Descumprimento do Critério de Aceite 2 (AC2)**: A auditoria afirmou ter mapeado "100% dos controllers (13) e rotas (38)", mas **omitiu completamente 3 controllers inteiros** (`AuditController`, `JobsController` e `SystemController`) e **alucinou/inventou rotas inexistentes** em `AvaSyncController`, `AvaReportsController` e `AcademicController`, omitindo a rota `@Public()` real `GET /api/ava-sync`.
2. **Incompatibilidade Fatal do Snippet Drizzle ORM (Seção 8.1) com o Schema Real**: O código proposto como "drop-in production" referencia colunas fictícias que não existem em `apps/backend/src/db/schema.ts` (`opcaos.vagasDisponiveis`, `opcaos.vagasOcupadas`, `opcaos.horaInicio`, `agendamentosMatricula.localId`, etc.) e propõe um bloqueio pessimista ordenado por `id` (UUID aleatório) sobre **todas as vagas do polo no dia**, o que geraria um gargalo catastrófico de concorrência equivalente a um table lock diário.
3. **Vulnerabilidade a Ataque de Tempo (Timing Attack) no Guard HMAC (Seção 8.2)**: A verificação de assinatura da sessão do aluno utiliza comparação direta de strings (`signature !== expectedSignature`) em vez de `crypto.timingSafeEqual`, além de manter um fallback perigoso (`'nexus-secret-fallback'`).
4. **Mismatch de Contrato na Server Action (Seção 8.3)**: O payload do snippet utiliza `agendamentoId`, enquanto o endpoint real do NestJS exige estritamente a chave `bookingId`, gerando `400 Bad Request` em tempo de execução.

---

## 2. Apontamentos Detalhados (Findings)

### Finding 1 [CRÍTICO] — Falha de Integridade e Descumprimento de AC2 no Mapeamento de Controllers e Rotas

- **O que**: A Tabela 2.1 ("Mapeamento e Conferência de 100% dos Controllers e Rotas Expostas no Backend") afirma mapear 13 controllers e 38 endpoints. Na realidade, a tabela contém apenas 10 controllers e omite 3 controllers inteiros do backend NestJS. Além disso, rotas reais foram substituídas por rotas fictícias.
- **Onde**: `AUDIT_REPORT_AND_ROADMAP.md:33-77` vs codebase em `apps/backend/src/`.
- **Evidências no Código-Fonte**:
  1. **Controllers Omitidos**:
     - `AuditController` (`apps/backend/src/audit/audit.controller.ts`): expõe 3 endpoints administrativos em `/api/audit-logs` protegidos por `@RequireAdmin()`.
     - `JobsController` (`apps/backend/src/jobs/jobs.controller.ts`): expõe `/api/jobs/:queue/:id/status` protegido por `@RequireModule('academic', 'ava')`.
     - `SystemController` (`apps/backend/src/system/system.controller.ts`): expõe `/api/system/modules` (sem decorators específicos), `/api/system/sidebar-modules` e `/api/system/admin-dashboard`.
  2. **Rotas Fictícias Documentadas em Vez das Rotas Reais**:
     - `AvaSyncController`: A tabela lista `POST /ava-sync/trigger`, `GET /ava-sync/status/:jobId` e `GET /ava-sync/history`. **Nenhuma dessas rotas existe no controller!** O controller real (`apps/backend/src/ava-sync/ava-sync.controller.ts`) possui apenas um endpoint: `GET /api/ava-sync`, que é decorado com `@Public()` e autenticado via `process.env.CRON_SECRET` com `timingSafeEqual`.
     - `AvaReportsController`: A tabela lista `GET /ava-reports/consolidated` e `GET /ava-reports/summary`. No código real (`ava-reports.controller.ts`), as rotas são `POST /api/ava-reports/progress`, `POST /api/ava-reports/progress/export`, `POST /api/ava-reports/grades`, `POST /api/ava-reports/grades/export`, `POST /api/ava-reports/sync` e `GET /api/ava-reports/dropdowns`, sob `@RequireModule('ava')`.
     - `AcademicController`: A tabela lista `GET /academic/consolidated` e `GET /academic/student/:matricula`. No código real (`academic.controller.ts`), as rotas são `GET /api/academic/discentes`, `GET /api/academic/discentes/:matricula/disciplinas`, `GET /api/academic/docentes`, `GET /api/academic/turmas` e `GET /api/academic/matriculas`.
  3. **Impacto de Segurança**: A rota `GET /api/ava-sync` é uma superfície pública (`@Public()`) que dispara tarefas pesadas de sincronização com o Moodle de 6 instituições. Omissão dessa rota na tabela de auditoria significa que a superfície de ataque não foi completamente catalogada.
- **Sugestão de Correção**: Atualizar a Tabela 2.1 com a totalidade dos 13 controllers reais e suas 45+ rotas HTTP autênticas mapeadas diretamente do código-fonte.

---

### Finding 2 [CRÍTICO] — Divergência de Schema e Falha de Bloqueio no Snippet Drizzle ORM 8.1

- **O que**: O trecho de código `createBookingAtomic` e `rescheduleStudentBookingAtomic` na Seção 8.1 é incompatível com o schema do Drizzle ORM em `apps/backend/src/db/schema.ts` e introduz um gargalo severo de contenção.
- **Onde**: `AUDIT_REPORT_AND_ROADMAP.md:358-468` vs `apps/backend/src/db/schema.ts:370-420`.
- **Evidências no Código-Fonte**:
  1. **Colunas Inexistentes Referenciadas**:
     - `opcaos.vagasDisponiveis` e `opcaos.vagasOcupadas`: O schema real possui apenas `vagas: integer` (representando vagas livres restantes).
     - `opcaos.horaInicio`: O schema real possui apenas `hora: text`.
     - `agendamentosMatricula.localId`, `agendamentosMatricula.horaInicio`, `agendamentosMatricula.duracaoMinutos`, `agendamentosMatricula.disciplinas`: Nenhuma dessas colunas existe na tabela `agendamentos_matricula`. A tabela real armazena `opcaoId`, `matricula`, `descricao` (disciplinas separadas por `;`), `status`, `periodo`, `data`, `createdAt`, `updatedAt`, `deletedAt`.
     - Executar esse snippet no backend resultará em erro fatal de compilação TypeScript e exceção de SQL do PostgreSQL por coluna inexistente.
  2. **Falha de Bloqueio Monotônico e Table Lock Equivalente**:
     - O snippet propõe:
       ```typescript
       const candidateSlots = await tx
         .select()
         .from(opcaos)
         .where(
           and(
             eq(opcaos.localId, localId),
             eq(opcaos.data, data),
             sql`${opcaos.vagasDisponiveis} - ${opcaos.vagasOcupadas} >= 1`
           )
         )
         .orderBy(asc(opcaos.id))
         .for('update');
       ```
     - Esta query aplica `FOR UPDATE` sobre **TODOS os slots do campus para aquela data**, ordenando por `id` (um UUID aleatório). Isso bloqueia indiscriminadamente qualquer outro aluno tentando agendar qualquer outro horário naquele polo para aquele dia!
     - Além disso, ordenar por UUID aleatório `id` não resolve a linearidade temporal das vagas consecutivas.
  3. **Contraste com a Solução Correta do Concurrency Challenger**:
     - O arquivo `.agents/teamwork/teamwork_preview_challenger_concurrency_1/concurrency_audit.md` (Seção 6) possui a implementação matematicamente correta e perfeitamente compatível com o schema real: calcula os horários exatos necessários (`allPossibleTimes`), filtra por `inArray(opcaos.hora, allPossibleTimes)` e ordena estritamente por `opcaos.hora` com trava pessimista pontual.
- **Sugestão de Correção**: Substituir o snippet 8.1 pela versão real do `concurrency_audit.md`, que opera com as colunas reais `opcaos.hora`, `opcaos.vagas` e `agendamentosMatricula.opcaoId`.

---

### Finding 3 [MAIOR] — Vulnerabilidade a Timing Attack e Fallback Fraco no StudentSessionGuard (Seção 8.2)

- **O que**: O guard de validação de sessão do estudante compara assinaturas HMAC via igualdade comum de strings e aceita um segredo de fallback inseguro.
- **Onde**: `AUDIT_REPORT_AND_ROADMAP.md:488-496` (`StudentSessionGuard`).
- **Análise Adversarial**:
  1. **Ataque de Tempo (Side-Channel Timing Attack)**:
     ```typescript
     if (signature !== expectedSignature) {
       throw new UnauthorizedException('Assinatura da sessão de estudante inválida.');
     }
     ```
     O operador `!==` do JavaScript compara caracteres sequencialmente e encerra no primeiro byte divergente. Isso permite a atacantes reconstruir a assinatura hexadecimal byte a byte medindo a latência da resposta em redes de baixa latência ou ambiente local.
     *Correção*: Utilizar `crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSignature, 'hex'))` (com validação prévia de tamanho idêntico dos buffers).
  2. **Insegurança do Segredo de Fallback**:
     ```typescript
     process.env.STUDENT_SESSION_SECRET || 'nexus-secret-fallback'
     ```
     Se a variável de ambiente não for configurada no deploy, qualquer usuário ciente do código-fonte público/auditado pode forjar sessões válidas para qualquer matrícula. O guard deve falhar estritamente na inicialização caso `STUDENT_SESSION_SECRET` não esteja definido.
  3. **Extração de Matrícula Restrita**:
     A linha `const requestedMatricula = request.query?.matricula || request.body?.matricula` não cobre parâmetros de rota (`request.params?.matricula`). Se um endpoint usar `/api/public/scheduling/student/:matricula`, a checagem é burlada.
- **Sugestão de Correção**: Aplicar `crypto.timingSafeEqual`, exigir secret obrigatório sem fallback permissivo e cobrir `request.params`.

---

### Finding 4 [MAIOR] — Mismatch de Contrato na Server Action `cancelStudentBookingAction` (Seção 8.3)

- **O que**: O snippet da Server Action envia um payload com nomes de campos incompatíveis com o controller NestJS.
- **Onde**: `AUDIT_REPORT_AND_ROADMAP.md:529-543` vs `apps/backend/src/scheduling/public-scheduling.controller.ts:58-69`.
- **Evidências no Código-Fonte**:
  1. No snippet 8.3:
     ```typescript
     body: JSON.stringify({ agendamentoId, matricula }),
     ```
  2. No backend NestJS real:
     ```typescript
     @Post('cancel')
     async cancelStudentBooking(
       @Body() body: { bookingId: string; matricula: string },
     ) {
       if (!body?.bookingId || !body?.matricula) {
         throw new BadRequestException('bookingId e matricula são obrigatórios.');
       }
       ...
     }
     ```
  3. Como a propriedade enviada é `agendamentoId` e o backend valida estritamente `!body?.bookingId`, a requisição sempre falhará com HTTP 400 Bad Request.
  4. O path informado no snippet (`/scheduling/public/cancel`) também diverge do path real do controller (`/api/public/scheduling/cancel`).
- **Sugestão de Correção**: Ajustar o payload para `{ bookingId: agendamentoId, matricula }` e o path para `/api/public/scheduling/cancel`.

---

### Finding 5 [MENOR] — Caminho Impreciso do Arquivo `StudentVoucherDialog.tsx`

- **O que**: O relatório aponta o arquivo como `apps/frontend/src/components/StudentVoucherDialog.tsx:46-56, 330-356`.
- **Onde**: `AUDIT_REPORT_AND_ROADMAP.md:103`.
- **Diagnóstico**: O arquivo reside fisicamente em `apps/frontend/src/app/agendamento/StudentVoucherDialog.tsx`. O diagnóstico de XSS (`document.write` sem escape) está 100% correto, mas o path indicado no relatório não existe.

---

## 3. Verificação Independente de Reivindicações (Verified Claims)

| Reivindicação / Diagnóstico | Arquivo / Alvo | Método de Verificação | Veredito |
|---|---|---|---|
| **Testes Unitários Backend: 93/93 Aprovados** | `apps/backend` | Execução `npm run test` (Jest) | **CONFIRMADO** (26 suites, 93 testes passaram em 6.48s) |
| **Build Frontend Next.js: 32 Rotas Compiladas** | `apps/frontend` | Execução `npm run build` (Turbopack) | **CONFIRMADO** (0 erros, 32 rotas em 13.2s) |
| **Alerta de Múltiplos Lockfiles** | Raiz e `apps/frontend` | Verificação do output do build | **CONFIRMADO** (`Detected additional lockfiles`) |
| **Script de Testes Frontend Ausente** | `apps/frontend/package.json` | Leitura do package.json | **CONFIRMADO** (Apenas dev, build, start, lint) |
| **Vulnerabilidade IDOR / Impersonação de Alunos** | `middleware.ts` & `public-scheduling.controller.ts` | Inspeção de código | **CONFIRMADO** (Cookie em texto puro, backend sem validação) |
| **Deadlock 40P01 em Vagas Consecutivas** | `scheduling.service.ts:650, 699` | Análise de lock em duas etapas | **CONFIRMADO** (Aquisição fora de ordem monotônica) |
| **Perda Irreversível de Vagas no Reschedule** | `scheduling.service.ts:1621-1653` | Análise de transações separadas | **CONFIRMADO** (Cancel antes do Book com catch silencioso) |
| **Não Devolução de Vagas (`HH:MM:00` vs `HH:MM`)** | `scheduling.service.ts:787-805` | Inspeção do `cancelBooking` | **CONFIRMADO** (`getNextTimeStr` gera 8 chars, slots têm 5) |
| **Vetor XSS no Comprovante de Agendamento** | `StudentVoucherDialog.tsx:46-56, 355` | Inspeção do template HTML | **CONFIRMADO** (`document.write` de `${disc}` sem sanitização) |
| **Falta de RBAC no Frontend Admin Scheduling** | `admin/scheduling/page.tsx:7-8` | Inspeção de código | **CONFIRMADO** (Apenas verifica `!session?.user`) |
| **Queda Fatal por Pool MSSQL sem Listener de Erro** | `academic.service.ts:168-170` | Inspeção do pool `ConnectionPool` | **CONFIRMADO** (Sem `pool.on('error')`, sem reconnect) |
| **Full Scan e Conflito de Chave no Snapshot AVA** | `ava-sync.service.ts:224-234` | Inspeção da query SQL | **CONFIRMADO** (`regexp_replace` nos dois lados, sem `DISTINCT ON`) |
| **Mascaramento de Digest em Server Actions** | `actions/api.ts:32, 46` & `users.ts:23` | Inspeção do padrão de erro | **CONFIRMADO** (`throw new Error` dispara digest no Next.js 16) |

---

## 4. Avaliação de Conformidade com os Critérios de Aceite (ORIGINAL_REQUEST.md)

| Critério de Aceite | Descrição | Status | Avaliação do Revisor |
|---|---|---|---|
| **AC1** | Execução e verificação dos comandos de integridade (`build` e `test`) | **SATISFEITO** | Baseline scorecard totalmente documentado e verificado de forma independente. |
| **AC2** | Mapeamento e conferência de 100% dos controllers e rotas expostas no NestJS | **NÃO SATISFEITO** | 3 controllers omitidos (`Audit`, `Jobs`, `System`); rotas fictícias em `AvaSync`, `AvaReports` e `Academic`; rota `@Public()` de sincronização omitida. |
| **AC3** | Análise estática de vulnerabilidades e verificação de concorrência | **SATISFEITO** | Concorrência, deadlocks, transações e segurança estática modelados e reproduzidos empiricamente. |
| **AC4** | Emissão de relatório técnico completo com trechos de código e plano executável | **PARCIALMENTE DEFICIENTE** | Relatório excelente e abrangente, porém os trechos de código em 8.1 e 8.3 possuem erros de schema e de contrato que impossibilitam uso como drop-in. |

---

## 5. Instruções Concretas de Remediação para Aprovação

Para que o relatório `AUDIT_REPORT_AND_ROADMAP.md` obtenha o veredito **APPROVE**, o autor deve realizar as seguintes alterações:

1. **Atualizar a Tabela 2.1**:
   - Incluir `AuditController` (3 rotas `/api/audit-logs/*`), `JobsController` (1 rota `/api/jobs/*`) e `SystemController` (3 rotas `/api/system/*`).
   - Corrigir as rotas de `AvaSyncController` para a rota real `GET /api/ava-sync` (`@Public()`, protegida por `CRON_SECRET`), removendo as rotas alucinadas `/ava-sync/trigger`, etc.
   - Corrigir as rotas de `AvaReportsController` e `AcademicController` para refletir exatamente os métodos dos respectivos controllers.
2. **Substituir o Trecho de Código da Seção 8.1**:
   - Adotar a implementação contida em `.agents/teamwork/teamwork_preview_challenger_concurrency_1/concurrency_audit.md` (Seções 6.1 e 6.3), que utiliza os campos reais `opcaos.hora`, `opcaos.vagas`, `agendamentosMatricula.opcaoId` e o algoritmo de trava ordenada por `hora`.
3. **Endurecer o Guard da Seção 8.2**:
   - Substituir `signature !== expectedSignature` por `crypto.timingSafeEqual`.
   - Lançar erro caso `process.env.STUDENT_SESSION_SECRET` não esteja configurado, eliminando o fallback fraco.
   - Incluir verificação de `request.params?.matricula`.
4. **Corrigir os Contratos da Seção 8.3**:
   - Ajustar o payload de `cancelStudentBookingAction` para `{ bookingId: agendamentoId, matricula }`.
   - Ajustar a URL para `${baseUrl}/api/public/scheduling/cancel`.
5. **Corrigir o Path do Arquivo na Seção 2.4**:
   - Atualizar para `apps/frontend/src/app/agendamento/StudentVoucherDialog.tsx`.
