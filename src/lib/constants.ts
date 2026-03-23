export const APP_NAME = "FinanceAI";
export const APP_DESCRIPTION = "Assistente Financeiro Familiar com IA";

export const CURRENCY = "BRL";
export const LOCALE = "pt-BR";

export const DATA_STATUS_LABELS: Record<string, string> = {
  confirmed: "Confirmado",
  suggested: "Sugerido",
  incomplete: "Incompleto",
  inconsistent: "Inconsistente",
  missing: "Ausente",
  estimated: "Estimativa",
};

export const SOURCE_TYPE_LABELS: Record<string, string> = {
  manual: "Manual",
  voice: "Voz",
  photo_ocr: "Foto/OCR",
  free_text: "Texto livre",
  sms: "SMS",
  ai_suggestion: "Sugestão IA",
  system_generated: "Sistema",
};

export const SCOPE_LABELS: Record<string, string> = {
  private: "Pessoal",
  family: "Família",
  business: "Negócio/MEI",
};

export const ALERT_LEVEL_LABELS: Record<string, string> = {
  critical: "Crítico",
  warning: "Atenção",
  info: "Informação",
  opportunity: "Oportunidade",
};

export const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  income: "Receita",
  expense: "Despesa",
};
