# Relatório de Auditoria Técnica: Integrações Externas, Filas Assíncronas e Resiliência de Sincronização

**Data**: 23 de Outubro de 2026  
**Projeto**: Nexus Core (`apps/backend` e `apps/frontend`)  
**Autor**: Teamwork Explorer (Auditoria de Integrações e Resiliência)  
**Escopo**: `AvaSyncService`, `AcademicSyncService` / `AcademicService`, `BullMQ`, `JobsService`, `CacheService`, Snapshot Consolidado (`ava_consolidated_report`), Resiliência de I/O e Observabilidade.

---

## 1. Sumário Executivo

A aplicação Nexus Core implementa uma arquitetura híbrida de sincronização de dados acadêmicos e analíticos:
1. **Lyceum (MSSQL / SQL Server)**: Acesso direto via pool TCP gerenciado pelo driver `mssql` (`tedious`), sincronizando turmas, matrículas, discentes e docentes para o PostgreSQL local (`apps/backend/src/academic/`).
2. **Moodle AVA (HTTP / Deferred SQL)**: Embora a especificação mencione Moodle AVA / MySQL, a implementação real **não se conecta diretamente a um banco MySQL**, mas consome relatórios gerados pelo plugin de SQL Adiado do Moodle via requisições HTTP REST (`apps/backend/src/ava-sync/`).
3. **Processamento em Segundo Plano (BullMQ / Redis)**: Duas filas principais (`academic-sync` e `ava-sync`) com workers dedicados e controle de progresso granular consumido pelo frontend Next.js via Server Actions e polling.
4. **Relatórios Consolidados por Snapshot**: Tabela desnormalizada (`ava_consolidated_report`) com índices trigram GIN e B-Tree para consultas ultrarrápidas (< 20ms) sem execução de joins complexos em tempo de requisição.

**Diagnóstico Geral**: O design de cache local e snapshots atinge excelente performance de leitura no dashboard. Entretanto, foram identificados **riscos críticos de confiabilidade, integridade de dados e concorrência**, destacando-se:
- Ausência de reconexão automática e listener de erro no pool MSSQL (risco de queda fatal do processo Node.js).
- Mascaramento de erros de timeout/rede do Moodle como jobs "concluídos", inibindo a política de retry do BullMQ.
- Inexistência de Dead-Letter Queues (DLQ) e descarte silencioso de falhas após 100 jobs.
- Falta de deduplicação idempotente nas filas do AVA e risco de duplicação em ambientes clusterizados (sem distributed lock).
- Risco de aborto no snapshot consolidado (`ON CONFLICT DO UPDATE command cannot affect row a second time`) por ausência de deduplicação na query `LEFT JOIN`.
- Bloqueio síncrono do Event Loop durante parse de payloads JSON massivos e vazamento potencial de memória no fallback do `CacheService`.

---

## 2. Mapeamento Arquitetural das Integrações Externas

### 2.1. AvaSyncService (Moodle AVA)
- **Localização**: `apps/backend/src/ava-sync/ava-sync.service.ts`
- **Mecanismo de Conexão**: Não utiliza conexão direta de socket MySQL. O serviço realiza requisições HTTP (`fetch`) para endpoints parametrizados do Moodle com cabeçalho `cache: 'no-store'`.
- **Instituições Atendidas (6)**: EAD (`ead`), UniEvangélica Anápolis (`uni`), Ceres / UniEgo (`uniego`), Raízes (`raizes`), EEFN (`eefn`) e Pós-Graduação (`pos`).
- **Tipos de Relatório**: `grades` (notas por fase/atividade) e `progress` (progresso percentual e dias sem acesso).
- **Ciclo de Atualização Adiada**:
  - `GET URL`: Consulta o arquivo JSON gerado pelo Moodle.
  - `ATT URL`: Dispara o gatilho de geração em fila assíncrona do próprio Moodle para o ciclo subsequente (`triggerMoodleUpdate`, linhas 282-304).
