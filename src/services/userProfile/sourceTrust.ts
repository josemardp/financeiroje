/**
 * FinanceiroJe — Score de Confiabilidade da Fonte (§10.3 do Plano)
 *
 * Hierarquia de confiança (1 = mais confiável, 5 = menos):
 *   1 — manual confirmado pelo usuário           → afirmação categórica
 *   2 — texto/voz fornecido pelo usuário         → afirmação categórica
 *   3 — photo_ocr, alta confiança (≥ 0.8)       → afirmação com ressalva leve
 *   4 — photo_ocr, baixa confiança (< 0.8)      → linguagem de incerteza
 *   5 — inferência / fonte desconhecida          → linguagem reflexiva, nunca como fato
 */

export type SourceTrustLevel = 1 | 2 | 3 | 4 | 5;

type ConfidenceInput = string | number | null | undefined;

/**
 * Normaliza confidence para número 0–1.
 * O banco armazena como texto ('alta'/'media'/'baixa') em transactions
 * e como numeric(3,2) em behavioral_tags e capture_learning_events.
 */
function normalizeConfidence(confidence: ConfidenceInput): number {
  if (typeof confidence === "number") return confidence;
  if (confidence === "alta") return 0.9;
  if (confidence === "media") return 0.5;
  if (confidence === "baixa") return 0.2;
  return 0.5; // default quando ausente ou desconhecido
}

/**
 * Retorna o nível de confiabilidade da fonte de um dado.
 *
 * @param source_type — valor do enum source_type do banco
 * @param confidence  — confidence da transação (número 0–1 ou texto 'alta'/'media'/'baixa')
 */
export function getSourceTrust(
  source_type: string | null | undefined,
  confidence: ConfidenceInput = null
): SourceTrustLevel {
  const src = source_type ?? "";
  const conf = normalizeConfidence(confidence);

  if (src === "manual") return 1;
  if (src === "free_text" || src === "voice") return 2;
  if (src === "photo_ocr" && conf >= 0.8) return 3;
  if (src === "photo_ocr") return 4;
  // sms, ai_suggestion, system_generated, null, desconhecido → inferência
  return 5;
}

/**
 * Labels descritivos para uso no systemPrompt.
 * Instrui a IA sobre como expressar cada nível de confiança.
 */
export const SOURCE_TRUST_LABELS: Record<SourceTrustLevel, string> = {
  1: "afirmação categórica (inserido manualmente e confirmado pelo usuário)",
  2: "afirmação categórica (texto ou voz fornecido e confirmado pelo usuário)",
  3: "afirmação com ressalva leve — OCR de fonte conhecida, alta confiança",
  4: 'linguagem de incerteza: "parece que...", "indica..." — OCR com baixa confiança',
  5: 'linguagem reflexiva: "tende a...", "costuma..." — nunca como fato; inferência comportamental ou fonte desconhecida',
};
