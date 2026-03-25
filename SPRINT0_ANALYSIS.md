# Sprint 0: Análise Completa do Estado Atual do FinanceAI

## 1. LÓGICA CRÍTICA ENCONTRADA NO FRONTEND

### 1.1 Alertas.tsx (Linha 76-173)
- **Orquestração completa**: Busca dados, mapeia para tipos da engine, filtra oficiais, calcula resumo, desvio orçamentário, previsão de caixa, indicadores de dívida
- **Problema**: Toda essa lógica deveria estar em uma Edge Function ou API backend
- **Impacto**: Duplicação de código com HealthScore.tsx, Dashboard.tsx, MonthlyClosing.tsx

### 1.2 HealthScore.tsx (Linha 24-88)
- **Cálculo crítico no cliente**: Mapeia transações, budgets, loans, installments; filtra oficiais; calcula score
- **Problema**: Score é um KPI crítico que deveria ser determinístico no backend
- **Impacto**: Possibilidade de inconsistência se o frontend recalcular

### 1.3 Accounts.tsx (Linha 56-76)
- **Saldo de contas no cliente**: Soma manual de transações confirmadas por account_id
- **Problema**: Saldo é um valor crítico que deveria ser calculado no backend
- **Impacto**: Risco de desincronização com dados reais

### 1.4 Dashboard.tsx
- **Agregações múltiplas**: Saldos de contas, metas em risco, reserva de emergência
- **Problema**: Múltiplas orquestração de dados no cliente
- **Impacto**: Dificuldade de manutenção e consistência

### 1.5 MonthlyClosing.tsx (Linha 135-189)
- **Snapshot de fechamento**: Calcula budget, score, pendências no cliente antes de persistir
- **Problema**: Snapshots críticos de auditoria sendo montados no frontend
- **Impacto**: Falta de garantia de integridade dos dados persistidos

## 2. MAPEAMENTO DE TIPOS E CONTRATOS

### 2.1 Estados de Dados (Já Padronizados ✓)
- confirmed
- suggested
- incomplete
- inconsistent
- missing
- estimated

### 2.2 Escopos (Já Padronizados ✓)
- private
- family
- business

### 2.3 Metadados de Rastreabilidade (FALTANDO ✗)
- source/origin: Parcialmente em TransactionRaw (source_type, confidence)
- created_by: NÃO EXISTE
- updated_by: NÃO EXISTE
- created_at: Existe em algumas tabelas
- updated_at: Existe em algumas tabelas

## 3. INCONSISTÊNCIAS ENCONTRADAS

### 3.1 Saldo de Contas
- Dashboard usa: saldo_inicial + transações confirmadas
- Accounts.tsx usa: saldo_inicial + transações confirmadas
- Regra: "confirmed + null = official" (PHASE 4.2)

### 3.2 Reserva de Emergência
- Settings.tsx: Campo de "renda mensal" com placeholder "Usada para cálculo de cobertura"
- Dashboard/MonthlyClosing/contextCollector: Usam despesa mensal para cobertura, não renda
- **CONFLITO**: Qual é a regra correta?

### 3.3 Mapeamento de Dados
- Alerts.tsx: Mapeia transações, budgets, loans, installments manualmente
- HealthScore.tsx: Mapeia transações, budgets, loans, installments manualmente
- MonthlyClosing.tsx: Mapeia transações, budgets, goals manualmente
- **DUPLICAÇÃO**: Mesmo contrato mapeado 3+ vezes

## 4. ESTRUTURA DE TIPOS ATUAL

### 4.1 Finance Engine (Bem Estruturado ✓)
- TransactionRaw
- BudgetRaw
- RecurringRaw
- LoanRaw
- InstallmentRaw
- ExtraAmortizationRaw
- GoalRaw
- GoalContributionRaw
- MonthlySummary
- BudgetDeviationResult
- HealthScoreResult
- CashflowForecastResult
- GoalProgressResult
- LoanIndicatorResult

### 4.2 AI Advisor Context (Bem Estruturado ✓)
- FinancialContext (Completo com metadados)
- AiResponseBlock
- AiStructuredResponse
- ChatMessage
- Conversation

### 4.3 Data Quality (Bem Estruturado ✓)
- DataQualityIssue
- DataQualityReport

## 5. FALTA DE PADRONIZAÇÃO

### 5.1 Metadados de Auditoria
- Nenhuma tabela tem created_by/updated_by explícito
- audit_logs existe mas não é usado em todas as entidades críticas
- Falta de rastreabilidade de quem criou/modificou cada registro

### 5.2 Contratos de Saída
- Cada página monta seus próprios contratos de saída
- Não existe um contrato único de "Financial Summary" ou "Financial Report"
- Exportação de dados (CSV) feita no frontend

### 5.3 Validação de Dados
- Nenhum tipo tem validação integrada (Zod schemas)
- Conversão de tipos feita manualmente em cada página
- Risco de inconsistência de tipos

## 6. RECOMENDAÇÕES PARA SPRINT 0

### 6.1 Criar Utilitários de Validação (Zod)
- Validar todos os tipos Raw do financeEngine
- Validar contratos de entrada/saída
- Criar schemas reutilizáveis

### 6.2 Consolidar Mapeamentos
- Criar função única para mapear transações
- Criar função única para mapear budgets
- Criar função única para mapear loans
- Reutilizar em todas as páginas

### 6.3 Criar Tipos de Saída Padronizados
- FinancialReport (resumo mensal)
- AlertsReport (relatório de alertas)
- HealthReport (relatório de score)
- AccountsReport (relatório de contas)

### 6.4 Adicionar Metadados de Rastreabilidade
- Estender tipos Raw com source, confidence, status
- Criar utilitários para rastreabilidade
- Documentar origem de cada dado

## 7. PRÓXIMAS SPRINTS

### Sprint 1: Migração de Lógica Crítica
1. Migrar orquestração de Alertas para Edge Function
2. Migrar cálculo de HealthScore para Edge Function
3. Migrar cálculo de saldo de contas para Edge Function

### Sprint 2: Auditoria Completa
1. Implementar created_by/updated_by em todas as entidades críticas
2. Criar sistema de versioning de dados críticos
3. Criar dashboard de qualidade de dados

### Sprint 3: Validação em Tempo Real
1. Integrar Zod em todas as operações
2. Criar middleware de validação
3. Implementar testes automáticos
