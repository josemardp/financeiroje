# FinanceAI - Script de Setup Supabase + Vercel
# Execute: .\setup-supabase.ps1

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  FinanceAI - Setup Supabase + Vercel" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# ETAPA 1 - Verificar/Instalar Supabase CLI
Write-Host "Etapa 1/7 - Verificando Supabase CLI..." -ForegroundColor Yellow

$supabaseFound = $false
try {
    $v = & supabase --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        $supabaseFound = $true
        Write-Host "  OK - Supabase CLI: $v" -ForegroundColor Green
    }
} catch {
    $supabaseFound = $false
}

if (-not $supabaseFound) {
    Write-Host "  Supabase CLI nao encontrado. Instalando via Scoop..." -ForegroundColor Gray

    $scoopFound = $false
    try {
        & scoop --version 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) { $scoopFound = $true }
    } catch {}

    if (-not $scoopFound) {
        Write-Host "  Instalando Scoop..." -ForegroundColor Gray
        Invoke-RestMethod get.scoop.sh | Invoke-Expression
    }

    & scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
    & scoop install supabase

    $v = & supabase --version 2>&1
    Write-Host "  OK - Supabase CLI instalado: $v" -ForegroundColor Green
}

# ETAPA 2 - Login no Supabase
Write-Host ""
Write-Host "Etapa 2/7 - Login no Supabase..." -ForegroundColor Yellow
Write-Host "  O navegador sera aberto para autenticar." -ForegroundColor Gray
Read-Host "  Pressione Enter para continuar"
& supabase login

# ETAPA 3 - Dados do projeto
Write-Host ""
Write-Host "Etapa 3/7 - Dados do seu projeto Supabase" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Acesse: https://supabase.com/dashboard" -ForegroundColor Gray
Write-Host "  O Project ID esta na URL do projeto" -ForegroundColor Gray
Write-Host "  Ex: supabase.com/dashboard/project/abcdef123456" -ForegroundColor Gray
Write-Host ""

$PROJECT_ID = Read-Host "  Cole seu Project ID"
$OPENAI_KEY = Read-Host "  Cole sua OpenAI API Key"

if (-not $PROJECT_ID) {
    Write-Host "  ERRO: Project ID nao pode ser vazio." -ForegroundColor Red
    exit 1
}

if (-not $OPENAI_KEY) {
    Write-Host "  ERRO: OpenAI API Key nao pode ser vazia." -ForegroundColor Red
    exit 1
}

# ETAPA 4 - Linkar projeto
Write-Host ""
Write-Host "Etapa 4/7 - Linkando projeto Supabase..." -ForegroundColor Yellow

Set-Location $PSScriptRoot
& supabase link --project-ref $PROJECT_ID

if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERRO ao linkar projeto. Verifique o Project ID." -ForegroundColor Red
    exit 1
}
Write-Host "  OK - Projeto linkado." -ForegroundColor Green

# ETAPA 5 - Migrations
Write-Host ""
Write-Host "Etapa 5/7 - Aplicando migrations no banco de dados..." -ForegroundColor Yellow

& supabase db push

if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERRO ao aplicar migrations." -ForegroundColor Red
    exit 1
}
Write-Host "  OK - Schema criado (9 migrations)." -ForegroundColor Green

# ETAPA 6 - Secrets e Edge Functions
Write-Host ""
Write-Host "Etapa 6/7 - Secrets e deploy das Edge Functions..." -ForegroundColor Yellow

& supabase secrets set OPENAI_API_KEY=$OPENAI_KEY

if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERRO ao configurar secret." -ForegroundColor Red
    exit 1
}
Write-Host "  OK - OPENAI_API_KEY configurado." -ForegroundColor Green

$functions = @("smart-capture-ocr", "smart-capture-voice", "smart-capture-interpret", "ai-advisor", "finance-engine")
foreach ($fn in $functions) {
    Write-Host "  Deploying: $fn..." -ForegroundColor Gray
    & supabase functions deploy $fn --no-verify-jwt
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  OK - $fn" -ForegroundColor Green
    } else {
        Write-Host "  AVISO: falha no deploy de $fn" -ForegroundColor Yellow
    }
}

# ETAPA 7 - .env.local
Write-Host ""
Write-Host "Etapa 7/7 - Gerando .env.local..." -ForegroundColor Yellow
Write-Host ""
Write-Host "  Acesse: https://supabase.com/dashboard/project/$PROJECT_ID/settings/api" -ForegroundColor Gray
$ANON_KEY = Read-Host "  Cole a 'anon public' key do seu projeto"

$line1 = "VITE_SUPABASE_URL=https://$PROJECT_ID.supabase.co"
$line2 = "VITE_SUPABASE_PUBLISHABLE_KEY=$ANON_KEY"

Set-Content -Path ".env.local" -Value $line1 -Encoding UTF8
Add-Content -Path ".env.local" -Value $line2 -Encoding UTF8

Write-Host "  OK - .env.local criado." -ForegroundColor Green

# RESUMO
Write-Host ""
Write-Host "======================================" -ForegroundColor Green
Write-Host "  Setup concluido!" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Proximos passos:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  1. Testar localmente:" -ForegroundColor White
Write-Host "     npm install" -ForegroundColor Gray
Write-Host "     npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. Deploy no Vercel:" -ForegroundColor White
Write-Host "     a) https://vercel.com/new" -ForegroundColor Gray
Write-Host "     b) Importar repo: josemardp/financeiroje" -ForegroundColor Gray
Write-Host "     c) Environment Variables:" -ForegroundColor Gray
Write-Host "        VITE_SUPABASE_URL = https://$PROJECT_ID.supabase.co" -ForegroundColor Gray
Write-Host "        VITE_SUPABASE_PUBLISHABLE_KEY = (sua anon key)" -ForegroundColor Gray
Write-Host "     d) Clicar Deploy" -ForegroundColor Gray
Write-Host ""
