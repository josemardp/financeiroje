import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { calculateHealthScore } from '../src/services/financeEngine/healthScore';

dotenv.config();

const ROOT = path.resolve(process.cwd());

function check(condition: boolean, label: string): void {
  if (!condition) throw new Error(`FALHA: ${label}`);
  console.log(`  ✅ ${label}`);
}

async function runTests() {
  let passed = 0;
  let failed = 0;

  console.log('🚀 TESTE DE INTEGRAÇÃO — FinanceiroJe\n');

  // --- TESTE 1: Variáveis de ambiente e conexão Supabase ---
  console.log('TESTE 1: Variáveis de ambiente e conexão Supabase');
  try {
    const url = process.env.VITE_SUPABASE_URL;
    const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    check(typeof url === 'string' && url.startsWith('https://'), 'VITE_SUPABASE_URL configurada');
    check(typeof key === 'string' && key.length > 20, 'VITE_SUPABASE_PUBLISHABLE_KEY configurada');

    const supabase = createClient(url!, key!);
    const { error } = await supabase.auth.getSession();
    check(error === null, 'auth.getSession() retorna sem erro');
    passed++;
  } catch (e) {
    console.error(`  ❌ ${(e as Error).message}`);
    failed++;
  }

  // --- TESTE 2: Integridade estrutural do repositório ---
  console.log('\nTESTE 2: Integridade estrutural do repositório');
  try {
    const requiredFiles = [
      'vercel.json',
      'src/App.tsx',
      'src/pages/Documents.tsx',
      'src/components/shared/ErrorBoundary.tsx',
      'src/services/financeEngine/healthScore.ts',
    ];
    for (const f of requiredFiles) {
      check(fs.existsSync(path.join(ROOT, f)), `Arquivo existe: ${f}`);
    }
    passed++;
  } catch (e) {
    console.error(`  ❌ ${(e as Error).message}`);
    failed++;
  }

  // --- TESTE 3: Motor financeiro — cálculo de score ---
  console.log('\nTESTE 3: Motor financeiro — cálculo de score');
  try {
    // Perfil saudável: income 2× expense, reserva de 3 meses, sem dívidas vencidas
    const scoreOK = calculateHealthScore({
      totalIncome: 10000,
      totalExpense: 5000,
      totalDebt: 0,
      emergencyReserve: 15000,
      emergencyReserveConfigured: true,
      budgetConfigured: true,
      budgetDeviation: 0,
      overdueInstallments: 0,
      totalInstallments: 0,
      monthsWithData: 1,
      totalMonthsPossible: 1,
    });
    check(scoreOK.scoreGeral !== null, 'scoreGeral não é null com dados suficientes');
    check(scoreOK.scoreGeral! >= 0 && scoreOK.scoreGeral! <= 100, `scoreGeral em [0,100]: ${scoreOK.scoreGeral}`);
    check(scoreOK.scoreGeral! > 70, `score saudável (income=10k, expense=5k): ${scoreOK.scoreGeral}`);
    check(Array.isArray(scoreOK.recommendations), 'campo recommendations é array');
    check(scoreOK.availableComponents > 0, `availableComponents > 0: ${scoreOK.availableComponents}`);

    // Perfil crítico: expense = 5× income, sem reserva, 3/5 parcelas em atraso
    const scoreBad = calculateHealthScore({
      totalIncome: 1000,
      totalExpense: 5000,
      totalDebt: 50000,
      emergencyReserve: 0,
      emergencyReserveConfigured: true,
      budgetConfigured: true,
      budgetDeviation: 80,
      overdueInstallments: 3,
      totalInstallments: 5,
      monthsWithData: 1,
      totalMonthsPossible: 1,
    });
    check(scoreBad.scoreGeral !== null, 'scoreGeral não é null no perfil crítico');
    check(scoreBad.scoreGeral! < 30, `score crítico (expense=5×income, dívidas): ${scoreBad.scoreGeral}`);

    // Discriminação: score saudável > score crítico
    check(scoreOK.scoreGeral! > scoreBad.scoreGeral!, 'score saudável > score crítico (discriminação)');

    console.log(`  Score saudável: ${scoreOK.scoreGeral} | Score crítico: ${scoreBad.scoreGeral}`);
    passed++;
  } catch (e) {
    console.error(`  ❌ ${(e as Error).message}`);
    failed++;
  }

  // --- RESULTADO ---
  console.log(`\n${'─'.repeat(40)}`);
  if (failed === 0) {
    console.log(`🏁 ${passed}/${passed + failed} testes passaram.`);
  } else {
    console.log(`❌ ${failed} teste(s) falharam de ${passed + failed}.`);
    process.exit(1);
  }
}

runTests().catch((error: Error) => {
  console.error('\n❌ ERRO INESPERADO:', error.message);
  process.exit(1);
});
