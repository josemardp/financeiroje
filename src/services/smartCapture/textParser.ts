/**
 * FinanceAI — Captura Inteligente: Parser de Texto Livre
 * 
 * Extrai dados estruturados de texto livre ou OCR.
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
  warnings: string[];
}

/**
 * Limpa descrições de ruídos comuns em comprovantes brasileiros.
 */
export function cleanDescription(text: string): string {
  if (!text) return "";
  
  return text
    .replace(/\b(PAG\*|COMPRA\s*|SAO\s*PAULO|SAO\s*JOSE|CURITIBA|BRASILIA|RJ|SP|MG|PR|RS|SC|BA|PE|CE|AM|PA|GO|DF)\b/gi, "")
    .replace(/\d{2,}\/\d{2,}(?:\/\d{2,4})?/g, "") // remove datas
    .replace(/\b\d{4,}\b/g, "") // remove sequencias longas de numeros (IDs)
    .replace(/\b(LOJA|FILIAL|MATRIZ|UNIDADE)\s*\d*\b/gi, "")
    .replace(/\b(0001|0002|0003)\b/g, "")
    .replace(/R\$\s*/gi, "")
    .replace(/[\/\-\*]/g, " ") // remove caracteres especiais de separação
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parser local determinístico para texto livre e pós-processamento de OCR.
 */
export function parseTransactionText(input: string): ParsedTransaction {
  const text = input.trim();
  const today = new Date().toISOString().split("T")[0];
  const observacoes: string[] = [];
  const camposFaltantes: string[] = [];
  const warnings: string[] = [];

  // Extract valor - melhorado para padrões BR
  // Tenta primeiro o padrão R$ 1.234,56 ou 1234,56
  const valorBrRegex = /(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2})/i;
  // Tenta o padrão 1234.56
  const valorEnRegex = /(?:R\$\s*)?(\d{1,}\.\d{2})/i;
  // Tenta apenas o número com vírgula
  const valorSimpleBrRegex = /(?:\s|^)(\d{1,},\d{2})(?:\s|$)/i;

  let valor: number | null = null;
  const matchBr = text.match(valorBrRegex);
  const matchEn = text.match(valorEnRegex);
  const matchSimpleBr = text.match(valorSimpleBrRegex);

  if (matchBr) {
    valor = parseFloat(matchBr[1].replace(/\./g, "").replace(",", "."));
  } else if (matchEn) {
    valor = parseFloat(matchEn[1]);
  } else if (matchSimpleBr) {
    valor = parseFloat(matchSimpleBr[1].replace(",", "."));
  }

  if (!valor) camposFaltantes.push("valor");

  // Detect tipo
  const incomePatterns = /\b(entrou|receb[ei]|sal[aá]rio|renda|freelance|receita|ganho|ganh[ei]|pix recebido|transferência recebida|depósito)\b/i;
  const expensePatterns = /\b(gastei|paguei|comprei|gast[oa]|pagamento|compra|pix enviado|débito|crédito|ifood|uber|mercado|farmácia)\b/i;
  
  let tipo: "income" | "expense" = "expense";
  if (incomePatterns.test(text)) {
    tipo = "income";
  } else if (expensePatterns.test(text)) {
    tipo = "expense";
  }

  // Detect date
  let data = today;
  if (/\bhoje\b/i.test(text)) {
    data = today;
  } else if (/\bontem\b/i.test(text)) {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    data = d.toISOString().split("T")[0];
  } else {
    // Formato DD/MM/YYYY ou DD/MM/YY ou DD/MM
    const dateMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
    if (dateMatch) {
      const day = parseInt(dateMatch[1]);
      const month = parseInt(dateMatch[2]);
      let year = dateMatch[3] ? (dateMatch[3].length === 2 ? 2000 + parseInt(dateMatch[3]) : parseInt(dateMatch[3])) : new Date().getFullYear();
      
      if (month > 0 && month <= 12 && day > 0 && day <= 31) {
        data = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      }
    }
  }

  // Detect category hints
  const categoryHints: Record<string, string> = {
    "mercado|supermercado|feira|atacadão|pão de açúcar|carrefour|extra|assai": "Alimentação",
    "aluguel|condom[ií]nio|iptu|quinto andar": "Moradia",
    "uber|99|gasolina|combustível|transporte|ônibus|metrô|estacionamento": "Transporte",
    "farmácia|médico|consulta|exame|saúde|plano de saúde|drogaria|hospital": "Saúde",
    "escola|faculdade|curso|educação|livro|mensalidade escolar": "Educação",
    "netflix|spotify|streaming|assinatura|amazon prime|disney|hbo": "Assinaturas",
    "pizza|restaurante|lanche|café|jantar|almoço|ifood|rappi|burguer king|mcdonalds": "Alimentação",
    "luz|energia|água|internet|telefone|celular|vivo|claro|tim|oi|enel|sabesp": "Contas",
    "consignado|parcela|empréstimo|financiamento|banco|juros": "Dívidas",
    "salário|renda|freelance|pro-labore|dividendos": "Renda",
    "roupa|calçado|vestuário|renner|cea|zara|riachuelo": "Vestuário",
    "pet|veterinário|ração|petz|cobasi": "Pet",
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
  if (/\b(mei|empresa|negócio|nota fiscal|cnpj|embalagem|fornecedor|cliente|serviço prestado)\b/i.test(text)) {
    escopo = "business";
    observacoes.push("Detectado como transação de negócio/MEI");
  } else if (/\b(família|casa|filh[oa]|esposa|marido|compras casa)\b/i.test(text)) {
    escopo = "family";
  }

  // Build description (remove extracted numeric values and common noises)
  let rawDesc = text
    .replace(/R\$\s*\d+[.,]?\d*/gi, "")
    .replace(/\d+[.,]?\d*\s*reais/gi, "")
    .replace(/\b(hoje|ontem)\b/gi, "")
    .replace(/\b(gastei|paguei|comprei|gast[oa]|entrou|recebi|pix recebido|pix enviado|recebido de|enviado para)\b/gi, "")
    .replace(/\b(de|com|no|na|em|do|da|para|pra)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  let descricao = cleanDescription(rawDesc);
  
  if (!descricao || descricao.length < 2) {
    descricao = text.substring(0, 50);
  }

  // Confidence
  const confianca: ParsedTransaction["confianca"] = 
    valor && categoriaSugerida && data !== today ? "alta" :
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
    warnings,
  };
}
