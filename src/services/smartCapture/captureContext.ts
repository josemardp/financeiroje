/**
 * FinanceAI — Capture Context
 * Busca categorias e histórico de transações do Supabase para enriquecer
 * o prompt da edge function smart-capture-interpret com contexto real do usuário.
 */
import { supabase } from "@/integrations/supabase/client";
import type { ScopeType } from "@/contexts/ScopeContext";
import { getUserBehavioralSnapshot } from "@/services/userProfile/snapshot";
import type { UserBehavioralSnapshot } from "@/services/userProfile/snapshot";

export interface CaptureContextData {
  /** Texto compacto pronto para injetar no prompt do LLM */
  contextBlock: string;
}

interface CategoryRow {
  id: string;
  nome: string;
  tipo: string | null;
  e_mei: boolean | null;
  scope: string | null;
}

interface TransactionRow {
  descricao: string | null;
  valor: number;
  tipo: string;
  data: string;
  categories: { nome: string } | null;
}

/** Formata lista de categorias em texto compacto para o LLM */
function formatCategories(cats: CategoryRow[], currentScope: ScopeType): string {
  const filtered =
    currentScope === "all"
      ? cats
      : cats.filter((c) => c.scope === currentScope || c.scope === null);

  if (filtered.length === 0) return "";

  const items = filtered
    .map((c) => {
      const parts = [c.nome, c.tipo ?? "?", c.scope ?? "geral"];
      if (c.e_mei) parts.push("MEI");
      return parts.join(":");
    })
    .join(", ");

  return `categorias_usuario: ${items}`;
}

/** Formata últimas transações em texto compacto para o LLM */
function formatRecentTransactions(txs: TransactionRow[]): string {
  if (txs.length === 0) return "";

  const lines = txs.map((t) => {
    const catName = t.categories?.nome ?? "sem categoria";
    const valor = `R$${t.valor.toFixed(2)}`;
    const desc = (t.descricao ?? "-").slice(0, 40);
    return `- ${t.data} | ${t.tipo} | ${valor} | ${desc} | ${catName}`;
  });

  return `historico_recente:\n${lines.join("\n")}`;
}

/**
 * Formata snapshot comportamental em texto compacto para o LLM.
 * currentScope === "all": snapshot cobre todas as transações do usuário (sem filtro de escopo).
 * currentScope específico: snapshot cobre apenas transações daquele escopo.
 * Retorna "" apenas se nenhum dado relevante estiver disponível.
 */
function formatSnapshot(s: UserBehavioralSnapshot): string {
  const lines: string[] = [];

  if (s.arquetipo !== "indefinido") {
    lines.push(`- arquetipo: ${s.arquetipo} (${s.arquetipoDescricao.slice(0, 100)})`);
  }

  if (s.topCategorias.length > 0) {
    const cats = s.topCategorias.map((c) => `${c.nome}(${c.usosNoMes}x)`).join(", ");
    lines.push(`- top_categorias: ${cats}`);
  }

  if (s.faixasTipicas.despesaMediana > 0) {
    lines.push(
      `- faixa_despesa_tipica: R$${s.faixasTipicas.despesaP10}-${s.faixasTipicas.despesaP90} (mediana R$${s.faixasTipicas.despesaMediana})`
    );
  }

  if (s.beneficiariosFrequentes.length > 0) {
    const benef = s.beneficiariosFrequentes.map((b) => b.nome).join(", ");
    lines.push(`- beneficiarios_frequentes: ${benef}`);
  }

  if (lines.length === 0) return "";
  return `perfil_usuario:\n${lines.join("\n")}`;
}

/**
 * Busca categorias e últimas 20 transações confirmadas do usuário.
 * Retorna um bloco de texto compacto para enriquecer o prompt do LLM.
 * Em caso de erro, retorna contextBlock vazio — não bloqueia a captura.
 */
export async function getCaptureContext(
  currentScope: ScopeType,
  userId: string
): Promise<CaptureContextData> {
  try {
    // currentScope === "all": snapshot agrega todos os escopos do usuário (sem filtro).
    // currentScope específico: snapshot filtra pelo escopo ativo.
    const [catResult, txResult, snapshot] = await Promise.all([
      supabase
        .from("categories")
        .select("id, nome, tipo, e_mei, scope")
        .order("nome", { ascending: true }),

      supabase
        .from("transactions")
        .select("descricao, valor, tipo, data, categories(nome)")
        .eq("data_status", "confirmed")
        .is("deleted_at", null)
        .order("data", { ascending: false })
        .limit(20),

      getUserBehavioralSnapshot(userId, currentScope),
    ]);

    const categories: CategoryRow[] = (catResult.data ?? []) as CategoryRow[];
    const transactions: TransactionRow[] = (txResult.data ?? []) as TransactionRow[];

    const catBlock = formatCategories(categories, currentScope);
    const txBlock = formatRecentTransactions(transactions);
    const snapshotBlock = formatSnapshot(snapshot);

    const contextBlock = [catBlock, txBlock, snapshotBlock].filter(Boolean).join("\n\n");

    return { contextBlock };
  } catch {
    // Falha silenciosa: contexto histórico é enriquecimento opcional
    return { contextBlock: "" };
  }
}
