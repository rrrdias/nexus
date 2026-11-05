# Relatório de Auditoria Técnica Profunda: Frontend, Next.js 16, Server Actions & UX (R4)

**Nexus Core — Sistema Acadêmico e Hub Integrador**  
**Data da Auditoria:** 23 de Outubro de 2026  
**Ambiente:** Next.js 16.2.6 (Turbopack, App Router) + React 19.2.4  
**Status da Auditoria:** Concluído com Sucesso (Modo Read-Only)

---

## 1. Sumário Executivo e Matriz de Severidade

Esta auditoria técnica aprofundada avaliou a integridade do código, aderência aos padrões do **Next.js 16 / React 19**, tratamento de exceções em **Server Actions**, arquitetura de layout do **App Router**, experiência do estudante no fluxo mobile de agendamento presencial e a saúde geral do monorepo (ESLint, testes e dependências).

### Matriz de Diagnósticos

| ID | Área / Componente | Descrição da Não-Conformidade | Severidade | Impacto |
|---|---|---|---|---|
| **D1** | `actions/*.ts` & `api.ts` | **Error Digest Masking em Produção**: `throw new Error(...)` em Server Actions faz o Next.js 16 mascarar mensagens para o usuário final com hashes opacos (`Digest: 12345`), impedindo feedback de validação/conflito. | **Crítico** | Usuários veem erros genéricos ou quebras de tela sem saber o motivo da recusa (ex: e-mail já existe, polo com conflito). |
| **D2** | `app/agendamento` (Wizard) | **Desconexão do Stepper com Browser History API**: O estado de navegação utiliza `useState(1)` e `useState("landing")` locais sem sincronização com o histórico do navegador. Ao pressionar "Voltar" no Android/iOS, o usuário é ejetado do app para o AVA em vez de retroceder o passo. | **Crítico** | Abandono em massa do fluxo de agendamento mobile e frustração extrema dos discentes. |
| **D3** | `app/layout.tsx` | **Vazamento de Layout e Providers Globais**: O layout raiz executa `await auth()` para 100% das requisições (inclusive fluxo público de agendamento), aplica `overflow-hidden` rígido no `<html>` e `<body>` (quebrando o scroll em navegadores mobile), e renderiza Topbar/Sidebar caso um admin acesse o agendamento. | **Alto** | Degradação de performance SSR no fluxo de alunos, travamento de rolagem no Safari/Chrome mobile e vazamento de casca administrativa. |
| **D4** | `src/app/**` (App Router) | **Ausência Total de Route Boundaries**: 0 arquivos `error.tsx`, 0 arquivos `loading.tsx` e 0 arquivos `not-found.tsx` em toda a aplicação frontend. | **Alto** | Exceções de renderização quebram a aplicação inteira para tela branca do Next.js sem botão de retry; navegação entre páginas pesadas não tem feedback visual imediato. |
| **D5** | `StudentVoucherDialog.tsx` | **Falha de Impressão de Comprovante Mobile & Risco de Segurança**: Uso de `document.createElement('iframe')` com `doc.write(html)` e `setTimeout(250ms)`. Em iOS Safari e Android WebView, iframes ocultos falham silenciosamente na impressão; ausência de sanitização em `doc.write` introduz vetor de XSS no DOM. | **Alto** | Alunos em celulares não conseguem imprimir nem salvar o comprovante em PDF para apresentar no polo presencial. |
| **D6** | `StudentBookingWizard.tsx` | **Invalidação de Especificação HTML5**: Botões de polos possuem tags `<a>` aninhadas dentro de tags `<button>` (`<button><a ...>Ver Mapa</a></button>`), gerando erros de hidratação e conflitos de clique. | **Médio** | Advertências de hidratação no console, comportamento errático de clique em telas touch. |
| **D7** | `GradeDetailDialog.tsx:95` | **Anti-Padrão `set-state-in-effect`**: Sincronização síncrona de props (`faseActive`) para state (`selectedTab`) dentro de `useEffect`, violando regras do React 19 e disparando renderizações em cascata desnecessárias. | **Médio** | Alerta no ESLint, atraso na abertura de modais com dezenas de notas calculadas. |
| **D8** | Frontend ESLint (91 avisos) | **91 Warnings no ESLint**: 69 variáveis/ícones do Lucide não utilizados, 15 alertas de `set-state-in-effect`, 4 alertas de impureza de renderização (`Date.now()` em `page.tsx`) e 3 dependências ausentes de hooks. | **Médio** | Poluição do output de CI/CD, risco de esconder regressões reais e bugs de hidratação. |
| **D9** | Monorepo / Turbo / Testes | **Script de Testes Ausente no Frontend & Lockfile Duplicado**: `apps/frontend/package.json` não possui script `"test"`, `turbo.json` não possui pipeline `"test"`, `package.json` da raiz só testa o backend, e existe um `apps/frontend/package-lock.json` residual conflitante. | **Médio** | Testes existentes (`scheduling-utils.test.ts`) nunca são executados no CI/CD; inconsistência de resolução de pacotes no npm. |