- **Persistência Local**:
  - Tabelas: `ava_grades_report`, `ava_progress_report` e `ava_consolidated_report`.
  - Processamento em lotes de 250 itens (`processInChunks`, linhas 8-43) com `insert().onConflictDoUpdate()`.

### 2.2. Lyceum (AcademicSyncService e AcademicService)
- **Localização**:
  - Pool e queries: `apps/backend/src/academic/academic.service.ts`
  - Sincronizador e agendador: `apps/backend/src/academic/academic-sync.service.ts`
- **Mecanismo de Conexão**: Driver nativo `mssql` conectado a banco Microsoft SQL Server (porta 1433, IP configurável via `.env`).
- **Configuração do Pool (`academic.service.ts:150-165`)**:
  ```ts
  max: 10,
  min: 0,
  idleTimeoutMillis: 30000,
  encrypt: false,
  trustServerCertificate: true
  ```
- **Vistas Remotas (Views Lyceum)**:
  - `VW_AVA_TURMA`: Dados de turmas filtrados por períodos ativos (`LYCEUM_ACTIVE_PERIODS`, default `2026-2`).
  - `VW_AVA_MATRICULA`: Vínculo discente/docente com turmas ativas.
  - `VW_AVA_DISCENTE`: Dados cadastrais de alunos (nomes, polos/unidade física, telefones, CPF, e-mail).
  - `VW_AVA_DOCENTE`: Dados de professores associados.
- **Ciclo de Sincronização**:
  - Cron diário às 03:00 AM (`@Cron('0 3 * * *')`, `academic-sync.service.ts:25-29`).
  - Execução manual/sob demanda via controller (`academic.controller.ts:25-38`).
  - Transação atômica para limpeza e inserção de matrículas (`academic-sync.service.ts:160-190`).
  - Batching de 1.000 usuários por query MSSQL (`academic-sync.service.ts:201-205`).

---

## 3. Análise Detalhada de Filas BullMQ e Background Workers

### 3.1. Definições de Filas e Conexão Redis
As filas são registradas em `apps/backend/src/jobs/jobs.module.ts`:
- **Filas**: `academic-sync` (`QUEUE_ACADEMIC_SYNC`) e `ava-sync` (`QUEUE_AVA_SYNC`).
- **Configuração do Cliente Redis (`jobs.module.ts:13-25`)**:
  - `maxRetriesPerRequest: null`: Conforme preconizado pelo BullMQ para comandos bloqueantes (`BRPOPLPUSH`).
  - `enableReadyCheck: false`.
  - `retryStrategy`: `Math.min(times * 1000, 10000)` (backoff linear limitado a 10s).
- **Gargalo Identificado**: Não há opções padrão (`defaultJobOptions`) definidas no registro da fila (`BullModule.registerQueue(...)`), dependendo exclusivamente das opções passadas manualmente em cada chamada de `add()`.

### 3.2. Concorrência e Workers
- **Worker Acadêmico (`AcademicSyncProcessor`, `academic-sync.processor.ts:7-9`)**:
  - `concurrency: 1`: Adequado, pois a sincronização do Lyceum é um processo pesado e global que altera as tabelas inteiras de matrículas do período.
- **Worker AVA (`AvaSyncProcessor`, `ava-sync.processor.ts:12-14`)**:
  - `concurrency: 2`: Permite que dois jobs de sincronização AVA rodem em paralelo.
  - **Problema de Concorrência**: Como ambos os jobs executam `refreshConsolidatedSnapshot` ao final de cada etapa, dois workers concorrentes competem atualizando a mesma tabela `ava_consolidated_report`, gerando contenção de escrita e locks no PostgreSQL.

