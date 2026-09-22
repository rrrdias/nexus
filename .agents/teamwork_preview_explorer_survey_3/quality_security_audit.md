# Nexus Core: Relatório de Auditoria de Qualidade, Segurança e Infraestrutura CI/CD

**Data da Auditoria:** 18 de Setembro de 2026  
**Auditor:** Teamwork Explorer Survey Agent 3 (`teamwork_preview_explorer_survey_3`)  
**Repositório:** `nexus-core` (Monorepo Turborepo: Backend NestJS 11 + Frontend Next.js 16.2.6)  
**Status Global:** APROVADO COM RESSALVAS CRÍTICAS (1 falha de segurança de alta severidade identificada)

---

## 1. Sumário Executivo

A auditoria cobriu integralmente as 6 dimensões de qualidade, segurança e infraestrutura do ecossistema Nexus Core. O projeto exibe uma base arquitetural sólida nas 6 etapas de modernização recém-implementadas (CORS/Helmet, RBAC centralizado, filas BullMQ, observabilidade com Request ID, Drizzle ORM com índices e suíte de testes unitários/E2E com 100% de aprovação).

Contudo, a investigação revelou **vulnerabilidades de segurança críticas**, **gaps significativos de cobertura de código** (especialmente no frontend) e **débitos de higiene de workspace** que exigem intervenção imediata antes de qualquer promoção para ambiente produtivo.

### Placar de Conformidade por Dimensão

| Dimensão Auditada | Status | Principais Destaques |
|---|:---:|---|
| **1. Build & Workspaces** | ⚠️ Regular | Turborepo compila backend e frontend com sucesso (`2/2 tasks green`), mas há lockfiles duplicados, arquivo espúrio `=` na raiz e TypeScript não-estrito no backend. |
| **2. Suíte de Testes** | ⚠️ Regular | 100% de sucesso nos testes executados (23 unitários, 4 E2E). Cobertura global de linhas no backend é de **34,73%**. **Frontend possui 0 testes**. |
| **3. Auditoria de Segurança** | 🚨 Crítico | **Credenciais reais do Lyceum MSSQL em texto plano** em `inspect_mat.js`. Chaves secretas JWT hardcoded como fallback padrão no backend. |
| **4. Autorização de Rotas & RBAC** | ✅ Bom | 100% dos controllers NestJS protegidos por default (`JwtAuthGuard` + `RbacGuard` globais). Middleware frontend redireciona não-autenticados, mas há falta de guards de módulo em páginas do Next.js. |
| **5. Ciclo de Vida do Cache** | ⚠️ Regular | `CacheModule` com Redis e fallback em memória Map resiliente. Invalidação automática ativa em usuários e grupos, mas `AcademicService` usa cache estático desacoplado e estatísticas pesadas do AVA não são cacheadas. |
| **6. Pipeline CI/CD** | ⚠️ Regular | GitHub Actions executa matriz Node 20/22, testes unitários, E2E e build, porém ignora erros de lint (`continue-on-error: true`), não testa o frontend e não possui containers de banco/Redis. |

---

## 2. Dimensão 1: Build & Configuração de Workspaces

### 2.1 Estrutura do Monorepo
- **Gerenciador:** Turborepo `v2.9.14` com `packageManager: npm@10.5.0`.
- **Workspaces definidos:** `apps/*` mapeando `@nexus-core/backend` (`apps/backend`) e `@nexus-core/frontend` (`apps/frontend`).
- **Verificação do Build (`npm run build`):**
  - Backend: `nest build` concluído com sucesso gerando bundle em `dist/`.
  - Frontend: `next build` compilado com Turbopack em 8.7s e exportação de 30 páginas estáticas/dinâmicas em 259ms. Tempo total: 29.82s.

### 2.2 Configuração TypeScript (`tsconfig.json`)
- **Frontend (`apps/frontend/tsconfig.json`):**
  - Configuração estrita ativada: `"strict": true`.
  - Resolução moderna: `"moduleResolution": "bundler"`, `"target": "ES2017"`.
- **Backend (`apps/backend/tsconfig.json`):**
  - **Inconsistência identificada:** Não utiliza `"strict": true`.
  - Configurações permissivas explícitas:
    - `"noImplicitAny": false` (permite inferência de `any` em variáveis não tipadas).
    - `"strictBindCallApply": false`.
    - `"noFallthroughCasesInSwitch": false`.
    - Apenas `"strictNullChecks": true` e `"forceConsistentCasingInFileNames": true` estão ativados.
  - **Impacto:** Permite que débitos de tipagem e valores potencialmente indefinidos passem silenciosamente pela compilação.

