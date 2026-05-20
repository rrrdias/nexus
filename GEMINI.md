## Sumário

- [Onboarding — Leia primeiro](#onboarding)
- [Visão Geral do Projeto](#visão-geral-do-projeto)
- [Exploração do Diretório](#exploração-do-diretório)
- [Convenções de Branch](#convenções-de-branch)
- [Padrões de Commit](#padrões-de-commit)
- [Padrões de Código](#padrões-de-código)
- [Fluxo de Trabalho Git](#fluxo-de-trabalho-git)
- [Regras para o Agente](#regras-para-o-agente)
- [Automação e Scripts](#automação-e-scripts)
- [Atualização desta Documentação](#atualização-desta-documentação)

---

## Onboarding

**Ao iniciar qualquer sessão de trabalho, o agente DEVE seguir esta sequência obrigatória:**

1. Leia este arquivo (`GEMINI.md`) do início ao fim.
2. Execute `ls -la` na raiz do repositório e mapeie a estrutura de diretórios.
3. Leia os arquivos abaixo **em ordem**, se existirem:
    - `docs/README.md` — visão geral do projeto e guia de navegação
    - `docs/AGENT_INSTRUCTIONS.md` — instruções operacionais detalhadas
    - `docs/ARCHITECTURE.md` — diagrama e decisões de arquitetura
    - `docs/CONVENTIONS.md` — guias de estilo e convenções
    - `docs/TESTING.md` — guia de testes automatizados
    - `.cursorrules` ou `.github/copilot/instructions.md` — regras complementares
4. Execute `git log --oneline -20` para entender os últimos 20 commits.
5. Execute `git branch -a` para mapear todas as branches ativas.
6. Execute `git status` para entender o estado atual do repositório.
7. **Somente após concluir os passos acima**, inicie a tarefa solicitada.

> **Importante:** Nunca assuma o estado do repositório. Sempre consulte os arquivos e o histórico git antes de agir.

---

## Visão Geral do Projeto

```
# Preencha após a leitura do repositório:
NOME_DO_PROJETO   = Nexus Core
LINGUAGEM_PRIMARIA = TypeScript / React
FRAMEWORK         = Next.js 16.2.6
AMBIENTE_ALVO     = Desenvolvimento / Produção
BRANCH_PRINCIPAL  = master
```

---

## Exploração do Diretório

O agente deve executar os comandos abaixo e catalogar os resultados internamente:

```bash
# Estrutura de alto nível
find . -maxdepth 2 -not -path './.git/*' -not -path './node_modules/*' \
       -not -path './.venv/*' | sort

# Identificar linguagem e framework
cat package.json 2>/dev/null || cat pyproject.toml 2>/dev/null \
    || cat Cargo.toml 2>/dev/null || cat go.mod 2>/dev/null \
    || cat pom.xml 2>/dev/null | head -40

# Identificar arquivos de configuração de qualidade de código
ls -1 .eslintrc* .prettierrc* .flake8 .pylintrc mypy.ini \
       tsconfig.json .editorconfig 2>/dev/null

# Identificar testes
find . -type d -name 'test' -o -name 'tests' -o -name '__tests__' \
       -o -name 'spec' | grep -v node_modules | grep -v .git
```

### Padrões a Identificar e Registrar

Após executar os comandos acima, o agente deve inferir e registrar:

| Aspecto | Como identificar | Onde anotar |
|---|---|---|
| Linguagem | Extensões de arquivo mais comuns | Memória da sessão |
| Framework | Arquivos de config (`package.json`, `pyproject.toml`) | Memória da sessão |
| Estilo de indentação | `.editorconfig`, linters presentes | Memória da sessão |
| Convenção de nomes | Analisar 5+ arquivos existentes | Memória da sessão |
| Padrão de imports | Primeiras linhas dos arquivos principais | Memória da sessão |
| Estrutura de testes | Diretório e nomenclatura dos arquivos de teste | Memória da sessão |

---

## Convenções de Branch

### Modelo de Branching

Este projeto adota o **Git Flow** adaptado. O agente deve respeitar rigorosamente esta hierarquia:

```
main / master          ← produção; nunca commitar diretamente
│
├── develop            ← integração de features; base de PRs
│   │
│   ├── feat/<slug>    ← nova funcionalidade
│   ├── fix/<slug>     ← correção de bug
│   ├── hotfix/<slug>  ← correção urgente (parte de main)
│   ├── refactor/<slug>← refatoração sem mudança de comportamento
│   ├── docs/<slug>    ← apenas documentação
│   ├── chore/<slug>   ← tarefas de manutenção (deps, build, CI)
│   ├── test/<slug>    ← adição ou correção de testes
│   └── release/<ver>  ← preparação de release (ex: release/2.1.0)
```

### Regras de Nomenclatura de Branch

- Usar **kebab-case** exclusivamente: `feat/user-auth-oauth2`
- Slug máximo de **50 caracteres**
- Sem espaços, underscores ou caracteres especiais
- O slug deve descrever **o que a branch resolve**, não quem a criou

### Exemplos Válidos

```bash
feat/add-dark-mode-toggle
fix/login-timeout-error
hotfix/payment-gateway-null-pointer
docs/update-api-endpoints-readme
chore/upgrade-dependencies-april
refactor/extract-auth-service
test/add-unit-tests-user-service
release/1.4.0
```

### Exemplos Inválidos — Nunca Criar

```bash
minha_branch               # underscore e sem prefixo
Feature/LoginPage          # maiúscula e sem slug descritivo
fix_bug_23                 # underscore e referência genérica
joao/trabalho-de-hoje      # nome de pessoa
temp                       # sem contexto
```

### Criação de Branch pelo Agente

Antes de criar uma branch, o agente deve:

1. Confirmar a branch base (`develop` ou `main` para hotfixes)
2. Verificar se já não existe branch similar: `git branch -a | grep <termo>`
3. Usar o prefixo correto baseado no tipo de tarefa
4. Anunciar ao usuário: `"Criando branch feat/nome-da-feature a partir de develop"`

```bash
# Fluxo padrão
git checkout develop
git pull origin develop
git checkout -b feat/<slug>
```

---

## Padrões de Commit

### Especificação Conventional Commits

Este projeto segue o padrão **[Conventional Commits v1.0](https://www.conventionalcommits.org/)**.

**Estrutura obrigatória:**

```
<tipo>(<escopo opcional>): <descrição imperativa em minúsculas>

[corpo opcional — explica O QUÊ e POR QUÊ, não COMO]

[rodapé opcional — BREAKING CHANGE, referências a issues]
```

### Tipos de Commit Permitidos

| Tipo | Quando usar |
|---|---|
| `feat` | Nova funcionalidade visível ao usuário |
| `fix` | Correção de bug |
| `docs` | Apenas documentação |
| `style` | Formatação, ponto-e-vírgula, sem mudança de lógica |
| `refactor` | Refatoração sem nova feature e sem fix de bug |
| `test` | Adição ou correção de testes |
| `chore` | Tarefas de build, dependências, configuração de CI |
| `perf` | Melhoria de performance |
| `ci` | Mudanças em pipelines de CI/CD |
| `revert` | Reversão de commit anterior |
| `build` | Mudanças no sistema de build ou dependências externas |

### Regras da Mensagem de Commit

- A **linha de assunto** deve ter no máximo **72 caracteres**
- Use o **imperativo**: "adiciona", "corrige", "remove" — não "adicionado", "adicionando"
- **Não** termine o assunto com ponto final
- O corpo é **obrigatório** para commits `feat` e `fix` complexos
- Referencie issues no rodapé: `Closes #123`, `Fixes #45`
- Marque breaking changes: `BREAKING CHANGE: descrição do impacto`

### Exemplos de Commits Válidos

```
feat(auth): adiciona login via OAuth2 com Google

Implementa fluxo de autorização OAuth2 para autenticação
com provedores externos. O token é armazenado no Redis
com TTL de 24h para evitar re-autenticação frequente.

Closes #87
```

```
fix(pagamento): corrige erro de arredondamento no cálculo de frete

O valor fracionário era truncado em vez de arredondado,
causando discrepância de R$0,01 em alguns pedidos.

Fixes #102
```

```
chore: atualiza dependências para abril de 2026

- express: 4.18 → 4.19
- jest: 29.5 → 29.7
- typescript: 5.3 → 5.4
```

```
refactor(user-service): extrai lógica de validação para módulo próprio

Sem mudança de comportamento externo. Facilita testes
unitários isolados e reutilização em outros contextos.
```

### Exemplos de Commits Inválidos — Nunca Gerar

```
# Muito vago
fix: bug corrigido
update: mudanças
wip: trabalhando nisso

# Sem tipo
Adiciona tela de login
Correção do erro de autenticação

# Passado ou gerúndio
feat: adicionando nova tela
fix: corrigiu o bug de login

# Escopo incorreto com maiúsculas
feat(Auth): adiciona login
```

### Processo de Geração de Commit pelo Agente

1. Executar `git diff --staged` para entender exatamente o que está staged
2. Executar `git log --oneline -5` para manter consistência com histórico recente
3. Identificar o tipo correto baseado nas mudanças
4. Redigir mensagem seguindo a estrutura obrigatória
5. Apresentar ao usuário para aprovação antes de executar `git commit`
6. Nunca fazer commit sem confirmação explícita do usuário

---

## Padrões de Código

> O agente deve **ler os arquivos reais do repositório** para confirmar e complementar as convenções abaixo. Os padrões aqui são um ponto de partida; o código existente é a fonte de verdade.

### Comandos para Identificar Padrões Reais

```bash
# Ver estilo de indentação e encoding
cat .editorconfig 2>/dev/null

# Ver regras de linting (JavaScript/TypeScript)
cat .eslintrc.json 2>/dev/null || cat .eslintrc.js 2>/dev/null

# Ver formatação (JavaScript/TypeScript)
cat .prettierrc 2>/dev/null

# Ver regras de linting (Python)
cat .flake8 2>/dev/null || cat pyproject.toml 2>/dev/null | grep -A 20 '\[tool.ruff\]'

# Analisar padrões em arquivos existentes
head -50 src/**/*.ts 2>/dev/null | head -100
head -50 src/**/*.py 2>/dev/null | head -100
```

### Convenções Gerais (confirmar contra código existente)

**Nomenclatura:**

```
Arquivos fonte      → kebab-case          (user-service.ts, auth-helper.py)
Classes/Interfaces  → PascalCase          (UserService, IAuthProvider)
Funções/Métodos     → camelCase (JS/TS)   (getUserById, validateToken)
                    → snake_case (Python)  (get_user_by_id, validate_token)
Constantes          → UPPER_SNAKE_CASE    (MAX_RETRY_COUNT, API_BASE_URL)
Variáveis privadas  → prefixo _           (_internalCache, _config)
Enums               → PascalCase          (UserRole, PaymentStatus)
```

**Estrutura de Arquivos:**

```
src/
├── domain/         ← entidades e interfaces de negócio
├── application/    ← casos de uso e serviços
├── infrastructure/ ← implementações externas (DB, API, cache)
├── interfaces/     ← controllers, rotas, adapters
└── shared/         ← utilitários e tipos compartilhados
```

**Regras de Qualidade:**

- Funções com mais de **30 linhas** devem ser avaliadas para extração
- Arquivos com mais de **300 linhas** devem ser avaliados para separação
- Evitar comentários que explicam **o quê** — o código deve ser autoexplicativo
- Comentários devem explicar **por quê** (intenção, contexto, trade-offs)
- Todo código novo deve ter cobertura de testes adequada

---

## Fluxo de Trabalho Git

### Ciclo Completo de uma Feature

```
1. PREPARAR
   git checkout develop && git pull origin develop
   git checkout -b feat/<slug>

2. DESENVOLVER
   → Escrever código
   → Executar testes locais
   → Revisar diff antes de staged

3. STAGED E COMMIT
   git add -p                    ← revisar hunk por hunk
   git commit                    ← mensagem Conventional Commits

4. PUSH E PR
   git push origin feat/<slug>
   → Abrir Pull Request para develop
   → Título do PR = mensagem do commit principal
   → Descrição = O quê, Por quê, Como testar

5. REVISÃO E MERGE
   → Code review aprovado
   → CI/CD verde
   → Squash merge ou merge commit (conforme política do projeto)
   → Branch deletada após merge
```

### Regras de Proteção de Branch

| Branch | Proteção | Quem pode merge |
|---|---|---|
| `main` / `master` | Protegida — nunca commit direto | Só via PR aprovado + CI verde |
| `develop` | Protegida — nunca commit direto | Só via PR aprovado |
| `release/*` | Protegida após criada | Tech lead + aprovação |
| `feat/*`, `fix/*` | Livre para o dono | Dono da branch |

### Política de Rebase vs Merge

- `git rebase` → permitido em branches pessoais antes do PR
- `git merge` → padrão para integração entre branches protegidas
- `git rebase` em branch compartilhada → **proibido** (reescreve histórico público)

### Comandos Úteis para o Agente

```bash
# Ver histórico de uma branch comparada à develop
git log develop..HEAD --oneline

# Ver quais arquivos foram alterados
git diff --name-only develop...HEAD

# Ver estado completo antes de commitar
git status && git diff --staged

# Verificar se PR pode ser criado (sem conflitos)
git fetch origin && git merge-base --is-ancestor origin/develop HEAD
```

---

## Regras para o Agente

### O Agente DEVE

- ✅ Ler arquivos existentes antes de criar ou modificar qualquer coisa
- ✅ Confirmar com o usuário antes de executar `git commit`, `git push`, `git merge`
- ✅ Seguir os padrões de código **do arquivo real**, não de suposições
- ✅ Anunciar qual branch está ativa antes de qualquer operação git
- ✅ Usar `git add -p` para staging granular quando possível
- ✅ Verificar o CI/CD antes de sugerir merge
- ✅ Documentar breaking changes explicitamente
- ✅ Manter o `GEMINI.md` atualizado ao final de cada sessão

### O Agente NUNCA deve

- ❌ Commitar diretamente em `main`, `master` ou `develop`
- ❌ Fazer `git push --force` em branches compartilhadas
- ❌ Criar commits com mensagens vagas ("fix", "update", "wip")
- ❌ Ignorar arquivos de linting e formatação existentes
- ❌ Deletar branches sem confirmar com o usuário
- ❌ Fazer `git rebase` em branches com mais de um colaborador
- ❌ Executar migrações de banco ou deploys sem confirmação explícita
- ❌ Criar arquivos em locais incorretos sem verificar a estrutura de pastas

### Comportamento em Caso de Dúvida

Quando o agente encontrar ambiguidade (convenção não clara, estrutura inconsistente, instrução conflitante), deve:

1. Identificar 2–3 exemplos do padrão no código existente
2. Apresentar ao usuário os padrões encontrados
3. Perguntar qual seguir antes de prosseguir
4. Registrar a decisão na memória da sessão

---

## Automação e Scripts

Se o repositório contém scripts de automação git, o agente deve:

```bash
# Listar scripts disponíveis
ls -1 *.sh *.zsh *.bash scripts/ Makefile 2>/dev/null

# Ler cada script antes de sugerir seu uso
cat auto_commit.zsh 2>/dev/null
cat auto_pr.zsh 2>/dev/null

# Verificar targets de Makefile
make help 2>/dev/null || grep '^[a-zA-Z].*:' Makefile 2>/dev/null | head -20
```

### Integração com Gemini CLI

Quando disponível, o agente pode usar os scripts do repositório para:

- **Commits automatizados:** `auto-commit "contexto adicional"` — gera mensagem Conventional Commit baseada no diff staged
- **PRs automatizados:** `auto-pr "contexto adicional"` — gera título e descrição a partir do histórico de commits
- **Issues:** `auto-issue "descrição em linguagem natural"` — cria ou atualiza issues via linguagem natural

O agente deve **sempre apresentar o conteúdo gerado ao usuário para aprovação** antes de executar qualquer operação.

---

## Atualização desta Documentação

### Quando Atualizar

O agente deve atualizar este `GEMINI.md` ao final de cada sessão que resultar em:

- Nova convenção de código adotada
- Novo padrão de branch ou commit definido
- Mudança na estrutura de diretórios
- Novo script ou ferramenta introduzida
- Decisão arquitetural relevante

### Como Atualizar

1. Identificar qual seção precisa de atualização
2. Apresentar ao usuário o trecho atual e o trecho proposto
3. Aguardar aprovação
4. Aplicar a mudança e commitar:

```
docs(gemini): atualiza convenções após sessão de <data>

- Adiciona padrão X identificado em <arquivo>
- Corrige descrição de Y baseado em decisão de <contexto>
```

### Imports Modulares (Opcional)

Para projetos grandes, este arquivo pode importar sub-documentos usando a sintaxe `@`:

```markdown
@./docs/CONVENTIONS.md
@./docs/ARCHITECTURE.md
@./docs/AGENT_INSTRUCTIONS.md
```

---

## Referências

- [Conventional Commits](https://www.conventionalcommits.org/)
- [Gemini CLI — Project Context (GEMINI.md)](https://geminicli.com/docs/cli/gemini-md/)
- [Gemini CLI — Documentação Oficial](https://github.com/google-gemini/gemini-cli)
- [hakonno/gemini-docs-template](https://github.com/hakonno/gemini-docs-template) — Template de docs mantidas por IA
- [sebastianhuus/gemini-cli-scripts](https://github.com/sebastianhuus/gemini-cli-scripts) — Scripts de automação git com Gemini CLI

---