### 3.3. Políticas de Retry, Backoff e Falhas
| Fila | Tentativas (`attempts`) | Estratégia de Backoff | Limpeza de Sucesso | Limpeza de Falha |
| :--- | :--- | :--- | :--- | :--- |
| `academic-sync` | 3 | Exponencial, 5.000ms (`jobs.service.ts:59-63`) | 50 itens / 24h | 100 itens |
| `ava-sync` | 2 | Exponencial, 3.000ms (`jobs.service.ts:85-89`) | 50 itens / 24h | 100 itens |

### 3.4. Ausência Crítica de Dead-Letter Queue (DLQ)
- O BullMQ não possui uma fila morta (DLQ) configurada nativamente por padrão sem listeners de evento.
- Quando as tentativas (`attempts: 2` ou `3`) se esgotam:
  - O job é movido para o estado `failed`.
  - Não há envio de alerta, notificação administrativa ou publicação em fila secundária (DLQ).
  - Com `removeOnFail: { count: 100 }`, após 100 falhas, os registros de erro mais antigos são **definitivamente purgados do Redis**, destruindo o histórico para auditoria e debug.

### 3.5. Deduplicação e Prevenção de Concorrência
- **Fila Acadêmica (`addAcademicSyncJob`, `jobs.service.ts:44-53`)**:
  - Realiza verificação prévia:
    ```ts
    const activeJobs = await this.academicQueue.getActive();
    const waitingJobs = await this.academicQueue.getWaiting();
    const existingJob = [...activeJobs, ...waitingJobs][0];
    if (existingJob) return { jobId: existingJob.id, queue: QUEUE_ACADEMIC_SYNC };
    ```
  - **Falha de Condição de Corrida (TOCTOU)**: O padrão "verificar depois adicionar" não é atômico. Sob requisições simultâneas no endpoint `/api/academic/sync`, ambas as threads podem constatar lista vazia e enfileirar jobs redundantes. Não foi utilizado `jobId` determinístico nem trava no Redis.
- **Fila AVA (`addAvaSyncJob`, `jobs.service.ts:80-101`)**:
  - **Vulnerabilidade Total**: O método `addAvaSyncJob` não realiza checagem alguma nem define `jobId` fixo. Se o usuário clicar várias vezes no botão de sincronização, múltiplos jobs idênticos para a mesma instituição são empilhados na fila e processados em duplicidade.

---

## 4. Avaliação de Tolerância a Falhas e Resiliência sob Estresse

### 4.1. Comportamento com Lyceum (MSSQL)
1. **Inicialização "One-Shot" (`academic.service.ts:168`)**:
   - O método `onModuleInit()` tenta conectar uma única vez ao iniciar a aplicação.
   - Se o servidor SQL Server estiver temporariamente inacessível durante o boot do NestJS (por exemplo, reinício de servidor ou manutenção de rede):
     - O erro é capturado em `catch (err)` e exibido no console.
     - `this.pool` permanece `null`.
     - **Não existe reconexão automática em background nem Lazy Reconnect**. Qualquer requisição subsequente lançará a exceção `Lyceum database not connected.`, tornando o módulo inoperante até que todo o container/processo do backend seja reiniciado.
2. **Crash Potencial por Falta de Listener `pool.on('error')`**:
   - No driver `node-mssql` (`tedious`), se a conexão for interrompida pelo servidor MSSQL (reset de conexão TCP ou timeout ocioso), o objeto `ConnectionPool` emite um evento `'error'`.
   - Se não houver um listener registrado (`pool.on('error', (err) => ...)`), o runtime do Node.js trata eventos `'error'` não escutados como **Unhandled Exception**, abortando e encerrando sumariamente o processo da aplicação (`process.exit(1)`).
3. **Ausência de Configuração de Timeout de Query (`requestTimeout`)**:
   - A configuração (`academic.service.ts:150-165`) não declara `requestTimeout` (o padrão do driver é 15.000ms).
   - Consultas volumosas em `VW_AVA_MATRICULA` e `VW_AVA_TURMA` que demorem mais de 15 segundos em períodos de alta carga acadêmica falharão abruptamente com timeout.

