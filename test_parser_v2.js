
function cleanDescription(text) {
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

  if (/^ifood/i.test(cleaned)) cleaned = "Ifood";
  if (/^uber/i.test(cleaned)) cleaned = "Uber";
  if (/pix recebido/i.test(cleaned)) {
    const nome = cleaned.replace(/pix recebido/i, "").trim();
    cleaned = nome ? `Pix recebido de ${nome}` : "Pix recebido";
  }

  return cleaned
    .toLowerCase()
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function parseTransactionText(input) {
  const text = input.trim();
  const today = new Date().toISOString().split("T")[0];
  const warnings = [];

  const valorCandidates = [];
  const valorBrRegex = /(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2})/gi;
  const valorEnRegex = /(?:R\$\s*)?(\d{1,}\.\d{2})/gi;
  
  let match;
  while ((match = valorBrRegex.exec(text)) !== null) {
    valorCandidates.push(parseFloat(match[1].replace(/\./g, "").replace(",", ".")));
  }
  while ((match = valorEnRegex.exec(text)) !== null) {
    valorCandidates.push(parseFloat(match[1]));
  }

  let valor = null;
  if (valorCandidates.length > 0) {
    valor = Math.max(...valorCandidates);
    if (new Set(valorCandidates).size > 1) warnings.push("valor principal escolhido entre múltiplos candidatos");
  }

  const incomePatterns = /\b(entrou|receb[ei]|sal[aá]rio|renda|freelance|receita|ganho|ganh[ei]|pix recebido|transferência recebida|depósito)\b/i;
  const tipo = incomePatterns.test(text) ? "income" : "expense";

  let data = today;
  const dateCandidates = [];
  const dateRegex = /(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/g;
  while ((match = dateRegex.exec(text)) !== null) {
    const day = parseInt(match[1]);
    const month = parseInt(match[2]);
    let year = match[3] ? (match[3].length === 2 ? 2000 + parseInt(match[3]) : parseInt(match[3])) : new Date().getFullYear();
    dateCandidates.push(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  }
  if (dateCandidates.length > 0) {
    data = dateCandidates[0];
    if (new Set(dateCandidates).size > 1) warnings.push("mais de uma data encontrada");
  }

  let rawDesc = text
    .replace(/R\$\s*\d+[.,]?\d*/gi, "")
    .replace(/\d+[.,]?\d*\s*reais/gi, "")
    .replace(/\b(hoje|ontem)\b/gi, "")
    .replace(/\b(gastei|paguei|comprei|gast[oa]|entrou|recebi|pix recebido|pix enviado)\b/gi, "")
    .trim();

  let descricao = cleanDescription(rawDesc);
  
  return { valor, tipo, data, descricao, warnings };
}

const tests = [
  { input: "IFOOD *PEDIDO 49,90 26/03/2026", expected: { valor: 49.9, tipo: "expense", data: "2026-03-26", descricao: "Ifood" } },
  { input: "PIX RECEBIDO JOAO SILVA R$ 350,00", expected: { valor: 350, tipo: "income", descricao: "Pix Recebido De Joao Silva" } },
  { input: "Comprovante: Total R$ 120,50 Taxa R$ 5,00 27/03/2026", expected: { valor: 120.5, warnings: ["valor principal escolhido entre múltiplos candidatos"] } }
];

tests.forEach(t => {
  const res = parseTransactionText(t.input);
  console.log(`Input: ${t.input}`);
  console.log(`Result: ${JSON.stringify(res)}`);
  console.log('---');
});
