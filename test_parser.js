
function cleanDescription(text) {
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

function parseTransactionText(input) {
  const text = input.trim();
  const today = new Date().toISOString().split("T")[0];
  
  const valorBrRegex = /(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2})/i;
  const valorEnRegex = /(?:R\$\s*)?(\d{1,}\.\d{2})/i;
  const valorSimpleBrRegex = /(?:\s|^)(\d{1,},\d{2})(?:\s|$)/i;

  let valor = null;
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

  const incomePatterns = /\b(entrou|receb[ei]|sal[aá]rio|renda|freelance|receita|ganho|ganh[ei]|pix recebido|transferência recebida|depósito)\b/i;
  const tipo = incomePatterns.test(text) ? "income" : "expense";

  let data = today;
  const dateMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
  if (dateMatch) {
    const day = parseInt(dateMatch[1]);
    const month = parseInt(dateMatch[2]);
    let year = dateMatch[3] ? (dateMatch[3].length === 2 ? 2000 + parseInt(dateMatch[3]) : parseInt(dateMatch[3])) : new Date().getFullYear();
    data = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
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
  
  return { valor, tipo, data, descricao };
}

const tests = [
  { input: "IFOOD *PEDIDO 49,90 26/03/2026", expected: { valor: 49.9, tipo: "expense", data: "2026-03-26", descricao: "Ifood pedido" } },
  { input: "PIX RECEBIDO JOAO SILVA R$ 350,00", expected: { valor: 350, tipo: "income", data: new Date().toISOString().split("T")[0], descricao: "Joao silva" } },
  { input: "SUPERMERCADO CENTRAL LOJA 02 120.50", expected: { valor: 120.5, tipo: "expense", descricao: "Supermercado central" } }
];

tests.forEach(t => {
  const res = parseTransactionText(t.input);
  console.log(`Input: ${t.input}`);
  console.log(`Result: ${JSON.stringify(res)}`);
  console.log('---');
});
