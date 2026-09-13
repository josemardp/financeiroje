/**
 * Dados 100% fictícios para o Modo Demonstração do FinanceiroJE.
 * Criado exclusivamente para avaliação por recrutadores sem expor dados reais
 * e sem dependência do backend Supabase pessoal.
 */

export const DEMO_USER_ID = "demo-recruiter-user";

export interface DemoCategory {
  id: string;
  nome: string;
  icone: string;
  cor: string;
  tipo: "income" | "expense";
}

export const DEMO_CATEGORIES: DemoCategory[] = [
  { id: "cat-1", nome: "Alimentação", icone: "Utensils", cor: "#f97316", tipo: "expense" },
  { id: "cat-2", nome: "Moradia & Contas", icone: "Home", cor: "#3b82f6", tipo: "expense" },
  { id: "cat-3", nome: "Transporte", icone: "Car", cor: "#8b5cf6", tipo: "expense" },
  { id: "cat-4", nome: "Saúde", icone: "HeartPulse", cor: "#ef4444", tipo: "expense" },
  { id: "cat-5", nome: "Educação & Cursos", icone: "GraduationCap", cor: "#10b981", tipo: "expense" },
  { id: "cat-6", nome: "Tecnologia & Softwares", icone: "Laptop", cor: "#06b6d4", tipo: "expense" },
  { id: "cat-7", nome: "Serviços & Consultoria", icone: "Briefcase", cor: "#10b981", tipo: "income" },
  { id: "cat-8", nome: "Rendimentos & Investimentos", icone: "TrendingUp", cor: "#22c55e", tipo: "income" },
];

export interface DemoAccount {
  id: string;
  nome: string;
  tipo: "checking" | "investment" | "credit";
  saldo_inicial: number;
  ativa: boolean;
  cor: string;
  instituicao: string;
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  { id: "acc-1", nome: "Conta Corrente", tipo: "checking", saldo_inicial: 2500.0, ativa: true, cor: "#820ad1", instituicao: "Banco Digital" },
  { id: "acc-2", nome: "Reserva Estratégica CDI", tipo: "investment", saldo_inicial: 15000.0, ativa: true, cor: "#16a34a", instituicao: "Corretora" },
  { id: "acc-3", nome: "Cartão de Crédito", tipo: "credit", saldo_inicial: 0.0, ativa: true, cor: "#2563eb", instituicao: "Fintech" },
];

function getDateOffset(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split("T")[0];
}

export interface DemoTransaction {
  id: string;
  user_id: string;
  account_id: string;
  categoria_id: string;
  valor: number;
  tipo: "income" | "expense";
  data: string;
  descricao: string;
  scope: "private" | "family" | "business";
  data_status: "confirmed" | "suggested" | "estimated" | "incomplete" | "inconsistent";
  source_type: "manual" | "ocr" | "csv" | "ofx" | "rule";
  confidence: string;
  e_mei: boolean;
  created_at: string;
  categories?: { nome: string; icone: string; cor: string };
}

