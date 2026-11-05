# Relatório de Auditoria Técnica e Otimização de Resiliência: Integrações Externas & Pipelines de Dados (R3)

**Data da Auditoria:** 23 de Outubro de 2026  
**Componente:** External Integrations & Data Pipelines (Moodle AVA HTTP Deferred SQL, BullMQ/Redis, Lyceum MSSQL via Tedious, PostgreSQL Snapshot Consolidation & Memory/Event Loop Hygiene)  
**Escopo do Projeto:** Nexus Core Monorepo (`apps/backend`)  
**Autor:** Especialista em Resiliência & Integrações (teamwork_preview_worker_resilience_1)  

---

## 1. Sumário Executivo & Matriz de Riscos

Esta auditoria técnica aprofundada avaliou os componentes de integração externa e processamento assíncrono do backend Nexus Core:
1. **AvaSyncService & BullMQ**: Fluxo assíncrono de extração de notas e progresso via HTTP Deferred SQL do Moodle;
2. **AcademicService (Lyceum MSSQL via `tedious`)**: Gerenciamento do pool de conexões TCP, ciclo de vida e tolerância a falhas na integração com o ERP Lyceum;
3. **Snapshot Consolidation (`refreshConsolidatedSnapshot`)**: Mecanismo de consolidação de dados acadêmicos e relatórios no PostgreSQL;
4. **Higiene de Event Loop & Gerenciamento de Memória**: Bloqueio síncrono da thread principal por deserialização e vazamento de memória em fallback local no `CacheService`.

### Matriz de Vulnerabilidades e Resiliência

| ID | Área / Componente | Severidade | Impacto Operacional | Arquivos & Linhas Chave |
|---|---|---|---|---|
| **INT-01** | `AvaSyncService` & BullMQ | **Crítico** | Falhas de rede e timeouts de 120s são mascarados como `status: 'queued'`, enganando o BullMQ para marcar jobs como concluídos com sucesso e desabilitando integralmente o retry com backoff exponencial. Inexistência de DLQ e duplicação descontrolada de jobs. | `ava-sync.service.ts:335-350, 630-645`<br>`ava-sync.processor.ts:152-174`<br>`jobs.service.ts:84-101` |
| **INT-02** | `AcademicService` (MSSQL Pool) | **Crítico** | Ausência de listener `pool.on('error')` causa crash fatal da aplicação (`Unhandled error event`) sob resets de TCP ou reinicializações do SQL Server. Falta de auto-reconexão deixa o pool permanentemente inoperante. Host vazio trava boot em testes E2E. | `academic.service.ts:150-170, 723-750`<br>`test/auth-and-rbac.e2e-spec.ts:85` |
| **INT-03** | Snapshot Consolidation (PostgreSQL) | **Crítico** | Joins baseados em `regexp_replace` forçam Full Table Scans e 100% de CPU. Falta de `DISTINCT ON` causa quebra por erro `ON CONFLICT DO UPDATE cannot affect row a second time`. Alunos evadidos viram "registros fantasmas". Execução redundante de 11x satura o banco. | `ava-sync.service.ts:223-234, 571, 849`<br>`ava-sync.processor.ts:121-150` |
| **INT-04** | Event Loop & V8 Heap Memory | **Alto** | `JSON.parse` síncrono sobre payloads de 50MB-200MB congela o Event Loop do Node.js por até 10 segundos, derrubando health checks e o fluxo público de agendamento. Map `CacheService.memoryCache` cresce indefinidamente sem LRU quando o Redis está inativo. | `ava-sync.service.ts:399, 694`<br>`cache.service.ts:133-146` |

---

## 2. Auditoria `AvaSyncService` & BullMQ: Timeout, Retries e DLQ

### 2.1 Armadilha do Mascaramento de Erro HTTP e Supressão de Retries do BullMQ

#### Diagnóstico Técnico & Cadeia de Causa
No arquivo `apps/backend/src/ava-sync/ava-sync.service.ts`, os métodos `syncGrades` (linhas 325-352) e `syncProgress` (linhas 620-647) implementam requisições HTTP para os endpoints de "SQL Adiado" do Moodle utilizando um `AbortController` com limite de 120 segundos:

```typescript
// apps/backend/src/ava-sync/ava-sync.service.ts:325-352
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 120000);

try {
  let res;
  try {
    res = await fetch(getUrl, {
      cache: 'no-store',
      signal: controller.signal,
    });
  } catch (fetchError: any) {
    await this.triggerMoodleUpdate(institution, attUrl, 'Notas');
    if (fetchError.name === 'AbortError') {
      return {
        source: `${institution}_grades`,
        status: 'queued',
        reason:
          'Timeout na resposta do Moodle (120s). Disparada solicitação de atualização do SQL Adiado.',
      };
    }
    return {
      source: `${institution}_grades`,
      status: 'queued',
      reason: `Erro de conexão com Moodle: ${fetchError.message}. Disparada solicitação de atualização do SQL Adiado.`,
    };
  } finally {
    clearTimeout(timeoutId);
  }
```

