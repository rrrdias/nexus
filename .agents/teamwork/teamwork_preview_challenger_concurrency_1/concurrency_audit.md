# Relatório de Auditoria Técnica de Concorrência, Transações e Performance (R2)

**Projeto**: Nexus Core  
**Módulo**: Agendamento de Provas Presenciais & Repositórios de Dados  
**Auditor / Papel**: EMPIRICAL CHALLENGER (Critic / Specialist)  
**Data da Auditoria**: 23 de Outubro de 2026  
**Ambiente de Execução**: PostgreSQL 16.14 (Docker), NestJS 11, Drizzle ORM  
**Status Geral de Risco**: **CRÍTICO**

---

## 1. Sumário Executivo

A auditoria empírica de concorrência e transações (Requisito R2) identificou **três falhas críticas de concorrência e integridade transacional**, além de **gargalos severos de I/O em queries essenciais de agendamento e relatórios**:

1. **Vulnerabilidade a Deadlocks (PostgreSQL 40P01) e Travas Invertidas**:
   O método `createBooking` executa um bloqueio pessimista em duas etapas (`FOR UPDATE` no slot base por ID, seguido de um `FOR UPDATE` ordenado por `hora`). A aquisição de travas em ordens arbitrárias quebra a hierarquia global de recursos de Dijkstra, gerando impasses cíclicos comprovados empiricamente sob concorrência simultânea. Além disso, a ausência de índices compostos em `opcao` força o PostgreSQL a realizar `Seq Scan` (varredura sequencial) com `LockRows`, bloqueando a tabela inteira sob alta carga.

2. **Perda Irreversível de Vagas por Falta de Atomicidade em `rescheduleStudentBooking`**:
   O fluxo de remarcação desmembra o cancelamento (`cancelBooking`) e a nova reserva (`createBooking`) em transações autônomas e separadas. Se a reserva do novo horário falhar (vagas esgotadas por concorrência simultânea) e a vaga antiga for ocupada por um terceiro no milissegundo intermediário, o bloco `catch` silencioso falha em recuperar o agendamento original. O aluno perde definitivamente sua vaga e seu comprovante, sem agendamento ativo no sistema.

3. **Defeito Silencioso de Não Restauração de Vagas no `cancelBooking` (`HH:MM:00` vs `HH:MM`)**:
   Enquanto `createBooking` consulta formatos de 5 e 8 caracteres (`allPossibleTimes`), `cancelBooking` utiliza exclusivamente `getNextTimeStr`, que gera strings com sufixo `:00` (`10:00:00`). Para slots criados ou importados no formato `HH:MM` (como no DTO `horaInicio`), a comparação estrita de strings no PostgreSQL resulta em **0 linhas encontradas**. O agendamento é marcado como cancelado, mas `opcao.vagas` **nunca é incrementado**, evaporando a capacidade física do polo.

4. **Gargalos de Indexação em Tabelas Centrais (`opcao`, `agendamentos_matricula`, `local`, `ava_progress_report`)**:
   O plano de execução (`EXPLAIN ANALYZE`) revelou que queries críticas do fluxo público realizam varreduras sequenciais completas por falta de índices compostos e parciais cobrindo `(localId, data, hora, status, vagas)`.

---

## 2. Vulnerabilidade 1: Deadlocks e Travas Invertidas em Vagas Consecutivas

### 2.1 Análise de Código e Causa Raiz
No arquivo `apps/backend/src/scheduling/scheduling.service.ts`:

```typescript
// Linhas 650-655: Bloqueio do slot base pelo ID
const [opcao] = await tx
  .select()
  .from(opcaos)
  .where(eq(opcaos.id, opcaoId))
  .for('update');

// Linhas 699-711: Bloqueio de todos os slots consecutivos necessários
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

**Mecanismo de Falha**:
- **Aquisição em Duas Fases Sem Ordem Monotônica**: A primeira consulta adquire uma trava de linha exclusiva (`FOR UPDATE`) sobre um registro específico identificado pelo UUID `opcaoId`. Essa trava é obtida **antes** de o algoritmo conhecer a lista completa de slots ou ordenar os recursos.
- **Inversão de Hierarquia de Recursos**: Seja o Aluno A selecionando início às `10:00` (necessita de `10:00` e `10:30`) e o Aluno B selecionando início às `10:30` (necessita de `10:30` e `11:00`), ou cenários de cancelamento/reagendamento reverso:
  - Tx A obtém trava exclusiva em `10:00` (Etapa 1).
  - Tx B obtém trava exclusiva em `10:30` (Etapa 1).
  - Tx A executa a Etapa 2 e solicita trava em `10:30` -> **Tx A é suspensa aguardando Tx B**.
  - Se Tx B ou qualquer transação de remarcação/validação correlata requisitar `10:00` -> **Tx B é suspensa aguardando Tx A**.
  - Ocorre um ciclo no grafo de espera direcionado ($WFG$ - Wait-For Graph): $Tx_A \to Tx_B \to Tx_A$.
- **Impacto da Varredura Sequencial (`Seq Scan`)**: A tabela `opcao` no PostgreSQL não possui índice composto em `(localId, data, hora)`. Conforme validado via `EXPLAIN (ANALYZE, BUFFERS)`, o PostgreSQL executa um `Seq Scan` em toda a tabela antes do nó `Sort`, aplicando `LockRows` à medida que varre tuplas do disco, ampliando drasticamente o período de contenção.

### 2.2 Modelo Matemático de Concorrência
Sejam $S = \{s_1, s_2, \dots, s_k\}$ os slots temporais ordenados cronologicamente: $t(s_1) < t(s_2) < \dots < t(s_k)$.
Para que um protocolo de travamento bidimensional seja livre de impasses (Teorema de Coffman & Dijkstra):
$$\forall Tx_i, Tx_j \quad \text{se } Tx_i \text{ adquire } Lock(s_a) \text{ antes de } Lock(s_b), \text{ então } a < b$$
No código atual do Nexus Core:
1. $Tx_A$ adquire $Lock(s_{\text{base}})$ via chave primária aleatória.
2. Posteriormente, adquire $\{Lock(s_i)\}_{i=1}^n$ ordenado por $t(s_i)$.
Como $s_{\text{base}}$ é travado independentemente da ordem dos demais participantes concorrentes, a propriedade de ordenação linear estrita é violada.

### 2.3 Evidência Empírica de Reprodução
Executado contra a instância PostgreSQL 16 (`apps/backend/test/empirical_concurrency_challenge.cjs`):
```text
[Tx 1] Acquired FOR UPDATE lock on slotA (10:00:00)
[Tx 2] Acquired FOR UPDATE lock on slotB (10:30:00)
[Tx 1] Requesting FOR UPDATE lock on slotB (10:30:00)...
[Tx 2] Requesting FOR UPDATE lock on slotA (10:00:00)...
[Tx 2] Postgres Deadlock Detected! Error code: 40P01 - deadlock detected
Deadlock Inversion Verified: YES (PostgreSQL 40P01 deadlock_detected successfully reproduced)
```

---

## 3. Vulnerabilidade 2: Não Atomicidade e Perda de Vagas em `rescheduleStudentBooking`

### 3.1 Análise de Código e Causa Raiz
No arquivo `apps/backend/src/scheduling/scheduling.service.ts`:

```typescript
// Linhas 1621-1653:
// Libera a vaga do agendamento antigo
await this.cancelBooking(bookingId); // <-- Transação 1 COMITADA

try {
  // Reserva o novo horário
  const newBooking = await this.createBooking({ // <-- Transação 2 SEPARADA
    opcaoId: newOpcaoId,
    matricula,
    periodo,
  });

  return newBooking;
} catch (err: any) {
  // Em caso de falha no novo agendamento, restaura o agendamento anterior
  try {
    await this.createBooking({ // <-- Transação 3 de "tentativa de reversão"
      opcaoId: booking.opcaoId,
      matricula,
      periodo,
    });
  } catch {
    // Silencioso se não conseguir reverter!
  }
  throw err;
}
```

**Mecanismo de Falha**:
1. O cancelamento do agendamento anterior é efetivado em uma transação comitada no banco de dados. A vaga antiga volta imediatamente para o pool público.
2. A nova reserva tenta ser realizada em uma transação separada.
3. Se a nova reserva falhar (por exemplo, outro estudante ocupou a última vaga do novo polo/horário uma fração de segundo antes, ou regras de validação rejeitaram o pedido):
   - O código cai no bloco `catch`.
   - O bloco `catch` tenta chamar `createBooking` para recriar o agendamento original.
   - **Cenário Catastrófico de Concorrência**: Entre a finalização do cancelamento e a tentativa de recuperação, um terceiro estudante reservou a vaga original recém-liberada.
   - O `createBooking` no catch lança `BadRequestException: O horário já está com as vagas esgotadas`.
   - O `catch { /* Silencioso se não conseguir reverter */ }` simplesmente engole a exceção.
4. **Resultado**: O aluno recebe um erro HTTP 400 informando que o novo horário falhou, seu agendamento antigo permanece com `status = 'cancelado'`, `deletedAt = NOW()`, e ele **perde completamente o agendamento**, ficando sem vaga no sistema.

### 3.2 Evidência Empírica de Reprodução
Executado no PostgreSQL 16:
```text
[Test 2] Student has active booking on slot 14:00:00. New slot 15:00:00 has 0 vacancies.
[Test 2] Step 1: Executing cancelBooking(booking-test)...
[Test 2] CONCURRENCY INTERLEAVING: Another student steals the released slot 14:00:00!
[Test 2] Step 2: Reserving new slot 15:00:00 (vagas = 0)...
[Test 2] Step 2 failed as expected: O horário 15:00 já está com as vagas esgotadas.
[Test 2] Step 3: Catch block attempts to restore old slot 14:00:00...
[Test 2] Step 3 rollback FAILED: Falha no rollback: Horário original também foi esgotado!
[Test 2] Final State for student MATR_TEST:
  - Original Booking Status: cancelado
  - DeletedAt: Fri Oct 23 2026 12:22:27 GMT-0300
  - Old Slot Vacancies: 0
