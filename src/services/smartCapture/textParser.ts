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
  installmentText: string | null;
  installmentCount: number | null;
  status: "complete" | "partial" | "ambiguous";
}

type ScopeValue = ParsedTransaction["escopo"];
type ConfidenceValue = ParsedTransaction["confianca"];

function formatIsoDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function isValidCalendarDate(year: number, month: number, day: number) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return false;

  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function parseLocalizedAmount(raw: string) {
  const cleaned = raw
    .replace(/R\$/gi, "")
    .replace(/\s+/g, "")
    .trim();

  if (!cleaned) return null;

  let normalized = cleaned;
  if (cleaned.includes(",") && cleaned.includes(".")) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (cleaned.includes(",")) {
    normalized = cleaned.replace(",", ".");
  }

  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0 || value > 1_000_000) {
    return null;
  }

  return value;
}

const MONTH_ALIASES: Record<string, number> = {
  jan: 1, janeiro: 1, january: 1,
  fev: 2, fevereiro: 2, feb: 2, february: 2,
  mar: 3, março: 3, marco: 3, march: 3,
  abr: 4, abril: 4, apr: 4, april: 4,
  mai: 5, maio: 5, may: 5,
  jun: 6, junho: 6, june: 6,
  jul: 7, julho: 7, july: 7,
  ago: 8, agosto: 8, aug: 8, august: 8,
  set: 9, setembro: 9, sep: 9, september: 9,
  out: 10, outubro: 10, oct: 10, october: 10,
  nov: 11, novembro: 11, november: 11,
  dez: 12, dezembro: 12, dec: 12, december: 12,
};

function normalizeMonthToken(raw: string) {
  const normalized = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\.$/, "");

  return MONTH_ALIASES[normalized] ?? null;
}

function extractDateFromText(text: string, observacoes: string[]) {
  const today = new Date().toISOString().split("T")[0];

  const labeledDateRegex =
    /\b(?:data|data da transa[cç][aã]o|data do pagamento|data do recebimento|emiss[aã]o|lan[çc]amento|ocorr[êe]ncia)\b[^\n\r]{0,18}?(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4}|\d{2})\b/gi;
  const labeledDateMatch = labeledDateRegex.exec(text);
  if (labeledDateMatch) {
    const day = Number(labeledDateMatch[1]);
    const month = Number(labeledDateMatch[2]);
    const rawYear = Number(labeledDateMatch[3]);
    const year = labeledDateMatch[3].length === 2 ? 2000 + rawYear : rawYear;

    if (isValidCalendarDate(year, month, day)) {
      return {
        data: formatIsoDate(year, month, day),
        explicitDateFound: true,
        inferredDate: false,
      };
    }
  }

  const fullDateRegex = /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4}|\d{2})\b/g;
  let fullDateMatch: RegExpExecArray | null;

  while ((fullDateMatch = fullDateRegex.exec(text)) !== null) {
    const day = Number(fullDateMatch[1]);
    const month = Number(fullDateMatch[2]);
    const rawYear = Number(fullDateMatch[3]);
    const year = fullDateMatch[3].length === 2 ? 2000 + rawYear : rawYear;

    if (isValidCalendarDate(year, month, day)) {
      return {
        data: formatIsoDate(year, month, day),
        explicitDateFound: true,
        inferredDate: false,
      };
    }
  }

  const textualDateRegex =
    /\b(\d{1,2})\s*(?:de\s*)?([A-Za-zÀ-ÿ]{3,10})[,.]?\s*(?:de\s*)?(\d{4})\b/gi;
  let textualDateMatch: RegExpExecArray | null;

  while ((textualDateMatch = textualDateRegex.exec(text)) !== null) {
    const day = Number(textualDateMatch[1]);
    const month = normalizeMonthToken(textualDateMatch[2]);
    const year = Number(textualDateMatch[3]);

    if (month && isValidCalendarDate(year, month, day)) {
      return {
        data: formatIsoDate(year, month, day),
        explicitDateFound: true,
        inferredDate: false,
      };
    }
  }

  const partialDateRegex = /\b(\d{1,2})[\/\-.](\d{1,2})\b/g;
  let partialDateMatch: RegExpExecArray | null;
  while ((partialDateMatch = partialDateRegex.exec(text)) !== null) {
    const day = Number(partialDateMatch[1]);
    const month = Number(partialDateMatch[2]);
    const year = new Date().getFullYear();

    if (isValidCalendarDate(year, month, day)) {
      observacoes.push("Data sem ano explícito; assumido ano atual.");
      return {
        data: formatIsoDate(year, month, day),
        explicitDateFound: true,
        inferredDate: true,
      };
    }
  }

  if (/\bhoje\b/i.test(text)) {
    observacoes.push("Data inferida pela palavra 'hoje'.");
    return { data: today, explicitDateFound: false, inferredDate: true };
  }

  if (/\bontem\b/i.test(text)) {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    observacoes.push("Data inferida pela palavra 'ontem'.");
    return {
      data: d.toISOString().split("T")[0],
      explicitDateFound: false,
      inferredDate: true,
    };
  }

  observacoes.push("Nenhuma data explícita encontrada; usado o dia atual como fallback.");
  return { data: today, explicitDateFound: false, inferredDate: true };
}

