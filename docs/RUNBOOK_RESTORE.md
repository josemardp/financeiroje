# Runbook de Restauração — FinanceiroJe

**Quando usar:** perda de dados, corrupção de tabela, ou necessidade de reverter para estado anterior.

---

## 1. Localizar o backup

Pasta no Google Drive (sincronizada localmente):

```
G:\Meu Drive\Arquivos Josemar\projetos nao vercionados\financeiroje\
```

Arquivos: `backup_YYYY-MM-DD_HH-mm.json`
Retenção: 30 dias. Escolha o backup mais recente antes do incidente.

---

## 2. Inspecionar o backup

Abrir o JSON e confirmar que a tabela afetada tem dados:

```powershell
$b = Get-Content "G:\Meu Drive\Arquivos Josemar\projetos nao vercionados\financeiroje\backup_YYYY-MM-DD_HH-mm.json" | ConvertFrom-Json
$b.tables.transactions.Count   # substitua pelo nome da tabela
$b.tables.transactions[0]      # ver primeiro registro
```

---

## 3. Restaurar uma tabela específica

### Opção A — Restaurar linhas ausentes (merge seguro, recomendado)

Gera SQL de INSERT com ON CONFLICT DO NOTHING — não sobrescreve dados existentes:

```powershell
$b = Get-Content "G:\Meu Drive\...\backup_YYYY-MM-DD_HH-mm.json" | ConvertFrom-Json
$table = "transactions"   # altere conforme necessário
$rows = $b.tables.$table

$sqls = $rows | ForEach-Object {
    $cols = ($_.PSObject.Properties.Name | ForEach-Object { "`"$_`"" }) -join ", "
    $vals = ($_.PSObject.Properties.Value | ForEach-Object {
        if ($null -eq $_) { "NULL" }
        elseif ($_ -is [bool]) { $_.ToString().ToLower() }
        elseif ($_ -is [string]) { "'" + $_.Replace("'", "''") + "'" }
        else { $_ }
    }) -join ", "
    "INSERT INTO public.$table ($cols) VALUES ($vals) ON CONFLICT (id) DO NOTHING;"
}

$sqls | Out-File -FilePath "$env:TEMP\restore_$table.sql" -Encoding UTF8
Write-Host "SQL gerado: $env:TEMP\restore_$table.sql ($($sqls.Count) linhas)"
```

Depois: SQL Editor do Supabase → abrir `restore_$table.sql` → Run.

### Opção B — Restaurar tabela completa (sobrescreve tudo, use com cuidado)

```sql
-- Rodar no SQL Editor do Supabase
TRUNCATE TABLE public.transactions RESTART IDENTITY CASCADE;
-- Em seguida, colar o SQL gerado pela Opção A (sem o ON CONFLICT)
```

---

## 4. Verificar após restauração

```sql
-- Confirmar contagem de linhas
SELECT count(*) FROM public.transactions;

-- Confirmar data do registro mais recente
SELECT max(created_at) FROM public.transactions;
```

---

## 5. Tabelas por ordem de restauração (dependências)

Se precisar restaurar tudo, respeitar esta ordem para não violar foreign keys:

```
1. profiles
2. accounts, categories
3. transactions, recurring_transactions
4. loans → loan_installments, extra_amortizations
5. goals → goal_contributions
6. budgets
7. ai_conversations → ai_messages
8. ai_coach_memory, user_patterns, capture_learning_events
9. user_ai_preferences, ai_self_observations, decision_outcomes
10. user_achievements, user_streaks, behavioral_tags
11. weekly_digests, alerts, life_events, family_values
```

---

## 6. Teste semestral recomendado

1. Pegar o backup mais recente
2. Rodar o script da Opção A para `transactions` em ambiente de teste
3. Confirmar que os registros apareceram no Supabase
4. Fazer TRUNCATE para limpar o teste

Próximo teste sugerido: **Dezembro/2026**