### 2.3 Anomalias e Débitos de Higiene
1. **Arquivo espúrio na raiz do repositório:** Existe um arquivo chamado `=` com 0 bytes na raiz `c:\Users\ricardo.dias\develop\projetos\nexus-core\=`. Deve ser removido.
2. **Lockfiles duplicados:**
   - Detectado `apps/frontend/package-lock.json` em concorrência com o `package-lock.json` da raiz do monorepo.
   - O Next.js emite o alerta durante o build: `⚠ Warning: Next.js inferred your workspace root... Detected additional lockfiles: apps/frontend/package-lock.json`. O lockfile interno do frontend deve ser deletado para evitar conflito de resolução do npm.
3. **Depreciação de Middleware no Next.js 16:**
   - Next.js 16 emite: `⚠ The "middleware" file convention is deprecated. Please use "proxy" instead`. Recomenda-se planejar a migração futura conforme documentação oficial.

---

## 3. Dimensão 2: Auditoria das Suítes de Teste

### 3.1 Inventário de Testes Unitários (`npm run test`)
- **Execução:** 23 test suites, 65 testes executados, 100% de aprovação (tempo de execução: 14.18s).
- **Setup do Runner:** Jest v30 com `ts-jest` e isolamento via `node` environment. Módulos ESM ignorados com regex seletivo (`@nestjs/bullmq`, `bullmq`, `msgpackr`).

### 3.2 Inventário de Testes E2E (`npm run test:e2e`)
- **Execução:** 4 test suites, 12 testes executados, 100% de aprovação (tempo de execução: 8.94s).
- **Suítes E2E:**
  1. `apps/backend/test/app.e2e-spec.ts`: Teste básico de inicialização do app.
  2. `apps/backend/test/auth-and-rbac.e2e-spec.ts`: Valida rejeição 401 sem token, 403 para usuário sem módulo e 200 para Super Admin.
  3. `apps/backend/test/jobs-and-sync.e2e-spec.ts`: Valida enfileiramento BullMQ, endpoints assíncronos e consulta de status de jobs.
  4. `apps/backend/test/observability.e2e-spec.ts`: Valida propagação de headers `X-Request-Id`, formato padronizado de erro do `GlobalExceptionFilter` e rota `/health`.
- **Estratégia de Mocks no E2E:**
  - O E2E utiliza `Test.createTestingModule().overrideProvider(...)` sobrepondo:
    - `DB_CONNECTION`: Mock fluente simulando as queries do Drizzle ORM (`select`, `insert`, `update`, `delete`, `execute`).
    - `CacheService`: Mock simulando operações em memória sem depender de instância do Redis.
    - `JobsService`: Mock simulando filas e retorno de jobs.
  - **Avaliação da Estratégia:** Excelente para isolamento e velocidade no CI sem dependência de serviços externos, mas não substitui testes de integração com instâncias reais de banco.

### 3.3 Métricas Oficiais de Cobertura de Código (Backend)
Extraído via `npm run test:cov` e relatório `lcov`:

| Métrica | Cobertura Obtida | Itens Cobertos / Total |
|---|:---:|:---:|
| **Statements** | **33.82%** | 891 / 2634 |
| **Branches** | **30.38%** | 508 / 1672 |
| **Functions** | **23.54%** | 93 / 395 |
| **Lines** | **34.73%** | 816 / 2349 |

#### Módulos com 0% de Cobertura (Lacunas Críticas):
- `src/scheduling/scheduling.controller.ts`: **0%**
- `src/scheduling/dto/*`: **0%**
- `src/system/system.controller.ts`: **0%**
- `src/system/system.service.ts`: **0%**
- `src/jobs/processors/academic-sync.processor.ts`: **0%**
- `src/jobs/processors/ava-sync.processor.ts`: **0%**

#### Módulos com Baixa Cobertura:
- `src/users/users.service.ts`: **14.10%** de linhas.
- `src/groups/groups.service.ts`: **17.54%** de linhas.
- `src/scheduling/scheduling.service.ts`: **20.17%** de linhas.

### 3.4 Situação do Frontend (`apps/frontend`)
- **Status:** **0% de cobertura / Ausência total de testes**.
- Não há configuração de Jest, Vitest, Cypress, Playwright ou React Testing Library no `package.json` do frontend.
- Não existem arquivos `.spec.ts(x)` ou `.test.ts(x)` no workspace do frontend.
- **Risco:** Qualquer quebra de interface, lógica de componentes ou manipulação de estado do cliente não é capturada automaticamente.