function buildCompactDescriptionFromFields(text: string) {
  const fieldPatterns = [
    /(?:descri[cç][aã]o|descrição da transação|hist[oó]rico|histórico|referente a)\s*[:\-]\s*([^\n;|]{3,120})/i,
    /(?:estabelecimento|loja|merchant)\s*[:\-]\s*([^\n;|]{3,120})/i,
    /(?:favorecido|benefici[aá]rio|recebedor(?:a)?|destinat[aá]rio|pagador(?:a)?)\s*[:\-]\s*([^\n;|]{3,120})/i,
  ];

  for (const pattern of fieldPatterns) {
    const match = text.match(pattern);
    const value = match?.[1]?.trim();
    if (value) return value;
  }

  return "";
}

function buildPixDescription(text: string) {
  const pixMatch = text.match(
    /\b(PIX(?:\s+(?:recebido|recebida|recebimento|enviado|enviada|pago|pagamento|transfer[êe]ncia|transferido|transferida))?)\b[^\n\r]{0,25}?\b(?:para|de|do|da|favorecido|benefici[aá]rio|recebedor(?:a)?)\b\s*[:\-]?\s*([A-ZÀ-ÿ][A-ZÀ-ÿ0-9.'\-]+(?:\s+[A-ZÀ-ÿ0-9.'\-]+){0,4})/i
  );

  if (!pixMatch) return "";

  const movement = pixMatch[1]
    .replace(/\s+/g, " ")
    .trim();

  const counterpart = pixMatch[2]
    .replace(/\s+/g, " ")
    .trim();

  return `${movement} ${counterpart}`;
}

function buildMerchantDescription(text: string) {
  const merchantPatterns = [
    /\b(supermercado\s+[A-ZÀ-ÿ0-9][^\n,;|]{2,60})/i,
    /\b(farm[aá]cia\s+[A-ZÀ-ÿ0-9][^\n,;|]{2,60})/i,
    /\b(padaria\s+[A-ZÀ-ÿ0-9][^\n,;|]{2,60})/i,
    /\b(restaurante\s+[A-ZÀ-ÿ0-9][^\n,;|]{2,60})/i,
    /\b(mercado\s+[A-ZÀ-ÿ0-9][^\n,;|]{2,60})/i,
    /\b(uber(?:\s+trip)?|99(?:\s*pop)?|ifood|infinitepay)\b/i,
  ];

  for (const pattern of merchantPatterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }

  return "";
}

