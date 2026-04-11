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

interface PatternRow {
  pattern_type: string;
  pattern_key: string;
  pattern_value: Record<string, unknown>;
  confidence: number;
  hit_count: number;
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

interface AiPrefsRow {
  tom_voz: string;
  nivel_detalhamento: string;
  frequencia_alertas: string;
  contexto_identidade: string | null;
  valores_pessoais: string[] | null;
  compromissos_fixos: Array<{ descricao: string; dia?: number; valor?: number }> | null;
  contexto_religioso: string | null;
  prioridade_default: string | null;
  tratar_parcelamentos: string | null;
}

/** Formata padrões aprendidos em texto compacto para o LLM */
function formatPatterns(patterns: PatternRow[]): string {
  if (patterns.length === 0) return "";

  const fmtBrl = (n: number) => `R$${Math.round(n)}`;
  const lines: string[] = [];

  for (const p of patterns) {
    const pct = `${Math.round(p.confidence * 100)}%`;
    const v = p.pattern_value;

    if (p.pattern_type === "merchant_category") {
      const merchant =
        (v["sample_descriptions"] as string[] | undefined)?.[0] ?? p.pattern_key;
      const cat = (v["category_name"] as string | undefined) ?? "?";
      lines.push(`- ${merchant} → ${cat} (${pct}, ${p.hit_count} ocorrências)`);
    } else if (p.pattern_type === "category_value_range") {
      const cat = (v["category_name"] as string | undefined) ?? p.pattern_key;
      const p10 = (v["p10"] as number | undefined) ?? 0;
      const p50 = (v["p50"] as number | undefined) ?? 0;
      const p90 = (v["p90"] as number | undefined) ?? 0;
      lines.push(
        `- categoria ${cat}: faixa típica ${fmtBrl(p10)}-${fmtBrl(p90)} (mediana ${fmtBrl(p50)})`
      );
    } else if (p.pattern_type === "document_disambiguation") {
      const rule = (v["rule"] as string | undefined) ?? "";
      if (rule) lines.push(`- ${rule}`);
    }
    // demais tipos não produzidos ainda — silenciosamente ignorados
  }

  if (lines.length === 0) return "";
  return `padroes_aprendidos:\n${lines.join("\n")}`;
}

/** Formata preferências declarativas do usuário em texto compacto para o LLM */
function formatPreferences(prefs: AiPrefsRow | null): string {
  if (!prefs) return "";

  const lines: string[] = [];

  lines.push(`- tom: ${prefs.tom_voz}`);
  lines.push(`- nivel_detalhamento: ${prefs.nivel_detalhamento}`);
  lines.push(`- frequencia_alertas: ${prefs.frequencia_alertas}`);
  if (prefs.prioridade_default) lines.push(`- prioridade_default: ${prefs.prioridade_default}`);
  if (prefs.tratar_parcelamentos) lines.push(`- tratar_parcelamentos: ${prefs.tratar_parcelamentos}`);
  if (prefs.contexto_identidade) lines.push(`- contexto_identidade: ${prefs.contexto_identidade}`);
  if (prefs.valores_pessoais?.length) lines.push(`- valores_pessoais: ${prefs.valores_pessoais.join(", ")}`);
  if (prefs.compromissos_fixos?.length) {
    const commitments = prefs.compromissos_fixos
      .map(c => `${c.descricao}${c.dia ? ` dia${c.dia}` : ""}${c.valor ? ` R$${c.valor}` : ""}`)
      .join(", ");
    lines.push(`- compromissos_fixos: ${commitments}`);
  }
  if (prefs.contexto_religioso) lines.push(`- contexto_religioso: ${prefs.contexto_religioso}`);

  return `preferencias_usuario:\n${lines.join("\n")}`;
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
    // currentScope === "all": snapshot agrega todos os escopos; patterns são por escopo (pulados).
    const patternsPromise =
      currentScope === "all"
        ? Promise.resolve({ data: [] as PatternRow[], error: null })
        : supabase
            .from("user_patterns")
            .select("pattern_type, pattern_key, pattern_value, confidence, hit_count")
            .eq("user_id", userId)
            .eq("scope", currentScope)
            .gte("confidence", 0.6)
            .order("confidence", { ascending: false })
            .order("hit_count", { ascending: false })
            .limit(30);

    const [catResult, txResult, snapshot, patternResult, aiPrefsResult] = await Promise.all([
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
      patternsPromise,
      supabase.from("user_ai_preferences").select("*").eq("user_id", userId).maybeSingle(),
    ]);

    const categories: CategoryRow[] = (catResult.data ?? []) as CategoryRow[];
    const transactions: TransactionRow[] = (txResult.data ?? []) as TransactionRow[];
    const patterns: PatternRow[] = (patternResult.data ?? []) as PatternRow[];

    const catBlock = formatCategories(categories, currentScope);
    const txBlock = formatRecentTransactions(transactions);
    const snapshotBlock = formatSnapshot(snapshot);
    const patternBlock = formatPatterns(patterns);
    const prefsBlock = formatPreferences((aiPrefsResult.data ?? null) as AiPrefsRow | null);

    const contextBlock = [catBlock, txBlock, snapshotBlock, patternBlock, prefsBlock].filter(Boolean).join("\n\n");

    return { contextBlock };
  } catch {
    // Falha silenciosa: contexto histórico é enriquecimento opcional
    return { contextBlock: "" };
  }
}
