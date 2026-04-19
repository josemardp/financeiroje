# Sprint 0: Checklist de Validação Manual

## 1. VALIDAÇÃO DE TIPOS E SCHEMAS

### 1.1 Schemas Zod
- [ ] Abrir `src/services/financeEngine/schemas.ts`
- [ ] Verificar se todos os enums estão definidos
- [ ] Verificar se todos os schemas Raw estão presentes
- [ ] Verificar se todos os schemas de Output estão presentes
- [ ] Testar validação com dados válidos
- [ ] Testar validação com dados inválidos
- [ ] Verificar mensagens de erro

### 1.2 Tipos Exportados
- [ ] Verificar se todos os tipos estão exportados
- [ ] Verificar se não há conflitos de nomes
- [ ] Verificar se os tipos correspondem aos schemas

---

## 2. VALIDAÇÃO DE MAPEADORES

### 2.1 Mapeadores Individuais
- [ ] Testar `mapTransaction()` com dados reais
- [ ] Testar `mapBudget()` com dados reais
- [ ] Testar `mapRecurring()` com dados reais
- [ ] Testar `mapLoan()` com dados reais
- [ ] Testar `mapInstallment()` com dados reais
- [ ] Testar `mapExtraAmortization()` com dados reais
- [ ] Testar `mapGoal()` com dados reais
- [ ] Testar `mapGoalContribution()` com dados reais

### 2.2 Mapeadores em Lote
- [ ] Testar `mapTransactions()` com array vazio
- [ ] Testar `mapTransactions()` com múltiplos registros
- [ ] Testar `mapBudgets()` com dados nulos
- [ ] Testar `mapFinancialDataBatch()` com dados completos
- [ ] Testar `mapFinancialDataBatch()` com dados parciais

### 2.3 Conversão de Tipos
- [ ] Verificar se `Number()` funciona corretamente
- [ ] Verificar se valores nulos são preservados
- [ ] Verificar se categorias relacionadas são mapeadas
- [ ] Verificar se escopos são preservados

---

## 3. VALIDAÇÃO DE CONTRATOS

### 3.1 Estrutura de Contratos
- [ ] Abrir `src/services/financeEngine/contracts.ts`
- [ ] Verificar se `DataMetadata` está bem definido
- [ ] Verificar se todos os relatórios têm `period` e `scope`
- [ ] Verificar se todos os relatórios têm `metadata`
- [ ] Verificar se os tipos estão alinhados com outputs da engine

### 3.2 Relatórios Específicos
- [ ] Verificar `MonthlyReport` com dados reais
- [ ] Verificar `HealthReport` com dados reais
- [ ] Verificar `AlertsReport` com dados reais
- [ ] Verificar `AccountsReport` com dados reais
- [ ] Verificar `BudgetReport` com dados reais
- [ ] Verificar `ForecastReport` com dados reais
- [ ] Verificar `GoalsReport` com dados reais
- [ ] Verificar `DebtsReport` com dados reais
- [ ] Verificar `MonthlyClosingReport` com dados reais

---

## 4. VALIDAÇÃO DE METADADOS

### 4.1 Criação de Metadados
- [ ] Testar `createMetadata()` com source definido
- [ ] Testar `createMetadata()` com confidence definido
- [ ] Testar `createMetadata()` com status definido
- [ ] Testar `createMetadata()` com createdBy definido
- [ ] Verificar se timestamps são ISO 8601

### 4.2 Atualização de Metadados
- [ ] Testar `updateMetadata()` com status novo
- [ ] Testar `updateMetadata()` com confidence novo
- [ ] Verificar se `updatedAt` é atualizado
- [ ] Verificar se `createdAt` não muda

### 4.3 Inferência de Status
- [ ] Testar `inferDataStatus()` com dados completos
- [ ] Testar `inferDataStatus()` com dados incompletos
- [ ] Testar `inferDataStatus()` com conflitos
- [ ] Testar `inferDataStatus()` com estimativas

### 4.4 Inferência de Confiança
- [ ] Testar `inferConfidenceLevel()` com alta completude
- [ ] Testar `inferConfidenceLevel()` com média completude
- [ ] Testar `inferConfidenceLevel()` com baixa completude
- [ ] Testar `inferConfidenceLevel()` com confiança do usuário

### 4.5 Validação de Metadados
- [ ] Testar `validateMetadata()` com metadados válidos
- [ ] Testar `validateMetadata()` com metadados inválidos
- [ ] Verificar mensagens de erro

### 4.6 Qualidade de Metadados
- [ ] Testar `calculateMetadataQuality()` com metadados completos
- [ ] Testar `calculateMetadataQuality()` com metadados parciais
- [ ] Verificar se score está entre 0-100
- [ ] Verificar se level é um dos valores esperados

### 4.7 Agrupamento de Dados
- [ ] Testar `groupByStatus()` com múltiplos status
- [ ] Testar `groupBySource()` com múltiplas origens
- [ ] Testar `groupByConfidence()` com múltiplos níveis
- [ ] Verificar se todos os itens estão agrupados

### 4.8 Estatísticas de Metadados
- [ ] Testar `calculateMetadataStats()` com dados reais
- [ ] Verificar se contadores estão corretos
- [ ] Verificar se distribuição está correta
- [ ] Verificar se qualidade média está correta

### 4.9 Relatório de Rastreabilidade
- [ ] Testar `generateTraceabilityReport()` com metadados válidos
- [ ] Verificar se relatório contém todas as informações
- [ ] Verificar se formatação está legível

---

## 5. VALIDAÇÃO DE ÍNDICE

