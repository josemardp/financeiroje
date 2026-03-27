
function cleanDescription(text) {
  if (!text) return "";
  let cleaned = text
    .replace(/\b(PAG\*|COMPRA\s*|SAO\s*PAULO|SAO\s*JOSE|CURITIBA|BRASILIA|RJ|SP|MG|PR|RS|SC|BA|PE|CE|AM|PA|GO|DF)\b/gi, "")
    .replace(/\d{2,}\/\d{2,}(?:\/\d{2,4})?/g, "")
    .replace(/\b\d{4,}\b/g, "")
    .replace(/\b(LOJA|FILIAL|MATRIZ|UNIDADE)\s*\d*\b/gi, "")
    .replace(/\b(0001|0002|0003)\b/g, "")
    .replace(/R\$\s*/gi, "")
    .replace(/[\/\-\*]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned.toLowerCase().split(" ").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

function parseTransactionText(input) {
  const text = input.trim();
  const lowerText = text.toLowerCase();
  const warnings = [];

  // 1. Escolha Inteligente de Valor (Fase 3)
  const valorCandidates = [];
  const valorBrRegex = /(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2})/gi;
  const valorEnRegex = /(?:R\$\s*)?(\d{1,}\.\d{2})/gi;
  
  let match;
  while ((match = valorBrRegex.exec(text)) !== null) {
    valorCandidates.push({ value: parseFloat(match[1].replace(/\./g, "").replace(",", ".")), index: match.index });
  }
  while ((match = valorEnRegex.exec(text)) !== null) {
    valorCandidates.push({ value: parseFloat(match[1]), index: match.index });
  }

  let valor = null;
  if (valorCandidates.length > 0) {
    const strongPriorities = ["total", "valor total", "total a pagar", "valor pago", "pix", "débito", "crédito", "compra"];
    const avoidKeywords = ["troco", "taxa", "tarifa", "desconto", "nsu", "autorização", "parcela"];
    
    let bestCandidate = null;
    let highestScore = -1;

    for (const cand of valorCandidates) {
      let score = 0;
      const windowStart = Math.max(0, cand.index - 30);
      const windowEnd = Math.min(text.length, cand.index + 30);
      const surrounding = lowerText.substring(windowStart, windowEnd);

      for (const p of strongPriorities) { if (surrounding.includes(p)) score += 10; }
      for (const a of avoidKeywords) { if (surrounding.includes(a)) score -= 15; }

      if (score > highestScore) {
        highestScore = score;
        bestCandidate = cand.value;
      }
    }
    valor = bestCandidate ?? valorCandidates[valorCandidates.length - 1].value;
    if (new Set(valorCandidates.map(c => c.value)).size > 1) warnings.push("valor principal escolhido entre múltiplos candidatos");
  }

  // 2. Tipo (Sem Viés)
  const incomePatterns = /\b(entrou|receb[ei]|sal[aá]rio|renda|freelance|receita|ganho|ganh[ei]|pix recebido|transferência recebida|depósito)\b/i;
  const expensePatterns = /\b(gastei|paguei|comprei|gast[oa]|pagamento|compra|pix enviado|débito|crédito|ifood|uber|mercado|farmácia)\b/i;
  let tipo = null;
  if (incomePatterns.test(text)) tipo = "income";
  else if (expensePatterns.test(text)) tipo = "expense";
  else warnings.push("tipo não identificado claramente");

  // 3. Escopo
  let escopo = "private";
  if (/\b(mei|empresa|negócio|nota fiscal|cnpj|embalagem|fornecedor|cliente|serviço prestado)\b/i.test(text)) escopo = "business";
  else if (/\b(família|casa|filh[oa]|esposa|marido|compras casa)\b/i.test(text)) escopo = "family";

  return { valor, tipo, escopo, warnings };
}

const tests = [
  { input: "PIX JOAO SILVA 350,00", expected: { tipo: null, warnings: ["tipo não identificado claramente"] } },
  { input: "NF SERVIÇO PRESTADO CLIENTE XPTO R$ 800,00", expected: { escopo: "business" } },
  { input: "COMPRAS CASA MERCADO 120,00", expected: { escopo: "family" } },
  { input: "Subtotal 100,00 Taxa 5,00 Total 105,00", expected: { valor: 105.00 } }
];

tests.forEach(t => {
  const res = parseTransactionText(t.input);
  console.log(`Input: ${t.input}`);
  console.log(`Result: ${JSON.stringify(res)}`);
  console.log('---');
});
