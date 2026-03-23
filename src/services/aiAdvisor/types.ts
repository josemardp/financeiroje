/**
 * FinanceAI — Tipos para IA Conselheira
 * 
 * Protocolo zero-alucinação:
 * - facts: dados confirmados pela engine
 * - alerts: alertas baseados em regras
 * - suggestions: sugestões interpretativas da IA
 * - questions: perguntas para esclarecer dados
 */

export interface AiResponseBlock {
  type: "fact" | "alert" | "suggestion" | "question" | "projection";
  icon?: string;
  title: string;
  content: string;
  severity?: "critical" | "warning" | "info" | "opportunity";
  source?: string; // e.g. "engine:monthlySummary", "engine:healthScore"
}

export interface AiStructuredResponse {
  blocks: AiResponseBlock[];
  rawText: string;
  disclaimer: string;
  contextSummary: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  structuredBlocks?: AiResponseBlock[];
  timestamp: string;
  contextSnapshot?: Record<string, unknown>;
}

export interface Conversation {
  id: string;
  titulo: string | null;
  messages: ChatMessage[];
  createdAt: string;
}
