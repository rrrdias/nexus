# Relatório de Auditoria e Análise Arquitetural Frontend: Nexus Core
**Aplicação**: Next.js 16.2.6 (React 19.2.4, Tailwind CSS 4, Turbopack)  
**Data da Auditoria**: 23 de Outubro de 2026  
**Investigador**: Teamwork Explorer (Frontend Architecture, UX & Security)  
**Status da Compilação**: `next build` compilado com sucesso (32 rotas dinâmicas geradas). `tsc --noEmit` 0 erros. `eslint` 91 warnings (0 erros).

---

## 1. Resumo Executivo

O frontend do **Nexus Core** é uma aplicação Next.js 16 baseada no modelo **App Router**, integrada a uma API backend NestJS e conectada ao ambiente AVA Moodle e ERP Lyceum. A aplicação foi recentemente expandida para acomodar o fluxo público de **Agendamento de Provas Presenciais** dos alunos de Graduação EaD da UniEVANGÉLICA, além dos módulos administrativos de relatórios consolidados do AVA, gestão acadêmica e controle de usuários/permissões.

A investigação profunda revelou que, embora o fluxo do estudante apresente excelente acabamento visual, tipografia e boas práticas de acessibilidade nas regras de horários consecutivos (`America/Sao_Paulo`), existem **vulnerabilidades críticas de segurança, falhas no tratamento de erros com mascaramento de digest hash em produção, ausência de convenções essenciais do App Router (Error Boundaries e Suspense Loading) e brechas de autorização no controle de acesso (RBAC)**.

### Tabela de Diagnósticos por Severidade

| ID | Classificação | Categoria | Descrição Sintética | Arquivo / Linha |
|---|---|---|---|---|
| **SEC-01** | **Crítico** | Segurança / Sessão | Cookie de sessão do estudante (`nexus_student_session`) em texto puro sem assinatura HMAC, permitindo personificação de qualquer aluno via URL ou Cookie | `src/middleware.ts:24-37` |
| **SEC-02** | **Crítico** | Segurança / RBAC | Rotas administrativas `/admin/scheduling`, `/admin/scheduling/locals` e `/admin/scheduling/slots` não validam perfil `isSuperAdmin` ou permissão de módulo, expondo gestão de polos e horários a qualquer usuário autenticado | `src/app/admin/scheduling/page.tsx:7-8`, `locals/page.tsx:7-8`, `slots/page.tsx:7-8` |
| **SEC-03** | **Alto** | Segurança / XSS | Vetor de XSS Refletido/Stored no diálogo de comprovante (`StudentVoucherDialog.tsx`) devido à concatenação sem escape de HTML em `doc.write()` dentro de iframe | `src/app/agendamento/StudentVoucherDialog.tsx:46-56, 330-356` |
| **SEC-04** | **Alto** | Segurança / Headers | Content-Security-Policy (CSP) incompleta no `next.config.ts`, sem diretivas `default-src`, `script-src` e `connect-src`, deixando a aplicação desprotegida contra XSS | `next.config.ts:27-29` |
| **ERR-01** | **Alto** | Next.js 16 / UX | Server Actions disparam exceções brutas (`throw new Error`), acionando o mascaramento de erros do Next.js 16 em produção com código hash aleatório (`Digest: ...`), ocultando erros reais nos modais | `src/app/actions/users.ts:23-28`, `scheduling.ts:17-24`, `groups.ts:19-24` |
| **ARC-01** | **Médio** | Arquitetura | Ausência total de Error Boundaries (`error.tsx`, `global-error.tsx`) e Suspense Fallbacks (`loading.tsx`) no Next.js App Router | `src/app/` (0 arquivos encontrados) |
| **ARC-02** | **Médio** | Performance / SSR | Chamada de `auth()` síncrona/unificada no `RootLayout` forçando 100% das páginas da aplicação (inclusive agendamento público e landing pages) a renderização dinâmica sob demanda (`ƒ Dynamic`) | `src/app/layout.tsx:42`, `apps/frontend/next.config.ts` |
| **UX-01** | **Médio** | UX / Mobile | Wizard de agendamento não sincroniza o passo atual com a URL / History API (`useState(1)` puro); o botão "Voltar" do navegador ou gesto do smartphone cancela a navegação | `src/app/agendamento/StudentBookingWizard.tsx:76` |
| **UX-02** | **Médio** | Concorrência / UX | Card de seleção de horário no Stepper exibe vagas apenas do primeiro bloco (`slot.vagas`), e não o gargalo mínimo de vagas consecutivas necessárias | `src/app/agendamento/StudentBookingWizard.tsx:589` |
| **DEP-01** | **Baixo** | Dependências | Dependências desnecessárias ou orfãs instaladas no frontend: `react-router-dom`, `axios`, `postgres`, `drizzle-kit`, `@auth/drizzle-adapter` | `package.json:12-24` |

