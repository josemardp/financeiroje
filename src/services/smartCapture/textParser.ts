/**
 * FinanceAI — Captura Inteligente: Parser de Texto Livre
 * 
 * Extrai dados estruturados de texto livre do usuário.
 * Resultado SEMPRE tem status "suggested" — nunca salva automaticamente.
 * Passa pelo Modo Espelho para validação humana.
 */

export interface ParsedTransaction {
  valor: number | null;
  tipo: "income" | "expense";
  descricao: string;
  data: string; // ISO date
  categoriaSugerida: string | null;
  escopo: "private" | "family" | "business";
  confianca: "alta" | "media" | "baixa";
  textoOriginal: string;
  observacoes: string[];
  camposFaltantes: string[];
}

/**
 * Parser local determinístico para texto livre.
 * Extrai valor, tipo, data e descrição com regex.
 * Campos não encontrados são marcados como faltantes.
 */
export function parseTransactionText(input: string): ParsedTransaction {
  const text = input.trim();
  const today = new Date().toISOString().split("T")[0];
  const observacoes: string[] = [];
  const camposFaltantes: string[] = [];

  // Extract valor
  const valorMatch = text.match(/(?:R\$\s*)?(\d{1,}[.,]?\d{0,2})\s*(?:reais|real)?/i);
  const valor = valorMatch ? parseFloat(valorMatch[1].replace(",", ".")) : null;
  if (!valor) camposFaltantes.push("valor");

  // Detect tipo
  const incomePatterns = /\b(entrou|receb[ei]|sal[aá]rio|renda|pagamento|freelance|receita|ganho|ganh[ei])\b/i;
  const tipo = incomePatterns.test(text) ? "income" : "expense";

  // Detect date
  let data = today;
  if (/\bhoje\b/i.test(text)) {
    data = today;
  } else if (/\bontem\b/i.test(text)) {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    data = d.toISOString().split("T")[0];
  } else {
    const dateMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
    if (dateMatch) {
      const day = parseInt(dateMatch[1]);
      const month = parseInt(dateMatch[2]);
      const year = dateMatch[3] ? (dateMatch[3].length === 2 ? 2000 + parseInt(dateMatch[3]) : parseInt(dateMatch[3])) : new Date().getFullYear();
      data = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  // Detect category hints
  const categoryHints: Record<string, string> = {
    "mercado|supermercado|feira": "Alimentação",
    "aluguel|condom[ií]nio": "Moradia",
    "uber|99|gasolina|combustível|transporte|ônibus": "Transporte",
    "farmácia|médico|consulta|exame|saúde|plano de saúde": "Saúde",
    "escola|faculdade|curso|educação|livro": "Educação",
    "netflix|spotify|streaming|assinatura": "Assinaturas",
    "pizza|restaurante|lanche|café|jantar|almoço": "Alimentação",
    "luz|energia|água|internet|telefone|celular": "Contas",
    "consignado|parcela|empréstimo|financiamento": "Dívidas",
    "salário|renda|freelance": "Renda",
  };

  let categoriaSugerida: string | null = null;
  for (const [pattern, cat] of Object.entries(categoryHints)) {
    if (new RegExp(pattern, "i").test(text)) {
      categoriaSugerida = cat;
      break;
    }
  }

  // Detect scope
  let escopo: ParsedTransaction["escopo"] = "private";
  if (/\b(mei|empresa|negócio|nota fiscal|cnpj|embalagem|fornecedor)\b/i.test(text)) {
    escopo = "business";
    observacoes.push("Detectado como transação de negócio/MEI");
  } else if (/\b(família|casa|filh[oa]|esposa|marido)\b/i.test(text)) {
    escopo = "family";
  }

  // Build description (remove extracted numeric values)
  let descricao = text
    .replace(/R\$\s*\d+[.,]?\d*/gi, "")
    .replace(/\d+[.,]?\d*\s*reais/gi, "")
    .replace(/\b(hoje|ontem)\b/gi, "")
    .replace(/\b(gastei|paguei|comprei|gast[oa]|entrou|recebi)\b/gi, "")
    .replace(/\b(de|com|no|na|em|do|da|para|pra)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!descricao) descricao = text.substring(0, 50);

  // Confidence
  const confianca: ParsedTransaction["confianca"] = 
    valor && categoriaSugerida ? "alta" :
    valor ? "media" : "baixa";

  if (!categoriaSugerida) camposFaltantes.push("categoria");

  return {
    valor,
    tipo,
    descricao: descricao.charAt(0).toUpperCase() + descricao.slice(1),
    data,
    categoriaSugerida,
    escopo,
    confianca,
    textoOriginal: text,
    observacoes,
    camposFaltantes,
  };
}