function sanitizeDescription(value: string) {
  return value
    .replace(/[_*#`]+/g, " ")
    .replace(
      /\b(?:cnpj|cpf|ag[êe]ncia|conta|autentica[cç][aã]o|protocolo|nsu|documento|id)\b\s*[:\-]?\s*[\w./-]+/gi,
      " "
    )
    .replace(/\b(?:observa[cç][aã]o|obs|teste|auxiliar|rodap[eé])\b\s*[:\-]?\s*/gi, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,;:|.-]+|[\s,;:|.-]+$/g, "")
    .trim();
}

function buildCompactDescriptionFromLines(text: string) {
  const lines = text
    .split(/[\n\r]+/)
    .map((line) => sanitizeDescription(line))
    .filter(Boolean);

  const ignoredLinePattern =
    /^(?:comprovante|recibo|extrato|nota fiscal|arquivo|p[aá]gina|sheet\d*|planilha|total geral|subtotal|header|rodap[eé]|banco|ag[êe]ncia|conta|autentica[cç][aã]o|transa[cç][aã]o|valor|data)\b/i;

  const semanticLine = lines.find((line) => {
    if (ignoredLinePattern.test(line)) return false;
    if (line.length < 3 || line.length > 90) return false;
    if ((line.match(/[,;|]/g) || []).length > 4) return false;
    const digits = (line.match(/\d/g) || []).length;
    return digits <= Math.max(6, Math.floor(line.length * 0.25));
  });

  return semanticLine ?? "";
}

function buildCompactDescriptionFromText(text: string, tipo: ParsedTransaction["tipo"]) {
  const explicitField = buildCompactDescriptionFromFields(text);
  if (explicitField) return explicitField;

  const pixDescription = buildPixDescription(text);
  if (pixDescription) return pixDescription;

  const merchantDescription = buildMerchantDescription(text);
  if (merchantDescription) return merchantDescription;

  const byLines = buildCompactDescriptionFromLines(text);
  if (byLines) return byLines;

  const fallback = text
    .replace(/\b\d{1,2}[\/\-.]\d{1,2}(?:[\/\-.]\d{2,4})?\b/g, " ")
    .replace(/\b\d{1,2}\s*(?:de\s*)?[A-Za-zÀ-ÿ]{3,10}[,.]?\s*(?:de\s*)?\d{4}\b/gi, " ")
    .replace(/R\$\s*\d+[.,]?\d*/gi, " ")
    .replace(/\d+[.,]?\d*\s*reais?/gi, " ")
    .replace(
      /\b(?:gastei|paguei|comprei|entrou|recebi|transferi|pix|debito|d[eé]bito|credito|cr[eé]dito|parcelas?|comprovante de venda|link de pagamento)\b/gi,
      " "
    )
    .replace(/\b(?:de|com|no|na|em|do|da|para|pra|por)\b/gi, " ")
    .replace(/[;,|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = fallback.split(" ").filter(Boolean).slice(0, 8).join(" ");
  if (words) return words;

  return tipo === "income" ? "Receita identificada" : "Despesa identificada";
}

function normalizeDescription(
  text: string,
  tipo: ParsedTransaction["tipo"],
  observacoes: string[]
) {
  const compact = sanitizeDescription(buildCompactDescriptionFromText(text, tipo));

  let descricao = compact;
  if (!descricao) {
    descricao = tipo === "income" ? "Receita identificada" : "Despesa identificada";
    observacoes.push("Descrição não encontrada com clareza; usado fallback seguro.");
  }

  if (descricao.length > 80) {
    descricao = `${descricao.slice(0, 77).trimEnd()}...`;
    observacoes.push("Descrição encurtada para evitar texto cru/excessivo.");
  }

  return descricao.charAt(0).toUpperCase() + descricao.slice(1);
}

function extractScope(text: string, observacoes: string[]) {
  const businessPattern =
    /\b(business|empresa|profissional|neg[oó]cio|mei|fornecedor|cliente|nota fiscal|servi[cç]o profissional|comercial|mei)\b/i;
  const familyPattern = /\b(family|fam[ií]lia|familiar|casa|filh[oa]|esposa|marido|lar)\b/i;
  const privatePattern = /\b(personal|pessoal|privado|individual|particular)\b/i;

  let escopo: ScopeValue = "private";
  let strongScopeEvidence = false;

  if (businessPattern.test(text)) {
    escopo = "business";
    strongScopeEvidence = true;
    observacoes.push("Escopo mapeado como negócio por evidência textual.");
  } else if (familyPattern.test(text)) {
    escopo = "family";
    strongScopeEvidence = true;
    observacoes.push("Escopo mapeado como família/familiar por evidência textual.");
  } else if (privatePattern.test(text)) {
    escopo = "private";
    strongScopeEvidence = true;
    observacoes.push("Escopo mapeado como pessoal por evidência textual.");
  }

  return { escopo, strongScopeEvidence };
}

function extractAmountFromText(text: string, observacoes: string[]) {
  const candidates: Array<{ value: number; score: number; index: number; source: string }> = [];

  const installmentRanges: Array<{ start: number; end: number }> = [];
  const installmentRegex =
    /\b\d{1,2}\s*x\s*de\s*(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+[.,]\d{2})/gi;

  let installmentMatch: RegExpExecArray | null;
  while ((installmentMatch = installmentRegex.exec(text)) !== null) {
    installmentRanges.push({
      start: installmentMatch.index,
      end: installmentMatch.index + installmentMatch[0].length,
    });
  }

  const isInstallmentCandidate = (index: number) =>
    installmentRanges.some((range) => index >= range.start && index < range.end);

  const addCandidate = (raw: string, index: number, score: number, source: string) => {
    const value = parseLocalizedAmount(raw);
    if (value === null) return;

    const adjustedScore = isInstallmentCandidate(index) ? score - 2.5 : score;

    candidates.push({
      value,
      score: adjustedScore,
      index,
      source: isInstallmentCandidate(index) ? `${source}:installment` : source,
    });
  };

  const contextualPatterns = [
    {
      regex:
        /\b(?:valor total|total da venda|total pago|total recebido|valor pago|valor recebido|recebimento total|pagamento total)\b[^\n\r]{0,40}?(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+[.,]\d{2}|\d{1,5})/gi,
      score: 6,
      source: "total",
    },
    {
      regex: /(?:^|[\n\r])\s*R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2}|\d+[.,]\d{2})\b/gim,
      score: 4.5,
      source: "headline",
    },
    {
      regex:
        /\b(?:valor total|total a pagar|valor pago|valor recebido|valor|total|pagamento|recebimento|recebido|pago|pix recebido|pix enviado|transfer[êe]ncia|compra|gasto|despesa)\b[^\n\r]{0,24}?(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+[.,]\d{2}|\d{1,5})/gi,
      score: 5,
      source: "contextual",
    },
    {
      regex:
        /\b(?:gastei|paguei|comprei|entrou|recebi|ganhei|sal[aá]rio|mercado|uber|ifood|pix|transferi)\b[^\n\r]{0,16}?(?:R\$\s*)?(\d{1,5}(?:[.,]\d{1,2})?)/gi,
      score: 4,
      source: "verb",
    },
    {
      regex: /R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2}|\d+[.,]\d{2}|\d{1,5})/gi,
      score: 3,
      source: "currency",
    },
    {
      // Fallback para valores "soltos" no início ou fim (ex: "25,75 farmácia" ou "uber 15")
      regex: /(?:^|\s)(\d{1,3}(?:\.\d{3})*,\d{2}|\d+[.,]\d{1,2}|\d{1,5})(?:\s|$)/gi,
      score: 2.5,
      source: "telegraphic",
    },
  ];

  for (const pattern of contextualPatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.regex.exec(text)) !== null) {
      addCandidate(match[1], match.index, pattern.score, pattern.source);
    }
  }

  if (!candidates.length) {
    observacoes.push("Nenhum valor monetário claro foi encontrado no texto.");
    return { valor: null, explicitAmountFound: false, ambiguousAmount: false };
  }

  const ranked = [...candidates].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (Math.abs(b.value - a.value) > 0.009) return b.value - a.value;
    return a.index - b.index;
  });

  const best = ranked[0];
  const conflictingTopCandidates = ranked.filter(
    (candidate) =>
      candidate !== best &&
      candidate.score >= best.score - 1 &&
      Math.abs(candidate.value - best.value) > 0.009
  );

  if (best.score < 4 && conflictingTopCandidates.length > 0) {
    observacoes.push(
      "Valor monetário ambíguo: múltiplos candidatos relevantes encontrados no texto."
    );
    return { valor: null, explicitAmountFound: false, ambiguousAmount: true };
  }

  if (conflictingTopCandidates.length > 1 && best.source !== "total") {
    observacoes.push("Valor monetário potencialmente ambíguo; reduzindo confiança da sugestão.");
  }

  return { valor: best.value, explicitAmountFound: true, ambiguousAmount: false };
}