---

## 4. Dimensão 3: Auditoria de Segurança & Secrets

### 4.1 Vulnerabilidades Identificadas

```
[VULNERABILIDADE 1] ALTA SEVERIDADE - VAZAMENTO DE CREDENCIAIS DE BANCO DE PRODUÇÃO
Arquivo: apps/backend/inspect_mat.js (Linhas 7-11)
Código Observado:
  const config = {
    user: process.env.LYCEUM_DB_USERNAME || 'PortAeeConsult',
    password: process.env.LYCEUM_DB_PASSWORD || 'Port4eeC0nsult@Tudo.',
    server: process.env.LYCEUM_DB_HOST || '172.29.44.90',
    port: parseInt(process.env.LYCEUM_DB_PORT || '1433'),
    database: process.env.LYCEUM_DB_DATABASE || 'Lyceum',
    ...
  };
Diagnóstico: Script de inspeção contém credenciais SQL Server reais do Lyceum hardcoded como fallback. 
Risco: Comprometimento direto da base de dados acadêmica institucional caso o código seja exposto.
Ação Imediata: Remover o arquivo inspect_mat.js do repositório, invalidar/trocar a senha 'Port4eeC0nsult@Tudo.' no banco Lyceum imediatamente e garantir que o IP 172.29.44.90 esteja inacessível externamente.
```

```
[VULNERABILIDADE 2] MÉDIA SEVERIDADE - SEGREDO JWT ESTÁTICO DE FALLBACK
Arquivos: 
  - apps/backend/src/auth/auth.module.ts (Linha 10)
  - apps/backend/src/auth/jwt-auth.guard.ts (Linha 44)
Código Observado:
  secret: process.env.JWT_SECRET || 'nexus-secret-key-2026'
Diagnóstico: Se a variável JWT_SECRET não estiver definida em ambiente produtivo, o sistema inicializa silenciosamente usando a chave pública 'nexus-secret-key-2026'.
Risco: Qualquer agente malicioso pode assinar seus próprios JWTs com payload isSuperAdmin: true e obter controle total do backend.
Ação Imediata: Lançar erro fatal durante a inicialização (Fail-Fast) se process.env.JWT_SECRET estiver ausente ou tiver menos de 32 caracteres.
```

```
[VULNERABILIDADE 3] MÉDIA SEVERIDADE - CONNECTION STRING DE BANCO POSTGRES COMO FALLBACK
Arquivo: apps/backend/migrate.js (Linha 7)
Código Observado:
  const connectionString = process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/nexus_core";
Diagnóstico: Fallback hardcoded para URL de banco de dados em script de migração.
```

### 4.2 Práticas de Segurança Positivas Verificadas
- **Prevenção de Timing Attacks:** O controller `AvaSyncController` utiliza `crypto.timingSafeEqual` para validar o token Bearer `CRON_SECRET`, impedindo exploração por medição de tempo de resposta.
- **Hashing de Senhas:** Implementado com `bcryptjs` com custo de 10 salt rounds (`password.util.ts`).
- **Headers de Segurança HTTP:**
  - Backend: `helmet()` configurado no bootstrap do NestJS.
  - Frontend: `next.config.ts` injeta `Content-Security-Policy`, `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` e `Strict-Transport-Security` em produção.
- **Proteção CORS Segura:** Validada função `isOriginAllowed` em `apps/backend/src/config/app-config.ts` que checa lista restrita de origens configuradas via env, permitindo requisições sem origin apenas para server-to-server.

---

## 5. Dimensão 4: Auditoria de Autorização de Rotas & RBAC

### 5.1 Arquitetura de Proteção do Backend NestJS
O backend adota o princípio de **Closed by Default (Segurança por Padrão)**:
- Em `app.module.ts`, tanto `JwtAuthGuard` quanto `RbacGuard` estão registrados como provedores globais `APP_GUARD`.
- Qualquer nova rota criada é **automaticamente privada e sujeita ao RBAC**, a menos que explicitamente anotada com `@Public()`.
- O `JwtAuthGuard` consulta o banco para garantir que o usuário não foi desativado (`isActive: true`), utilizando um cache LRU em memória de 30 segundos (`CACHE_TTL_MS = 30_000`) para poupar requisições ao banco.