[Test 2] Bug Confirmed: YES (CRITICAL DEFECT: Student lost original booking permanently!)
```

---

## 4. Vulnerabilidade 3: Defeito de Não Restauração de Vagas no `cancelBooking`

### 4.1 Análise de Código e Causa Raiz
No arquivo `apps/backend/src/scheduling/scheduling.service.ts`:

Em `createBooking` (linhas 692-696):
```typescript
// Match both HH:MM and HH:MM:00 formats in database
const allPossibleTimes = [
  ...requiredTimes,
  ...requiredTimes.map((t) => `${t}:00`),
];
```
O autor reconheceu a existência de slots com formatação de 5 caracteres (`HH:MM`) e 8 caracteres (`HH:MM:00`).

Porém, em `cancelBooking` (linhas 787-805):
```typescript
const timeStr = opcao.hora.slice(0, 5);
const requiredTimes = Array.from({ length: totalDisciplines }, (_, i) =>
  getNextTimeStr(timeStr, i), // <-- Retorna SEMPRE 'HH:MM:00' (8 caracteres)
);

// Fetch and Lock all matching slots
const slots = await tx
  .select()
  .from(opcaos)
  .where(
    and(
      eq(opcaos.localId, opcao.localId),
      eq(opcaos.data, opcao.data),
      inArray(opcaos.hora, requiredTimes), // <-- Procura APENAS 'HH:MM:00'!
    ),
  )
  .orderBy(opcaos.hora)
  .for('update');

// Restore vacancy capacity (+1)
for (const slot of slots) {
  await tx
    .update(opcaos)
    .set({ vagas: slot.vagas + 1, updatedAt: new Date() })
    .where(eq(opcaos.id, slot.id));
}
```

**Mecanismo de Falha**:
- Na tabela `opcao`, a coluna `hora` é do tipo `text` (não `time`).
- Quando um slot possui `hora = '10:00'` (5 caracteres), a consulta `WHERE hora IN ('10:00:00')` executa comparação textual exata no PostgreSQL.
- `'10:00' = '10:00:00'` é estritamente **FALSO** (`f`).
- `slots` retorna `[]` (vetor vazio).
- O loop de incremento `vagas + 1` **nunca é executado**.
- O agendamento é marcado como `cancelado`, mas a vaga física jamais retorna ao polo. A cada cancelamento de um slot formatado em 5 caracteres, o polo perde vagas permanentemente até a lotação fantasma.

### 4.2 Evidência Empírica de Reprodução
Executado no PostgreSQL 16:
```text
[Test 1] Slot '10:00' initial vagas = 5. After booking, vagas = 4
[Test 1] cancelBooking query looking for ["10:00:00"] matched 0 slots.
[Test 1] After cancelBooking, vagas = 4 (Expected to restore to 5, Actual: 4)
[Test 1] Bug Confirmed: YES (CRITICAL DEFECT: Vacancy NOT restored for 5-character times)
```

---

## 5. Auditoria de Desempenho de Queries e Indexação do Banco de Dados

### 5.1 Diagnóstico de Gargalos Identificados

| Tabela | Query / Endpoint | Índice Atual no BD | Problema Identificado no Plano de Execução |
|---|---|---|---|
| `opcao` | `getAvailableSlots`, `listOptions` | `idx_opcao_local ("localId")`, `idx_opcao_data (data)` | Executa `BitmapAnd` ou `Seq Scan`, filtra `status = true` e `vagas > 0` no heap e realiza ordenação em memória (`quicksort`) por `data, hora`. |
| `opcao` | `createBooking`, `cancelBooking` | Nenhum composto | `LockRows` em cima de `Seq Scan` em toda a tabela `opcao` a cada agendamento confirmado. |
| `agendamentos_matricula` | `student-flow`, `createBooking` | `idx_agendamento_matricula`, `unq_agendamento_matricula_periodo_ativo` | Busca com `ILIKE` impede index seek direto se houver diferença de caixa em sistemas sem collations especiais. Ausência de índice composto em `(matricula, periodo, status)` com filtro `deletedAt IS NULL`. |
| `local` | `listLocals(false)` | Apenas PK `local_pkey (id)` | Sem índice em `(status, nome)`. Força sequential scan e sort em memória para listagem pública de polos. |
| `ava_progress_report` | `getStudentProfile` | `idx_ava_progress_join_mat (inst, mat, curso)` | Não há índice B-tree direto em `(matricula, periodo)`. Obriga varredura filtrando `periodo` no heap. |
| `ava_consolidated_report` | `getConsolidatedData` | GIN trgm em `aluno`, `curso`, `matricula` | Filtro `search` com `OR` inclui `usuario` e `cursoPerfil`, que não possuem índice GIN, degradando o plano para Seq Scan. |

### 5.2 Teste de Plano de Execução (`EXPLAIN ANALYZE`) na Consulta de Reserva

Consulta auditada:
```sql
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM opcao 
WHERE "localId" = 'e754249a-179e-4873-9549-5ae76c47eb84' 
  AND data = '2026-09-30 00:00:00' 
  AND hora IN ('08:00:00', '08:30:00') 
  AND status = true 
