export type BillDetectionResult =
  | { isBill: true; carrier: string; confidence: "alta" | "media" }
  | { isBill: false };

const CARRIERS: { name: string; tokens: string[] }[] = [
  { name: "Claro",      tokens: ["claro s.a", "claro brasil", "claro movel", "net servicos", "embratel"] },
  { name: "Vivo",       tokens: ["telefonica brasil", "vivo s.a", "vivo s/a", "telefonica"] },
  { name: "TIM",        tokens: ["tim celular", "tim brasil", "tim s.a", "tim s/a"] },
  { name: "Oi",         tokens: ["telemar", "oi s.a", "oi movel", "oi s/a"] },
  { name: "Nextel",     tokens: ["nextel", "nii holdings", "claro nextel"] },
  { name: "Algar",      tokens: ["algar telecom", "ctbc", "algar movel"] },
  { name: "Sercomtel",  tokens: ["sercomtel"] },
];

const BILL_SIGNALS = [
  "data de vencimento", "vencimento", "fatura", "total a pagar",
  "valor total", "segunda via", "periodo de", "ciclo", "plano",
  "linha", "ddd", "mensalidade",
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");
}

export function detectPhoneBill(text: string): BillDetectionResult {
  const normalized = normalize(text);

  const signalCount = BILL_SIGNALS.filter((s) => normalized.includes(s)).length;

  const carrier = CARRIERS.find((c) => c.tokens.some((t) => normalized.includes(t)));

  if (carrier) {
    if (signalCount < 1) return { isBill: false };
    return {
      isBill: true,
      carrier: carrier.name,
      confidence: signalCount >= 2 ? "alta" : "media",
    };
  }

  if (signalCount >= 3) {
    return { isBill: true, carrier: "Operadora Desconhecida", confidence: "media" };
  }

  return { isBill: false };
}
