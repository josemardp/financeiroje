/**
 * FinanceAI — Parser de Resposta da IA (Hardened)
 * 
 * Suporta dois formatos:
 * 1. JSON estruturado (preferido) — { blocks: [...] }
 * 2. Marcadores textuais (fallback) — [FATO], [ALERTA], etc.
 */
import type { AiResponseBlock, AiStructuredResponse } from "./types";

const BLOCK_PATTERNS: Array<{ marker: RegExp; type: AiResponseBlock["type"]; icon: string }> = [
  { marker: /\[FATO\]/i, type: "fact", icon: "✅" },
  { marker: /\[ALERTA\]/i, type: "alert", icon: "⚠️" },
  { marker: /\[SUGEST[ÃA]O\]/i, type: "suggestion", icon: "💡" },
  { marker: /\[PROJE[ÇC][ÃA]O\]/i, type: "projection", icon: "📈" },
  { marker: /\[PERGUNTA\]/i, type: "question", icon: "❓" },
];

const VALID_TYPES = new Set(["fact", "alert", "suggestion", "projection", "question"]);

export function parseAiResponse(rawText: string): AiStructuredResponse {
  // Try JSON structured format first
  const jsonBlocks = tryParseJson(rawText);
  if (jsonBlocks) {
    return {
      blocks: jsonBlocks,
      rawText,
      disclaimer: "Os valores numéricos foram calculados pela engine determinística. A IA interpreta, não calcula.",
      contextSummary: buildContextSummary(jsonBlocks),
    };
  }

  // Fallback: marker-based parsing
  const blocks = parseMarkerBased(rawText);

  return {
    blocks,
    rawText,
    disclaimer: "Os valores numéricos foram calculados pela engine determinística. A IA interpreta, não calcula.",
    contextSummary: buildContextSummary(blocks),
  };
}

/** Try to extract JSON blocks from the response (may be wrapped in markdown code fences) */
function tryParseJson(text: string): AiResponseBlock[] | null {
  // Extract JSON from code fences if present
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  const jsonCandidate = fenceMatch ? fenceMatch[1].trim() : text.trim();

  // Only try if it looks like JSON
  if (!jsonCandidate.startsWith("{") && !jsonCandidate.startsWith("[")) return null;

  try {
    const parsed = JSON.parse(jsonCandidate);
    const blocksArray = Array.isArray(parsed) ? parsed : parsed?.blocks;
    if (!Array.isArray(blocksArray)) return null;

    const validBlocks: AiResponseBlock[] = [];
    for (const b of blocksArray) {
      if (!b || typeof b !== "object") continue;
      const type = VALID_TYPES.has(b.type) ? b.type : "fact";
      validBlocks.push({
        type,
        icon: getIcon(type),
        title: typeof b.title === "string" ? b.title : getDefaultTitle(type),
        content: typeof b.content === "string" ? b.content : "",
        severity: b.severity,
        source: b.source,
      });
    }

    return validBlocks.length > 0 ? validBlocks : null;
  } catch {
    return null;
  }
}

function parseMarkerBased(rawText: string): AiResponseBlock[] {
  const blocks: AiResponseBlock[] = [];
  const lines = rawText.split("\n");
  let currentBlock: Partial<AiResponseBlock> | null = null;
  let currentContent: string[] = [];

  const flushBlock = () => {
    if (currentBlock && currentContent.length > 0) {
      blocks.push({
        type: currentBlock.type || "fact",
        icon: currentBlock.icon || "📋",
        title: currentBlock.title || "",
        content: currentContent.join("\n").trim(),
        severity: currentBlock.severity,
        source: currentBlock.source,
      });
    }
    currentBlock = null;
    currentContent = [];
  };

  for (const line of lines) {
    let matched = false;
    for (const pattern of BLOCK_PATTERNS) {
      if (pattern.marker.test(line)) {
        flushBlock();
        const title = line.replace(pattern.marker, "").replace(/^[:\s-]+/, "").trim();
        currentBlock = { type: pattern.type, icon: pattern.icon, title: title || getDefaultTitle(pattern.type) };
        if (pattern.type === "alert") currentBlock.severity = "warning";
        matched = true;
        break;
      }
    }
    if (!matched) {
      if (currentBlock) {
        currentContent.push(line);
      } else if (line.trim()) {
        if (!currentBlock) {
          currentBlock = { type: "fact", icon: "📋", title: "Análise" };
        }
        currentContent.push(line);
      }
    }
  }
  flushBlock();

  if (blocks.length === 0 && rawText.trim()) {
    blocks.push({ type: "fact", icon: "📋", title: "Resposta", content: rawText.trim() });
  }

  return blocks;
}

function getIcon(type: string): string {
  const icons: Record<string, string> = { fact: "✅", alert: "⚠️", suggestion: "💡", projection: "📈", question: "❓" };
  return icons[type] || "📋";
}

function getDefaultTitle(type: string): string {
  const titles: Record<string, string> = { fact: "Fato", alert: "Alerta", suggestion: "Sugestão", projection: "Projeção", question: "Pergunta" };
  return titles[type] || "Info";
}

function buildContextSummary(blocks: AiResponseBlock[]): string {
  return `${blocks.filter(b => b.type === "fact").length} fato(s), ${blocks.filter(b => b.type === "alert").length} alerta(s), ${blocks.filter(b => b.type === "suggestion").length} sugestão(ões)`;
}