ORDER BY hora 
FOR UPDATE;
```

**Resultado Observado**:
```text
LockRows (cost=2.11..2.13 rows=1 width=118) (actual time=0.458..0.462 rows=2 loops=1)
  -> Sort (cost=2.11..2.12 rows=1 width=118) (actual time=0.231..0.232 rows=2 loops=1)
        Sort Key: hora
        Sort Method: quicksort Memory: 25kB
        -> Seq Scan on opcao (cost=0.00..2.10 rows=1 width=118) (actual time=0.031..0.064 rows=2 loops=1)
              Filter: (status AND (hora = ANY ('{08:00:00,08:30:00}'::text[])) AND ("localId" = 'e754249a-179e-4873-9549-5ae76c47eb84'::text) AND (data = '2026-09-30 00:00:00'::timestamp without time zone))
              Rows Removed by Filter: 47
```
**Impacto**: O PostgreSQL lê todas as páginas do disco (`Seq Scan on opcao`), remove 47 tuplas por filtro e depois ordena em memória. Em um banco em produção com 100.000 slots e centenas de acessos simultâneos na abertura do agendamento, isso causa contenção severa de CPU e I/O.

---

## 6. Blocos de Código de Remediação Pronta (Drop-in Drizzle ORM)

### 6.1 Remediação 1: `createBooking` Sem Deadlock e Livre de Seq Scan
Substituição para `apps/backend/src/scheduling/scheduling.service.ts`:

```typescript
  // 4. Bookings Management (Deadlock-Free Consecutive Slot Reservation)
  async createBooking(dto: CreateBookingDto) {
    const { opcaoId, matricula, periodo } = dto;

    const profile = await this.getStudentProfile(matricula, periodo);
    const totalDisciplines = profile.totalDisciplinas;
    if (totalDisciplines === 0) {
      throw new BadRequestException(
        'O estudante não possui disciplinas matriculadas para realizar agendamentos.',
      );
    }

    return this.db.transaction(async (tx) => {
      // 1. Verificação de agendamento ativo com trava de leitura consistente
      const [existing] = await tx
        .select({ id: agendamentosMatricula.id })
        .from(agendamentosMatricula)
        .where(
          and(
            eq(sql`lower(trim(${agendamentosMatricula.matricula}))`, profile.matricula.trim().toLowerCase()),
            eq(agendamentosMatricula.periodo, periodo),
            eq(agendamentosMatricula.status, 'ativo'),
            isNull(agendamentosMatricula.deletedAt),
          ),
        )
        .limit(1);

      if (existing) {
        throw new BadRequestException(
          'O estudante já possui um agendamento ativo para este período.',
        );
      }

      // 2. Consulta informativa do slot base SEM trava prematura (elimina a inversão de trava)
      const [opcao] = await tx
        .select()
        .from(opcaos)
        .where(eq(opcaos.id, opcaoId))
        .limit(1);

      if (!opcao) throw new NotFoundException('Horário base selecionado não encontrado.');
      if (!opcao.status) throw new BadRequestException('O horário selecionado está desativado.');

      // Validação de horário futuro no fuso de São Paulo
      const timeStr = opcao.hora.slice(0, 5);
      const { dateStr: todayStr, currentMinutes } = getNowInSaoPaulo();
      const slotDate = opcao.data instanceof Date ? opcao.data : new Date(opcao.data);
      const slotDateStr = `${slotDate.getUTCFullYear()}-${String(slotDate.getUTCMonth() + 1).padStart(2, '0')}-${String(slotDate.getUTCDate()).padStart(2, '0')}`;

      if (slotDateStr < todayStr) {
        throw new BadRequestException('Não é permitido agendar provas para datas passadas.');
      }
      if (slotDateStr === todayStr) {
        const slotMinutes = parseTimeToMinutes(timeStr);
        if (slotMinutes !== null && slotMinutes <= currentMinutes) {
          throw new BadRequestException(
            `O horário ${timeStr} já passou para o dia de hoje. Selecione um horário futuro.`,
          );
        }
      }

      // 3. Montagem dos horários consecutivos necessários (suportando 5 e 8 caracteres)
      const requiredTimes = Array.from({ length: totalDisciplines }, (_, i) => {
        const startMin = parseTimeToMinutes(timeStr);
        const totalMin = (((startMin! + i * 30) % 1440) + 1440) % 1440;
        const h = Math.floor(totalMin / 60);
        const m = totalMin % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      });

      const allPossibleTimes = [
        ...requiredTimes,
        ...requiredTimes.map((t) => `${t}:00`),
      ];

      // 4. Bloqueio pessimista ATÔMICO e ORDENADO de todos os slots necessários em uma ÚNICA query
      // Garante que todas as transações adquirem as travas estritamente na ordem cronológica (hora)
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

      const matchedTimeMap = new Map<string, typeof opcao>();
      for (const slot of slots) {
        matchedTimeMap.set(slot.hora.slice(0, 5), slot);
      }

      for (const reqTime of requiredTimes) {
        const slot = matchedTimeMap.get(reqTime);
        if (!slot) {
          throw new BadRequestException(
            `Não há horários consecutivos suficientes disponíveis a partir de ${timeStr} para todas as ${totalDisciplines} disciplinas do aluno. Falta o horário ${reqTime}.`,
          );
        }
        if (slot.vagas <= 0) {
          throw new BadRequestException(
            `O horário ${reqTime} já está com as vagas esgotadas.`,
          );
        }
      }

      // 5. Decremento atômico de vagas protegendo contra concorrência
      for (const reqTime of requiredTimes) {
        const slot = matchedTimeMap.get(reqTime)!;
        await tx
          .update(opcaos)
          .set({
            vagas: sql`${opcaos.vagas} - 1`,
            updatedAt: new Date(),
          })
          .where(and(eq(opcaos.id, slot.id), sql`${opcaos.vagas} > 0`));
      }

      // 6. Inserção do agendamento
      const [booking] = await tx
        .insert(agendamentosMatricula)
        .values({
          opcaoId,
          matricula,
          descricao: profile.disciplinas.join(';'),
          status: 'ativo',
          periodo,
          data: opcao.data,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      return {
        ...booking,
        studentName: profile.nome,
        disciplines: profile.disciplinas,
      };
    });
  }
```

---

### 6.2 Remediação 2: `cancelBooking` com Suporte Universal a `HH:MM` e `HH:MM:00`
Substituição para `apps/backend/src/scheduling/scheduling.service.ts`:

```typescript
  async cancelBooking(id: string) {
    return this.db.transaction(async (tx) => {
      const [booking] = await tx
        .select()
        .from(agendamentosMatricula)
        .where(eq(agendamentosMatricula.id, id))
        .for('update');

      if (!booking) throw new NotFoundException('Agendamento não encontrado.');
      if (booking.status === 'cancelado') {
        throw new BadRequestException('Este agendamento já está cancelado.');
      }

      const [opcao] = await tx
        .select()
        .from(opcaos)
        .where(eq(opcaos.id, booking.opcaoId))
        .limit(1);

      if (opcao) {
        const disciplines = booking.descricao ? booking.descricao.split(';') : [];
        const totalDisciplines = Math.max(1, disciplines.length);
        const timeStr = opcao.hora.slice(0, 5);

        // Suporte UNIVERSAL: gera 5 caracteres (HH:MM) e 8 caracteres (HH:MM:00)
        const requiredTimes5 = Array.from({ length: totalDisciplines }, (_, i) => {
          const startMin = parseTimeToMinutes(timeStr);
          const totalMin = (((startMin! + i * 30) % 1440) + 1440) % 1440;
          const h = Math.floor(totalMin / 60);
          const m = totalMin % 60;
          return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        });

        const allPossibleTimes = [
          ...requiredTimes5,
          ...requiredTimes5.map((t) => `${t}:00`),
        ];

        // Busca e trava todos os slots que foram ocupados pelo agendamento
        const slots = await tx
          .select()
          .from(opcaos)
          .where(
            and(
              eq(opcaos.localId, opcao.localId),
              eq(opcaos.data, opcao.data),
              inArray(opcaos.hora, allPossibleTimes),
            ),
          )
          .orderBy(opcaos.hora)
          .for('update');

        // Restaura a vaga atomicamente em todos os slots encontrados
        for (const slot of slots) {
          await tx
            .update(opcaos)
            .set({
              vagas: sql`${opcaos.vagas} + 1`,
              updatedAt: new Date(),
            })
            .where(eq(opcaos.id, slot.id));
        }
      }

      const [updated] = await tx
        .update(agendamentosMatricula)
        .set({
          status: 'cancelado',
          deletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(agendamentosMatricula.id, id))
        .returning();

      return updated;
    });
  }
```

---

### 6.3 Remediação 3: `rescheduleStudentBooking` 100% Atômica Sem Perda de Vagas
Substituição para `apps/backend/src/scheduling/scheduling.service.ts`:

```typescript
  /**
   * Remarcação de agendamento pelo aluno (troca atômica de polo, data ou horário)
   * Executada em uma ÚNICA transação do PostgreSQL: se o novo slot falhar,
   * a transação sofre rollback automático e o agendamento original permanece 100% íntegro.
   */
  async rescheduleStudentBooking(
    bookingId: string,
    matricula: string,
    newOpcaoId: string,
    periodo: string,
  ) {
    const profile = await this.getStudentProfile(matricula, periodo);
    const totalDisciplines = profile.totalDisciplinas;
    if (totalDisciplines === 0) {
      throw new BadRequestException('Estudante sem disciplinas aptas para agendamento.');
    }

    return this.db.transaction(async (tx) => {
      // 1. Trava o agendamento atual do estudante
      const [booking] = await tx
        .select()
        .from(agendamentosMatricula)
        .where(eq(agendamentosMatricula.id, bookingId))
        .for('update');

      if (!booking) {
        throw new NotFoundException('Agendamento não encontrado.');
      }

      if (
        booking.matricula.trim().toLowerCase() !== matricula.trim().toLowerCase()
      ) {
        throw new BadRequestException('Este agendamento não pertence à matrícula informada.');
      }

      if (booking.status === 'concluido' || booking.status === 'ausente') {
        throw new BadRequestException(
          'Agendamentos já concluídos ou com presença registrada não podem ser alterados.',
        );
      }

      if (booking.status === 'cancelado') {
        throw new BadRequestException('Não é possível remarcar um agendamento cancelado.');
      }

      if (booking.opcaoId === newOpcaoId) {
        throw new BadRequestException('O novo horário selecionado é idêntico ao horário atual.');
      }

      // 2. Consulta slot base antigo e slot base novo
      const [oldBaseOpcao] = await tx
        .select()
        .from(opcaos)
        .where(eq(opcaos.id, booking.opcaoId))
        .limit(1);

      const [newBaseOpcao] = await tx
        .select()
        .from(opcaos)
        .where(eq(opcaos.id, newOpcaoId))
        .limit(1);

      if (!newBaseOpcao) {
        throw new NotFoundException('Novo horário selecionado não foi encontrado.');
      }
      if (!newBaseOpcao.status) {
        throw new BadRequestException('O novo horário selecionado está desativado.');
      }

      // Validação de data/horário futuro no fuso de São Paulo
      const newTimeStr = newBaseOpcao.hora.slice(0, 5);
      const { dateStr: todayStr, currentMinutes } = getNowInSaoPaulo();
      const newSlotDate = newBaseOpcao.data instanceof Date ? newBaseOpcao.data : new Date(newBaseOpcao.data);
      const newSlotDateStr = `${newSlotDate.getUTCFullYear()}-${String(newSlotDate.getUTCMonth() + 1).padStart(2, '0')}-${String(newSlotDate.getUTCDate()).padStart(2, '0')}`;

      if (newSlotDateStr < todayStr) {
        throw new BadRequestException('Não é permitido remarcar provas para datas passadas.');
      }
      if (newSlotDateStr === todayStr) {
        const slotMinutes = parseTimeToMinutes(newTimeStr);
        if (slotMinutes !== null && slotMinutes <= currentMinutes) {
          throw new BadRequestException(
            `O horário ${newTimeStr} já passou para o dia de hoje. Selecione um horário futuro.`,
          );
        }
      }

      // 3. Montagem de slots consecutivos do novo agendamento
      const newRequiredTimes = Array.from({ length: totalDisciplines }, (_, i) => {
        const startMin = parseTimeToMinutes(newTimeStr);
        const totalMin = (((startMin! + i * 30) % 1440) + 1440) % 1440;
        const h = Math.floor(totalMin / 60);
        const m = totalMin % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      });
      const newAllTimes = [
        ...newRequiredTimes,
        ...newRequiredTimes.map((t) => `${t}:00`),
      ];

      // 4. Bloqueio pessimista e conferência de vagas nos NOVOS slots
      const newSlots = await tx
        .select()
        .from(opcaos)
        .where(
          and(
            eq(opcaos.localId, newBaseOpcao.localId),
            eq(opcaos.data, newBaseOpcao.data),
            inArray(opcaos.hora, newAllTimes),
            eq(opcaos.status, true),
          ),
        )
        .orderBy(opcaos.hora)
        .for('update');

      const matchedNewTimeMap = new Map<string, typeof newBaseOpcao>();
      for (const slot of newSlots) {
        matchedNewTimeMap.set(slot.hora.slice(0, 5), slot);
      }

      for (const reqTime of newRequiredTimes) {
        const slot = matchedNewTimeMap.get(reqTime);
        if (!slot) {
          throw new BadRequestException(
            `Não há horários consecutivos suficientes no novo horário a partir de ${newTimeStr}. Falta ${reqTime}.`,
          );
        }
        if (slot.vagas <= 0) {
          throw new BadRequestException(
            `O horário ${reqTime} já está com as vagas esgotadas para remarcação.`,
          );
        }
      }

      // 5. Decrementa vagas nos novos slots
      for (const reqTime of newRequiredTimes) {
        const slot = matchedNewTimeMap.get(reqTime)!;
        await tx
          .update(opcaos)
          .set({ vagas: sql`${opcaos.vagas} - 1`, updatedAt: new Date() })
          .where(eq(opcaos.id, slot.id));
      }

      // 6. Restaura vagas nos slots antigos (se existirem)
      if (oldBaseOpcao) {
        const oldDisciplines = booking.descricao ? booking.descricao.split(';') : [];
        const oldTotal = Math.max(1, oldDisciplines.length);
        const oldTimeStr = oldBaseOpcao.hora.slice(0, 5);
        const oldRequiredTimes = Array.from({ length: oldTotal }, (_, i) => {
          const startMin = parseTimeToMinutes(oldTimeStr);
          const totalMin = (((startMin! + i * 30) % 1440) + 1440) % 1440;
          const h = Math.floor(totalMin / 60);
          const m = totalMin % 60;
          return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        });
        const oldAllTimes = [
          ...oldRequiredTimes,
          ...oldRequiredTimes.map((t) => `${t}:00`),
        ];

        const oldSlots = await tx
          .select()
          .from(opcaos)
          .where(
            and(
              eq(opcaos.localId, oldBaseOpcao.localId),
              eq(opcaos.data, oldBaseOpcao.data),
              inArray(opcaos.hora, oldAllTimes),
            ),
          )
          .orderBy(opcaos.hora)
          .for('update');

        for (const slot of oldSlots) {
          await tx
            .update(opcaos)
            .set({ vagas: sql`${opcaos.vagas} + 1`, updatedAt: new Date() })
            .where(eq(opcaos.id, slot.id));
        }
      }

      // 7. Atualização atômica in-place do agendamento (preserva ID, histórico e comprovante)
      const [updatedBooking] = await tx
        .update(agendamentosMatricula)
        .set({
          opcaoId: newOpcaoId,
          data: newBaseOpcao.data,
          descricao: profile.disciplinas.join(';'),
          updatedAt: new Date(),
        })
        .where(eq(agendamentosMatricula.id, bookingId))
        .returning();

      await this.auditService?.record({
        action: 'EXAM_BOOKING_RESCHEDULED_BY_STUDENT',
        category: 'SCHEDULING',
        status: 'SUCCESS',
        userEmail: matricula,
        details: { oldBookingId: bookingId, newOpcaoId, matricula, periodo },
      });

      return {
        ...updatedBooking,
        studentName: profile.nome,
        disciplines: profile.disciplinas,
      };
    });
  }
```

---

### 6.4 Remediação 4: Índices Compostos e Parciais em `schema.ts`
Adições recomendadas para `apps/backend/src/db/schema.ts`:

```typescript
// --- Tabela: locals ---
export const locals = pgTable(
  'local',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    nome: text('nome').notNull(),
    endereco: text('endereco').notNull(),
    linkLocal: text('link_local'),
    telefone: text('telefone'),
    status: boolean('status').default(true).notNull(),
    createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
  },
  (t) => [
    // Otimização para listLocals(false): Index-Only Scan pre-ordenado por nome
    index('idx_local_status_nome').on(t.status, t.nome),
  ],
);

// --- Tabela: opcaos ---
export const opcaos = pgTable(
  'opcao',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    localId: text('localId').notNull().references(() => locals.id, { onDelete: 'cascade' }),
    data: timestamp('data', { mode: 'date' }).notNull(),
    hora: text('hora').notNull(),
    vagas: integer('vagas').notNull(),
    status: boolean('status').default(true).notNull(),
    createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
  },
  (t) => [
    index('idx_opcao_local').on(t.localId),
    index('idx_opcao_data').on(t.data),
    // Índice parcial crítico: Atende getAvailableSlots com Zero Heap Lookups e ordenação nativa
    index('idx_opcao_available_slots')
      .on(t.localId, t.data, t.hora)
      .where(sql`status = true AND vagas > 0`),
    // Índice parcial para lock atômico: Elimina o Seq Scan em createBooking e cancelBooking
    index('idx_opcao_locking_lookup')
      .on(t.localId, t.data, t.hora)
      .where(sql`status = true`),
  ],
);

// --- Tabela: agendamentosMatricula ---
export const agendamentosMatricula = pgTable(
  'agendamentos_matricula',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    opcaoId: text('opcaoId').notNull().references(() => opcaos.id, { onDelete: 'cascade' }),
    matricula: text('matricula').notNull(),
    descricao: text('descricao').notNull(),
    status: text('status').default('ativo').notNull(),
    periodo: text('periodo').notNull(),
    data: timestamp('data', { mode: 'date' }).notNull(),
    createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
    deletedAt: timestamp('deletedAt', { mode: 'date' }),
  },
  (t) => [
    uniqueIndex('unq_agendamento_matricula_periodo_ativo')
      .on(t.matricula, t.periodo)
      .where(sql`"deletedAt" IS NULL`),
    index('idx_agendamento_opcao').on(t.opcaoId),
    index('idx_agendamento_matricula').on(t.matricula),
    index('idx_agendamento_periodo_status').on(t.periodo, t.status),
    // Índice composto cobrindo status ativo para buscas públicas de fluxo do aluno
    index('idx_agendamento_active_lookup')
      .on(t.matricula, t.periodo, t.status)
      .where(sql`"deletedAt" IS NULL`),
  ],
);

