# Relatório de Auditoria Funcional de Ponta a Ponta — Nexus Core

**Data da Auditoria**: 18 de Setembro de 2026  
**Auditor**: `teamwork_preview_explorer_survey_2` (Exploration Subagent)  
**Escopo**: Análise funcional profunda de ponta a ponta (Next.js 16 frontend + NestJS backend) abrangendo os 4 domínios funcionais do monorepo Nexus Core.

---

## Sumário Executivo

O Nexus Core opera como um monorepo corporativo (npm workspaces + Turbo) integrando uma aplicação **Next.js 16 (Turbopack, App Router, React 19)** com basePath fixo `/nexus` e um backend **NestJS 11** com **Drizzle ORM**, **PostgreSQL 16**, filas **BullMQ/Redis** e conectores para **Moodle/OpenLMS** e **Lyceum MSSQL**.

Todos os testes unitários (**23 suites, 65 testes, 100% green**), testes E2E (**4 suites, 12 testes, 100% green**) e o build unificado (`npm run build` em ambos os workspaces) executam com sucesso. 

A arquitetura geral exibe maturidade técnica elevada com implementações robustas de cache híbrido (Redis com fallback em memória), filas assíncronas com feedback visual contínuo, concorrência transacional pessimista (`FOR UPDATE`) e snapshot de relatórios consolidado. Contudo, a investigação revelou divergências de roteamento, dessincronizações de sessão, parâmetros default dessintonizados e rotas auxiliares com fallbacks de rede incorretos.

---

## 1. Fluxos de Autenticação & Gestão de Sessão

### 1.1 Arquitetura e Ciclo de Vida do Token

O fluxo de autenticação é híbrido, unindo a sessão do Next.js via **NextAuth v5** com emissão e validação de JWT stateless pelo backend NestJS:

```
[ Usuário ] ───(Login Form /credentials)───► [ NextAuth authorize() ]
                                                      │
                                           POST /api/auth/login
                                                      │
                                                      ▼
                                           [ NestJS AuthService ]
                                                      │
                                         Verifica senha (bcryptjs)
                                         Verifica isActive no banco
                                         Busca grupo 'Super Admin'
                                                      │
                                         Emite JWT Backend (exp: 2h)
                                                      │
                                                      ▼
[ NextAuth Session Cookie (exp: 30m) ] ◄─── Retorna { access_token, user }
```

1. **Frontend (`apps/frontend/src/auth.ts`)**:
   - Provider `Credentials`: envia `{ email: login, password }` para `POST /api/auth/login`.
   - Configuração de sessão: `strategy: "jwt"`, `maxAge: 30 * 60` (30 minutos), `updateAge: 10 * 60` (10 minutos).
   - O `access_token` retornado pelo NestJS é injetado no JWT do NextAuth (`token.accessToken = user.accessToken`) e exposto na sessão (`session.user.accessToken`).

2. **Backend (`apps/backend/src/auth`)**:
   - `AuthModule`: registra o `JwtModule` globalmente com `expiresIn: '2h'` e secret via `process.env.JWT_SECRET || 'nexus-secret-key-2026'`.
   - `JwtAuthGuard`: registrado como `APP_GUARD` global em `AppModule`. Extrai o Bearer token do header `Authorization`, valida a assinatura criptográfica e executa verificação de liveness de usuário.

3. **Validação de Usuário Ativo com Cache LRU**:
   - O `JwtAuthGuard` implementa um cache estático em memória (`userActiveCache: Map<string, UserActiveCacheEntry>`) com TTL de 30 segundos (`CACHE_TTL_MS = 30_000`) e auto-prune ao exceder 1000 entradas.
   - A cada requisição, se o cache estiver expirado, consulta `users.isActive` no PostgreSQL. Usuários desativados recebem `401 Unauthorized` imediatamente.

4. **Controle de Acesso RBAC (`apps/backend/src/auth/rbac.guard.ts`)**:
   - Registrado como segundo `APP_GUARD` global após o `JwtAuthGuard`.
   - Decorações suportadas:
     - `@Public()`: isenta a rota de autenticação e RBAC.
     - `@RequireAdmin()`: restringe o endpoint exclusivamente a usuários com flag `isSuperAdmin === true`.
     - `@RequireModule(...slugs)`: exige que o usuário tenha acesso (direto via `users_system_access` ou herdado via `group_system_access`) a pelo menos um dos módulos especificados.
   - Otimização de Performance: utiliza o `CacheService` Redis com chave `rbac:user:${userId}:modules` (TTL 300s) e fallback em memória `localFallbackCache` (TTL 60s).