---

## 2. Mapeamento da Arquitetura Next.js 16 App Router

### 2.1 Estrutura de Rotas e Grupos
A árvore de rotas da aplicação encontra-se estruturada sob `apps/frontend/src/app`:

```
apps/frontend/src/app/
├── academic/
│   ├── AcademicDashboard.tsx      (Client Component)
│   └── page.tsx                   (Server Component - guard fraco)
├── actions/                       (Server Actions "use server")
│   ├── academic.ts
│   ├── api.ts
│   ├── audit.ts
│   ├── auth.ts
│   ├── ava-reports.ts
│   ├── groups.ts
│   ├── jobs.ts
│   ├── scheduling.ts
│   ├── student-scheduling.ts
│   ├── system.ts
│   └── users.ts
├── admin/
│   ├── groups/                    (page.tsx, GroupFormDialog.tsx)
│   ├── logs/                      (page.tsx, AuditFilters.tsx, AuditPagination.tsx, AuditLogDetailDialog.tsx)
│   ├── scheduling/                (page.tsx, SchedulingDashboard.tsx, ExamDateCalendar.tsx, AttendanceListDialog.tsx)
│   │   ├── locals/                (page.tsx, LocalsManagement.tsx)
│   │   └── slots/                 (page.tsx, SlotsManagement.tsx)
│   └── users/                     (page.tsx, UserFormDialog.tsx, ToggleUserButton.tsx)
├── agendamento/                   (Público - Aluno EaD)
│   ├── page.tsx                   (Server Component wrapper com Suspense local)
│   ├── StudentActiveBookingCard.tsx
│   ├── StudentBookingWizard.tsx
│   ├── StudentConfirmationPage.tsx
│   ├── StudentLandingPage.tsx
│   ├── StudentLoadingPage.tsx
│   ├── StudentSchedulingClient.tsx
│   ├── StudentVoucherDialog.tsx
│   └── RescheduleDialog.tsx
├── api/                           (Route Handlers)
│   ├── auth/[...nextauth]/route.ts
│   └── scheduling/
│       ├── bookings/route.ts
│       └── export/route.ts
├── login/
│   └── page.tsx                   (Server Component com Server Action inline)
├── relatorios/
│   ├── consolidado/               (page.tsx, subpastas ead, eefn, raizes, uni, uniego)
│   ├── notas/                     (page.tsx, subpastas eefn, raizes, uni, uniego)
│   ├── progresso/                 (page.tsx, subpastas eefn, raizes, uni, uniego)
│   └── page.tsx
├── globals.css
├── layout.tsx                     (Root Layout unificado)
└── page.tsx                       (Dashboard Hub principal)
```