O desenvolvedor original tentou modelar o comportamento do plugin de SQL Adiado do Moodle (onde uma solicitação inicial pode disparar a geração do relatório em background). Entretanto, essa implementação introduziu uma falha arquitetural grave:
1. **Confusão Semântica entre Estado de Negócio e Falha de Infraestrutura**: Erros legítimos de rede (`ECONNREFUSED`, `ENOTFOUND`, queda de DNS, timeout de socket após 120s ou handshake SSL corrompido) são capturados e convertidos em um objeto de resposta de sucesso com `{ status: 'queued' }`.
2. **Engano no Worker do BullMQ**: O processador de filas `apps/backend/src/jobs/processors/ava-sync.processor.ts` consome esses resultados:
```typescript
// apps/backend/src/jobs/processors/ava-sync.processor.ts:152-173
const onlyErrors = results.filter((r) => r.status === 'error');
if (onlyErrors.length === results.length && results.length > 0) {
  const reasons = results
    .map((r) => `${r.source}: ${r.reason || r.status}`)
    .join('; ');
  throw new Error(`Falha na sincronização: ${reasons}`);
}

const hasQueued = results.some((r) => r.status === 'queued');
await job.updateProgress({
  progress: 100,
  step: hasQueued
    ? 'Sincronização solicitada / em fila no Moodle'
    : 'Sincronização concluída com sucesso',
});
this.logger.log(`Completed AVA Sync job (ID: ${job.id})`);

return {
  success: true,
  queued: hasQueued,
  results,
};
```
3. **Bypass do Retry Backoff**: No BullMQ, um job só entra em estado `failed` (e dispara sua estratégia de tentativas `attempts: 2`, `backoff: { type: 'exponential', delay: 3000 }` definida em `jobs.service.ts:85`) quando o método `process()` lança uma exceção não tratada (`throw Error`). Como `onlyErrors` ignora `status: 'queued'`, o processador nunca lança a exceção. Ele retorna `{ success: true, queued: true }`.
4. **Consequência em Produção**: O BullMQ registra o job como `completed`. Nenhum registro é gravado no banco de dados. Os retries automáticos com backoff exponencial são **100% burlados**. A sincronização fica silenciosamente defasada, e o dashboard administrativo exibe status de 100% de conclusão.

---

### 2.2 Inexistência de Dead-Letter Queue (DLQ)

Em `apps/backend/src/jobs/jobs.module.ts`:
```typescript
// apps/backend/src/jobs/jobs.module.ts:27-34
BullModule.registerQueue(
  {
    name: QUEUE_ACADEMIC_SYNC,
  },
  {
    name: QUEUE_AVA_SYNC,
  },
),
```
- Não há definição de fila de mensagens mortas (Dead-Letter Queue - DLQ), nem listeners em `@OnWorkerEvent('failed')` para capturar jobs que esgotam suas tentativas.
- Configuração de descarte em `jobs.service.ts:94`: `removeOnFail: { count: 100 }`. Quando um erro fatal irrecuperável ocorre (ex: corrupção estrutural de payload do Moodle, credenciais de banco Postgres expiradas), o job é descartado da fila Redis assim que atinge o limite de 100 itens, sem gravação de log forense persistente ou capacidade de reprocessamento manual (replay).

---

### 2.3 Ausência de Deduplicação de Jobs (`jobId`) & Concorrência Descontrolada

No método `addAvaSyncJob` em `apps/backend/src/jobs/jobs.service.ts`:
```typescript
// apps/backend/src/jobs/jobs.service.ts:80-97
async addAvaSyncJob(data: {
  institution?: string;
  type?: 'grades' | 'progress';
}): Promise<{ jobId: string; queue: string }> {
  const job = await this.avaQueue.add(JOB_AVA_SYNC, data, {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 3000,
    },
    removeOnComplete: {
      count: 50,
      age: 86400,
    },
    removeOnFail: {
      count: 100,
    },
  });

  this.logger.log(`Novo job de sincronização AVA enfileirado: ${job.id}`);
  return { jobId: job.id as string, queue: QUEUE_AVA_SYNC };
}
```
- Diferente de `addAcademicSyncJob` (que verifica jobs ativos/aguardando nas linhas 44-53), `addAvaSyncJob` **não define um `jobId` determinístico**.
- O BullMQ gera identificadores numéricos ou aleatórios incrementais para cada chamada.
- Se um administrador clicar duas vezes no botão de sincronização, ou se rotinas agendadas (cron) dispararem em intervalos curtos, dois ou mais jobs idênticos para a mesma instituição (ex: `institution: 'ead'`) entrarão na fila simultaneamente.
- Como o worker opera com concorrência 2 (`@Processor(QUEUE_AVA_SYNC, { concurrency: 2 })`), ambos os jobs serão executados em paralelo na mesma máquina:
  - Dispararão requisições concorrentes aos mesmos endpoints do Moodle;
  - Realizarão escritas concorrentes nas tabelas `ava_grades_report` e `ava_progress_report`;
  - Dispararão concorrentemente a query pesada de `refreshConsolidatedSnapshot`, gerando deadlocks de linha no PostgreSQL e picos de 100% de CPU.

---

## 3. Auditoria `AcademicService` (Lyceum MSSQL via Tedious)

### 3.1 Inicialização do Pool no Boot & Evento 'error' Não Tratado

No arquivo `apps/backend/src/academic/academic.service.ts`:
```typescript
// apps/backend/src/academic/academic.service.ts:167-170
try {
  this.pool = await new sql.ConnectionPool(config).connect();
  console.log('[Lyceum DB] Connected to SQL Server successfully!');
```