### 4.2. Comportamento com Moodle AVA (HTTP / SQL Adiado)
1. **Mascaramento de Erros e Supressão de Retries (`ava-sync.service.ts:335-352`)**:
   - Quando a requisição HTTP estoura o timeout de 120s (`AbortError`) ou encontra falha de conexão (DNS, Connection Refused):
     ```ts
     if (fetchError.name === 'AbortError') {
       return { source: `${institution}_grades`, status: 'queued', reason: 'Timeout na resposta do Moodle (120s)...' };
     }
     ```
   - O serviço retorna explicitamente `status: 'queued'`.
   - No processador (`ava-sync.processor.ts:152`), o código apenas lança erro se todos os itens forem `status === 'error'`:
     ```ts
     const onlyErrors = results.filter((r) => r.status === 'error');
     if (onlyErrors.length === results.length && results.length > 0) throw new Error(...);
     ```
   - **Consequência Grave**: O BullMQ interpreta que o job foi **concluído com sucesso**. A política de tentativas (`attempts: 2`) e o backoff exponencial são descartados. Nenhum mecanismo agenda a leitura futura do relatório, e a base permanece desatualizada até intervenção manual.
2. **Falhas de Autenticação / URLs Inválidas**:
   - Se a chave ou URL configurada no `.env` expirar e o Moodle retornar uma página de login HTML:
     ```ts
     if (cleanText.startsWith('<!DOCTYPE') || cleanText.startsWith('<html')) {
       await this.triggerMoodleUpdate(institution, attUrl, 'Notas');
       return { status: 'queued', reason: 'Moodle retornou HTML/Processamento...' };
     }
     ```
   - O sistema interpreta a tela de login como "Moodle processando" (`status: 'queued'`) e entra em loop acionando continuamente o gatilho sem notificar falha de credenciais.

---

## 5. Auditoria da Consolidação de Snapshots por Polo e Instituição