/**
 * Parser local determinístico para texto livre.
 * Extrai valor, tipo, data e descrição com regex.
 * Campos não encontrados são marcados como faltantes.
 */
export function parseTransactionText(input: string): ParsedTransaction {
  const text = input.trim();
  const observacoes: string[] = [];
  const camposFaltantes: string[] = [];

  const { valor, explicitAmountFound, ambiguousAmount } = extractAmountFromText(text, observacoes);
  if (!valor) camposFaltantes.push("valor");

  // Extract installment text (e.g. "3x", "12x de 30,47")
  const installmentMatch = text.match(/\b(\d{1,2})\s*x(?:\s+(?:de\s+)?(?:R\$\s*)?[\d.,]+)?(?:\s+(?:sem\s+juros|com\s+juros|no\s+cart[aã]o))?/i);
  const installmentText = installmentMatch ? installmentMatch[0].trim() : null;
  const installmentCount = installmentMatch ? parseInt(installmentMatch[1], 10) : null;

  // If ONLY installment value present (e.g. "12x de 30,47") with no explicit total, amount must be null
  const onlyInstallmentPattern = /^\s*\d{1,2}\s*x\s*(?:de\s+)?(?:R\$\s*)?[\d.,]+/i;
  const hasExplicitTotal = /\b(?:total|valor)\b/i.test(text) || (valor !== null && !onlyInstallmentPattern.test(text.replace(/\s+/g, ' ').trim()));

  // Apply the rule: if hasExplicitTotal is false, the found value is a per-installment amount, not a total
  const effectiveValor = hasExplicitTotal ? valor : null;
  if (effectiveValor === null && valor !== null) {
    camposFaltantes.push("valor");
    observacoes.push(
      "Apenas valor de parcela detectado; total não determinado. Preencha o valor total manualmente no Modo Espelho."
    );
  }

  const incomePatterns =
    /\b(entrou|receb[ei]|sal[aá]rio|renda|pagamento recebido|receita|ganho|ganh[ei]|pix recebido|transfer[êe]ncia recebida|dep[oó]sito)\b/i;
  const expensePatterns =
    /\b(gastei|paguei|comprei|d[eé]bito|despesa|sa[ií]da|retirada|pix enviado|transfer[êe]ncia enviada|compra aprovada|comprovante de venda|link de pagamento|parcelas|pagamento com cart[aã]o|pagamento aprovado|transa[cç][aã]o aprovada|mei)\b/i;

  const hasIncomeSignal = incomePatterns.test(text);
  const hasExpenseSignal = expensePatterns.test(text);
  const tipo = hasIncomeSignal && !hasExpenseSignal ? "income" : "expense";

  if (hasIncomeSignal && hasExpenseSignal) {
    observacoes.push("Texto contém sinais mistos de receita e despesa.");
  }
  if (!hasIncomeSignal && !hasExpenseSignal) {
    camposFaltantes.push("tipo");
    observacoes.push(
      "Tipo da transação não foi identificado com clareza; mantido padrão conservador."
    );
  }

  const { data, explicitDateFound, inferredDate } = extractDateFromText(text, observacoes);
  if (!explicitDateFound) {
    camposFaltantes.push("data");
  }

  const categoryHints: Record<string, string> = {
    "mercado|supermercado|feira": "Alimentação",
    "aluguel|condom[ií]nio": "Moradia",
    "uber|99|gasolina|combust[ií]vel|transporte|ônibus": "Transporte",
    "farmácia|médico|consulta|exame|saúde|plano de saúde": "Saúde",
    "escola|faculdade|curso|educação|livro": "Educação",
    "netflix|spotify|streaming|assinatura": "Assinaturas",
    "pizza|restaurante|lanche|café|jantar|almoço": "Alimentação",
    "luz|energia|água|internet|telefone|celular": "Contas",
    "consignado|parcela|parcelas|empréstimo|financiamento|link de pagamento|comprovante de venda":
      "Dívidas",
    "salário|renda|freelance": "Renda",
  };

  let categoriaSugerida: string | null = null;
  for (const [pattern, cat] of Object.entries(categoryHints)) {
    if (new RegExp(pattern, "i").test(text)) {
      categoriaSugerida = cat;
      break;
    }
  }

  let { escopo, strongScopeEvidence } = extractScope(text, observacoes);
  
  // Adicional: se houver forte sinal de MEI no texto, forçar escopo business
  if (/\bmei\b/i.test(text)) {
    escopo = "business";
    strongScopeEvidence = true;
  }

  const descricao = normalizeDescription(text, tipo, observacoes);

  if (!categoriaSugerida) camposFaltantes.push("categoria");

  const looksRawOrDense =
    text.length > 240 || /[\n\r]/.test(text) || (text.match(/[,;|]/g) || []).length > 6;
  const descriptionTooGeneric = /^(Receita identificada|Despesa identificada)$/i.test(descricao);

  let score = 0;

  if (effectiveValor && explicitAmountFound) score += 2;
  if (categoriaSugerida) score += 1;
  if (explicitDateFound) score += 1;
  if (!inferredDate && !descriptionTooGeneric) score += 1;
  if (strongScopeEvidence) score += 0.5;
  if (hasIncomeSignal || hasExpenseSignal) score += 0.5;

  if (hasIncomeSignal && hasExpenseSignal) score -= 1;
  if (inferredDate) score -= 1;
  if (looksRawOrDense) score -= 0.5;
  if (descriptionTooGeneric) score -= 0.5;
  if (!strongScopeEvidence && escopo !== "private") score -= 0.5;
  if (!effectiveValor) score -= 1.5;
  if (ambiguousAmount) score -= 1.5;
  if (!hasIncomeSignal && !hasExpenseSignal) score -= 0.5;

  const confianca: ConfidenceValue = score >= 4 ? "alta" : score >= 2 ? "media" : "baixa";

  // Determine status
  const hasCriticalFields = effectiveValor !== null && (hasIncomeSignal || hasExpenseSignal);
  const status: ParsedTransaction["status"] = ambiguousAmount
    ? "ambiguous"
    : hasCriticalFields
      ? "complete"
      : "partial";

  return {
    valor: effectiveValor,
    tipo,
    descricao,
    data,
    categoriaSugerida,
    escopo,
    confianca,
    textoOriginal: text,
    observacoes,
    camposFaltantes,
    installmentText,
    installmentCount,
    status,
  };
}