### 5.2 Matriz Completa de Controllers e Rotas Auditadas

| Controller | Prefixo de Rota | Decorators de Classe | Rotas / Métodos | Nível de Proteção / Módulo Exigido | Avaliação |
|---|---|---|---|---|:---:|
| **AppController** | `/` | - | `GET /` | `@Public()` | ✅ Seguro (Boas-vindas) |
| **AuthController** | `/api/auth` | - | `POST /login` | `@Public()` (DTO validado) | ✅ Seguro (Endpoint de Login) |
| **HealthController** | `/health` | - | `GET /` | `@Public()` | ✅ Seguro (Health Check monitorado) |
| **AvaSyncController** | `/api/ava-sync` | `@Public()` | `GET /` | Token `CRON_SECRET` via `timingSafeEqual` | ✅ Seguro (Job externo com segredo) |
| **AcademicController** | `/api/academic` | `@RequireModule('academic')` | `POST /sync` | `@RequireAdmin()` | ✅ Seguro |
| | | | `GET /discentes` | Requer módulo `academic` | ✅ Seguro |
| | | | `GET /discentes/:matricula/disciplinas` | Requer módulo `academic` | ✅ Seguro |
| | | | `GET /docentes` | Requer módulo `academic` | ✅ Seguro |
| | | | `GET /docentes/:docenteId/disciplinas` | Requer módulo `academic` | ✅ Seguro |
| | | | `GET /turmas` | Requer módulo `academic` | ✅ Seguro |
| | | | `GET /matriculas` | Requer módulo `academic` | ✅ Seguro |
| **AvaReportsController** | `/api/ava-reports` | `@RequireModule('ava')` | `POST /sync` | `@RequireAdmin()` | ✅ Seguro |
| | | | `POST /progress` | Requer módulo `ava` | ✅ Seguro |
| | | | `POST /progress/export` | Requer módulo `ava` | ✅ Seguro |
| | | | `POST /grades` | Requer módulo `ava` | ✅ Seguro |
| | | | `POST /grades/export` | Requer módulo `ava` | ✅ Seguro |
| | | | `POST /consolidated` | Requer módulo `ava` | ✅ Seguro |
| | | | `POST /consolidated/export` | Requer módulo `ava` | ✅ Seguro |
| | | | `GET /dashboard-stats` | Requer módulo `ava` | ✅ Seguro |
| **JobsController** | `/api/jobs` | `@RequireModule('academic', 'ava')` | `GET /:queue/:id/status` | Requer módulo `academic` OU `ava` | ✅ Seguro |
| **SchedulingController** | `/api/scheduling` | `@RequireModule('scheduling', 'backoffice')` | `GET /locals`, `GET /options`, `GET /profile/:m/:p`, `GET /bookings`, `POST /bookings`, `GET /export` | Requer módulo `scheduling` OU `backoffice` | ✅ Seguro |
| | | | `POST /locals`, `PUT /locals/:id`, `POST /options`, `PUT /options/:id`, `POST /bookings/:id/conclude`, `POST /bookings/:id/absent`, `DELETE /bookings/:id`, `POST /import` | `@RequireAdmin()` (Apenas Super Admin) | ✅ Seguro |
| **UsersController** | `/api/users` | `@RequireAdmin()` | `GET /`, `GET /:id`, `POST /`, `PUT /:id`, `PUT /:id/active`, `DELETE /:id` | Todos requerem Super Admin | ✅ Seguro |
| **GroupsController** | `/api/groups` | `@RequireAdmin()` | `GET /`, `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id` | Todos requerem Super Admin | ✅ Seguro |
| **SystemController** | `/api/system` | - | `GET /modules` | Usuário logado e ativo | ✅ Seguro |
| | | | `GET /sidebar-modules` | Usuário logado (filtra seus módulos) | ✅ Seguro |
| | | | `GET /admin-dashboard` | `@RequireAdmin()` (Apenas Super Admin) | ✅ Seguro |

**Conclusão da auditoria de controllers:** Não há nenhuma rota privada exposta sem guard de autenticação ou RBAC. A cobertura backend de autorização é de **100%**.

### 5.3 Auditoria de Autorização no Frontend (Next.js)
1. **Middleware Global (`apps/frontend/src/middleware.ts`):**
   - Intercepta todas as rotas da aplicação (exceto assets estáticos e `api/auth`).
   - Redireciona usuários não autenticados para `/nexus/login`.
   - Redireciona usuários autenticados que visitam a tela de login para `/nexus`.
   - Força logout se o usuário estiver desativado (`req.auth?.user?.isDisabled`).