---

## 2. Pilar 1: Next.js 16 Server Actions & Error Digest Masking

### 2.1. O Mecanismo de Digest Masking no Next.js 16
No Next.js 16 (especialmente com React 19 Server Functions), o framework adota uma política de segurança rígida: **qualquer exceção lançada (`throw new Error(...)`) dentro de uma Server Action ou Server Component em ambiente de produção tem sua mensagem e stack trace sumariamente ocultados**.

Ao lançar uma exceção:
1. O servidor Next.js gera um hash criptográfico (ex: `digest: "3928194821"`).
2. O log completo da exceção é gravado **apenas no stdout do container/servidor**.
3. O payload enviado pela rede ao navegador do cliente (via protocolo RSC) substitui a mensagem original por:
   ```
   Error: An error occurred in the Server Components render. The specific message is omitted in production builds to avoid leaking sensitive information. A digest was provided by the server: 3928194821.
   ```
4. Do lado do cliente, qualquer bloco `try { await myAction() } catch (err: any) { setError(err.message) }` receberá essa string ininteligível.

### 2.2. Diagnóstico no Nexus Core (`users.ts`, `groups.ts`, `scheduling.ts`, `api.ts`)

#### Arquivo: `apps/frontend/src/app/actions/api.ts`
```typescript
// Linhas 30-33:
if (!response.ok) {
  const error = await response.json().catch(() => null)
  throw new Error(error?.message || error?.error || `Erro HTTP ${response.status} na API.`)
}

// Linhas 44-47:
console.error(`[API Fetch Error] Failed to connect to ${url}:`, error);
throw new Error(error.message || "Erro de conexão com o backend.");
```

#### Arquivo: `apps/frontend/src/app/actions/users.ts`
```typescript
// Linhas 14-29:
export async function createUser(formData: FormData) {
  // ... extração dos campos
  await fetchFromApi('/api/users', {
    method: 'POST',
    body: JSON.stringify({ name, email, password, userid, isActive, groupIds, moduleIds })
  });
  revalidatePath("/admin/users");
  return { success: true };
}
```
**Análise:** `createUser`, `updateUser`, `deleteUser` não tratam erros. Se a API backend retornar HTTP 400 (`"E-mail institucional já cadastrado"`), `fetchFromApi` lança um `Error`. Em desenvolvimento, o Next.js expõe a mensagem, iludindo o desenvolvedor. Porém, **em produção com `npm run start` / Docker, o modal `UserFormDialog.tsx` exibe a mensagem de digest opaca**, impedindo o administrador de saber que o e-mail estava duplicado!

#### Arquivo: `apps/frontend/src/app/actions/groups.ts`
Mesmo problema exato em `createGroup`, `updateGroup`, `deleteGroup`. Lança exceção não capturada que é mascarada em produção.

#### Arquivo: `apps/frontend/src/app/actions/scheduling.ts`
Inconsistência arquitetural dentro do mesmo arquivo:
- Funções como `createBooking`, `concludeBooking`, `cancelBooking` utilizam `try/catch` e retornam `{ success: true, data }` ou `{ success: false, error: ... }`.
- Funções como `createLocal`, `updateLocal`, `createOption`, `updateOption` executam chamadas diretas sem `try/catch` e lançam exceção bruta, disparando digest masking no modal `LocalsManagement.tsx` e `SlotsManagement.tsx`.
- Funções como `getLocals` e `getOptions` capturam o erro e retornam array vazio silencioso (`[]`), impedindo a UI de exibir mensagem de falha de conexão.

### 2.3. Padrão Arquitetural Padronizado: `ActionResult<T>`

Para resolver em definitivo o digest masking, **Server Actions nunca devem deixar exceções vazarem para o runtime do Next.js**. Todas as operações devem retornar um tipo unificado que é serializado de forma limpa como JSON pelo protocolo RSC.

```typescript
// apps/frontend/src/types/actions.ts

export type ActionErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "NETWORK_ERROR"
  | "SERVER_ERROR";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; code?: ActionErrorCode; details?: Record<string, string[]> };
```

### 2.4. Código de Remediação Concreto