export const DEMO_TRANSACTIONS: DemoTransaction[] = [
  {
    id: "tx-1",
    user_id: DEMO_USER_ID,
    account_id: "acc-1",
    categoria_id: "cat-7",
    valor: 5400.0,
    tipo: "income",
    data: getDateOffset(2),
    descricao: "Honorários de Consultoria em Automação de Processos",
    scope: "private",
    data_status: "confirmed",
    source_type: "manual",
    confidence: "1.0",
    e_mei: false,
    created_at: new Date().toISOString(),
    categories: { nome: "Serviços & Consultoria", icone: "Briefcase", cor: "#10b981" },
  },
  {
    id: "tx-2",
    user_id: DEMO_USER_ID,
    account_id: "acc-1",
    categoria_id: "cat-1",
    valor: 428.5,
    tipo: "expense",
    data: getDateOffset(3),
    descricao: "Supermercado Modelo — Compras da Semana",
    scope: "family",
    data_status: "confirmed",
    source_type: "ocr",
    confidence: "0.96",
    e_mei: false,
    created_at: new Date().toISOString(),
    categories: { nome: "Alimentação", icone: "Utensils", cor: "#f97316" },
  },
  {
    id: "tx-3",
    user_id: DEMO_USER_ID,
    account_id: "acc-1",
    categoria_id: "cat-2",
    valor: 184.2,
    tipo: "expense",
    data: getDateOffset(5),
    descricao: "Energia Elétrica — Distribuidora Regional",
    scope: "family",
    data_status: "confirmed",
    source_type: "ofx",
    confidence: "1.0",
    e_mei: false,
    created_at: new Date().toISOString(),
    categories: { nome: "Moradia & Contas", icone: "Home", cor: "#3b82f6" },
  },
  {
    id: "tx-4",
    user_id: DEMO_USER_ID,
    account_id: "acc-3",
    categoria_id: "cat-6",
    valor: 89.9,
    tipo: "expense",
    data: getDateOffset(6),
    descricao: "Assinatura Servidor Cloud & API",
    scope: "private",
    data_status: "confirmed",
    source_type: "csv",
    confidence: "1.0",
    e_mei: false,
    created_at: new Date().toISOString(),
    categories: { nome: "Tecnologia & Softwares", icone: "Laptop", cor: "#06b6d4" },
  },
  {
    id: "tx-5",
    user_id: DEMO_USER_ID,
    account_id: "acc-1",
    categoria_id: "cat-3",
    valor: 190.0,
    tipo: "expense",
    data: getDateOffset(8),
    descricao: "Abastecimento Combustível — Posto Aliança",
    scope: "private",
    data_status: "confirmed",
    source_type: "manual",
    confidence: "1.0",
    e_mei: false,
    created_at: new Date().toISOString(),
    categories: { nome: "Transporte", icone: "Car", cor: "#8b5cf6" },
  },
  {
    id: "tx-6",
    user_id: DEMO_USER_ID,
    account_id: "acc-2",
    categoria_id: "cat-8",
    valor: 156.4,
    tipo: "income",
    data: getDateOffset(10),
    descricao: "Rendimento de Aplicação Líquida CDI 100%",
    scope: "family",
    data_status: "confirmed",
    source_type: "ofx",
    confidence: "1.0",
    e_mei: false,
    created_at: new Date().toISOString(),
    categories: { nome: "Rendimentos & Investimentos", icone: "TrendingUp", cor: "#22c55e" },
  },
  {
    id: "tx-7",
    user_id: DEMO_USER_ID,
    account_id: "acc-1",
    categoria_id: "cat-4",
    valor: 78.9,
    tipo: "expense",
    data: getDateOffset(12),
    descricao: "Farmácia DrogaViva — Medicamentos",
    scope: "family",
    data_status: "confirmed",
    source_type: "ocr",
    confidence: "0.94",
    e_mei: false,
    created_at: new Date().toISOString(),
    categories: { nome: "Saúde", icone: "HeartPulse", cor: "#ef4444" },
  },
  {
    id: "tx-8",
    user_id: DEMO_USER_ID,
    account_id: "acc-3",
    categoria_id: "cat-5",
    valor: 240.0,
    tipo: "expense",
    data: getDateOffset(15),
    descricao: "Curso de Especialização em IA e Processos",
    scope: "private",
    data_status: "confirmed",
    source_type: "manual",
    confidence: "1.0",
    e_mei: false,
    created_at: new Date().toISOString(),
    categories: { nome: "Educação & Cursos", icone: "GraduationCap", cor: "#10b981" },
  },
  {
    id: "tx-9",
    user_id: DEMO_USER_ID,
    account_id: "acc-1",
    categoria_id: "cat-1",
    valor: 142.5,
    tipo: "expense",
    data: getDateOffset(1),
    descricao: "Comprovante Fiscal Digitalizado (Demonstração OCR)",
    scope: "family",
    data_status: "suggested",
    source_type: "ocr",
    confidence: "0.98",
    e_mei: false,
    created_at: new Date().toISOString(),
    categories: { nome: "Alimentação", icone: "Utensils", cor: "#f97316" },
  }
];

export const DEMO_GOALS = [
  {
    id: "goal-1",
    user_id: DEMO_USER_ID,
    titulo: "Reserva de Emergência Estratégica",
    valor_alvo: 20000.0,
    valor_atual: 15156.4,
    prazo: "2026-12-31",
    ativo: true,
  },
  {
    id: "goal-2",
    user_id: DEMO_USER_ID,
    titulo: "Equipamentos de Laboratório de TI",
    valor_alvo: 5000.0,
    valor_atual: 3200.0,
    prazo: "2026-10-30",
    ativo: true,
  }
];

export const DEMO_ALERTS = [
  {
    id: "alert-1",
    user_id: DEMO_USER_ID,
    titulo: "Reserva de Emergência atingiu 75% da meta",
    mensagem: "O aporte recorrente e os rendimentos mantêm a meta no prazo previsto.",
    tipo: "info",
    lido: false,
    scope: "all",
    created_at: new Date().toISOString(),
  }
];

export function isDemoMode(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("financeiroje_demo_mode") === "true";
}

export function activateDemoMode(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("financeiroje_demo_mode", "true");
}

export function exitDemoMode(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("financeiroje_demo_mode");
}