### 2.2 Problemas de Organização de Rotas (Falta de Route Groups)
A aplicação adota uma raiz totalmente plana, **sem Route Groups** (como `(public)`, `(auth)` ou `(admin)`).
- **Impacto no Root Layout (`src/app/layout.tsx:42-63`)**: O `RootLayout` avalia `const session = await auth()` em nível global.
  - Para usuários autenticados, injeta `<Sidebar />`, `<Topbar />` e `<IdleTimeoutProvider>`.
  - Para usuários não autenticados, omite a Sidebar e Topbar.
  - **Problema de Vazamento de Contexto**: Se um administrador ou professor logado acessar o link público do estudante (`/nexus/agendamento`), o `session` é verdadeiro; portanto, o aluno/administrador verá a Sidebar administrativa, o Topbar e os paddings da dashboard administrativa sobrepostos ao fluxo público de agendamento do aluno!
- **Recomendação**: Adotar grupos de rotas isolados:
  - `(student)/agendamento/...` com layout dedicado, isolado e sem verificação de sessão administrativa.
  - `(dashboard)/admin/...`, `(dashboard)/relatorios/...` com layout autenticado e RBAC estrito.
  - `(auth)/login/...` com layout limpo.

### 2.3 Ausência Crítica de `error.tsx` e `loading.tsx`
Uma busca por arquivos do tipo `*error*` e `*loading*` em `apps/frontend/src/app` retornou **0 resultados**:
- No Next.js App Router, componentes de página que falham ao renderizar no servidor (SSR) sem um `error.tsx` adjacente provocam a quebra de toda a árvore até a tela de erro padrão 500 do Next.js.
- A ausência de `loading.tsx` nos diretórios `/relatorios`, `/academic` e `/admin/scheduling` impede o streaming progressivo (React Suspense Streaming) via Turbopack, tornando a tela em branco durante as consultas lentas ao backend.

---

## 3. Avaliação da Lógica do Middleware (`src/middleware.ts`)

O arquivo `apps/frontend/src/middleware.ts` opera como o guardião de entrada para requisições HTTP:

```typescript
// Linhas 8-15 de apps/frontend/src/middleware.ts:
const isOnApiAuth = pathname.includes('/api/auth')
const isOnLogin = pathname === '/login' || pathname === '/nexus/login' || pathname.endsWith('/login')
const isPublicRoute =
  pathname.includes('/agendamento') ||
  pathname.includes('/api/public') ||
  pathname.includes('/loadingpage') ||
  pathname.includes('/landingpage')
```

### 3.1 Falha Crítica de Segurança no Cookie do Estudante (`SEC-01`)
Nas linhas 20-39:
```typescript
if (pathname.includes('/agendamento')) {
  const urlMat =
    req.nextUrl.searchParams.get('matricula')?.trim() ||
    req.nextUrl.searchParams.get('userid')?.trim()
  const existingCookie = req.cookies.get('nexus_student_session')?.value?.trim()

  const activeMatricula = urlMat || existingCookie

  if (activeMatricula) {
    const res = NextResponse.next()
    res.cookies.set('nexus_student_session', activeMatricula, {
      maxAge: 30 * 60, // 30 minutos em segundos (1800s)
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    })
    return res
  }
}
```

#### Vulnerabilidades Identificadas:
1. **Cookie em Plaintext Não-Assinado**:
   O valor gravado em `nexus_student_session` é exatamente a matrícula crua (ex: `"202410999"`). Não há **assinatura criptográfica (HMAC-SHA256)**, timestamp embutido ou hash com segredo compartilhado. Qualquer usuário ou atacante pode forjar o cookie `nexus_student_session` com o ID de outro aluno e visualizar todas as suas disciplinas, cancelar seu agendamento ou remarcar seu exame para outro polo.
2. **Precedência Arbitrária do Parâmetro de URL**:
   Se um aluno possui uma sessão ativa válida e clica em um link compartilhado por outro aluno no WhatsApp (ex: `/nexus/agendamento?matricula=123456`), `urlMat` sobrescreve instantaneamente a sessão ativa do aluno sem nenhum aviso ou validação.
3. **Escopo de Rota Inadequado via `pathname.includes`**:
   `pathname.includes('/agendamento')` intercepta qualquer rota interna caso venha a existir um endpoint administrativo como `/admin/agendamento`. O correto é utilizar regex exata ou correspondência por prefixo de rota `pathname.startsWith('/agendamento') || pathname.startsWith('/nexus/agendamento')`.