### 5.1. Mecanismo de Consolidação (`AvaSyncService.refreshConsolidatedSnapshot`)
- **Evidência no Código**: `apps/backend/src/ava-sync/ava-sync.service.ts`, linhas 141 a 280.
- Executa a query:
  ```sql
  INSERT INTO ava_consolidated_report ( ... )
  SELECT 
    gen_random_uuid(), p."sourceInstitution", p.aluno_id, p.matricula, p.usuario, p.aluno,
    g.user_email, p.user_phone1, p.periodo, p.subcategoria, p.curso, p.curso_perfil,
    p.periodo_perfil, p.unidade_fisica, p.enrolment_status, p.lastaccess, p.dias_sem_acesso,
    p.fase1, p.fase2, p.fase3, p.progresso_total, p.lista_fase1, p.lista_fase2, p.lista_fase3,
    g.id, g.fase1, g.fase2, g.fase3, g.media, g.lista_fase1, g.lista_fase2, g.lista_fase3, g.lista_notas, now()
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

### 5.2. Falhas Críticas de Consistência e Transacionalidade
1. **Crash por Chave Duplicada no Mesmo Statement**:
   - O `LEFT JOIN` usa quatro condições com `OR`, incluindo `regexp_replace`. Se existirem múltiplos registros em `ava_grades_report` para o mesmo aluno/curso (ex.: cursos homônimos ou histórico de reoferta), a junção gera linhas duplicadas com a mesma tupla `("sourceInstitution", aluno_id, curso)`.
   - No PostgreSQL, executar um `INSERT ... ON CONFLICT DO UPDATE` onde o `SELECT` de origem traz duplicatas da chave do índice único gera o erro irrecuperável:
     `ERROR: ON CONFLICT DO UPDATE command cannot affect row a second time`
   - **Correção Necessária**: A query de seleção deve utilizar `DISTINCT ON (p."sourceInstitution", p.aluno_id, p.curso)` ou particionamento via window function (`ROW_NUMBER() OVER (...)`).
2. **Dados Fantasma (Sem Purga de Desvinculações)**:
   - A operação é puramente um `INSERT ... ON CONFLICT DO UPDATE`. Se um discente cancelar sua matrícula, trancar o curso ou for excluído do Moodle, o registro dele na tabela consolidada **nunca é removido nem marcado como inativo**, permanecendo indefinidamente nos relatórios e distorcendo as médias estatísticas por polo.
3. **Execução Excessiva e Redundante no Worker**:
   - Em `AvaSyncProcessor.process()` (`ava-sync.processor.ts:121-150`):
     - Para a instituição `ead`: executa `syncGrades` (que chama `refreshConsolidatedSnapshot('ead')`), depois executa `syncProgress` (que chama `refreshConsolidatedSnapshot('ead')`).
     - Em uma sincronização de todas as 6 instituições, o snapshot consolida a base **11 vezes consecutivas**, gastando ciclos massivos de CPU do banco PostgreSQL sem ganho funcional.
4. **Ausência de Trava Distribuída (Locking)**:
   - Não há uso de travas consultivas (`pg_advisory_lock`) nem Redlock. Se dois workers ou duas instâncias do backend rodarem a consolidação ao mesmo tempo, ocorrerá disputa violenta de locks de linha, lentidão generalizada e eventuais deadlocks.

---

## 6. Gargalos de Event Loop, Vazamento de Memória e Observabilidade

### 6.1. Bloqueio do Event Loop em Payloads Massivos
- **Evidência**: `apps/backend/src/ava-sync/ava-sync.service.ts:399` e `694`:
  ```ts
  const textContent = await res.text();
  // ...
  data = JSON.parse(cleanText);
  ```
- **Risco**: Em relatórios de grandes polos com 40.000 a 80.000 matrículas, o texto JSON pode ultrapassar 40 MB a 100 MB.
- A função `JSON.parse` é estritamente síncrona e executa na thread principal do Node.js. O parse de um objeto JSON desse porte bloqueia o Event Loop por **500ms a 1.800ms**. Durante esse período, o servidor backend não responde a nenhuma requisição HTTP de alunos ou administradores, gerando picos de latência e erros 504 no frontend.
- **Construção de Inserções em Memória**: Em `syncGrades` (linhas 453-509), o mapeamento e desduplicação do array completo ocorrem na memória RAM do processo antes de fatiar em chunks, podendo disparar o limite de heap do V8 (`JavaScript heap out of memory`) em containers com memória restrita (ex.: 512MB/1GB).

### 6.2. Vazamento de Memória Potencial no CacheService
- **Evidência**: `apps/backend/src/cache/cache.service.ts:133-145`:
  ```ts
  const expiresAt = ttlSeconds && ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null;
  this.memoryCache.set(key, { value: stringified, expiresAt });

  if (this.memoryCache.size > 2000) {
    const now = Date.now();
    for (const [k, v] of this.memoryCache.entries()) {
      if (v.expiresAt && now > v.expiresAt) {
        this.memoryCache.delete(k);
      }
    }
  }
  ```
- **Diagnóstico**: Quando o Redis está indisponível ou desativado, o cache opera em memória local. A política de limpeza só é disparada se o mapa ultrapassar 2.000 chaves. No entanto:
  - Chaves sem TTL (`ttlSeconds` indefinido) possuem `expiresAt = null`. A condição `v.expiresAt && now > v.expiresAt` nunca é satisfeita para elas.
  - Não existe política de despejo LRU (Least Recently Used) ou FIFO. Se o cache for preenchido com chaves persistentes, o mapa crescerá continuamente na memória heap sem nunca ser desalocado.

### 6.3. Anti-Pattern `KEYS *` no Redis
- **Evidência**: `apps/backend/src/cache/cache.service.ts:166`:
  ```ts
  const keys = await this.redisClient.keys(pattern);
  ```
- O comando `KEYS` do Redis é O(N) e bloqueia a thread única do servidor Redis. Em ambientes de produção com muitas chaves, a chamada `delByPattern` paralisa o Redis temporariamente. O correto é utilizar a iteração não bloqueante `SCAN`.

### 6.4. Observabilidade, Métricas e Open Handles
1. **Métricas Faltantes**:
   - O `HealthService` (`apps/backend/src/health/health.service.ts:83-86`) apenas executa `academicQueue.count()` como checagem básica do Redis.
   - Não há monitoramento de profundidade das filas (jobs `waiting`, `delayed`, `failed`), tempo médio de execução de sincronização ou contadores de falhas expostos via endpoint `/metrics` (Prometheus).
2. **Handles Abertos no Jest**:
   - Os testes de e2e emitem o aviso: `Force exiting Jest: Have you considered using --detectOpenHandles...`.
   - O driver `ioredis` ou listeners do MSSQL mantêm sockets abertos após a finalização da suíte de testes devido à ausência de shutdown ordenado em todos os providers de teste.

### 6.5. Polling Infinito no Frontend
- **Evidência**:
  - `apps/frontend/src/components/ava-reports/ConsolidatedActions.tsx:31-46`
  - `apps/frontend/src/app/academic/AcademicDashboard.tsx:129-147`
- A função de polling implementa um laço `while (!isDone)` que dorme por 1.500ms e consulta `/api/jobs/:queue/:id/status`.
- Se a requisição HTTP falhar temporariamente ou se o job for removido do Redis, o laço não possui contador máximo de tentativas nem timeout limite (ex.: 15 minutos), mantendo o navegador do usuário preso em polling infinito.

---

## 7. Matriz de Riscos e Recomendações Priorizadas

| Item | Classificação | Problema Identificado | Impacto | Esforço | Recomendação Prática de Implementação |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **R1** | **Crítico** | Pool MSSQL sem auto-reconexão e sem listener de erro. | Queda do processo Node.js ou indisponibilidade total das consultas Lyceum após queda de rede. | Baixo | Adicionar `pool.on('error', ...)` para capturar erros silenciosamente; implementar lazy connection / reconnect automático em `getSqlPool()`. |
| **R2** | **Crítico** | Mascaramento de timeout/erro do Moodle como `queued` no AVA Sync. | BullMQ não reexecuta jobs falhos; banco permanece com dados desatualizados sem aviso. | Baixo | Retornar `status: 'error'` no `AvaSyncService` em casos de falha/timeout real e permitir que o BullMQ realize as tentativas configuradas (`attempts: 2`). |
| **R3** | **Crítico** | Risco de aborto no Snapshot Consolidado por duplicatas no `LEFT JOIN`. | A sincronização falha inteiramente ao encontrar duplicata no conflito da chave única. | Baixo | Inserir `DISTINCT ON (p."sourceInstitution", p.aluno_id, p.curso)` no `SELECT` da query `refreshConsolidatedSnapshot`. |
| **R4** | **Alto** | Falta de Trava Distribuída (Redlock/Advisory Lock) no Cron Acadêmico. | Execução concorrente simultânea de múltiplos pods do backend rodando `DELETE/INSERT` em matrículas. | Médio | Utilizar `pg_advisory_xact_lock` no PostgreSQL durante a execução do cron diário ou trava distribuída no Redis. |
| **R5** | **Alto** | Falta de Deduplicação em `addAvaSyncJob`. | Múltiplos jobs redundantes enfileirados por cliques repetidos ou requisições concorrentes. | Baixo | Definir `jobId` determinístico (ex.: `ava-${institution}-${type}`) ou checar jobs ativos/waiting antes de enfileirar. |
| **R6** | **Alto** | Falta de Dead-Letter Queue (DLQ) e purga cega após 100 falhas. | Perda definitiva de jobs com erro e falta de visibilidade para os administradores. | Médio | Implementar fila DLQ ou tabela PostgreSQL de `failed_sync_jobs` com payload e stack trace completo. |
| **R7** | **Médio** | Bloqueio do Event Loop durante `JSON.parse` em grandes lotes. | Degradação de latência da API backend e indisponibilidade momentânea para usuários. | Médio | Adotar streaming JSON (`stream-json` ou Worker Threads) para payloads superiores a 10MB. |
| **R8** | **Médio** | Atualizações repetidas do Snapshot Consolidado em cadeia (11x). | Sobrecarga desnecessária de I/O e processador no PostgreSQL durante a sincronização global. | Baixo | Executar `refreshConsolidatedSnapshot` apenas uma vez ao término de todas as etapas daquela instituição. |
| **R9** | **Médio** | Polling infinito sem timeout no frontend Next.js. | Consumo contínuo de rede e travamento do estado de sincronização no navegador do usuário. | Baixo | Adicionar timeout máximo de 10-15 minutos ou limite de 400 tentativas no `pollJobUntilDone`. |
| **R10**| **Baixo** | Uso do comando `KEYS` no `CacheService.delByPattern`. | Bloqueio do servidor Redis em bases com grande volume de chaves. | Baixo | Substituir `redisClient.keys(pattern)` por `redisClient.scanStream(...)`. |

---

## 8. Índice de Evidências no Código Fonte

- **Definição de Filas e Conexão BullMQ**:
  - `apps/backend/src/jobs/jobs.constants.ts`: Linhas 1 a 6.
  - `apps/backend/src/jobs/jobs.module.ts`: Linhas 13 a 34.
  - `apps/backend/src/jobs/jobs.service.ts`: Linhas 42 a 101.
- **Processadores de Jobs (Workers)**:
  - `apps/backend/src/jobs/processors/academic-sync.processor.ts`: Linhas 7 a 40.
  - `apps/backend/src/jobs/processors/ava-sync.processor.ts`: Linhas 12 a 175.
- **Integração Moodle AVA & Snapshot Consolidado**:
  - `apps/backend/src/ava-sync/ava-sync.service.ts`:
    - Validação de Schema / Índices: Linhas 52 a 139.
    - Snapshot Consolidado (`refreshConsolidatedSnapshot`): Linhas 141 a 280.
    - Gatilho SQL Adiado (`triggerMoodleUpdate`): Linhas 282 a 304.
    - Sincronização de Notas (`syncGrades`): Linhas 306 a 600.
    - Sincronização de Progresso (`syncProgress`): Linhas 601 a 880.
- **Integração Lyceum (MSSQL)**:
  - `apps/backend/src/academic/academic.service.ts`:
    - Conexão e Pool MSSQL: Linhas 140 a 234.
    - Shutdown do Pool: Linhas 261 a 266.
    - Verificação de Health: Linhas 732 a 750.
  - `apps/backend/src/academic/academic-sync.service.ts`:
    - Cron diário às 03:00 AM: Linhas 25 a 29.
    - Sincronização de Turmas e Matrículas em Transação: Linhas 62 a 190.
    - Sincronização de Discentes e Docentes em Lotes: Linhas 192 a 355.
- **Cache e Redis**:
  - `apps/backend/src/cache/cache.service.ts`: Linhas 21 a 68, 132 a 145, 163 a 184.
- **Frontend Next.js (Polling e Ações de Sync)**:
  - `apps/frontend/src/app/actions/jobs.ts`: Linhas 21 a 30.
  - `apps/frontend/src/components/ava-reports/ConsolidatedActions.tsx`: Linhas 29 a 70.
  - `apps/frontend/src/app/academic/AcademicDashboard.tsx`: Linhas 124 a 147.