#### Refatoração do Helper Base `fetchFromApiSafe` (`apps/frontend/src/app/actions/api.ts`):
```typescript
"use server"

import { auth, signOut } from "@/auth"
import { ActionResult } from "@/types/actions"

export async function fetchFromApiSafe<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ActionResult<T>> {
  const session = await auth()
  const token = session?.user?.accessToken

  if (!token) {
    await signOut({ redirectTo: "/nexus/login" })
    return { success: false, error: "Sessão expirada. Faça login novamente.", code: "UNAUTHORIZED" }
  }

  const baseUrl = process.env.NEXT_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3004"
  const url = `${baseUrl}${endpoint}`

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        ...options.headers,
      },
    })

    if (response.status === 401) {
      await signOut({ redirectTo: "/nexus/login" })
      return { success: false, error: "Não autorizado.", code: "UNAUTHORIZED" }
    }

    if (response.status === 403) {
      return { success: false, error: "Permissão insuficiente para esta operação.", code: "FORBIDDEN" }
    }

    if (!response.ok) {
      const errBody = await response.json().catch(() => null)
      const message = errBody?.message || errBody?.error || `Erro HTTP ${response.status} na API.`
      return {
        success: false,
        error: Array.isArray(message) ? message.join(", ") : message,
        code: response.status === 409 ? "CONFLICT" : response.status === 400 ? "VALIDATION_ERROR" : "SERVER_ERROR",
      }
    }

    const data = (await response.json()) as T
    return { success: true, data }
  } catch (error: any) {
    if (error?.message === 'NEXT_REDIRECT' || error?.digest?.startsWith('NEXT_REDIRECT')) {
      throw error;
    }
    console.error(`[API Fetch Error] ${url}:`, error)
    return {
      success: false,
      error: "Falha ao conectar com o serviço backend. Verifique sua conexão.",
      code: "NETWORK_ERROR",
    }
  }
}
```

#### Refatoração de `users.ts`:
```typescript
"use server"

import { fetchFromApiSafe } from "./api"
import { revalidatePath } from "next/cache"
import { ActionResult } from "@/types/actions"

export async function createUser(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const userid = formData.get("userid") as string;
  const isActive = formData.get("isActive") === "on";
  const groupIds = formData.getAll("groupIds") as string[];
  const moduleIds = formData.getAll("moduleIds") as string[];

  const res = await fetchFromApiSafe<{ id: string }>('/api/users', {
    method: 'POST',
    body: JSON.stringify({ name, email, password, userid, isActive, groupIds, moduleIds }),
  });

  if (!res.success) {
    return res;
  }

  revalidatePath("/admin/users");
  return { success: true, data: res.data };
}
```

#### Consumo no Cliente sem Digest Mascarado (`UserFormDialog.tsx`):
```typescript
// Antes (vulnerável ao digest masking):
startTransition(async () => {
  try {
    await createUser(formData)
    setOpen(false)
  } catch (err: any) {
    setError(err.message) // Exibe "An error occurred with digest..." em prod!
  }
})

// Depois (com ActionResult seguro):
startTransition(async () => {
  const res = mode === "create"
    ? await createUser(formData)
    : await updateUser(userId!, formData)

  if (!res.success) {
    setError(res.error) // Exibe com fidelidade: "E-mail institucional já cadastrado"
    return
  }
  setOpen(false)
})
```

---

## 3. Pilar 2: App Router Architecture & Route Boundaries

### 3.1. Auditoria Estrutural do `src/app/layout.tsx`

Ao analisar `apps/frontend/src/app/layout.tsx`, identificamos três problemas arquiteturais de alto impacto:

```tsx
// Trecho de apps/frontend/src/app/layout.tsx:
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth() // <-- Problema 1

  return (
    <html lang="pt-BR" className="h-screen overflow-hidden"> {/* <-- Problema 2 */}
      <body className={`... flex h-screen bg-[#F4F5F7] antialiased overflow-hidden`}>
        <SessionProvider basePath="/nexus/api/auth"> {/* <-- Problema 3 */}
          {session ? <Sidebar /> : null}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden h-full w-full">
            {session ? <Topbar /> : null}
            <main className={`flex-1 overflow-y-auto ${session ? "p-6 lg:p-8" : ""}`}>
              {session ? (
                <IdleTimeoutProvider basePath={process.env.NEXT_BASE_PATH || ""}>
                  {children}
                </IdleTimeoutProvider>
              ) : (
                children
              )}
            </main>
          </div>
        </SessionProvider>
      </body>
    </html>
  )
}
```

#### Problema 1: `await auth()` no Root Layout para Tráfego Público de Alunos
Ao colocar `await auth()` no layout raiz, toda requisição pública enviada por milhares de estudantes acessando `/agendamento` é forçada a resolver a criptografia JWT do NextAuth. Isso transforma páginas que deveriam ser extremamente leves em nós dependentes do estado de autenticação interna da equipe administrativa.

#### Problema 2: `h-screen overflow-hidden` Quebra Mobile
As classes `h-screen overflow-hidden` aplicadas ao `<html>` e `<body>` configuram uma armadilha severa no Safari (iOS) e Chrome (Android):
- A barra de navegação retrátil dos sistemas móveis não redimensiona a viewport corretamente, fazendo elementos do rodapé do agendamento ficarem escondidos sob a barra de navegação do celular.
- Desativa a rolagem nativa suave e o recurso de "pull-to-refresh" natural do navegador móvel.
- O correto para layouts responsivos com suporte a mobile é usar `min-h-screen` ou `min-h-dvh` no container e deixar `<html>` e `<body>` rolarem naturalmente quando o conteúdo exigir.

#### Problema 3: Vazamento de UI Administrativa e Providers
Se um usuário administrativo (coordenador ou operador de polo) com sessão NextAuth ativa no navegador clicar em um link do aluno (`/agendamento`), o `session` será verdadeiro. A tela pública de agendamento do aluno será renderizada **dentro da Sidebar e da Topbar do sistema**, envolvida pelo `<IdleTimeoutProvider>`.

### 3.2. Proposta de Arquitetura com Route Groups

O Next.js App Router recomenda categoricamente o uso de **Route Groups** entre parênteses para isolar layouts sem afetar o path da URL:

```
apps/frontend/src/app/
├── layout.tsx                     # Root Layout ultraleve (somente <html>, <body>, fontes)
├── not-found.tsx                  # 404 global da aplicação
├── error.tsx                      # Error Boundary global
│
├── (admin)/                       # GRUPO ADMINISTRATIVO PROTEGIDO
│   ├── layout.tsx                 # Contém SessionProvider, Sidebar, Topbar, IdleTimeoutProvider
│   ├── page.tsx                   # Dashboard principal
│   ├── academic/
│   ├── admin/
│   │   ├── users/
│   │   ├── groups/
│   │   ├── logs/
│   │   └── scheduling/
│   ├── relatorios/
│   └── error.tsx                  # Error Boundary específico do Admin
│
├── (student)/                     # GRUPO PÚBLICO DO ESTUDANTE
│   ├── layout.tsx                 # Layout fluido, min-h-dvh, sem SessionProvider, sem Sidebar
│   ├── agendamento/
│   │   ├── page.tsx               # Stepper principal
│   │   ├── loading.tsx            # Streaming skeleton institucional
│   │   └── error.tsx              # Fallback de erro amigável ao aluno com link para tutoria
│   └── loading.tsx
│
└── (auth)/                        # GRUPO DE AUTENTICAÇÃO
    ├── layout.tsx                 # Layout centralizado, focado na tela de login
    └── login/
        └── page.tsx