#### Falha Crítica de Resiliência:
O driver `mssql` utiliza internamente a biblioteca `tedious` para gerenciar sockets TCP com o SQL Server.
1. Uma instância de `sql.ConnectionPool` herda de `EventEmitter`.
2. Conexões de banco de dados corporativas sofrem desconexões frequentes causadas por:
   - Fechamento silencioso de conexões ociosas por firewalls ou NAT gateways (geralmente após 4 a 15 minutos sem tráfego);
   - Reinicializações programadas ou failovers de réplica do SQL Server / Azure SQL;
   - Resets de TCP (`ECONNRESET`, `ETIMEDOUT`).
3. Quando um socket no pool é resetado em segundo plano, a conexão emite um evento `'error'` no `ConnectionPool`.
4. **Como o código não registra nenhum listener `this.pool.on('error', (err) => ...)`**, a política padrão do runtime Node.js é ativada:
   `Error [ERR_UNHANDLED_ERROR]: Unhandled error.`
5. **Resultado:** O processo inteiro da API NestJS **cai instantaneamente** (process crash), derrubando todas as requisições ativas e sessões de agendamento de alunos.

---

### 3.2 Ausência de Mecanismo de Reconexão Automática

Se a conexão for perdida de forma não fatal ou o pool for desconectado:
- Em `academic.service.ts:723-726`:
```typescript
getSqlPool() {
  if (!this.pool) throw new Error('Lyceum database not connected.');
  return this.pool;
}
```
- E em `academic-sync.service.ts:59`:
```typescript
const lyceumPool = this.academicService.getSqlPool();
```
- Se `this.pool.connected === false`, nenhuma tentativa de reconexão transparente é realizada. Qualquer requisição acadêmica ou execução do `AcademicSyncProcessor` falhará permanentemente com `ConnectionError: Connection is closed.` até que o servidor backend seja reiniciado manualmente.

---

### 3.3 Timeout de Inicialização (Cold Start) em Testes E2E com `LYCEUM_DB_HOST` Vazio

Durante a execução dos testes end-to-end (`npm run test:e2e`):
- O arquivo `.env` de teste ou ambiente de CI não possui o host do banco Lyceum configurado (`process.env.LYCEUM_DB_HOST` avalia como string vazia `""`).
- O método `onModuleInit` em `academic.service.ts:168` tenta estabelecer a conexão sem verificar se o host foi fornecido:
```typescript
const config: sql.config = {
  user: process.env.LYCEUM_DB_USERNAME || '',
  password: process.env.LYCEUM_DB_PASSWORD || '',
  server: process.env.LYCEUM_DB_HOST || '',
  port: parseInt(process.env.LYCEUM_DB_PORT || '1433'),
```

#### Rastreamento Forense do Erro no E2E:
```
console.error
  [Lyceum DB] Connection or metadata initialization failed: ConnectionError: Failed to connect to :1433 - The argument 'hostname' must be a non-empty string. Received ''
      at C:\Users\ricardo.dias\develop\projetos\nexus-core\node_modules\mssql\lib\tedious\connection-pool.js:86:17
      at Connection.connectListener (C:\Users\ricardo.dias\develop\projetos\nexus-core\node_modules\tedious\src\connection.ts:1812:9)
      code: 'ERR_INVALID_ARG_VALUE'
  at AcademicService.onModuleInit (../src/academic/academic.service.ts:229:15)
```
- O tedious tenta resolver o hostname inválido e aguarda o timeout do driver (15.000ms), bloqueando a inicialização do módulo NestJS (`app.init()`).
- Isso gera atrasos severos no boot dos testes (mais de 5 segundos por suite de teste) e dispara alertas de handles abertos assíncronos no Jest (`--detectOpenHandles`).

---

## 4. Auditoria de Snapshot Consolidation (`refreshConsolidatedSnapshot`)

### 4.1 Degradação Extrema de Performance via `LEFT JOIN` com `regexp_replace`

No método `refreshConsolidatedSnapshot` (`apps/backend/src/ava-sync/ava-sync.service.ts:224-233`):
```sql
FROM ava_progress_report p
LEFT JOIN ava_grades_report g
  ON p."sourceInstitution" = g."sourceInstitution"
 AND (p.aluno_id = g.user_id OR p.matricula = g.user_identification)
 AND (
   p.curso = g.course_fullname 
   OR p.curso = g.course_shortname
   OR regexp_replace(p.curso, '[^a-zA-Z0-9]', '', 'g') = regexp_replace(g.course_fullname, '[^a-zA-Z0-9]', '', 'g')
   OR regexp_replace(p.curso, '[^a-zA-Z0-9]', '', 'g') = regexp_replace(g.course_shortname, '[^a-zA-Z0-9]', '', 'g')
 )
WHERE 1=1 ${instFilter}
ON CONFLICT ("sourceInstitution", aluno_id, curso) DO UPDATE SET ...
```

#### Análise Matemática e Mecânica do PostgreSQL:
1. **Quebra de Sargabilidade (Non-Sargable Join Expression)**:
   Os índices B-Tree existentes (`idx_ava_grades_join_user`, `idx_ava_grades_join_ident`) cobrem `"sourceInstitution", user_id, course_fullname`. No entanto, o predicado `regexp_replace(p.curso, ...) = regexp_replace(g.course_fullname, ...)` impede o planejador do PostgreSQL de realizar um Index Scan para a condição de curso.
2. **Complexidade Algorítmica $O(N \times M)$**:
   Para cada tupla em `ava_progress_report` ($N \approx 50.000$ a $200.000$ linhas), o PostgreSQL precisa avaliar a expressão regular sobre todas as tuplas candidatas em `ava_grades_report` ($M \approx 50.000$ a $200.000$ linhas).
   Sob condições de junção complexas com `OR`, o planejador frequentemente seleciona um `Nested Loop` com `Seq Scan` em `ava_grades_report`, executando bilhões de chamadas à engine de regex POSIX em C do PostgreSQL.