4. **Cookie Path Amplo**:
   `path: '/'` propaga o cookie do estudante para toda a aplicação (inclusive `/nexus/admin`, `/nexus/login`, etc.). O path deveria ser restrito a `/nexus/agendamento`.

### 3.2 Bug Lógico: Código Morto na Validação de Usuário Desativado
Nas linhas 55-59 de `src/middleware.ts`:
```typescript
// Usuário desativado -> força logout
if (isLoggedIn && req.auth?.user?.isDisabled) {
  const signoutUrl = new URL('/nexus/api/auth/signout', req.url)
  return NextResponse.redirect(signoutUrl)
}
```
No entanto, inspecionando `apps/frontend/src/auth.ts`:
- No `authorize()`, o objeto retornado contém apenas `id`, `name`, `email`, `image`, `isSuperAdmin`, `groups`, `accessToken` (linhas 41-49).
- No callback `jwt({ token, user })`, `isDisabled` **não** é gravado no token (linhas 60-67).
- No callback `session({ session, token })`, `isDisabled` **não** é injetado na sessão (linhas 69-76).
- **Consequência**: `req.auth?.user?.isDisabled` é **sempre `undefined`**. Se um operador administrativo for desativado no banco de dados, o middleware nunca o desconectará automaticamente até que seu token expire ou o backend recuse o Bearer token.

### 3.3 Ausência de RBAC no Middleware
O middleware limita-se a checar `!isLoggedIn` e redirecionar para `/nexus/login`. **Nenhuma rota administrativa (`/admin/users`, `/admin/groups`, `/admin/logs`, `/admin/scheduling`) possui verificação de papel ou permissão no middleware**. Todo o isolamento depende exclusivamente de verificações página a página.

---

## 4. Brechas de Controle de Acesso nas Páginas Administrativas (`SEC-02`)

Ao auditar as páginas administrativas no diretório `src/app/admin/`, constatou-se uma disparidade crítica no controle de acesso:

| Página | Código de Verificação | Avaliação |
|---|---|---|
| `src/app/admin/users/page.tsx:13-14` | `if (!session?.user?.isSuperAdmin) redirect("/")` | **Protegido** (apenas SuperAdmin) |
| `src/app/admin/groups/page.tsx:11-12` | `if (!session?.user?.isSuperAdmin) redirect("/")` | **Protegido** (apenas SuperAdmin) |
| `src/app/admin/logs/page.tsx:88-89` | `if (!session?.user?.isSuperAdmin) redirect("/")` | **Protegido** (apenas SuperAdmin) |
| `src/app/admin/scheduling/page.tsx:7-8` | `if (!session?.user) redirect("/login")` | ⚠️ **VULNERÁVEL**: Qualquer usuário logado acessa |
| `src/app/admin/scheduling/locals/page.tsx:7-8` | `if (!session?.user) redirect("/login")` | ⚠️ **VULNERÁVEL**: Qualquer usuário logado acessa |
| `src/app/admin/scheduling/slots/page.tsx:7-8` | `if (!session?.user) redirect("/login")` | ⚠️ **VULNERÁVEL**: Qualquer usuário logado acessa |
| `src/app/academic/page.tsx:6-7` | `if (!session?.user) redirect("/login")` | ⚠️ **VULNERÁVEL**: Qualquer usuário logado acessa |
| `src/app/relatorios/page.tsx:5-7` | *Nenhuma verificação explícita de sessão* | ⚠️ **VULNERÁVEL**: Confiando unicamente no middleware |

### Evidência de Código (`src/app/admin/scheduling/locals/page.tsx:6-9`):
```typescript
export default async function AdminLocalsPage() {
  const session = await auth()
  if (!session?.user) redirect("/login") // <-- Não valida isSuperAdmin nem módulo!
```