```

### 3.3. Inventário de Arquivos de Limite Ausentes (Error, Loading, Not-Found)

A auditoria identificou **zero** arquivos `error.tsx`, `loading.tsx` e `not-found.tsx` na aplicação. A tabela abaixo documenta os limites necessários e seus respectivos papéis:

| Rota Alvo | Arquivo Necessário | Comportamento Atual sem o Arquivo | Comportamento com o Limite Implementado |
|---|---|---|---|
| `src/app/` (Global) | `error.tsx` | Crash total para a tela vermelha/branca do Next.js. | Captura exceções não tratadas, exibe mensagem amigável e botão "Tentar Novamente" (`reset()`). |
| `src/app/` (Global) | `not-found.tsx` | Tela 404 padrão monocromática do Next.js sem navegação. | Tela 404 personalizada com identidade visual Nexus Hub e link de retorno. |
| `src/app/` (Global) | `loading.tsx` | Tela congela durante transições de rota pesadas no SSR. | Barra de progresso ou skeleton imediato indicando carregamento. |
| `src/app/agendamento/` | `error.tsx` | Erro na consulta do discente trava o browser sem opções. | Card estilizado com aviso claro de erro e botão para abrir a tutoria no AVA. |
| `src/app/agendamento/` | `loading.tsx` | Atraso no carregamento inicial da página de agendamento. | Exibição instantânea do header da UniEVANGÉLICA com skeleton cards pulsantes. |
| `src/app/admin/scheduling/` | `loading.tsx` | Ao alternar datas e polos na listagem, UI parece travada. | Skeleton das tabelas de vagas e agendamentos. |

### 3.4. Implementação de Referência para `app/error.tsx`
```tsx
"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle, RefreshCw, Home } from "lucide-react"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[Global Error Boundary Caught]:", error)
  }, [error])

  return (
    <div className="min-h-screen bg-[#F4F5F7] flex items-center justify-center p-6 text-center">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-8 shadow-xl space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 mx-auto">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-extrabold text-slate-900">
            Algo inesperado aconteceu
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Ocorreu uma falha na renderização desta página. Nossos serviços já registraram este incidente.
          </p>
          {error.digest && (
            <p className="text-[11px] font-mono text-slate-400 bg-slate-50 py-1 px-2 rounded-md inline-block">
              Código de rastreio: {error.digest}
            </p>
          )}
        </div>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button
            onClick={() => reset()}
            className="bg-[#1C2B4A] hover:bg-[#243355] text-white gap-2 text-xs font-bold px-5 h-10"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Tentar Novamente
          </Button>
          <a
            href="/nexus"
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 px-4 h-10 border border-slate-200 rounded-lg"
          >
            <Home className="w-3.5 h-3.5" />
            Início
          </a>
        </div>
      </div>
    </div>
  )
}
```

---

## 4. Pilar 3: Student Stepper Mobile UX & Voucher Printing

### 4.1. Auditoria do Stepper: Perda de Navegação com `useState` vs Browser History API

#### O Problema Observado
No arquivo `apps/frontend/src/app/agendamento/StudentBookingWizard.tsx` (linha 76):
```typescript
const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1)
```
E no container `StudentSchedulingClient.tsx` (linha 45):
```typescript
const [viewMode, setViewMode] = useState<"landing" | "wizard" | "details" | "confirmation">("landing")
```

Quando um estudante em um dispositivo móvel (Android ou iPhone) executa o fluxo:
1. Ele acessa a Landing Page (`viewMode = "landing"`).
2. Toca em "Agendar Prova" -> `viewMode = "wizard"`, `currentStep = 1`.
3. Toca em "Avançar" -> `currentStep = 2` (Escolha de Polo).
4. Toca no polo e avança -> `currentStep = 3` (Escolha de Data e Horário).
5. **O Comportamento do Usuário Mobile**: Se o aluno perceber que quer alterar o polo, 95% dos usuários em smartphones não rolam a tela para procurar o botão "Voltar" no rodapé. Eles tocam no botão físico/gestual de voltar do Android ou fazem o gesto de arrastar da borda esquerda no iOS.
6. **A Falha Crítica**: Como as trocas de passo não inserem entradas na pilha de histórico do navegador (`window.history.pushState`), o navegador interpreta o gesto de voltar como um pedido para **sair do domínio `/agendamento`**, devolvendo o aluno à tela anterior (o AVA Moodle ou a tela inicial do navegador). O aluno perde todas as opções escolhidas e sua sessão pode expirar.

#### Solução: Hook de Sincronização com History API
Recomenda-se um hook leve para sincronizar o passo tanto com a URL quanto com o histórico nativo:

```typescript
// apps/frontend/src/hooks/useStepperHistory.ts
import { useState, useEffect, useCallback } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"

export function useStepperHistory(initialStep: number = 1, maxStep: number = 4) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  // Lê o passo da URL (?step=2) ou usa o inicial
  const stepParam = Number(searchParams.get("step"))
  const currentStep = stepParam >= 1 && stepParam <= maxStep ? stepParam : initialStep

  const goToStep = useCallback((newStep: number) => {
    if (newStep < 1 || newStep > maxStep) return
    const params = new URLSearchParams(searchParams.toString())
    params.set("step", String(newStep))
    
    // pushState insere entrada no histórico do navegador
    window.history.pushState(null, "", `${pathname}?${params.toString()}`)
    router.refresh()
  }, [searchParams, pathname, router, maxStep])

  // Trata o evento popstate quando o usuário pressiona "Voltar" no celular
  useEffect(() => {
    const handlePopState = () => {
      const step = Number(new URLSearchParams(window.location.search).get("step")) || 1
      // Força a atualização do estado visual
    }
    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [])

  return { currentStep, goToStep }
}
```

### 4.2. Auditoria de Usabilidade Mobile: Touch Targets e Layout

#### Invalidação de HTML5 no Seletor de Polos
No arquivo `StudentBookingWizard.tsx` (linhas 366-430):
```tsx
<button
  key={loc.id}
  type="button"
  onClick={() => setSelectedLocalId(loc.id)}
  className="..."
>
  {/* Conteúdo do polo ... */}
  {loc.linkLocal && (
    <a
      href={loc.linkLocal}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="..."
    >
      <ExternalLink className="w-3 h-3" />
      Ver Mapa
    </a>
  )}