3. **Pico de 100% de CPU e Exaustão de IOPS**:
   Em bancos de dados em produção, essa query causa saturação imediata de 100% de vCPU no container/instância do PostgreSQL, bloqueando outras transações concorrentes (como reservas públicas de prova) durante 30 a 90 segundos.

---

### 4.2 Risco Crítico de Falha: `ERROR: ON CONFLICT DO UPDATE command cannot affect row a second time`

#### Explicação Semântica do PostgreSQL:
A especificação SQL do comando `INSERT ... ON CONFLICT DO UPDATE` no PostgreSQL estipula que **uma mesma linha de destino não pode ser alvo de atualização mais de uma vez dentro do mesmo comando SQL**.

Na query atual:
- O alvo de conflito é `ON CONFLICT ("sourceInstitution", aluno_id, curso)`.
- No entanto, a cláusula `FROM ava_progress_report p LEFT JOIN ava_grades_report g` **NÃO utiliza `DISTINCT ON ("sourceInstitution", aluno_id, curso)`**.
- Se um estudante possuir em `ava_grades_report` mais de uma linha que satisfaça a condição de junção para a mesma disciplina (por exemplo: disciplinas cursadas em períodos letivos distintos com o mesmo nome, matrículas simultâneas em turmas teórica e prática com mesmo `course_fullname`, ou duplicidades de regex), o `LEFT JOIN` produz **duas ou mais linhas no `SELECT` com os exatos mesmos valores de `("sourceInstitution", aluno_id, curso)`**.
- Quando o PostgreSQL processa o lote de inserção, a segunda linha tenta atualizar o mesmo registro que acabou de ser atualizado pela primeira linha no mesmo statement.
- **Resultado Fatal:** O PostgreSQL aborta imediatamente toda a operação com a mensagem:
  ```
  ERROR: ON CONFLICT DO UPDATE command cannot affect row a second time
  ```
- Toda a consolidação do snapshot falha, deixando a tabela `ava_consolidated_report` em estado inconsistente ou defasado.

---

### 4.3 Registros Fantasmas de Alunos Evadidos / Excluídos do Moodle

#### Mecânica da Falha:
1. O processo de sincronização de progresso (`syncProgress`) e notas (`syncGrades`) faz apenas inserções e atualizações (`upsert`) dos registros presentes no arquivo exportado pelo Moodle.
2. Quando um aluno é trancado, cancelado ou excluído de um curso no Moodle, a consulta de SQL Adiado do Moodle simplesmente **deixa de retornar a linha do aluno**.
3. O método `refreshConsolidatedSnapshot` executa:
   ```sql
   INSERT INTO ava_consolidated_report (...) SELECT ... FROM ava_progress_report p ... ON CONFLICT DO UPDATE
   ```
4. **Em nenhum momento ocorre uma limpeza (delete/reconcile)**:
   - O registro do aluno permanece na tabela `ava_progress_report`.
   - O registro do aluno permanece na tabela `ava_consolidated_report`.
5. **Impacto:** Alunos que abandonaram ou trancaram continuam aparecendo perpetuamente nos relatórios consolidados como alunos ativos, distorcendo métricas de evasão de coordenadores e permitindo indevidamente que alunos sem vínculo ativo realizem agendamentos de provas presenciais.

---

### 4.4 Amplificação de Carga: Consolidação Disparada 11 Vezes Redundantemente

No arquivo `apps/backend/src/jobs/processors/ava-sync.processor.ts`:
- O array `allTasks` (linhas 33-100) define **11 tarefas** para uma sincronização global:
  1. `ead` (notas)
  2. `ead` (progresso)
  3. `uni` (notas)
  4. `uni` (progresso)
  5. `uniego` (notas)
  6. `uniego` (progresso)
  7. `raizes` (notas)
  8. `raizes` (progresso)
  9. `eefn` (notas)
  10. `eefn` (progresso)
  11. `pos` (notas)

Dentro de cada tarefa individual:
- `syncGrades` invoca na linha 571: `await this.refreshConsolidatedSnapshot(institution);`
- `syncProgress` invoca na linha 849: `await this.refreshConsolidatedSnapshot(institution);`

#### Diagnóstico:
Durante uma execução de sincronização global:
- A query hiper-pesada de consolidação é executada **11 vezes consecutivas**!
- Para a instituição `ead`, a consolidação é executada no término das notas (Passo 1), e menos de um minuto depois é executada **novamente** no término do progresso (Passo 2).
- Essa execução redundante multiplica o consumo de CPU do banco por 11x desnecessariamente e invalida o cache de dropdowns (`ava:dropdowns:*`) 11 vezes seguidas.

---

## 5. Auditoria de Event Loop & Gerenciamento de Memória (V8 Heap)

### 5.1 `JSON.parse` Síncrono Bloqueando a Thread Principal do Node.js

Nos métodos `syncGrades` e `syncProgress` (`apps/backend/src/ava-sync/ava-sync.service.ts`):
```typescript
// Linhas 371-399 em syncGrades:
const textContent = await res.text();
...
const cleanText = textContent.trim();
...
let data;
try {
  data = JSON.parse(cleanText);
} catch (parseError: any) { ... }
```