### 1.2 Lacunas, Inconsistências e Riscos Identificados

| Item | Gravidade | Diagnóstico Técnico | Impacto Funcional |
|---|---|---|---|
| **Ausência de Refresh Token Backend** | **Média** | O JWT do backend tem validade de 2h (`signOptions: { expiresIn: '2h' }`), enquanto a sessão do NextAuth renova a cada 10 min. Não existe rota `POST /api/auth/refresh` no NestJS nem callback de rotação no NextAuth. | Se o usuário mantiver uma sessão aberta por mais de 2 horas ininterruptas, a sessão do NextAuth permanecerá válida, mas todas as chamadas de API passarão a falhar com 401, forçando logout repentino. |
| **Atributo `isDisabled` não propagado no NextAuth** | **Baixa** | Em `apps/frontend/src/types/next-auth.d.ts`, o campo `isDisabled?: boolean` foi tipado, e em `middleware.ts` linha 26 há a checagem `if (isLoggedIn && req.auth?.user?.isDisabled)`. No entanto, em `auth.ts`, nem o `authorize()`, nem o callback `jwt()`, nem o callback `session()` atribuem esse valor. | A verificação em `middleware.ts` para desativação no Edge é sempre `undefined`. O usuário desativado só é barrado quando atinge uma rota que consome o backend (`fetchFromApi` recebendo 401 do `JwtAuthGuard`). |
| **Ausência de Decorator `@CurrentUser()`** | **Baixa** | Não existe um custom param decorator (`createParamDecorator`) no backend. Todos os controllers realizam injeção de `@Req() req: any` e acessam manualmente `req.user`. | Perda de tipagem estrita nos controllers e inconsistência em testes de integração unitários caso o mock do request express não seja manual. |
| **Fallback de Segredo JWT em Múltiplos Pontos** | **Média** | O secret `'nexus-secret-key-2026'` está codificado como fallback hardcoded em `auth.module.ts:10` e em `jwt-auth.guard.ts:44`. | Risco de divergência caso uma variável de ambiente seja injetada apenas parcialmente, além de risco de vulnerabilidade se o deploy subir sem `JWT_SECRET` definido. |
| **Redirect de Erro no Login com basePath** | **Baixa** | Em `apps/frontend/src/app/login/page.tsx:105`, o tratamento de erro faz `redirect('/login?error=${error.type}')`. Com `basePath: '/nexus'`, o Next.js lida internamente, mas no `pages.signIn` de `auth.ts` foi definido `/nexus/login`. | Redirecionamentos manuais podem gerar duplicidade de prefixo (`/nexus/nexus/login`) em proxies reversos Nginx caso o `basePath` não seja estritamente padronizado. |

---

## 2. Fluxos de Relatórios AVA (Moodle / OpenLMS)

### 2.1 Visão Geral e Arquitetura de Dados

O módulo de Relatórios AVA consolida informações pedagógicas e engajamento acadêmico de 5 instituições de ensino (`ead`, `uni`, `uniego`, `raizes`, `eefn`) mais o canal de pós-graduação (`pos`):

```
                       ┌─── GET /api/ava-sync (Moodle JSON)
                       │
[ Moodle / OpenLMS ] ──┤
                       │
                       └─── POST /api/ava-reports/sync (BullMQ 'ava-sync')
                                        │
                                        ▼
                           [ PostgreSQL Tabelas Brutas ]
                           ├── ava_progress_report
                           └── ava_grades_report
                                        │
                         refreshConsolidatedSnapshot()
                                        ▼
                         [ ava_consolidated_report ] (Snapshot Materializado)
                                        │
                                        ▼
               [ API Endpoints / Paginados & Agregados SQL ]
               ├── POST /api/ava-reports/consolidated (~14ms)
               ├── POST /api/ava-reports/progress
               └── POST /api/ava-reports/grades
```

1. **Tabela de Snapshot Materializado (`ava_consolidated_report`)**:
   - Anteriormente, o relatório consolidado exigia um `LEFT JOIN` pesado entre `ava_progress_report` e `ava_grades_report` em runtime por aluno e disciplina com regex de limpeza.
   - Atualmente, a rotina `refreshConsolidatedSnapshot(institution)` no `AvaSyncService` processa e insere o snapshot diretamente na tabela `ava_consolidated_report`, com cláusula `ON CONFLICT ("sourceInstitution", aluno_id, curso) DO UPDATE`.
   - As consultas da página consolidada (`getConsolidatedData`) executam direto sobre a tabela materializada, alcançando latência de **~14ms** com índices trigram GIN em `aluno`, `curso` e `matricula`.