**Impacto**: Um usuário cadastrado no sistema apenas para visualizar relatórios básicos de turma (ou um coordenador sem privilégios de polo) pode navegar diretamente para `/nexus/admin/scheduling/locals` ou `/nexus/admin/scheduling/slots`, criar, desativar ou excluir polos presenciais e cadastrar horários de prova com capacidade arbitrária.

---

## 5. Fronteiras RSC vs Client Components e Ações de Servidor

### 5.1 Tratamento de Erros e Mascaramento de Digest Hash (`ERR-01`)
No Next.js 16 (especialmente com React 19), o comportamento padrão de segurança do App Router ao processar Server Actions invocadas por Client Components é:
> *Se uma Server Action lançar uma exceção não capturada (`throw new Error(...)`), o Next.js substitui a mensagem do erro por um hash opaco em produção (`An error occurred in the Server Components render. Digest: 123456789`), a fim de prevenir vazamento de detalhes internos do servidor.*

#### Onde o problema ocorre:
Em `src/app/actions/api.ts:30-47`:
```typescript
if (!response.ok) {
  const error = await response.json().catch(() => null)
  throw new Error(error?.message || error?.error || `Erro HTTP ${response.status} na API.`)
}
```
E nas Server Actions de administração:
- `src/app/actions/users.ts:23-28` (`createUser`, `updateUser`): chamam `fetchFromApi` sem capturar erros, apenas revalidando path e retornando `{ success: true }`.
- `src/app/actions/scheduling.ts:17-33, 51-67` (`createLocal`, `updateLocal`, `createOption`, `updateOption`): executam `fetchFromApi` diretamente sem `try/catch`.
- `src/app/actions/groups.ts:19-24` (`createGroup`, `updateGroup`): disparam exceção bruta.

No componente cliente `UserFormDialog.tsx:77-88`:
```typescript
startTransition(async () => {
  try {
    if (mode === "create") {
      await createUser(formData)
    } else {
      await updateUser(userId!, formData)
    }
    setOpen(false)
  } catch (err: any) {
    setError(err.message || "Erro ao salvar usuário.") // <-- Em produção, err.message é mascarado!
  }
})
```

#### O Contraste Correto em `student-scheduling.ts`:
Em `apps/frontend/src/app/actions/student-scheduling.ts:5-8, 110-130`:
```typescript
export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }

export async function submitPublicBooking(data: { ... }): Promise<ActionResult<any>> {
  try {
    const res = await fetchPublicApi(...)
    return { success: true, data: res }
  } catch (err: any) {
    return { success: false, error: err?.message || "Não foi possível confirmar o agendamento." }
  }
}
```
Como `student-scheduling.ts` retorna um objeto de resultado tipado (`ActionResult<T>`) sem propagar a exceção até o RPC runtime do Next.js, a mensagem de negócio chega limpa e inteligível para o estudante.
**Recomendação**: Padronizar **todas** as Server Actions em `users.ts`, `groups.ts`, `scheduling.ts` e `jobs.ts` com o contrato `ActionResult<T>`.

### 5.2 Dependências Desnecessárias e Tamanho de Bundle (`DEP-01`)
A inspeção do `package.json` de `apps/frontend` demonstrou dependências desnecessárias que aumentam o overhead de instalação e manutenção:
1. `"react-router-dom": "^7.15.1"`: **Completamente órfã**. Uma busca global no código-fonte confirmou 0 importações.
2. `"axios": "^1.16.1"`: **Completamente órfã**. 100% das requisições utilizam o nativo `fetch` com headers de NextAuth.
3. `"@auth/drizzle-adapter": "^1.11.2"`, `"postgres": "^3.4.9"`, `"drizzle-kit": "^0.31.10"`: O frontend utiliza o provider `Credentials` do NextAuth, delegando a persistência à API NestJS (`apps/backend`). Drivers de banco de dados SQL no bundle do frontend são desnecessários.

---

## 6. Avaliação da Jornada do Estudante (Agendamento de Provas)

A jornada pública foi minuciosamente revisada em todas as suas etapas (`Loading`, `Landing`, `Wizard`, `Confirmação`, `Comprovante / Impressão`, `Cancelamento` e `Remarcação`):