### 5.1 Exportações
- [ ] Verificar se `index.ts` exporta todas as funções
- [ ] Verificar se `index.ts` exporta todos os tipos
- [ ] Verificar se `index.ts` exporta todos os schemas
- [ ] Verificar se não há conflitos de nomes
- [ ] Testar importações de `@/services/financeEngine`

---

## 6. VALIDAÇÃO DE COMPATIBILIDADE

### 6.1 Compatibilidade com Código Existente
- [ ] Verificar se novos tipos não quebram tipos existentes
- [ ] Verificar se novos mapeadores funcionam com dados existentes
- [ ] Verificar se novos contratos são compatíveis com engine
- [ ] Testar com dados reais do banco

### 6.2 Compatibilidade com Páginas
- [ ] Verificar se `Alerts.tsx` ainda funciona
- [ ] Verificar se `HealthScore.tsx` ainda funciona
- [ ] Verificar se `Accounts.tsx` ainda funciona
- [ ] Verificar se `Dashboard.tsx` ainda funciona
- [ ] Verificar se `MonthlyClosing.tsx` ainda funciona

---

## 7. VALIDAÇÃO DE DOCUMENTAÇÃO

### 7.1 Análise de Sprint 0
- [ ] Verificar se `SPRINT0_ANALYSIS.md` está completo
- [ ] Verificar se identifica todos os problemas
- [ ] Verificar se recomendações estão claras

### 7.2 Padrões de Sprint 0
- [ ] Verificar se `SPRINT0_PATTERNS.md` está completo
- [ ] Verificar se exemplos funcionam
- [ ] Verificar se checklist está claro

### 7.3 Análise de Dívida Técnica
- [ ] Verificar se `SPRINT0_DEBT_ANALYSIS.md` está completo
- [ ] Verificar se todas as regras críticas estão listadas
- [ ] Verificar se ordem de migração está clara
- [ ] Verificar se riscos estão identificados

---

## 8. TESTES MANUAIS

### 8.1 Teste de Mapeamento Completo
```typescript
// Testar mapeamento de dados reais do Supabase
const { data: txns } = await supabase.from("transactions").select("*").limit(10);
const mapped = mapTransactions(txns);
console.log("Mapeamento OK:", mapped.length === txns.length);
```

### 8.2 Teste de Validação Completa
```typescript
// Testar validação com dados reais
const result = TransactionRawSchema.safeParse(mapped[0]);
console.log("Validação OK:", result.success);
```

### 8.3 Teste de Metadados Completos
```typescript
// Testar criação e validação de metadados
const metadata = createMetadata("manual", "alta", "confirmed", userId);
const validation = validateMetadata(metadata);
console.log("Metadados OK:", validation.valid);
```

### 8.4 Teste de Relatórios Completos
```typescript
// Testar geração de relatório completo
const report: MonthlyReport = {
  period: { month: 3, year: 2026 },
  scope: "private",
  official: summary,
  pending: { count: 0, totalValue: 0, byStatus: {} },
  dataQuality: { /* ... */ },
  metadata: createMetadata("system_generated", "alta", "confirmed"),
};
console.log("Relatório OK:", report.metadata.status === "confirmed");
```

---

## 9. TESTES DE PERFORMANCE

### 9.1 Tempo de Mapeamento
- [ ] Medir tempo de `mapTransactions()` com 1000 registros
- [ ] Medir tempo de `mapBudgets()` com 100 registros
- [ ] Medir tempo de `mapFinancialDataBatch()` com dados completos
- [ ] Verificar se tempo está aceitável (< 100ms)

### 9.2 Tamanho de Tipos
- [ ] Verificar se tipos não aumentam bundle size significativamente
- [ ] Verificar se schemas Zod não aumentam bundle size significativamente

---

## 10. TESTES DE SEGURANÇA

### 10.1 Validação de Entrada
- [ ] Testar com valores negativos
- [ ] Testar com valores muito grandes
- [ ] Testar com strings vazias
- [ ] Testar com valores nulos
- [ ] Testar com tipos incorretos

### 10.2 Validação de Metadados
- [ ] Testar se `createdBy` é validado
- [ ] Testar se `updatedBy` é validado
- [ ] Testar se timestamps são validados

---

## 11. TESTES DE INTEGRAÇÃO

### 11.1 Integração com Engine
- [ ] Testar se mapeadores funcionam com `calculateMonthlySummary`
- [ ] Testar se mapeadores funcionam com `calculateBudgetDeviation`
- [ ] Testar se mapeadores funcionam com `calculateHealthScore`
- [ ] Testar se mapeadores funcionam com `calculateCashflowForecast`

### 11.2 Integração com Supabase
- [ ] Testar se mapeadores funcionam com dados reais do Supabase
- [ ] Testar se schemas validam dados reais
- [ ] Testar se metadados funcionam com dados reais

---

## 12. TESTES DE EDGE CASES

### 12.1 Dados Vazios
- [ ] Testar com array vazio
- [ ] Testar com objeto vazio
- [ ] Testar com valores nulos

### 12.2 Dados Incompletos
- [ ] Testar com campos faltando
- [ ] Testar com valores parciais
- [ ] Testar com relacionamentos quebrados

### 12.3 Dados Inconsistentes
- [ ] Testar com tipos incorretos
- [ ] Testar com valores conflitantes
- [ ] Testar com datas inválidas

---

## 13. SIGN-OFF

- [ ] Todos os testes passaram
- [ ] Documentação está completa
- [ ] Código está limpo e bem comentado
- [ ] Não há warnings ou erros
- [ ] Performance está aceitável
- [ ] Segurança está garantida
- [ ] Compatibilidade está mantida

**Data de Conclusão:** _______________

**Responsável:** _______________

**Observações:**
```
[Espaço para observações adicionais]
```