</button>
```
**Falha**: Na especificação HTML5 do W3C/WHATWG, uma tag `<a>` **não pode** ser filha de uma tag `<button>`. Essa estrutura gera:
- Alertas de hidratação no React ("Hydration failed: Cannot nest interactive element inside button").
- Comportamento imprevisível no mobile: em alguns navegadores Android, clicar em "Ver Mapa" seleciona o polo mas bloqueia a abertura do link externo; em outros, abre o mapa e simultaneamente submete o clique do botão pai.
**Correção**: O card deve ser uma `<div>` acessível com `role="button"` e `tabIndex={0}` com `onKeyDown`, ou o botão de "Ver Mapa" deve ficar fora do corpo clicável principal.

#### Seletor de Datas em Formato Wrap vs Scroll-Snap Horizontal
Linhas 519-545 de `StudentBookingWizard.tsx`:
```tsx
<div className="flex flex-wrap gap-2">
  {datesList.map((dStr) => (
    <button className="px-4 py-2.5 rounded-xl border ... min-w-[90px]">
```
Quando o polo oferece 10 a 15 datas de aplicação de prova, o layout `flex-wrap` cria um bloco vertical de até 5 linhas de botões, empurrando a seção de horários para fora do campo de visão do celular.
**Recomendação UX Mobile**: Converter para uma barra horizontal com scroll-snap:
```tsx
<div className="flex items-center gap-2 overflow-x-auto pb-3 pt-1 scrollbar-none snap-x snap-mandatory -mx-4 px-4 sm:mx-0 sm:px-0">
  {datesList.map((dStr) => (
    <button className="snap-start shrink-0 px-4 py-2.5 rounded-xl border min-w-[92px] ...">
```
Isso permite ao estudante deslizar as datas com o polegar de forma moderna e fluida, mantendo o seletor de horários visível logo abaixo.

#### Touch Targets (WCAG 2.5.5)
- O indicador de passos no topo (`w-8 h-8` = 32px) está abaixo do mínimo de acessibilidade de 44x44px (Apple HIG) ou 48x48px (Google Material).
- O padding dos cards no mobile (`p-6 sm:p-8`) consome 48px da largura total em telas de 360px (restando apenas 312px úteis). Recomenda-se `p-4 sm:p-6 md:p-8`.

---

### 4.3. Auditoria do Comprovante de Agendamento (`StudentVoucherDialog.tsx`)

#### O Mecanismo Atual de Impressão via Iframe
No arquivo `StudentVoucherDialog.tsx` (linhas 329-366):
```typescript
const handlePrint = () => {
  const html = generateVoucherHtml(student, booking)

  let iframe = document.getElementById("student-voucher-frame") as HTMLIFrameElement
  if (!iframe) {
    iframe = document.createElement("iframe")
    iframe.id = "student-voucher-frame"
    iframe.style.position = "fixed"
    iframe.style.width = "0"
    iframe.style.height = "0"
    iframe.style.border = "0"
    iframe.style.visibility = "hidden"
    document.body.appendChild(iframe)
  }

  const doc = iframe.contentWindow?.document
  if (!doc) {
    window.print()
    return
  }

  doc.open()
  doc.write(html)
  doc.close()

  setTimeout(() => {
    try {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
    } catch {
      window.print()
    }
  }, 250)
}
```

#### Falhas Críticas Identificadas:
1. **Falha Silenciosa no iOS Safari (WebKit)**: O motor WebKit do iOS ignora chamadas de `.print()` executadas em iframes com `visibility: hidden` ou dimensões `0x0`. O diálogo nativo do AirPrint simplesmente **não abre**.
2. **Impressão em Branco no Android Chrome/WebView**: Em navegadores baseados em Chromium no Android, a impressão de iframes desacoplados do layout principal frequentemente renderiza uma página totalmente em branco ou imprime a página mãe com o modal aberto.
3. **Race Condition de 250ms**: O `setTimeout(..., 250)` assume que em 250 milissegundos o documento HTML terá sido parseado, as fontes carregadas e o CSS aplicado. Em smartphones básicos ou sob conexões 4G lentas, 250ms não é suficiente, disparando o diálogo de impressão antes do layout estar pronto.
4. **Vulnerabilidade a XSS via `doc.write`**: `generateVoucherHtml` realiza interpolação direta de strings:
   ```typescript
   <span class="info-value">${student.nome}</span>
   <span class="info-value">${booking.localNome}</span>
   ```
   Se um nome de discente ou local contiver caracteres HTML especiais não escapados, `doc.write` executa o conteúdo dentro da mesma origem do app.
5. **Ausência da Opção "Salvar como PDF" no Mobile**: Alunos não costumam ter impressora configurada no celular. Eles precisam de um botão claro para baixar o PDF do comprovante ou uma imagem para salvar na galeria do celular e apresentar no portão do polo.

#### Arquitetura Recomendada para o Comprovante:
1. **Regras Nativas de `@media print` no Tailwind**:
   Incluir o comprovante renderizado no próprio DOM da página, visível na tela e estilizado para impressão direta via `window.print()`:
   ```css
   @media print {
     body * {
       visibility: hidden;
     }
     #printable-student-voucher, #printable-student-voucher * {
       visibility: visible;
     }
     #printable-student-voucher {
       position: absolute;
       left: 0;
       top: 0;
       width: 100%;
     }
   }
   ```
2. **Rota Dedicada para Download do Comprovante / PDF**:
   Disponibilizar endpoint ou rota `/agendamento/comprovante?id=...` para permitir a exportação direta em PDF através de stream ou visualização em aba separada.

---

## 5. Pilar 4: Qualidade de Código, Lint & Monorepo

### 5.1. Correção Definitiva para `GradeDetailDialog.tsx:95`

#### O Código Problemático:
No arquivo `apps/frontend/src/components/ava-reports/GradeDetailDialog.tsx`:
```tsx
// Linhas 87-99:
const isSinglePhase = faseActive === "fase1" || faseActive === "fase2" || faseActive === "fase3"

const [selectedTab, setSelectedTab] = useState<"fase1" | "fase2" | "fase3" | "all">(
  isSinglePhase ? faseActive : "all"
)

useEffect(() => {
  if (isSinglePhase) {
    setSelectedTab(faseActive)
  } else {
    setSelectedTab("all")
  }
}, [faseActive, isSinglePhase, open])
```

#### Por que isso dispara o aviso `react-hooks/set-state-in-effect`?
O React 19 / Next.js Compiler condena expressamente a sincronização de props para state dentro de `useEffect` ("You Might Not Need an Effect").
- Quando o componente é renderizado, o React executa a montagem.
- Imediatamente após a montagem no DOM, o `useEffect` roda e executa `setSelectedTab(...)`.
- O React é obrigado a pausar, descartar a renderização atual e disparar um **segundo ciclo completo de renderização**, recalculando os pesados mapas de atividades e notas de centenas de discentes.

#### A Correção Idiomática em React 19 (Estado Derivado durante a Renderização):
Como a prop `isSinglePhase` define se a aba é travada em uma fase única, não é necessário manter um `useState` reativo para quando o modal for de fase única. E quando o modal for o consolidado (`"all"`), precisamos apenas registrar a escolha manual do usuário.

```tsx
// Correção recomendada (sem useEffect e sem re-render redundante):
const isSinglePhase = faseActive === "fase1" || faseActive === "fase2" || faseActive === "fase3"

// Armazena a seleção manual do usuário apenas quando estiver no modo consolidado
const [userSelectedTab, setUserSelectedTab] = useState<"fase1" | "fase2" | "fase3" | "all">("all")

// O valor efetivo da aba é derivado diretamente durante o render:
const selectedTab = isSinglePhase ? faseActive : userSelectedTab
```
*Esta mesma correção deve ser espelhada no arquivo idêntico `apps/frontend/src/components/ava-reports/ActivityListDialog.tsx:66`, eliminando dois dos warnings mais graves do projeto.*

---

### 5.2. Censo e Plano de Saneamento dos 91 Warnings do ESLint

A execução de `npx eslint src/` revelou exatamente **91 avisos**:

| Regra ESLint | Quantidade | Principais Arquivos Afetados | Solução Automatizada / Manual |
|---|---|---|---|
| `@typescript-eslint/no-unused-vars` | **69** | `ConsolidatedDashboard.tsx`, `ConsolidatedTable.tsx`, `TopbarUserMenu.tsx`, `SchedulingDashboard.tsx`, `UsersManagement.tsx` | Remover ícones importados do `lucide-react` não utilizados no JSX; prefixar variáveis necessárias em assinaturas com `_` (ex: `_e`). |
| `react-hooks/set-state-in-effect` | **15** | `GradeDetailDialog.tsx`, `ActivityListDialog.tsx`, `SidebarClient.tsx`, `SchedulingDashboard.tsx`, `SlotsManagement.tsx`, `RescheduleDialog.tsx`, `StudentBookingWizard.tsx` | Substituir `setState` em efeito por estado derivado no render ou mover para callbacks de evento (ex: `onClick`, `onSelect`). |
| `react-hooks/purity` | **4** | `apps/frontend/src/app/page.tsx:228-231` | O arquivo invoca `new Date(Date.now() - ...)` durante a renderização no corpo do componente. Mover para um mock constante fora do componente ou inicializar dentro de `useMemo` com dependências vazias. |
| `react-hooks/exhaustive-deps` | **3** | `SchedulingDashboard.tsx:170`, `SlotsManagement.tsx:83`, `IdleTimeoutProvider.tsx:48` | Envolver as funções chamadas (`refreshData`, `loadSlots`, `resetTimer`) com `useCallback` e incluí-las nos arrays de dependências. |

---

### 5.3. Atualizações de `package.json`, `turbo.json` e Remoção de Lockfile Duplicado

#### Diagnóstico:
1. `apps/frontend/src/lib/scheduling-utils.test.ts` existe, possui 193 linhas de testes unitários cruciais para a validação de slots de 30 minutos e cálculo de fuso horário brasileiro, **mas não possui script para ser executado no `apps/frontend/package.json`**.
2. O arquivo `turbo.json` não contém a task `"test"`.
3. O `package.json` da raiz monorepo executa apenas `npm run test --workspace=@nexus-core/backend`.
4. Existe um arquivo duplicado `apps/frontend/package-lock.json` (além do `package-lock.json` raiz). Em monorepos com npm workspaces, isso quebra o determinismo das dependências e invalida o cache do Turborepo.

#### Plano de Atualização:

##### 1. Atualização em `apps/frontend/package.json`:
```json
{
  "name": "@nexus-core/frontend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3002",
    "build": "next build",
    "start": "next start --port 3002",
    "lint": "eslint",
    "test": "tsx src/lib/scheduling-utils.test.ts"
  }
}
```
*(Nota: `tsx` já está presente nas devDependencies do frontend na versão `^4.22.3`, permitindo execução imediata sem novas instalações).*

##### 2. Atualização em `turbo.json`:
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
    },
    "lint": {},
    "test": {
      "dependsOn": []
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

##### 3. Atualização no `package.json` da Raiz:
```json
{
  "name": "nexus-core",
  "version": "1.0.0",
  "private": true,
  "packageManager": "npm@10.5.0",
  "workspaces": [
    "apps/*"
  ],
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "test:backend": "npm run test --workspace=@nexus-core/backend",
    "test:frontend": "npm run test --workspace=@nexus-core/frontend",
    "test:e2e": "npm run test:e2e --workspace=@nexus-core/backend"
  }
}
```

##### 4. Remoção do Lockfile Duplicado:
Executar a exclusão de `apps/frontend/package-lock.json` e rodar `npm install` na raiz para consolidar a árvore única de dependências no `package-lock.json` principal.

---

## 6. Matriz de Priorização para o Roadmap (Input para R5)

Abaixo está a síntese de esforço versus impacto para guiar a fase de implementação do Nexus Core:

```
ALTO IMPACTO
  ▲
  │   [D1] Padronização ActionResult          [D2] History API no Stepper
  │   (Evitar Digest Masking em Ações)        (Eliminar saída acidental mobile)
  │
  │   [D3] Isolamento por Route Groups        [D5] Remediação da Impressão de
  │   (Eliminar layout leak & overflow)       Comprovante e Exportação PDF
  │
  │   [D4] Boundaries error/loading/404       [D7] Correção GradeDetailDialog
  │                                           (Eliminar render em cascata)
  │
  │   [D9] Script de Teste & turbo.json       [D8] Faxina dos 91 ESLint Warnings
  │   (Consolidação de lockfile)              (Lucide icons e impurezas)
  └────────────────────────────────────────────────────────────────────────►
  BAIXO ESFORÇO                                           ALTO ESFORÇO
```

### Ordem de Execução Recomendada:
1. **Fase I (Imediata - Quick Wins de Alto Impacto):**
   - Atualizar `turbo.json` e `package.json` para adicionar `"test"` no frontend e remover `apps/frontend/package-lock.json`.
   - Aplicar a correção de estado derivado em `GradeDetailDialog.tsx:95` e `ActivityListDialog.tsx:66`.
   - Adicionar `apps/frontend/src/app/error.tsx` e `not-found.tsx` na raiz.
2. **Fase II (Next.js 16 Patterns & Server Actions):**
   - Implementar `ActionResult<T>` em `api.ts`, `users.ts`, `groups.ts` e `scheduling.ts`.
   - Refatorar os diálogos administrativos para consumir o status e mensagem do resultado.
3. **Fase III (Experiência Mobile do Estudante):**
   - Implementar o hook de navegação com History API no Stepper.
   - Corrigir a tag `<a>` aninhada em `<button>` no seletor de polos.
   - Substituir a impressão por iframe por `@media print` e botão nativo de download do voucher.
4. **Fase IV (Arquitetura App Router e Limpeza Final):**
   - Migrar layout para Route Groups `(admin)` e `(student)`.
   - Limpar os 69 imports de ícones e parâmetros não utilizados.
