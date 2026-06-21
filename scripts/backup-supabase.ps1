# backup-supabase.ps1
# Exporta tabelas críticas do Supabase para o Google Drive local.
# Requer: scripts\backup-config.local.json (não versionado — contém service_role_key)
# Agendar via Windows Task Scheduler para rodar diariamente.

param(
    [string]$ConfigPath = "$PSScriptRoot\backup-config.local.json"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# --- Config ---
if (-not (Test-Path $ConfigPath)) {
    Write-Error "Config não encontrado: $ConfigPath`nCopie backup-config.local.json.example e preencha."
    exit 1
}
$cfg = Get-Content $ConfigPath -Raw | ConvertFrom-Json
$SUPABASE_URL    = $cfg.supabase_url
$SERVICE_KEY     = $cfg.service_role_key
$BACKUP_DIR      = $cfg.backup_dir
$RETENTION_DAYS  = if ($cfg.retention_days) { $cfg.retention_days } else { 30 }

# --- Tabelas a exportar ---
$TABLES = @(
    "transactions",
    "accounts",
    "categories",
    "goals",
    "goal_contributions",
    "budgets",
    "loans",
    "loan_installments",
    "recurring_transactions",
    "extra_amortizations",
    "profiles",
    "ai_coach_memory",
    "ai_conversations",
    "ai_messages",
    "user_patterns",
    "capture_learning_events",
    "user_ai_preferences",
    "ai_self_observations",
    "decision_outcomes",
    "user_achievements",
    "user_streaks",
    "behavioral_tags",
    "weekly_digests",
    "alerts",
    "life_events",
    "family_values"
)

$headers = @{
    "apikey"        = $SERVICE_KEY
    "Authorization" = "Bearer $SERVICE_KEY"
    "Content-Type"  = "application/json"
}

# --- Exportar ---
$timestamp  = Get-Date -Format "yyyy-MM-dd_HH-mm"
$backupFile = Join-Path $BACKUP_DIR "backup_$timestamp.json"

Write-Host "[$timestamp] Iniciando backup — $($TABLES.Count) tabelas..."

$backup = [ordered]@{
    exported_at   = (Get-Date -Format "o")
    supabase_url  = $SUPABASE_URL
    tables        = [ordered]@{}
}

foreach ($table in $TABLES) {
    try {
        $uri  = "$SUPABASE_URL/rest/v1/${table}?select=*&limit=100000"
        $rows = Invoke-RestMethod -Uri $uri -Headers $headers -Method GET
        $backup.tables[$table] = $rows
        Write-Host "  ✓ $table ($($rows.Count) linhas)"
    } catch {
        Write-Warning "  ✗ $table — $_"
        $backup.tables[$table] = $null
    }
}

# --- Salvar ---
if (-not (Test-Path $BACKUP_DIR)) {
    New-Item -ItemType Directory -Path $BACKUP_DIR | Out-Null
}
$backup | ConvertTo-Json -Depth 20 -Compress | Out-File -FilePath $backupFile -Encoding UTF8
$sizeMB = [math]::Round((Get-Item $backupFile).Length / 1MB, 2)
Write-Host "Backup salvo: $backupFile ($sizeMB MB)"

# --- Purgar backups antigos ---
$removed = 0
Get-ChildItem $BACKUP_DIR -Filter "backup_*.json" |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$RETENTION_DAYS) } |
    ForEach-Object { Remove-Item $_.FullName; $removed++ }

if ($removed -gt 0) { Write-Host "Removidos $removed backup(s) com mais de $RETENTION_DAYS dias." }
Write-Host "Concluído."