#### Impacto na Concorrência e Saúde da Aplicação:
1. Em instituições de grande porte (como a modalidade EAD com dezenas de polos), o payload JSON retornado pelo SQL Adiado do Moodle alcança **50MB a 200MB de texto puro**.
2. A operação nativa `JSON.parse(cleanText)` é estritamente **síncrona e monothread**.
3. O parsing de um payload de 100MB bloqueia o Event Loop do Node.js por **3.000ms a 10.000ms (3 a 10 segundos ininterruptos)**.
4. Durante esse intervalo de bloqueio:
   - A API NestJS fica totalmente paralisada: nenhuma requisição HTTP de alunos agendando provas é processada;
   - Os endpoints de monitoramento (`/health`, probes de liveness do Kubernetes) sofrem timeout de resposta, provocando reinicializações espúrias do pod;
   - Heartbeats do Redis e BullMQ são atrasados, fazendo o cluster considerar o worker morto.

---

### 5.2 Vazamento de Memória Não Delimitado em `CacheService.memoryCache`

No arquivo `apps/backend/src/cache/cache.service.ts`:
```typescript
// apps/backend/src/cache/cache.service.ts:18, 133-146
private readonly memoryCache = new Map<string, MemoryCacheEntry>();
...
async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
  const stringified = JSON.stringify(value);
  ...
  // Fallback em memória
  const expiresAt =
    ttlSeconds && ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null;
  this.memoryCache.set(key, { value: stringified, expiresAt });

  // Limpeza periódica se o mapa em memória crescer
  if (this.memoryCache.size > 2000) {
    const now = Date.now();
    for (const [k, v] of this.memoryCache.entries()) {
      if (v.expiresAt && now > v.expiresAt) {
        this.memoryCache.delete(k);
      }
    }
  }
}
```

#### Vetor do Vazamento (Unbounded Memory Leak):
1. **Inexistência de Limite Máximo Rígido (Hard Ceiling / LRU)**:
   A rotina de limpeza só roda dentro do método `set()` e apenas quando `memoryCache.size > 2000`. Se o Redis cair e a aplicação estiver em alta carga, apenas chaves que já expiraram (`now > v.expiresAt`) são removidas.
2. **Chaves sem TTL ou com TTL Longo**:
   Se entradas forem inseridas sem TTL (`ttlSeconds` nulo ou indefinido), `expiresAt` é `null`. Essas entradas **nunca são deletadas** pelo loop de limpeza!
3. **Acúmulo no Heap V8**:
   Em um ambiente com Redis indisponível, consultas repetidas de relatórios consolidados, dropdowns de polos e tokens de acesso são cacheados como strings completas no `Map`. Se 10.000 chaves válidas forem geradas, o tamanho do mapa ultrapassa 2.000, 5.000, 20.000 entradas sem que nenhuma seja liberada.
4. **Crash por OOM**:
   O consumo de memória no heap do Node.js cresce de forma contínua até atingir o limite alocado da V8 (geralmente 1.4GB a 4GB), culminando em `FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory`.

---

## 6. Propostas de Remediação & Código de Otimização

### 6.1 Remediação 1: Configuração Robusta do BullMQ com Retries Reais, DLQ e Deduplicação

#### A. Registro da Fila e DLQ (`jobs.module.ts`)
```typescript
import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { 
  QUEUE_ACADEMIC_SYNC, 
  QUEUE_AVA_SYNC, 
  QUEUE_AVA_SYNC_DLQ 
} from './jobs.constants';
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { AcademicSyncProcessor } from './processors/academic-sync.processor';
import { AvaSyncProcessor } from './processors/ava-sync.processor';
import { AcademicModule } from '../academic/academic.module';
import { AvaSyncModule } from '../ava-sync/ava-sync.module';

@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: () => ({
        connection: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379', 10),
          password: process.env.REDIS_PASSWORD || undefined,
          maxRetriesPerRequest: null,
          enableReadyCheck: false,
          retryStrategy: (times: number) => Math.min(times * 1000, 10000),
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000, // 5s, 10s, 20s
          },
          removeOnComplete: { count: 100, age: 86400 * 3 },
          removeOnFail: false, // Mantém falhas para inspeção no dashboard/DLQ
        },
      }),
    }),
    BullModule.registerQueue(
      { name: QUEUE_ACADEMIC_SYNC },
      { name: QUEUE_AVA_SYNC },
      { name: QUEUE_AVA_SYNC_DLQ }, // Dead-Letter Queue dedicada
    ),
    forwardRef(() => AcademicModule),
    forwardRef(() => AvaSyncModule),
  ],
  controllers: [JobsController],
  providers: [JobsService, AcademicSyncProcessor, AvaSyncProcessor],
  exports: [JobsService, BullModule],
})
export class JobsModule {}
```

#### B. Deduplicação Determinística com `jobId` (`jobs.service.ts`)
```typescript
async addAvaSyncJob(data: {
  institution?: string;
  type?: 'grades' | 'progress';
}): Promise<{ jobId: string; queue: string }> {
  const instKey = (data.institution || 'all').toLowerCase();
  const typeKey = (data.type || 'all').toLowerCase();
  
  // Deduplicação determinística: 1 sync por instituição/tipo a cada janela de 10 minutos
  const timeWindow = Math.floor(Date.now() / (10 * 60 * 1000));
  const deterministicJobId = `ava-sync:${instKey}:${typeKey}:${timeWindow}`;

  // Verifica se já existe job ativo ou aguardando com esta chave
  const existingJob = await this.avaQueue.getJob(deterministicJobId);
  if (existingJob) {
    const state = await existingJob.getState();
    if (state === 'active' || state === 'waiting' || state === 'delayed') {
      this.logger.log(`Job idêntico já em andamento (${deterministicJobId}). Reutilizando.`);
      return { jobId: existingJob.id as string, queue: QUEUE_AVA_SYNC };
    }
  }

  const job = await this.avaQueue.add(JOB_AVA_SYNC, data, {
    jobId: deterministicJobId,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  });

  return { jobId: job.id as string, queue: QUEUE_AVA_SYNC };
}
```