2. **Fluxo Assíncrono de Sincronização via BullMQ**:
   - `AvaReportsController.syncMoodleData`: quando chamado pelo frontend (sem query `async=false`), enfileira o job na fila `ava-sync` via `JobsService.addAvaSyncJob`.
   - O processador `AvaSyncProcessor` executa a busca no Moodle e reporta progresso de 0 a 100% e etapas descritivas (`job.updateProgress({ progress, step })`).
   - Os componentes frontend (`ConsolidatedActions`, `NotasActions`, `ProgressoActions`) iniciam polling com intervalo de 1500ms via `getJobStatus(queue, jobId)` e exibem barra de progresso em tempo real dentro do modal de confirmação.

3. **Exportação de Dados com Teto de Segurança**:
   - As funções `getProgressExportData`, `exportGradesData` e `getConsolidatedExportData` aplicam `limit(20000)` para prevenir exaustão de memória no Node.js.
   - A conversão em CSV é feita no cliente com codificação UTF-8 BOM (`\uFEFF`) para compatibilidade perfeita com o Microsoft Excel.

### 2.2 Lacunas, Inconsistências e Riscos Identificados

| Item | Gravidade | Diagnóstico Técnico | Impacto Funcional |
|---|---|---|---|
| **Inconsistência Estrutural de Rotas Frontend** | **Alta** | No módulo `consolidado`, `/relatorios/consolidado` redireciona para `/relatorios/consolidado/ead` e cada instituição tem sua pasta (`/ead`, `/uni`, etc.). Nos módulos `progresso` e `notas`, o arquivo `page.tsx` na raiz da pasta É a página do EaD! Não existem as subrotas `/relatorios/progresso/ead` nem `/relatorios/notas/ead`. | Se um usuário ou link tentar acessar `/relatorios/progresso/ead` ou `/relatorios/notas/ead`, receberá **404 Not Found**. A taxonomia de URLs é assimétrica. |
| **Sidebar Oculta Links de Progresso e Notas** | **Média** | O componente `SidebarClient.tsx` (linhas 219-257) renderiza apenas os links das instituições para `/relatorios/consolidado/*`. Não há na barra lateral nenhum link para as páginas de progresso ou notas. | Usuários comuns não conseguem acessar as telas dedicadas de Progresso e Notas a partir do menu principal de navegação, a menos que digitem a URL manualmente. |
| **Discrepância de Período e Datas de Fases Acadêmicas** | **Média** | O período padrão do sistema em `app-config.ts` e `academic-config.ts` é `DEFAULT_PERIOD = '2026-2'`. Contudo, as datas de fase em fallback de `getAcademicPhaseDates()` são do primeiro semestre: Fase 1 (13/02 a 29/03), Fase 2 (30/03 a 11/05), Fase 3 (12/05 a 19/06). | No segundo semestre (setembro de 2026), as funções `calculateFaseStatus` e `isBelowExpectedOnPhase` avaliam que a data atual é posterior ao fim da Fase 3, classificando indevidamente fases como expiradas/críticas caso as variáveis de ambiente de fases não estejam preenchidas. |
| **Texto Hardcoded no Dashboard AVA** | **Baixa** | Em `DashboardAva.tsx:211`, o rodapé do card de ações exibe: `Concluído há 10 min` estaticamente codificado no JSX, sem refletir o timestamp real do último processamento. | Informação imprecisa para o operador pedagógico sobre a data real da última sincronização. |
| **Instituição `pos` Não Contemplada no Frontend** | **Baixa** | O backend possui a tarefa `{ name: 'pos', type: 'grades' }` mapeada para sincronização Moodle de pós-graduação, mas o frontend não lista a instituição `pos` no `DashboardAva`, nos menus ou nos filtros. | Impossibilidade de visualização ou controle dos dados acadêmicos de pós-graduação pela interface web. |

---

## 3. Fluxos do Módulo Acadêmico (Lyceum MSSQL ➔ PostgreSQL)

### 3.1 Arquitetura de Sincronização e Cache

O módulo acadêmico é responsável por integrar a base de dados central legado Lyceum (Microsoft SQL Server) com o PostgreSQL local do Nexus Core:

```
[ Lyceum MSSQL ]
├── VW_AVA_TURMA
├── VW_AVA_CURSO
├── VW_AVA_MATRICULA
├── VW_AVA_DISCENTE
├── VW_AVA_DOCENTE
└── VW_AVA_USUARIOS
       │
       ▼ (AcademicSyncService - Diário 03:00 AM ou POST /api/academic/sync)
       │
       ├─► 1. Sincroniza Turmas dos períodos ativos ──► [ academic_turma ] (Upsert)
       │
       ├─► 2. Trunca e insere Matrículas ─────────────► [ academic_matricula ] (Atomic tx.delete)
       │
       └─► 3. Sincroniza Discentes e Docentes ────────► [ academic_discente ] & [ academic_docente ] (Upsert)
```

1. **Ciclo de Inicialização do Conector**:
   - `AcademicService.onModuleInit()`: conecta ao SQL Server via pool de conexões com `trustServerCertificate: true`.
   - Suporta linked server via prefixo configurável `LYCEUM_DB_PREFIX`.
   - Inspeciona dinamicamente metadados de colunas das views `VW_AVA_*` para tolerar variações de schema no Lyceum.
   - Executa auto-seeding garantindo que o módulo `academic` esteja registrado em `system_module` e concedido ao grupo `Super Admin`.

2. **Rotina de Sincronização (`AcademicSyncService.syncActivePeriods`)**:
   - Executada automaticamente todos os dias às 03:00 AM (`@Cron('0 3 * * *')`) ou via fila BullMQ (`academic-sync`).
   - Consulta `getLyceumActivePeriods()` com fallback seguro para não realizar dump do histórico inteiro da universidade.
   - Sanitização de parâmetros: os IDs dos discentes e docentes recebem limpeza via regex `id.replace(/[^a-zA-Z0-9_-]/g, '')` antes da concatenação na query `IN (...)`, eliminando vetores de SQL Injection contra o SQL Server.

3. **Consultas no Frontend (`AcademicDashboard.tsx`)**:
   - Abas com paginação dinâmica: **Discentes**, **Docentes**, **Turmas** e **Matrículas**.
   - Abertura de Drawer lateral para inspeção de disciplinas vinculadas (`getStudentDisciplines` / `getTeacherDisciplines`).
   - Tratamento case-insensitive e polimórfico de colunas nas linhas da tabela para compatibilidade tanto com o cache Postgres quanto com dados legados.

### 3.2 Lacunas, Inconsistências e Riscos Identificados

| Item | Gravidade | Diagnóstico Técnico | Impacto Funcional |
|---|---|---|---|
| **Truncamento Global de Matrículas no Sync** | **Alta** | Em `academic-sync.service.ts:135`, a rotina executa `await tx.delete(academicMatricula)` antes de inserir as novas matrículas. Embora ocorra dentro de transação, ela apaga **todas** as matrículas de todos os períodos do banco, reescrevendo apenas o período ativo. | Se o Lyceum possuir históricos de períodos anteriores armazenados localmente, eles são irremediavelmente perdidos a cada sync. O correto seria deletar apenas onde `turmaId IN (...)` ou filtrar pelo período ativo. |
| **Ausência de Foreign Keys nas Matrículas** | **Média** | A tabela `academic_matricula` referencia `usuarioId` e `turmaId` como strings sem constraints de chave estrangeira (`references()`). | Decisão arquitetural consciente para não quebrar a sincronização quando houver discentes pendentes no Lyceum, porém permite registros órfãos no PostgreSQL caso turmas sejam deletadas. |
| **UX Inicial de Busca Vazia no Dashboard** | **Baixa** | Em `AcademicDashboard.tsx:91-98`, o `useEffect` só dispara busca se `hasSearched === true`. Ao entrar na tela, `hasSearched` é false e a tela exibe a mensagem: *"Nenhum registro encontrado no Lyceum. Ajuste a busca acima"*. | Confusão para o usuário que acessa a página pela primeira vez e acredita que a base está vazia ou que houve erro de sistema, sem ver nenhuma listagem inicial. |

---

## 4. Fluxos de Agendamentos e Gestão de Usuários / Grupos

### 4.1 Gestão Administrativa de Usuários e Grupos

1. **Centralização e RBAC**:
   - `UsersController` e `GroupsController` são restritos integralmente por `@RequireAdmin()`.
   - Atribuição de permissões funciona em dois níveis:
     - **Direta**: tabela `users_system_access`.
     - **Herança de Grupo**: tabela `group_system_access` via associação em `user_groups`.

