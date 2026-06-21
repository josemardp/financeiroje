# setup-backup-task.ps1
# Cria a tarefa agendada do FinanceiroJe e salva resultado em log.

$logPath = "c:\projetos\financeiroje\scripts\setup-task-log.txt"
$output  = @()
$output += "=== FinanceiroJe — Setup Backup Task ==="
$output += "Executado em: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
$output += ""

try {
    $action = New-ScheduledTaskAction `
        -Execute "pwsh.exe" `
        -Argument "-NonInteractive -ExecutionPolicy Bypass -File `"c:\projetos\financeiroje\scripts\backup-supabase.ps1`" -ConfigPath `"c:\projetos\financeiroje\scripts\backup-config.local.json`""

    $trigger = New-ScheduledTaskTrigger -Daily -At "02:00"

    $settings = New-ScheduledTaskSettingsSet `
        -StartWhenAvailable `
        -ExecutionTimeLimit (New-TimeSpan -Hours 1) `
        -MultipleInstances IgnoreNew

    Register-ScheduledTask `
        -TaskName "FinanceiroJe — Backup Diário Supabase" `
        -Action   $action `
        -Trigger  $trigger `
        -Settings $settings `
        -RunLevel Highest `
        -Force | Out-Null

    $task = Get-ScheduledTask -TaskName "FinanceiroJe — Backup Diário Supabase" `
            | Select-Object TaskName, State

    $output += "STATUS: CRIADA COM SUCESSO"
    $output += "TaskName : $($task.TaskName)"
    $output += "State    : $($task.State)"

} catch {
    $output += "STATUS: ERRO"
    $output += "Detalhes: $_"
}

$output | Out-File -FilePath $logPath -Encoding UTF8 -Force