### 6.1 Tela de Transição / Carregamento (`StudentLoadingPage.tsx`)
- **Visual e Animação**: Layout imersivo com fundo escuro institucional (`#0A192F` / `#1C2B4A`), barra de progresso suave simulada com teto de 88% enquanto o backend responde, saltando para 100% assim que `isReady` é verdadeiro.
- **Identificação do Aluno**: Exibe a matrícula em destaque (`CheckCircle2`).
- **Resiliência**: Tratamento de timeout suave (`setTimeout 400ms`) antes de invocar `onComplete()`.

### 6.2 Página Inicial do Aluno (`StudentLandingPage.tsx`)
- **Separação de Estados**:
  - Aluno sem agendamento: Exibe lista detalhada das disciplinas regulares sincronizadas, duração estimada total (`disciplinas * 30 min`), card de orientações sobre o polo e botão de CTA de alta visibilidade (`Começar Meu Agendamento`).
  - Aluno com agendamento ativo: Exibe card de destaque com protocolo, dados do polo, data e horário de início/fim, com opções para visualizar detalhes, comprovante ou remarcar.
- **Acessibilidade**: Contrastes de cores atendem às diretrizes WCAG AA (`text-slate-900`, `text-emerald-800`).

### 6.3 Wizard de Agendamento (`StudentBookingWizard.tsx`)
O Stepper divide o fluxo em 4 etapas:
1. *Confirmação de Disciplinas e Carga Horária*
2. *Seleção do Polo Presencial / Online*
3. *Seleção de Data e Horário Consecutivo*
4. *Revisão Consolidada e Aceite dos Termos*

#### Aspectos Positivos:
- **Reserva Consecutiva Precisa**: Utiliza `filterValidStartSlots` (`src/lib/scheduling-utils.ts`) para garantir que o horário de início possua blocos contíguos de 30 minutos disponíveis para todas as disciplinas regulares matriculadas.
- **Proteção de Horário Passado**: Trata adequadamente o fuso horário `America/Sao_Paulo`, bloqueando horários anteriores ao horário corrente caso a data seja o dia de hoje.
- **Touch Targets no Mobile**: Botões de data (`min-w-[90px]`, altura ~44px), botões de horário (`p-3.5`, altura ~56px) e botões de ação inferior (`h-11` a `h-12`) atendem plenamente à recomendação mínima de 44x44px.

#### Falhas Identificadas no Wizard:
1. **Histórico do Navegador / Botão "Voltar" do Smartphone (`UX-01`)**:
   O estado do passo atual é puramente de memória local (`const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1)`). Se o estudante estiver no Passo 3 e tocar no botão nativo "Voltar" do Android/iOS, o navegador sai da página do agendamento e retorna para o AVA Moodle, perdendo todo o fluxo.
   - *Solução recomendada*: Refletir o passo na URL via query param `?step=2` ou usar `window.history.pushState`.
2. **Exibição Enganosa de Vagas no Card de Horário (`UX-02`)**:
   Na linha 589:
   ```typescript
   <span className="text-[10px] font-bold ...">{slot.vagas} vaga{slot.vagas !== 1 ? "s" : ""}</span>
   ```
   Exibe as vagas correspondentes apenas à primeira opção (`slot.vagas`). Se o aluno precisa de 3 disciplinas (3 blocos consecutivos) e o bloco das 08:00 possui 15 vagas, mas o das 08:30 possui apenas 1 vaga, o botão exibe "15 vagas". Se outro aluno reservar a vaga das 08:30 nesse meio tempo, o agendamento falhará na etapa de submissão. O ideal é exibir o valor mínimo (`Math.min(...vagasDosBlocos)`).

### 6.4 Confirmação e Impressão de Comprovante (`StudentVoucherDialog.tsx`)
- **Design do Comprovante**: Estilização A4 em CSS inline pronta para impressão gráfica (`@page { size: A4 portrait; margin: 14mm 15mm; }`), contendo número de protocolo, dados do discente, polo, mapa e lista de disciplinas.

