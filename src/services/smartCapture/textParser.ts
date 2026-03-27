/**
 * FinanceAI — Captura Inteligente: Parser de Texto Livre e OCR (Fase 2)
 * 
 * Extrai dados estruturados de texto livre ou OCR.
 * Resultado SEMPRE tem status "suggested" — nunca salva automaticamente.
 * Passa pelo Modo Espelho para validação humana.
 */

export interface ParsedTransaction {
  valor: number | null;
  tipo: "income" | "expense" | null;
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
 * Limpa descrições de ruídos comuns em comprovantes brasileiros e torna mais humana.
 */
export function cleanDescription(text: string): string {
  if (!text) return "";
  
  let cleaned = text
    .replace(/\b(PAG\*|COMPRA\s*|SAO\s*PAULO|SAO\s*JOSE|CURITIBA|BRASILIA|RJ|SP|MG|PR|RS|SC|BA|PE|CE|AM|PA|GO|DF)\b/gi, "")
    .replace(/\d{2,}\/\d{2,}(?:\/\d{2,4})?/g, "") // remove datas
    .replace(/\b\d{4,}\b/g, "") // remove sequencias longas de numeros (IDs)
    .replace(/\b(LOJA|FILIAL|MATRIZ|UNIDADE)\s*\d*\b/gi, "")
    .replace(/\b(0001|0002|0003)\b/g, "")
    .replace(/R\$\s*/gi, "")
    .replace(/[\/\-\*]/g, " ") // remove caracteres especiais de separação
    .replace(/\s+/g, " ")
    .trim();

  // Transformações amigáveis
  if (/^ifood/i.test(cleaned)) cleaned = "Ifood";
  if (/^uber/i.test(cleaned)) cleaned = "Uber";
  if (/^99/i.test(cleaned)) cleaned = "99 App";
  if (/pix recebido/i.test(cleaned)) {
    const nome = cleaned.replace(/pix recebido/i, "").trim();
    cleaned = nome ? `Pix recebido de ${nome}` : "Pix recebido";
  }
  if (/pix enviado/i.test(cleaned)) {
    const nome = cleaned.replace(/pix enviado/i, "").trim();
    cleaned = nome ? `Pix enviado para ${nome}` : "Pix enviado";
  }

  // Capitalização amigável
  return cleaned
    .toLowerCase()
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
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

  // 1. Escolha Inteligente de Valor
  const valorCandidates: number[] = [];
  const valorBrRegex = /(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2})/gi;
  const valorEnRegex = /(?:R\$\s*)?(\d{1,}\.\d{2})/gi;
  
  let match;
  while ((match = valorBrRegex.exec(text)) !== null) {
    valorCandidates.push(parseFloat(match[1].replace(/\./g, "").replace(",", ".")));
  }
  while ((match = valorEnRegex.exec(text)) !== null) {
    valorCandidates.push(parseFloat(match[1]));
  }

  let valor: number | null = null;
  if (valorCandidates.length > 0) {
    // Se houver múltiplos, tenta buscar palavras-chave próximas (heurística simples)
    const lowerText = text.toLowerCase();
    const priorities = ["total", "valor pago", "pix", "compra"];
    let foundPriority = false;

    for (const p of priorities) {
      if (lowerText.includes(p)) {
        // Pega o valor mais provável (geralmente o maior ou o último após a palavra)
        valor = Math.max(...valorCandidates);
        foundPriority = true;
        break;
      }
    }

    if (!foundPriority) {
      valor = valorCandidates[valorCandidates.length - 1]; // Pega o último como fallback
    }

    if (new Set(valorCandidates).size > 1) {
      warnings.push("valor principal escolhido entre múltiplos candidatos");
    }
  }

  if (!valor) camposFaltantes.push("valor");

  // 2. Escolha Inteligente de Tipo
  const incomePatterns = /\b(entrou|receb[ei]|sal[aá]rio|renda|freelance|receita|ganho|ganh[ei]|pix recebido|transferência recebida|depósito)\b/i;
  const expensePatterns = /\b(gastei|paguei|comprei|gast[oa]|pagamento|compra|pix enviado|débito|crédito|ifood|uber|mercado|farmácia)\b/i;
  
  let tipo: "income" | "expense" | null = null;
  if (incomePatterns.test(text)) {
    tipo = "income";
  } else if (expensePatterns.test(text)) {
    tipo = "expense";
  } else {
    warnings.push("tipo inferido por contexto");
    tipo = "expense"; // Fallback seguro para despesa, mas marcado como inferido
  }

  // 3. Escolha Inteligente de Data
  let data = today;
  const dateCandidates: string[] = [];
  const dateRegex = /(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/g;
  
  while ((match = dateRegex.exec(text)) !== null) {
    const day = parseInt(match[1]);
    const month = parseInt(match[2]);
    let year = match[3] ? (match[3].length === 2 ? 2000 + parseInt(match[3]) : parseInt(match[3])) : new Date().getFullYear();
    if (month > 0 && month <= 12 && day > 0 && day <= 31) {
      dateCandidates.push(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
    }
  }

  if (dateCandidates.length > 0) {
    // Prioriza a primeira data encontrada (geralmente data da transação)
    // Evita datas futuras
    const validDates = dateCandidates.filter(d => d <= today);
    data = validDates.length > 0 ? validDates[0] : dateCandidates[0];
    
    if (new Set(dateCandidates).size > 1) {
      warnings.push("mais de uma data encontrada");
    }
  }

  // 4. Categorização e Descrição
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
      warnings.push("categoria inferida por heurística");
      break;
    }
  }

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
    warnings.push("descrição parcialmente limpa");
  }

  // 5. Lógica de Confiança Real
  let confianca: ParsedTransaction["confianca"] = "baixa";
  const hasStrongValue = valor !== null;
  const hasStrongDate = dateCandidates.length > 0;
  const hasStrongDesc = descricao.length > 3 && !warnings.includes("descrição parcialmente limpa");
  const hasLowAmbiguity = warnings.length <= 1;

  if (hasStrongValue && hasStrongDate && hasStrongDesc && hasLowAmbiguity) {
    confianca = "alta";
  } else if (hasStrongValue && (hasStrongDate || hasStrongDesc)) {
    confianca = "media";
  }

  if (!categoriaSugerida) camposFaltantes.push("categoria");

  return {
    valor,
    tipo,
    descricao,
    data,
    categoriaSugerida,
    escopo: "private",
    confianca,
    textoOriginal: text,
    observacoes,
    camposFaltantes,
    warnings,
  };
}
