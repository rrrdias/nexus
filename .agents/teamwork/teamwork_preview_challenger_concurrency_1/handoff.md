# Handoff Report — Concurrency, Transactions & Booking Performance Audit (R2)

**Agent**: `teamwork_preview_challenger_concurrency_1` (EMPIRICAL CHALLENGER / Critic / Specialist)  
**Parent Conversation ID**: `27e91390-bd43-444c-a451-05eaa934d0b8`  
**Milestone**: R2 — Concurrency, Transactions & Booking Performance Audit  
**Type**: Hard Handoff (Task Complete)

---

## 1. Observation

1. **`apps/backend/src/scheduling/scheduling.service.ts` (Linhas 650–711)**:
   ```typescript
   // Linhas 651-655:
   const [opcao] = await tx
     .select()
     .from(opcaos)
     .where(eq(opcaos.id, opcaoId))
     .for('update');
   // Linhas 699-711:
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

2. **`apps/backend/src/scheduling/scheduling.service.ts` (Linhas 1621–1653)**:
   ```typescript
   await this.cancelBooking(bookingId);
   try {
     const newBooking = await this.createBooking({
       opcaoId: newOpcaoId,
       matricula,
       periodo,
     });
     return newBooking;
   } catch (err: any) {
     try {
       await this.createBooking({
         opcaoId: booking.opcaoId,
         matricula,
         periodo,
       });
     } catch {}
     throw err;
   }
   ```

3. **`apps/backend/src/scheduling/scheduling.service.ts` (Linhas 787–805)**:
   ```typescript
   const timeStr = opcao.hora.slice(0, 5);
   const requiredTimes = Array.from({ length: totalDisciplines }, (_, i) =>
     getNextTimeStr(timeStr, i),
   );
   const slots = await tx
     .select()
     .from(opcaos)
     .where(
       and(
         eq(opcaos.localId, opcao.localId),
         eq(opcaos.data, opcao.data),
         inArray(opcaos.hora, requiredTimes),
       ),
     )
     .orderBy(opcaos.hora)
     .for('update');
   ```
   Onde `getNextTimeStr` (linhas 59–72) formata exclusivamente:
   `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`.

4. **Resultado de Execução Empírica no PostgreSQL 16 (Porta 5433)**:
   - *Teste de Restauração 5-char*: Slot com `hora = '10:00'` consultado por `inArray(opcaos.hora, ['10:00:00'])` retornou `0` registros. `vagas` permaneceu em `4` (esperado: `5`).
   - *Teste de Reschedule*: Falha na reserva do novo horário gerou status `cancelado` no agendamento original com `deletedAt = NOW()`, sem agendamento ativo resultante.
   - *Teste de Concorrência*: Duas transações simultâneas adquirindo travas em ordem não monotônica dispararam o erro:
     `Postgres Deadlock Detected! Error code: 40P01 - deadlock detected`.

5. **`EXPLAIN (ANALYZE, BUFFERS)` na tabela `opcao`**:
   ```text
   LockRows (cost=2.11..2.13 rows=1 width=118) (actual time=0.458..0.462 rows=2 loops=1)
     -> Sort (cost=2.11..2.12 rows=1 width=118)
           Sort Key: hora
           -> Seq Scan on opcao (cost=0.00..2.10 rows=1 width=118)
                 Filter: (status AND (hora = ANY ('{08:00:00,08:30:00}'::text[])) AND ("localId" = '...'::text) AND (data = '...'::timestamp))
                 Rows Removed by Filter: 47
   ```

---

## 2. Logic Chain

1. **Da Observação 1 e 4 para a vulnerabilidade de Deadlocks**:
   - `createBooking` adquire uma trava exclusiva (`FOR UPDATE`) sobre `opcaoId` antes de identificar ou ordenar todos os slots consecutivos necessários.
   - Se duas transações $Tx_1$ e $Tx_2$ tiverem slots base distintos que se sobrepõem no tempo (ex: $Tx_1$ inicia às 10:00 e requer 10:30; $Tx_2$ inicia às 10:30 e requer 10:00 em remarcação ou varredura não indexada), $Tx_1$ obtém a trava de 10:00 e aguarda 10:30, enquanto $Tx_2$ obtém a trava de 10:30 e aguarda 10:00.
   - Esse entrelaçamento viola o Teorema de Coffman/Dijkstra de aquisição ordenada de recursos, gerando o ciclo de espera mútuo comprovado no erro `40P01 (deadlock_detected)`.

2. **Da Observação 2 e 4 para a perda irreversível de agendamento**:
   - `rescheduleStudentBooking` finaliza e comita a transação de cancelamento antes de iniciar a transação de nova reserva.
   - A vaga do horário original é liberada publicamente antes que a disponibilidade do novo horário seja garantida.
   - Sob concorrência no mesmo polo, um terceiro estudante pode reservar a vaga antiga imediatamente após a liberação.
   - Quando `createBooking` no novo horário é rejeitado (vagas esgotadas), o bloco de rollback tenta re-reservar o horário antigo, que agora também está esgotado.
   - O agendamento permanece cancelado no banco de dados e o aluno perde sua vaga definitivamente.

3. **Da Observação 3 e 4 para o vazamento de vagas em `cancelBooking`**:
   - A coluna `hora` na tabela `opcao` é do tipo `text`.
   - `createOptionDto` valida `horaInicio` no formato `HH:MM` (5 caracteres), enquanto `getNextTimeStr` gera `HH:MM:00` (8 caracteres).
   - O operador SQL `IN ('10:00:00')` não casa com tuplas contendo `'10:00'`.
   - O loop de incremento de `vagas` itera sobre uma lista vazia. As vagas nunca retornam ao inventário, reduzindo progressivamente a capacidade do polo até a exaustão artificial.

4. **Da Observação 5 para os gargalos de I/O e contenção**:
   - A tabela `opcao` conta apenas com índices unicolunares (`id`, `localId`, `data`).
   - A query de agendamento filtra simultaneamente por `localId`, `data`, `status` e `hora`.
   - O otimizador do PostgreSQL é forçado a executar `Seq Scan` em toda a tabela, lendo e descartando páginas desnecessárias antes da ordenação e aplicação de `LockRows`.

---

## 3. Caveats

1. O teste de concorrência foi validado em uma instância PostgreSQL 16 standalone no ambiente Docker oficial do projeto. Em arquiteturas com replicação primário-réplica, leituras com `FOR UPDATE` devem sempre ser roteadas ao primário (o que já é o comportamento padrão do pool `node-postgres` configurado).
2. Não foi detectada necessidade de travamento a nível de polo (`local`), uma vez que o ordenamento consistente de slots cronológicos por data/hora já garante a exclusão mútua necessária sem serializar o polo inteiro.

---

## 4. Conclusion

O subsistema de agendamento apresenta vulnerabilidades críticas de concorrência e integridade referencial que impactam diretamente os estudantes em períodos de pico. As soluções exigem:
1. Eliminar o travamento prévio do slot base em `createBooking`, passando a travar todos os slots necessários (base + consecutivos) em uma **única query estritamente ordenada por `hora`**.
2. Encapsular toda a remarcação (`rescheduleStudentBooking`) dentro de uma **única transação atômica** do Drizzle ORM, realizando a troca de vagas in-place no mesmo registro de `agendamentos_matricula`.
3. Normalizar a busca de cancelamento para casar tanto `HH:MM` quanto `HH:MM:00`.
4. Aplicar índices parciais compostos em `opcao` (`idx_opcao_available_slots` e `idx_opcao_locking_lookup`) e índice composto em `ava_progress_report (matricula, periodo)`.

Todos os blocos de código prontos para substituição direta (drop-in) foram documentados e disponibilizados no relatório `concurrency_audit.md`.

---

## 5. Verification Method

Para verificar independentemente todas as constatações e resultados:

1. **Inspecionar o relatório completo**:
   `cat c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\teamwork_preview_challenger_concurrency_1\concurrency_audit.md`

2. **Verificar a incompatibilidade de formatos de hora no PostgreSQL**:
   ```powershell
   docker exec nexus_core_postgres psql -U admin -d core_db -c "SELECT ('10:00' IN ('10:00:00')) as match_check;"
   ```
   *Condição de validação*: Retorna `f` (false), provando que `cancelBooking` falha silenciosamente para slots de 5 caracteres.

3. **Verificar o plano de execução (`Seq Scan`) no PostgreSQL**:
   ```powershell
   docker exec nexus_core_postgres psql -U admin -d core_db -c "EXPLAIN SELECT * FROM opcao WHERE \"localId\" = 'test' AND data = '2026-10-23' AND hora IN ('08:00:00', '08:30:00') AND status = true ORDER BY hora FOR UPDATE;"
   ```
   *Condição de validação*: Exibe `Seq Scan on opcao`, comprovando a ausência de índice composto cobrindo a query de bloqueio.