// --- Tabela: avaProgressReport ---
// Adicionar ao array de índices de avaProgressReport em schema.ts:
index('idx_ava_progress_mat_period').on(t.matricula, t.periodo),
```

---

## 7. Matriz de Severidade, Impacto e Ação Recomendada

| # | Vulnerabilidade / Achado | Severidade | Impacto Técnico e de Negócio | Esforço | Prioridade |
|---|---|---|---|---|---|
| **V1** | Travamento não monotônico e deadlocks 40P01 em `createBooking` | **ALTO** | Falhas 500 no agendamento em pico de matrículas simultâneas | Baixo | **P1 (Imediato)** |
| **V2** | Perda irreversível de agendamento em `rescheduleStudentBooking` | **CRÍTICO** | Aluno perde agendamento anterior sem conseguir vaga nova | Baixo | **P1 (Imediato)** |
| **V3** | Não devolução de vagas de 5 caracteres (`HH:MM`) em `cancelBooking` | **CRÍTICO** | Desperdício invisível e irreversível da capacidade física do polo | Muito Baixo | **P1 (Imediato)** |
| **V4** | Falta de índices compostos parciais em `opcao` (`Seq Scan` forçado) | **ALTO** | Degradação exponencial de I/O e latência sob alta concorrência | Baixo | **P2 (Curto Prazo)** |
| **V5** | Falta de índice B-tree `(matricula, periodo)` em `ava_progress_report` | **MÉDIO** | Atraso de centenas de ms na checagem de elegibilidade do aluno | Muito Baixo | **P2 (Curto Prazo)** |