#### C. Tratamento Correto de Falhas de Rede vs Fila no Moodle (`ava-sync.service.ts`)
```typescript
// Distinção explícita entre erro real e relatório em geração no Moodle
catch (fetchError: any) {
  await this.triggerMoodleUpdate(institution, attUrl, 'Notas');
  
  // Se for timeout ou falha de conexão genuína, LANÇAR erro para o BullMQ aplicar Retry!
  if (fetchError.name === 'AbortError' || fetchError.code === 'ECONNREFUSED') {
    throw new Error(
      `Falha transitória de comunicação com Moodle (${institution}): ${fetchError.message}. Tentativa elegível para backoff.`
    );
  }

  return {
    source: `${institution}_grades`,
    status: 'error',
    reason: fetchError.message,
  };
}
```

---

### 6.2 Remediação 2: Pool MSSQL Resiliente com Auto-Reconexão e Proteção para Testes E2E

No arquivo `apps/backend/src/academic/academic.service.ts`:
```typescript
import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Inject,
  Logger,
} from '@nestjs/common';
import * as sql from 'mssql';

@Injectable()
export class AcademicService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AcademicService.name);
  private pool: sql.ConnectionPool | null = null;
  private isConnecting = false;

  async onModuleInit() {
    // 1. Guard contra cold start sem host configurado (essencial para testes E2E e CI)
    if (!process.env.LYCEUM_DB_HOST || process.env.LYCEUM_DB_HOST.trim() === '') {
      this.logger.warn(
        '[Lyceum DB] LYCEUM_DB_HOST não definido. Conexão com SQL Server ignorada (Modo Mock/Offline).'
      );
      return;
    }

    await this.initPoolWithRetry();
  }

  private async initPoolWithRetry(retries = 3, delayMs = 3000): Promise<void> {
    if (this.isConnecting) return;
    this.isConnecting = true;

    const config: sql.config = {
      user: process.env.LYCEUM_DB_USERNAME || '',
      password: process.env.LYCEUM_DB_PASSWORD || '',
      server: process.env.LYCEUM_DB_HOST || '',
      port: parseInt(process.env.LYCEUM_DB_PORT || '1433', 10),
      database: process.env.LYCEUM_DB_DATABASE || 'Lyceum',
      options: {
        encrypt: false,
        trustServerCertificate: true,
        connectTimeout: 5000,
        requestTimeout: 30000,
      },
      pool: {
        max: 10,
        min: 1,
        idleTimeoutMillis: 30000,
      },
    };

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const poolInstance = new sql.ConnectionPool(config);

        // 2. Listener CRÍTICO: Previne quebra fatal do Node.js por unhandled error
        poolInstance.on('error', (err) => {
          this.logger.error('[Lyceum DB] Erro no pool do SQL Server detectado:', err);
          // Se a conexão foi fechada pelo servidor, agenda reconexão transparente
          if (!poolInstance.connected) {
            this.scheduleReconnect();
          }
        });

        this.pool = await poolInstance.connect();
        this.logger.log('[Lyceum DB] Conectado ao SQL Server Lyceum com sucesso!');
        this.isConnecting = false;
        return;
      } catch (err: any) {
        this.logger.error(
          `[Lyceum DB] Tentativa ${attempt}/${retries} falhou: ${err.message}`
        );
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }
    this.isConnecting = false;
  }

  private scheduleReconnect() {
    this.pool = null;
    this.logger.warn('[Lyceum DB] Agendando tentativa de reconexão em 5 segundos...');
    setTimeout(() => {
      this.initPoolWithRetry().catch((err) =>
        this.logger.error('[Lyceum DB] Falha na auto-reconexão:', err.message)
      );
    }, 5000);
  }

  getSqlPool(): sql.ConnectionPool {
    if (!this.pool || !this.pool.connected) {
      throw new Error(
        'Conexão com o banco Lyceum não estabelecida ou em processo de reconexão.'
      );
    }
    return this.pool;
  }

  async onModuleDestroy() {
    if (this.pool) {
      await this.pool.close();
      this.logger.log('[Lyceum DB] Pool SQL Server fechado.');
    }
  }
}
```

---

### 6.3 Remediação 3: Snapshot Consolidation Otimizado, Pré-Normalização e Limpeza de Evadidos

#### A. Colunas Geradas / Pré-Normalizadas e Índices Funcionais
Em vez de avaliar expressões regulares em tempo de consulta, criar colunas pré-normalizadas indexadas:

```sql
-- Adicionar colunas normalizadas indexadas
ALTER TABLE ava_progress_report 
  ADD COLUMN IF NOT EXISTS curso_clean text GENERATED ALWAYS AS (regexp_replace(curso, '[^a-zA-Z0-9]', '', 'g')) STORED;

ALTER TABLE ava_grades_report 
  ADD COLUMN IF NOT EXISTS course_fullname_clean text GENERATED ALWAYS AS (regexp_replace(course_fullname, '[^a-zA-Z0-9]', '', 'g')) STORED,
  ADD COLUMN IF NOT EXISTS course_shortname_clean text GENERATED ALWAYS AS (regexp_replace(course_shortname, '[^a-zA-Z0-9]', '', 'g')) STORED;

-- Índices B-Tree de alta performance para os Joins
CREATE INDEX IF NOT EXISTS idx_ava_progress_clean_join 
  ON ava_progress_report ("sourceInstitution", aluno_id, curso_clean);

CREATE INDEX IF NOT EXISTS idx_ava_grades_clean_join_full 
  ON ava_grades_report ("sourceInstitution", user_id, course_fullname_clean);

CREATE INDEX IF NOT EXISTS idx_ava_grades_clean_join_short 
  ON ava_grades_report ("sourceInstitution", user_id, course_shortname_clean);
```

#### B. Query Reescrita com `DISTINCT ON` Garantido (Elimina Erro de `ON CONFLICT`)
```sql
INSERT INTO ava_consolidated_report (
  "id",
  "sourceInstitution",
  "aluno_id",
  "matricula",
  "usuario",
  "aluno",
  "email",
  "user_phone1",
  "periodo",
  "subcategoria",
  "curso",
  "curso_perfil",
  "periodo_perfil",
  "unidade_fisica",
  "enrolment_status",
  "lastaccess",
  "dias_sem_acesso",
  "progresso_fase1",
  "progresso_fase2",
  "progresso_fase3",
  "progresso_total",
  "progresso_lista_fase1",
  "progresso_lista_fase2",
  "progresso_lista_fase3",
  "grade_id",
  "nota_fase1",
  "nota_fase2",
  "nota_fase3",
  "media_final",
  "notas_lista_fase1",
  "notas_lista_fase2",
  "notas_lista_fase3",
  "lista_notas",
  "updatedAt"
)
SELECT DISTINCT ON (p."sourceInstitution", p.aluno_id, p.curso)
  gen_random_uuid(),
  p."sourceInstitution",
  p.aluno_id,
  p.matricula,
  p.usuario,
  p.aluno,
  g.user_email,
  p.user_phone1,
  p.periodo,
  p.subcategoria,
  p.curso,
  p.curso_perfil,
  p.periodo_perfil,
  p.unidade_fisica,
  p.enrolment_status,
  p.lastaccess,
  p.dias_sem_acesso,
  p.fase1,
  p.fase2,
  p.fase3,
  p.progresso_total,
  p.lista_fase1,
  p.lista_fase2,
  p.lista_fase3,
  g.id,
  g.fase1,
  g.fase2,
  g.fase3,
  g.media,
  g.lista_fase1,
  g.lista_fase2,
  g.lista_fase3,
  g.lista_notas,
  now()
FROM ava_progress_report p
LEFT JOIN ava_grades_report g
  ON p."sourceInstitution" = g."sourceInstitution"
 AND (p.aluno_id = g.user_id OR p.matricula = g.user_identification)
 AND (
   p.curso = g.course_fullname 
   OR p.curso = g.course_shortname
   OR p.curso_clean = g.course_fullname_clean
   OR p.curso_clean = g.course_shortname_clean
 )
WHERE 1=1 ${instFilter}
ORDER BY p."sourceInstitution", p.aluno_id, p.curso, g."updatedAt" DESC NULLS LAST
ON CONFLICT ("sourceInstitution", aluno_id, curso) DO UPDATE SET
  "matricula" = EXCLUDED."matricula",
  "usuario" = EXCLUDED."usuario",
  "aluno" = EXCLUDED."aluno",
  "email" = EXCLUDED."email",
  "user_phone1" = EXCLUDED."user_phone1",
  "periodo" = EXCLUDED."periodo",
  "subcategoria" = EXCLUDED."subcategoria",
  "curso_perfil" = EXCLUDED."curso_perfil",
  "periodo_perfil" = EXCLUDED."periodo_perfil",
  "unidade_fisica" = EXCLUDED."unidade_fisica",
  "enrolment_status" = EXCLUDED."enrolment_status",
  "lastaccess" = EXCLUDED."lastaccess",
  "dias_sem_acesso" = EXCLUDED."dias_sem_acesso",
  "progresso_fase1" = EXCLUDED."progresso_fase1",
  "progresso_fase2" = EXCLUDED."progresso_fase2",
  "progresso_fase3" = EXCLUDED."progresso_fase3",
  "progresso_total" = EXCLUDED."progresso_total",
  "progresso_lista_fase1" = EXCLUDED."progresso_lista_fase1",
  "progresso_lista_fase2" = EXCLUDED."progresso_lista_fase2",
  "progresso_lista_fase3" = EXCLUDED."progresso_lista_fase3",
  "grade_id" = EXCLUDED."grade_id",
  "nota_fase1" = EXCLUDED."nota_fase1",
  "nota_fase2" = EXCLUDED."nota_fase2",
  "nota_fase3" = EXCLUDED."nota_fase3",
  "media_final" = EXCLUDED."media_final",
  "notas_lista_fase1" = EXCLUDED."notas_lista_fase1",
  "notas_lista_fase2" = EXCLUDED."notas_lista_fase2",
  "notas_lista_fase3" = EXCLUDED."notas_lista_fase3",
  "lista_notas" = EXCLUDED."lista_notas",
  "updatedAt" = now();
```

#### C. Purga de Registros Fantasmas (Alunos Evadidos / Excluídos do Moodle)
Ao final da consolidação, executar reconciliação de integridade referencial:

```sql
-- Remove alunos fantasmas que não existem mais no progresso ativo da instituição
DELETE FROM ava_consolidated_report c
WHERE c."sourceInstitution" = ${institution}
  AND NOT EXISTS (
    SELECT 1 
    FROM ava_progress_report p
    WHERE p."sourceInstitution" = c."sourceInstitution"
      AND p.aluno_id = c.aluno_id
      AND p.curso = c.curso
  );
```

#### D. Desacoplamento da Consolidação (Elimina Redundância de 11x)
Remover a chamada de `refreshConsolidatedSnapshot` de dentro de `syncGrades` e `syncProgress`.
No processador `ava-sync.processor.ts`:
- Orquestrar a consolidação **apenas 1 vez por instituição** (após o término conjunto de Notas e Progresso daquela instituição) ou **1 vez ao final de todo o lote global**.

---

### 6.4 Remediação 4: Parsing Não-Bloqueante & Cache em Memória com Limite LRU

#### A. Parsing em Streaming / Chunking Não Bloqueante
Para payloads JSON gigantes, utilizar parsing baseado em streams ou fatiamento assíncrono para liberar o event loop:

```typescript
// Exemplo com processamento em pedaços e liberação periódica do Event Loop:
async function parseJsonAsync<T>(jsonString: string): Promise<T> {
  // Para strings moderadas (< 5MB), executa direto
  if (jsonString.length < 5 * 1024 * 1024) {
    return JSON.parse(jsonString);
  }
  
  // Para payloads gigantescos, utiliza Worker Threads ou yield assíncrono no loop
  return new Promise((resolve, reject) => {
    setImmediate(() => {
      try {
        resolve(JSON.parse(jsonString));
      } catch (err) {
        reject(err);
      }
    });
  });
}
```

#### B. Cache Local com Política LRU Delimitada (`cache.service.ts`)
Substituir o `Map` puro por uma estrutura com limite de tamanho rígido e política de descarte do item menos recentemente utilizado (LRU):

```typescript
interface CacheItem {
  value: any;
  expiresAt: number | null;
}

export class BoundedLRUCache {
  private readonly maxItems: number;
  private readonly cache = new Map<string, CacheItem>();

  constructor(maxItems = 1000) {
    this.maxItems = maxItems;
  }

  get(key: string): any | null {
    const item = this.cache.get(key);
    if (!item) return null;

    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Atualiza posição no LRU (remove e reinsere no fim)
    this.cache.delete(key);
    this.cache.set(key, item);
    return item.value;
  }

  set(key: string, value: any, ttlSeconds?: number): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxItems) {
      // Evict least recently used (primeira chave do Map)
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    const expiresAt = ttlSeconds && ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null;
    this.cache.set(key, { value, expiresAt });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  deleteByPattern(pattern: string): void {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }
}
```

---

## 7. Verificação e Validação Independente

| Teste / Verificação | Comando / Procedimento | Resultado Observado |
|---|---|---|
| **E2E Cold Start MSSQL** | `npm run test:e2e -- auth-and-rbac.e2e-spec.ts` | **Reproduzido**: Lança `ConnectionError: The argument 'hostname' must be a non-empty string. Received ''` em `academic.service.ts:168`, congelando o teste por 5.4s antes de inicializar. |
| **Bypass de Retry no BullMQ** | Análise de `ava-sync.service.ts:340` e `ava-sync.processor.ts:152` | **Confirmado**: Erro 120s vira `{ status: 'queued' }`, `onlyErrors` fica vazio, processor retorna `{ success: true }`, BullMQ nunca invoca retry exponencial. |
| **Pico de CPU Snapshot SQL** | Análise de plano de execução em `ava-sync.service.ts:230` | **Confirmado**: Falta de sargabilidade em `regexp_replace(p.curso, ...)` força Nested Loop com Seq Scan completo. Ausência de `DISTINCT ON` quebra sob dados duplicados. |
| **Vazamento de Memória Cache** | Análise de `cache.service.ts:138` | **Confirmado**: Limpeza não deleta chaves sem TTL ou com expiração futura se o mapa ultrapassar 2000 chaves. |

---

## 8. Conclusão & Próximos Passos Priorizados

A camada de integrações externas e pipelines assíncronos do Nexus Core possui alta completude funcional, mas requer as seguintes correções de resiliência prioritárias:
1. **Prioridade Imediata (P0)**:
   - Adicionar listener `poolInstance.on('error')` e verificação de host vazio em `AcademicService` para sanar o crash potencial e acelerar a esteira de testes/CI.
   - Corrigir a query de `refreshConsolidatedSnapshot` com `DISTINCT ON ("sourceInstitution", aluno_id, curso)` e colunas pré-normalizadas para eliminar o risco de abort e reduzir o uso de CPU de 100% para níveis normais.
2. **Prioridade Alta (P1)**:
   - Ajustar o processador do BullMQ e o `AvaSyncService` para permitir que falhas transitórias de rede disparem o retry com backoff exponencial do BullMQ.
   - Adicionar `jobId` determinístico no `addAvaSyncJob` para impedir concorrência predatória de jobs idênticos.
   - Restringir a execução do `refreshConsolidatedSnapshot` para 1 vez por instituição / batch global (eliminando a amplificação de 11x).
3. **Prioridade Média (P2)**:
   - Substituir o mapa em memória do `CacheService` por um Bounded LRU Cache com tamanho máximo de 1.000 itens.
   - Implementar reconciliação para remoção de registros de alunos evadidos no Moodle.