#### Falha Crítica de Segurança: Vetor de XSS (`SEC-03`):
Nas linhas 46-56 e 348-356 de `StudentVoucherDialog.tsx`:
```typescript
const html = generateVoucherHtml(student, booking)
// ...
const doc = iframe.contentWindow?.document
doc.open()
doc.write(html)
doc.close()
```
Dentro de `generateVoucherHtml`, variáveis como `student.nome`, `student.matricula`, `booking.localNome`, `booking.localEndereco` e os nomes das disciplinas (`disc`) são interpoladas **diretamente sem nenhuma sanitização ou escape de entidades HTML**:
```typescript
<span class="info-value">${student.nome}</span>
...
<td style="padding: 8px 12px; ...">${disc}</td>
```
Caso o nome de uma disciplina vinda do AVA ou o nome do estudante contenha caracteres HTML (`<script>`, `<img src=x onerror=...>`, etc.), eles serão executados dentro do contexto do documento da aplicação quando o iframe for renderizado.
- *Solução recomendada*: Criar função `escapeHtml()` ou utilizar biblioteca como `DOMPurify`.

#### Limitação em Dispositivos Móveis:
A impressão é acionada injetando um iframe invisível (`style="width: 0; height: 0; visibility: hidden"`) e chamando `iframe.contentWindow?.print()`. Em navegadores móveis (Safari no iOS e Chrome no Android), invocar `.print()` em iframes ocultos **frequentemente falha ou é bloqueado pelo sistema**. Em mobile, deve-se disparar `window.print()` direto na tela ou abrir uma nova aba formatada via `window.open()`.

---

## 7. Auditoria de Segurança Frontend

### 7.1 Content Security Policy (CSP) Incompleta (`SEC-04`)
No arquivo `apps/frontend/next.config.ts:27-29`:
```typescript
{
  key: "Content-Security-Policy",
  value: "base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self'",
}
```
**Análise de Risco**:
- O cabeçalho **não define** `default-src`. No padrão W3C de CSP, na ausência de `default-src`, diretivas como `script-src`, `connect-src`, `style-src` e `img-src` assumem política **permissiva irrestrita (`*`)**.
- Um script injetado via XSS pode carregar recursos externos ou exfiltrar dados para qualquer servidor remoto sem ser bloqueado pela política de CSP atual.
- Deve-se implementar uma CSP robusta no `next.config.ts` ou via middleware:
  ```
  default-src 'self';
  script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  connect-src 'self' https:;
  font-src 'self' data:;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'self';
  ```

### 7.2 Sanitização e Proteção contra Manipulação de Sessão
Conforme demonstrado nos itens 3.1 e 6.4:
- O cookie de sessão do aluno `nexus_student_session` deve ser assinado ou substituído por um token JWT temporário (assinado com `JWT_SECRET` compartilhado).
- Quando o AVA redireciona o estudante para `/nexus/agendamento`, deve passar um parâmetro assinado `token=<JWT_ASSINADO>`, contendo `{ matricula, nome, exp }`, impedindo que usuários alterem a matrícula na URL.

---

## 8. Verificação de Compilação e Testes

Durante esta auditoria, foram executadas validações empíricas no ambiente:
1. **Typecheck TypeScript**:
   `npx tsc --noEmit` executado com **0 erros** em todo o workspace `apps/frontend`.
2. **ESLint**:
   `npm run lint` reportou 91 warnings (0 erros). Os alertas decorrem de `react-hooks/set-state-in-effect` (efeitos chamando `setState` sincronamente na montagem em `SidebarClient.tsx` e diálogos do AVA) e dezenas de imports não utilizados.
3. **Testes Unitários de Agendamento**:
   Executado `npx tsx src/lib/scheduling-utils.test.ts`. Todos os 5 testes de cálculo de horários consecutivos, conversão de timezone `America/Sao_Paulo` e bloqueio de horários passados passaram com êxito.
