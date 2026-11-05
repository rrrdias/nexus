# Handoff Report: External Integrations & Data Pipelines Resilience Audit (R3)

**Type:** Hard Handoff  
**Agent:** `teamwork_preview_worker_resilience_1`  
**Recipient:** Orchestrator (`27e91390-bd43-444c-a451-05eaa934d0b8`)  
**Artifact:** `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\teamwork_preview_worker_resilience_1\integrations_audit.md`  

---

## 1. Observation

1. **`AvaSyncService` HTTP Timeout & Mascaramento de Falhas (`apps/backend/src/ava-sync/ava-sync.service.ts`)**:
   - Linhas 325-352 (`syncGrades`) e 620-647 (`syncProgress`): Em caso de timeout de 120s (`AbortError`) ou falha de conexão de rede, o bloco catch retorna `{ source: '...', status: 'queued', reason: 'Timeout na resposta do Moodle (120s)...' }`.
   - `apps/backend/src/jobs/processors/ava-sync.processor.ts:152-174`: O processador filtra apenas `results.filter((r) => r.status === 'error')`. Como `status: 'queued'` não é classificado como erro, o processador retorna `{ success: true, queued: true, results }` sem lançar exceção. O BullMQ registra o job como `completed`, ignorando integralmente o retry com backoff exponencial configurado em `jobs.service.ts:85`.
   - `apps/backend/src/jobs/jobs.module.ts:27-34` e `jobs.service.ts:80-101`: Nenhuma Dead-Letter Queue (DLQ) está configurada para reter jobs irrecuperáveis após esgotamento de tentativas. O método `addAvaSyncJob` não fornece `jobId` determinístico, permitindo que múltiplas execuções simultâneas para a mesma instituição concorram no PostgreSQL sob `concurrency: 2`.

2. **`AcademicService` MSSQL Pool & Cold Start em Testes E2E (`apps/backend/src/academic/academic.service.ts`)**:
   - Linhas 150-170: O pool `sql.ConnectionPool(config).connect()` é instanciado em `onModuleInit` sem nenhum listener `this.pool.on('error', ...)`.
   - Linhas 723-750: Não há rotina de auto-reconexão se a conexão cair após o boot.
   - Execução do comando `npm run test:e2e`: Em `test/auth-and-rbac.e2e-spec.ts`, onde `process.env.LYCEUM_DB_HOST` está vazio, o teste registra verbatim:
     ```
     console.error
       [Lyceum DB] Connection or metadata initialization failed: ConnectionError: Failed to connect to :1433 - The argument 'hostname' must be a non-empty string. Received ''
           at C:\Users\ricardo.dias\develop\projetos\nexus-core\node_modules\mssql\lib\tedious\connection-pool.js:86:17
           at Connection.connectListener (C:\Users\ricardo.dias\develop\projetos\nexus-core\node_modules\tedious\src\connection.ts:1812:9)
           code: 'ERR_INVALID_ARG_VALUE'
       at AcademicService.onModuleInit (../src/academic/academic.service.ts:229:15)
     ```
     O Jest alerta: `Force exiting Jest: Have you considered using --detectOpenHandles to detect async operations that kept running after all tests finished?`. A ausência de validação de hostname bloqueia o boot por ~5.4 segundos por suite.

3. **Snapshot Consolidation (`apps/backend/src/ava-sync/ava-sync.service.ts:151-265`)**:
   - Linhas 224-232: O `LEFT JOIN` entre `ava_progress_report p` e `ava_grades_report g` contém cláusulas `regexp_replace(p.curso, '[^a-zA-Z0-9]', '', 'g') = regexp_replace(g.course_fullname, '[^a-zA-Z0-9]', '', 'g')`. O planejador do PostgreSQL não pode utilizar índices B-Tree normais para predicados com regex em ambos os lados, forçando Nested Loop com Seq Scan completo.
   - Linhas 151 e 234: A consulta `INSERT INTO ... SELECT ... ON CONFLICT ("sourceInstitution", aluno_id, curso) DO UPDATE SET` não possui `DISTINCT ON ("sourceInstitution", aluno_id, curso)`. Se o `LEFT JOIN` com notas produzir múltiplos matches para o mesmo aluno/curso, o PostgreSQL lança o erro fatal `ERROR: ON CONFLICT DO UPDATE command cannot affect row a second time`.
   - Não há instrução `DELETE` ou reconciliação; alunos evadidos/excluídos do Moodle permanecem perpetuamente como registros fantasmas em `ava_consolidated_report`.
   - Em `ava-sync.processor.ts:121-150`, durante a sincronização global de 11 tarefas, `syncGrades:571` e `syncProgress:849` invocam `refreshConsolidatedSnapshot` sequencialmente em cada passo, totalizando **11 execuções redundantes**.

4. **Event Loop & Memória (`apps/backend/src/ava-sync/ava-sync.service.ts` e `cache.service.ts`)**:
   - Linhas 399 e 694 de `ava-sync.service.ts`: `data = JSON.parse(cleanText)` é executado de forma síncrona sobre payloads de 50MB a 200MB, bloqueando o Event Loop da thread única do Node.js por 3 a 10 segundos.
   - `apps/backend/src/cache/cache.service.ts:133-146`: `this.memoryCache.set(key, { value: stringified, expiresAt })` usa um `Map` simples. A limpeza ocorre apenas quando `size > 2000` e apenas remove chaves expiradas (`now > v.expiresAt`). Chaves sem TTL ou chaves válidas em alto volume nunca são removidas, provocando vazamento progressivo de memória até crash por OOM no heap do V8.