2. **Invalidação de Cache de Autorização**:
   - Ao alterar usuário ou grupo, os métodos `updateUser`, `deleteUser`, `updateGroup`, `deleteGroup` executam limpeza imediata:
     - Redis: `cacheService.del('rbac:user:${userId}:modules')` e `delByPattern('rbac:user:*')`.
     - Memória local: `RbacGuard.clearCache(userId)` ou `RbacGuard.clearCache()`.

### 4.2 Backoffice de Agendamentos de Provas (`scheduling`)

1. **Gestão de Polos e Opções de Horários**:
   - Polos (`locals`): CRUD completo com nome, endereço, telefone, link de mapa e status ativo/inativo.
   - Opções de Horário (`opcaos`): criação em lote com validação rigorosa de formato `HH:MM`, passo de 30 minutos e laço finito limitado a no máximo 48 slots por dia para prevenir travamento de thread.

2. **Reserva Concorrente e Transacional com Pessimistic Locking**:
   - `SchedulingService.createBooking`:
     ```ts
     // 1. Busca perfil do aluno e calcula quantidade de disciplinas
     const profile = await this.getStudentProfile(matricula, periodo);
     const totalDisciplines = profile.totalDisciplinas;
     
     // 2. Transação com lock pessimista
     return this.db.transaction(async (tx) => {
       const [opcao] = await tx.select().from(opcaos).where(...).for('update');
       
       // 3. Calcula horários consecutivos necessários (30 min por disciplina)
       const requiredTimes = Array.from({ length: totalDisciplines }, (_, i) => getNextTimeStr(timeStr, i));
       
       // 4. Bloqueia todos os slots consecutivos
       const slots = await tx.select().from(opcaos).where(...).for('update');
       
       // 5. Valida se todos possuem vagas > 0 e decrementa atomicamente
       for (const slot of slots) {
         await tx.update(opcaos).set({ vagas: slot.vagas - 1 }).where(...);
       }
     });
     ```
   - O cancelamento (`cancelBooking`) reverte o processo, recalculando a grade de horários ocupados e devolvendo as vagas aos slots de forma atômica (`vagas: slot.vagas + 1`).

### 4.3 Lacunas, Inconsistências e Riscos Identificados

| Item | Gravidade | Diagnóstico Técnico | Impacto Funcional |
|---|---|---|---|
| **Porta e Host Incorretos no Route Handler de Export** | **Alta** | Em `apps/frontend/src/app/api/scheduling/export/route.ts:12`, a URL base de fallback está codificada como: `process.env.NEXT_API_URL \|\| ... \|\| "http://backend:3001"`. Idem no arquivo `bookings/route.ts:12`. O backend roda na porta **3004** (ou `localhost:3004`). | Em ambiente local ou dev sem a env `NEXT_API_URL` explícita, o botão **Exportar** do Painel de Agendamentos falha com `500 ECONNREFUSED` ao tentar se conectar na porta 3001. |
| **Rota de Exportação com Prefixo Hardcoded** | **Média** | Em `SchedulingDashboard.tsx:337`, o download dispara: `window.open('/nexus/api/scheduling/export?${params.toString()}')`. O prefixo `/nexus` está hardcoded na string em vez de utilizar o helper de basePath ou variável. | Se o basePath for alterado ou desabilitado, o link de export quebra. |
| **Período Default Dessincronizado na Tela de Agendamentos** | **Média** | Em `SchedulingDashboard.tsx:67` e `88`, o estado inicial do filtro de período é `"2026-1"` (`useState(searchParams.get("periodo") \|\| "2026-1")`), enquanto todo o resto do sistema adota `"2026-2"`. | Ao abrir o painel de agendamentos, os usuários visualizam por padrão agendamentos do semestre passado, precisando alterar manualmente o filtro para 2026-2. |
| **Vínculo Exclusivo de Agendamentos com `avaProgressReport`** | **Média** | Em `SchedulingService.getStudentProfile`, a validação do estudante consulta exclusivamente a tabela `ava_progress_report`. | Alunos que ainda não foram sincronizados do Moodle, ou discentes cadastrados apenas no módulo Acadêmico (Lyceum), não conseguem realizar agendamento de prova. |

---

## 5. Matriz Comparativa de Conformidade dos Fluxos