2. **Lacunas Identificadas no Frontend:**
   - O `middleware.ts` não possui checagem de RBAC nem de roles por rota.
   - Algumas páginas do Next.js implementam checagem de permissão:
     - `/admin/users` e `/admin/groups`: Validam `if (!session?.user?.isSuperAdmin) redirect("/")`.
   - **Gaps identificados:**
     - `/admin/scheduling`: Checa apenas se o usuário está logado (`if (!session?.user) redirect("/login")`). Usuários comuns conseguem carregar a casca da página de agendamento, embora as chamadas de API subsequentes falhem com 403.
     - `/academic`: Checa apenas se o usuário está logado. Usuários sem o módulo `academic` visualizam a página com erros de carregamento de dados.
     - `/relatorios/*`: Não checa módulo na rota da página; erros de permissão da API são capturados com `catch` e uma tela com contadores zerados é exibida.
   - **Recomendação:** Centralizar o guard de rotas no Next.js (seja via layout compartilhado ou validação prévia na sessão) para bloquear o acesso antes de renderizar a página.

---

## 6. Dimensão 5: Auditoria do Ciclo de Vida do Cache

### 6.1 Arquitetura da Camada `CacheModule`
- Implementado em `apps/backend/src/cache/cache.service.ts` como módulo global.
- Suporta Redis distribuído via `ioredis` e **fallback automático em memória** (`Map<string, MemoryCacheEntry>`) com verificação de TTL e limpeza periódica caso o mapa exceda 2000 entradas.
- O fallback em memória garante que indisponibilidades no Redis não derrubem o backend, operando em degradação graciosa.

### 6.2 Inventário de Chaves, TTLs e Invalidação Automática

| Entidade / Recurso | Padrão da Chave | TTL | Mecanismo de Invalidação em Mutações | Avaliação |
|---|---|:---:|---|:---:|
| **Permissões RBAC do Usuário** | `rbac:user:${userId}:modules` | 300s (5 min) | Invalidação imediata via `cacheService.del()` e `RbacGuard.clearCache(userId)` ao alterar módulos, status ou excluir o usuário em `UsersService`. | ✅ Excelente |
| **Permissões RBAC em Grupo** | `rbac:user:*` (Padrão) | 300s (5 min) | Invalidação imediata via `cacheService.delByPattern('rbac:user:*')` e `RbacGuard.clearCache()` ao criar, editar ou excluir grupos em `GroupsService`. | ✅ Excelente |
| **Dropdowns de Filtro do AVA** | `ava:dropdowns:${institution}` | 600s (10 min) | Invalidação automática via `cacheService.delByPattern('ava:dropdowns:*')` disparada ao término da sincronização do Moodle em `AvaSyncService`. | ✅ Excelente |
| **Sessão Ativa do Usuário** | `JwtAuthGuard.userActiveCache` | 30s | Cache local estático no Guard; expira por tempo ou é limpo quando usuário é marcado como inativo. | ✅ Bom |

### 6.3 Gaps de Cache e Gargalos Potenciais
1. **Cache Estático Isolado no `AcademicService`:**
   - Em `apps/backend/src/academic/academic.service.ts` (linhas 19-20), existe um `private static academicAccessCache = new Map<string, { hasAccess: boolean; timestamp: number }>()` com TTL de 60s.
   - Esse cache não utiliza o `CacheService` compartilhado e **não é invalidado** quando um administrador revoga o acesso do usuário no `UsersService`. O usuário mantém acesso residual de até 60 segundos.
2. **Dashboard AVA sem Cache (`getAvaDashboardStats`):**
   - O endpoint `GET /api/ava-reports/dashboard-stats` executa agregações complexas com `count`, `avg`, `regexp_replace` e `groupBy` varrendo milhares de registros nas tabelas `ava_progress_report` e `ava_grades_report` a cada carregamento de página.
   - Não utiliza `cacheService.wrap()`. Sob múltiplos acessos simultâneos, causa pico desnecessário de CPU no PostgreSQL.
3. **Módulo de Agendamentos (`SchedulingService`):**
   - Não possui cache para a listagem de locais (`listLocals`) nem para horários disponíveis (`listOptions`), gerando queries repetidas ao banco para dados que raramente mudam.

---

## 7. Dimensão 6: Auditoria da Pipeline CI/CD (.github/workflows)