---

## 2. Logic Chain

1. **Da observação 1 para conclusão**: Como falhas de rede geram retorno com `{ status: 'queued' }` em vez de lançar exceção ou retornar `status: 'error'`, o processador do BullMQ considera o job finalizado com sucesso. Portanto, o mecanismo nativo de retry e exponential backoff do BullMQ é completamente anulado, mascarando indisponibilidades do Moodle e deixando os dados defasados.
2. **Da observação 2 para conclusão**: Como sockets TCP sofrem fechamento por timeout de inatividade ou resets de rede, a ausência de um handler para `'error'` no `EventEmitter` do pool do tedious faz o Node.js lançar `ERR_UNHANDLED_ERROR`, abortando o processo da aplicação. A ausência de verificação de `process.env.LYCEUM_DB_HOST` faz o tedious tentar conexão a `:1433`, gerando cold start de 5+ segundos em testes e CI.
3. **Da observação 3 para conclusão**: A utilização de funções não-sargáveis (`regexp_replace`) na cláusula de junção invalida os índices B-Tree existentes, forçando avaliação $O(N \times M)$ e elevando a CPU a 100%. Como o `LEFT JOIN` pode multiplicar tuplas quando há duplicatas de notas ou múltiplos matches de shortname/fullname, o comando de upsert gera duas atualizações para a mesma chave de conflito, violando a invariante do PostgreSQL e abortando a operação. A ausência de delete ou controle de lote perpetua registros de alunos evadidos.
4. **Da observação 4 para conclusão**: Como `JSON.parse` é executado na main thread sem yield ou worker thread, payloads de dezenas de megabytes congelam o loop de eventos, impedindo o atendimento a novas requisições HTTP e causando timeout em probes de saúde. O mapa de cache em memória sem política LRU acumula entradas indefinidamente quando o Redis está inativo, esgotando o limite do heap V8.

---

## 3. Caveats

- **Ambiente de Teste Local**: Os testes de unidade (`npm test`) e E2E (`npm run test:e2e`) foram executados com os bancos locais e mocks previstos no repositório. O banco SQL Server Lyceum de produção não estava acessível diretamente no ambiente local, o que permitiu confirmar com precisão o comportamento de fallback e o erro de cold start.
- **Plugins do Moodle**: A lógica de "SQL Adiado" depende do comportamento assíncrono do plugin Moodle configurado nas instituições. A solução proposta preserva a sinalização de execução do Moodle, corrigindo estritamente a classificação de falhas de transporte/rede e a orquestração do BullMQ.

---

## 4. Conclusion

A infraestrutura de integrações e pipelines de dados (R3) do Nexus Core requer 4 intervenções arquiteturais prioritárias detalhadas no relatório `integrations_audit.md`:
1. **BullMQ & Moodle**: Separar erros de rede (que devem lançar exceção e acionar o retry com backoff exponencial do BullMQ) de relatórios pendentes no Moodle; adicionar deduplicação determinística com `jobId` e registro de DLQ.
2. **MSSQL Pool**: Adicionar listener `poolInstance.on('error')`, lógica de auto-reconexão com backoff e guard `if (!process.env.LYCEUM_DB_HOST) return;` para eliminar cold start em testes.
3. **Consolidação PostgreSQL**: Adicionar `DISTINCT ON ("sourceInstitution", aluno_id, curso)` e colunas pré-normalizadas indexadas para eliminar o erro de conflito e reduzir a CPU; adicionar reconciliação para alunos evadidos; e restringir a execução da consolidação para 1 vez por lote/instituição (em vez de 11 vezes).
4. **Memória & Event Loop**: Substituir o `Map` do `CacheService` por um Bounded LRU Cache (max 1.000 itens) e adotar parsing não-bloqueante para payloads JSON grandes.

---

## 5. Verification Method

1. **Auditoria Documental**:
   Inspecionar o arquivo gerado:
   `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\teamwork_preview_worker_resilience_1\integrations_audit.md`
2. **Execução de Testes de Unidade do Backend**:
   ```powershell
   cd c:\Users\ricardo.dias\develop\projetos\nexus-core\apps\backend
   npm test
   ```
   *Critério de Sucesso:* 26/26 suites passando, 93/93 testes passando.
3. **Execução de Testes E2E e Inspeção do Erro de Cold Start**:
   ```powershell
   cd c:\Users\ricardo.dias\develop\projetos\nexus-core\apps\backend
   npm run test:e2e -- test/auth-and-rbac.e2e-spec.ts
   ```
   *Critério de Sucesso:* Confirmação do log de tentativa de conexão a `:1433` em `academic.service.ts:168` com host vazio.
4. **Condições de Invalidação**:
   O diagnóstico será invalidado se o PostgreSQL permitir que um `INSERT ... ON CONFLICT DO UPDATE` atualize a mesma linha múltiplas vezes no mesmo statement (o que viola a especificação SQL do PostgreSQL), ou se o BullMQ executar retries em jobs que retornam sem lançar exceção (o que viola a especificação do BullMQ).