| Domínio Funcional | Status do Fluxo | Pontos Fortes | Gaps / Riscos Críticos |
|---|---|---|---|
| **1. Autenticação & Sessão** | **Parcialmente Completo** | Centralização em RBAC Guards; validação em banco com cache TTL 30s; senhas em bcrypt; sessões curtas com idle timeout. | Ausência de refresh token backend (expira em 2h); `isDisabled` não propagado no JWT NextAuth; secret hardcoded como fallback; falta de `@CurrentUser()`. |
| **2. Relatórios AVA** | **Funcional & Otimizado** | Snapshot materializado ultrarrápido (~14ms); busca trigram GIN; exportações com teto de 20k; filas BullMQ com progresso 0-100%. | Assimetria de URLs (`/progresso/ead` e `/notas/ead` são 404); sidebar não lista progresso e notas; período 2026-2 vs datas de fase de 2026-1. |
| **3. Módulo Acadêmico** | **Funcional** | Pool MSSQL resiliente; linked server tolerante; auto-seeding de módulos; sanitização de IDs contra injeção SQL; views dinâmicas. | `tx.delete(academicMatricula)` apaga todas as matrículas no sync diário; ausência de foreign keys; tela inicial vazia até busca explícita. |
| **4. Agendamentos & Acessos** | **Funcional com Bugs de Rota** | Locks pessimistas transacionais (`FOR UPDATE`); reserva atômica de slots consecutivos; devolução de vagas; CRUD de usuários/grupos completo. | Route handler de export aponta para porta incorreta 3001; URL com `/nexus` hardcoded; default do dashboard em 2026-1 em vez de 2026-2. |

---

## 6. Plano de Ação Recomendado

### 6.1 Correções Imediatas (P0 — Quick Wins de Alto Impacto)
1. **Corrigir Fallback de URL na Rota de Exportação de Agendamentos**:
   - Ajustar `apps/frontend/src/app/api/scheduling/export/route.ts:12` e `bookings/route.ts:12` de `"http://backend:3001"` para `"http://localhost:3004"` ou utilizar a mesma resolução centralizada de `apps/frontend/src/app/actions/api.ts`.
2. **Sincronizar Período Default no Agendamento**:
   - Em `SchedulingDashboard.tsx`, substituir o fallback hardcoded `"2026-1"` por `DEFAULT_PERIOD` importado de `@/lib/academic-config`.
3. **Propagar `isDisabled` no Token e Sessão NextAuth**:
   - Em `apps/frontend/src/auth.ts`, popular `token.isDisabled = user.isDisabled` e `session.user.isDisabled = token.isDisabled`, ativando a proteção em `middleware.ts`.

### 6.2 Melhorias de Roteamento e UX (P1 — Médio Prazo)
1. **Padronização das Rotas de Relatórios**:
   - Criar redirecionamentos ou rotas dedicadas em `/relatorios/progresso/ead` e `/relatorios/notas/ead` para manter paridade absoluta com `/relatorios/consolidado/ead`.
   - Adicionar atalhos explícitos para visualização de Progresso e Notas na barra lateral (`SidebarClient.tsx`) ou no cabeçalho do módulo AVA.
2. **Refatoração da Deleção no Sync Acadêmico**:
   - Em `AcademicSyncService.ts`, alterar a deleção em `academicMatricula` para excluir apenas as matrículas das turmas dos períodos ativos que estão sendo processados (`where inArray(...)`), preservando o histórico de períodos passados.
3. **Parametrização das Datas de Fases Acadêmicas**:
   - Atualizar os fallbacks de `getAcademicPhaseDates()` em frontend e backend para corresponderem às janelas do segundo semestre (`2026-2`) ou carregar dinamicamente do banco de dados/Lyceum.

### 6.3 Modernização e Segurança Avançada (P2 — Longo Prazo)
1. **Mecanismo de Refresh Token**:
   - Implementar rota de refresh no NestJS e rotação automática no callback `jwt({ token })` do NextAuth, garantindo que usuários logados não sofram expiração silenciosa após 2 horas.
2. **Custom Decorator `@CurrentUser()`**:
   - Criar decorator NestJS tipado `export const CurrentUser = createParamDecorator(...)` eliminando a dependência de `(@Req() req: any)` e `req.user`.
3. **Remoção de Secrets Hardcoded**:
   - Forçar falha no bootstrap da aplicação (`process.exit(1)`) caso a variável `JWT_SECRET` não esteja definida em ambiente de produção.
