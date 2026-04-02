# ============================================================
# FinanceAI — Script de Setup Supabase + Vercel
# Execute no PowerShell do seu PC: .\setup-supabase.ps1
# ============================================================

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  FinanceAI — Setup Supabase + Vercel" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# ------------------------------------
# ETAPA 1 — Verificar Supabase CLI
# ------------------------------------
Write-Host "Etapa 1/7 — Verificando Supabase CLI..." -ForegroundColor Yellow

if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) {
    Write-Host "  Supabase CLI nao encontrado. Instalando via Scoop..." -ForegroundColor Gray
    if (-not (Get-Command scoop -ErrorAction SilentlyContinue)) {
        Write-Host "  Instalando Scoop..." -ForegroundColor Gray
        Set-ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
        Invoke-RestMethod get.scoop.sh | Invoke-Expression
    }
    scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
    scoop install supabase
}

$version = supabase --version
Write-Host "  OK — Supabase CLI: $version" -ForegroundColor Green

# ------------------------------------
# ETAPA 2 — Login no Supabase
# ------------------------------------
Write-Host ""
Write-Host "Etapa 2/7 — Login no Supabase..." -ForegroundColor Yellow
Write-Host "  Abrira o navegador para autenticar. Pressione Enter quando pronto." -ForegroundColor Gray
Read-Host "  Pressione Enter para continuar"
supabase login

# ------------------------------------
# ETAPA 3 — Solicitar dados do projeto
# ------------------------------------
Write-Host ""
Write-Host "Etapa 3/7 — Dados do seu projeto Supabase" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Acesse: https://supabase.com/dashboard" -ForegroundColor Gray
Write-Host "  Crie um novo projeto (ou use um existente)" -ForegroundColor Gray
Write-Host "  Copie o Project ID (ex: abcdefghijklmnop)" -ForegroundColor Gray
Write-Host ""

$PROJECT_ID = Read-Host "  Cole seu Project ID aqui"
$OPENAI_KEY = Read-Host "  Cole sua OpenAI API Key aqui"

if (-not $PROJECT_ID) {
    Write-Host "  ERRO: Project ID nao pode ser vazio." -ForegroundColor Red
    exit 1
}

if (-not $OPENAI_KEY) {
    Write-Host "  ERRO: OpenAI API Key nao pode ser vazia." -ForegroundColor Red
    exit 1
}

# ------------------------------------
# ETAPA 4 — Linkar projeto
# ------------------------------------
Write-Host ""
Write-Host "Etapa 4/7 — Linkando projeto Supabase..." -ForegroundColor Yellow

Set-Location $PSScriptRoot
supabase link --project-ref $PROJECT_ID

if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERRO ao linkar projeto. Verifique o Project ID e tente novamente." -ForegroundColor Red
    exit 1
}

Write-Host "  OK — Projeto linkado." -ForegroundColor Green

# ------------------------------------
# ETAPA 5 — Rodar migrations
# ------------------------------------
Write-Host ""
Write-Host "Etapa 5/7 — Aplicando migrations no banco de dados..." -ForegroundColor Yellow

supabase db push

if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERRO ao aplicar migrations." -ForegroundColor Red
    exit 1
}

Write-Host "  OK — Schema criado com sucesso (9 migrations)." -ForegroundColor Green

# ------------------------------------
# ETAPA 6 — Configurar secrets e deploy das Edge Functions
# ------------------------------------
Write-Host ""
Write-Host "Etapa 6/7 — Configurando secrets e fazendo deploy das Edge Functions..." -ForegroundColor Yellow

supabase secrets set OPENAI_API_KEY=$OPENAI_KEY

if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERRO ao configurar secrets." -ForegroundColor Red
    exit 1
}

Write-Host "  OK — Secret OPENAI_API_KEY configurado." -ForegroundColor Green

$functions = @("smart-capture-ocr", "smart-capture-voice", "smart-capture-interpret", "ai-advisor", "finance-engine")
foreach ($fn in $functions) {
    Write-Host "  Fazendo deploy: $fn..." -ForegroundColor Gray
    supabase functions deploy $fn --no-verify-jwt
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  AVISO: Falha no deploy de $fn. Continue manualmente." -ForegroundColor Yellow
    } else {
        Write-Host "  OK — $fn" -ForegroundColor Green
    }
}

# ------------------------------------
# ETAPA 7 — Gerar .env.local
# ------------------------------------
Write-Host ""
Write-Host "Etapa 7/7 — Gerando .env.local..." -ForegroundColor Yellow

# Pegar anon key via CLI
$anonKey = supabase status --output json 2>$null | ConvertFrom-Json | Select-Object -ExpandProperty anon_key 2>$null

if (-not $anonKey) {
    Write-Host ""
    Write-Host "  Nao foi possivel obter a anon key automaticamente." -ForegroundColor Yellow
    Write-Host "  Acesse: https://supabase.com/dashboard/project/$PROJECT_ID/settings/api" -ForegroundColor Gray
    $anonKey = Read-Host "  Cole a 'anon public' key aqui"
}

$envContent = @"
# FinanceAI — gerado por setup-supabase.ps1
VITE_SUPABASE_URL=https://$PROJECT_ID.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=$anonKey
"@

Set-Content -Path ".env.local" -Value $envContent
Write-Host "  OK — .env.local criado." -ForegroundColor Green

# ------------------------------------
# RESUMO FINAL
# ------------------------------------
Write-Host ""
Write-Host "======================================" -ForegroundColor Green
Write-Host "  Setup concluido com sucesso!" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Proximos passos:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  1. Testar localmente:" -ForegroundColor White
Write-Host "     npm install" -ForegroundColor Gray
Write-Host "     npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. Deploy no Vercel:" -ForegroundColor White
Write-Host "     a) Acesse: https://vercel.com/new" -ForegroundColor Gray
Write-Host "     b) Importe o repo: josemardp/financeiroje" -ForegroundColor Gray
Write-Host "     c) Em 'Environment Variables' adicione:" -ForegroundColor Gray
Write-Host "        VITE_SUPABASE_URL = https://$PROJECT_ID.supabase.co" -ForegroundColor Gray
Write-Host "        VITE_SUPABASE_PUBLISHABLE_KEY = (sua anon key)" -ForegroundColor Gray
Write-Host "     d) Clique em Deploy" -ForegroundColor Gray
Write-Host ""
Write-Host "  3. No Supabase, habilite Auth providers em:" -ForegroundColor White
Write-Host "     Authentication > Providers > Email (ja habilitado por padrao)" -ForegroundColor Gray
Write-Host ""