4. **Build de Produção Next.js 16**:
   Executado `npm run build`. Compilação gerou 32 páginas dinâmicas via Turbopack com sucesso. Detectado aviso sobre lockfile duplicado (`package-lock.json` na raiz e em `apps/frontend`).

---

## 9. Roadmap Priorizado de Correções e Melhorias

### Prioridade 1: Crítico (Imediato)
1. **Assinar e Validar a Sessão do Estudante (`SEC-01`)**:
   Substituir a gravação em texto puro de `nexus_student_session` por um cookie assinado criptograficamente (via `iron-session` ou token HMAC com secret do NextAuth/Backend). Rejeitar acessos manuais arbitrários na URL sem token assinado do AVA.
2. **Aplicar Guards de Autorização (RBAC) nas Rotas Administrativas (`SEC-02`)**:
   Em `apps/frontend/src/app/admin/scheduling/page.tsx`, `locals/page.tsx` e `slots/page.tsx`, substituir `if (!session?.user) redirect(...)` por checagem obrigatória de permissão:
   `if (!session?.user?.isSuperAdmin && !session?.user?.groups?.includes('PoloAdmin')) redirect("/nexus")`.

### Prioridade 2: Alto (Curto Prazo)
3. **Sanitização de HTML no Comprovante de Prova (`SEC-03`)**:
   Implementar função de escape de caracteres HTML para todas as variáveis injetadas em `StudentVoucherDialog.tsx` (`student.nome`, `disciplinas`, `localNome`), eliminando o risco de XSS.
4. **Padronizar Resposta de Server Actions sem Mascaramento de Erro (`ERR-01`)**:
   Atualizar `users.ts`, `groups.ts` e `scheduling.ts` para adotar o pattern `ActionResult<T> = { success: true, data: T } | { success: false, error: string }`, garantindo que falhas de validação (ex: conflito de horário, polo duplicado) sejam exibidas com clareza ao usuário no frontend.
5. **Completar Headers de CSP no `next.config.ts` (`SEC-04`)**:
   Adicionar diretivas explícitas de `default-src 'self'`, `script-src`, `connect-src`, `style-src` e `img-src`.

### Prioridade 3: Médio (Médio Prazo)
6. **Criar `error.tsx` e `loading.tsx` nas Rotas do App Router (`ARC-01`)**:
   Implementar Error Boundaries amigáveis na raiz de `src/app/` e nas pastas `/admin/` e `/relatorios/`, além de skeletons de carregamento com React Suspense.
7. **Isolar Rotas Públicas e Administrativas via Route Groups (`ARC-02`)**:
   Criar `(public)/agendamento` com layout independente, evitando que a Sidebar administrativa seja renderizada para usuários logados que visitem o fluxo do aluno.
8. **Sincronizar Stepper Wizard com Navegação do Browser (`UX-01`)**:
   Sincronizar `currentStep` com `window.history` ou query params (`/agendamento?step=2`), prevenindo cancelamento acidental do agendamento ao tocar no botão de retorno do celular.
9. **Exibir Mínimo de Vagas Consecutivas no Stepper (`UX-02`)**:
   Ajustar a exibição do botão de horário para refletir o gargalo mínimo de vagas entre todos os blocos contíguos de 30 minutos necessários para o aluno.

### Prioridade 4: Baixo / Limpeza de Código
10. **Remoção de Dependências Órfãs (`DEP-01`)**:
    Remover `react-router-dom`, `axios`, `postgres`, `drizzle-kit` e `@auth/drizzle-adapter` de `apps/frontend/package.json`.
11. **Limpeza de Warnings do ESLint**:
    Corrigir os `setState` dentro de `useEffect` em `SidebarClient.tsx` e nos componentes de relatório do AVA.
12. **Adicionar Script `"test"` no `package.json`**:
    Adicionar `"test": "tsx src/lib/scheduling-utils.test.ts"` ao `package.json` de frontend para integração contínua.