### 7.1 Pipeline Atual (`.github/workflows/ci.yml`)
- **Gatilhos:** `push` e `pull_request` nas branches `main` e `develop`.
- **Controle de Concorrência:** `cancel-in-progress: true` configurado adequadamente para cancelar builds obsoletos.
- **Matriz de Execução:** Node.js 20.x e 22.x sobre `ubuntu-latest`.
- **Passos Executados:**
  1. Checkout do repositório (`actions/checkout@v4`).
  2. Setup do Node com cache de dependências npm (`actions/setup-node@v4`).
  3. Instalação com `npm ci`.
  4. Lint geral do monorepo (`npm run lint`).
  5. Testes unitários do backend (`npm run test --workspace=@nexus-core/backend`).
  6. Testes E2E do backend (`npm run test:e2e --workspace=@nexus-core/backend`).
  7. Build do monorepo (`npm run build`).

### 7.2 Fragilidades Identificadas no CI/CD
1. **Supressão de Erros de Lint (`continue-on-error: true`):**
   - Na linha 49 do workflow, o passo `Lint Monorepo` possui `continue-on-error: true`.
   - **Impacto:** Violações de tipagem, regras de ESLint e erros de formatação não barram o merge de PRs nem a integração na branch `main`.
2. **Ausência de Serviços para Testes de Integração:**
   - O workflow não declara container de serviços (`services: postgres`, `services: redis`).
   - Os testes só passam no CI porque todos os acessos a banco e Redis são atualmente mockados no Jest. Se algum teste de integração real for adicionado, a esteira falhará.
3. **Ausência de Testes do Frontend:**
   - Não há nenhum passo testando o workspace `@nexus-core/frontend`.
4. **Ausência de Pipeline de Entrega Contínua (CD):**
   - O repositório possui arquivos de deploy (`docker-compose.yml`, `docker-compose.prod.yml`, `nginx/Dockerfile`), mas o workflow do GitHub Actions não realiza build de imagens Docker, publicação em registry nem disparo de deploy para homologação/produção.
5. **Falta de Scanning de Segurança Automatizado:**
   - Ausência de steps de verificação de vulnerabilidades de dependências (`npm audit`) e detecção de secrets (ex: TruffleHog ou GitGuardian).

---

## 8. Plano de Ação e Recomendações Priorizadas

| Prioridade | Ação Recomendada | Arquivos Impactados | Complexidade | Impacto |
|:---:|---|---|:---:|:---:|
| **P0 (Imediato)** | Excluir script `inspect_mat.js` contendo credenciais de banco e rotacionar a senha do Lyceum imediatamente. | `apps/backend/inspect_mat.js` | Baixa | Crítico |
| **P0 (Imediato)** | Remover chaves JWT secret de fallback padrão e exigir fail-fast no bootstrap se `JWT_SECRET` faltar. | `auth.module.ts`, `jwt-auth.guard.ts` | Baixa | Crítico |
| **P1 (Alta)** | Remover lockfile redundante `apps/frontend/package-lock.json` e arquivo espúrio `=`. | `apps/frontend/package-lock.json`, `=` | Mínima | Alto |
| **P1 (Alta)** | Remover `continue-on-error: true` do lint no CI para garantir qualidade de código antes do merge. | `.github/workflows/ci.yml` | Mínima | Alto |
| **P1 (Alta)** | Cachear agregação do dashboard AVA (`getAvaDashboardStats`) com TTL de 5 min via `CacheService`. | `ava-reports.service.ts` | Baixa | Alto |
| **P2 (Média)** | Migrar o cache em memória isolado do `AcademicService` para o `CacheService` global. | `academic.service.ts`, `users.service.ts` | Baixa | Médio |
| **P2 (Média)** | Ativar `"strict": true` ou corrigir `"noImplicitAny": false` no `tsconfig.json` do backend. | `apps/backend/tsconfig.json` | Média | Médio |
| **P2 (Média)** | Implementar suíte de testes de componentes e páginas no frontend (Vitest / Playwright). | `apps/frontend` | Alta | Alto |
| **P2 (Média)** | Expandir testes unitários do backend para módulos com 0% (`scheduling`, `system`, processors). | `apps/backend/src/...` | Média | Médio |
| **P3 (Baixa)** | Adicionar pipeline de CD com build e publicação de containers Docker no GitHub Actions. | `.github/workflows/cd.yml` | Média | Médio |

---
*Relatório gerado em conformidade com as diretrizes do protocolo de auditoria e Hand-off.*
