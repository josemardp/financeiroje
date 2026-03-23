/**
 * FinanceAI — Parser de Resposta da IA
 * 
 * Transforma a resposta textual da IA em blocos estruturados.
 * A IA é instruída a usar markers como [FATO], [ALERTA], [SUGESTÃO], [PROJEÇÃO], [PERGUNTA].
 */
import type { AiResponseBlock, AiStructuredResponse } from "./types";

const BLOCK_PATTERNS: Array<{ marker: RegExp; type: AiResponseBlock["type"]; icon: string }> = [
  { marker: /\[FATO\]/i, type: "fact", icon: "✅" },
  { marker: /\[ALERTA\]/i, type: "alert", icon: "⚠️" },
  { marker: /\[SUGEST[ÃA]O\]/i, type: "suggestion", icon: "💡" },
  { marker: /\[PROJE[ÇC][ÃA]O\]/i, type: "projection", icon: "📈" },
  { marker: /\[PERGUNTA\]/i, type: "question", icon: "❓" },
];

export function parseAiResponse(rawText: string): AiStructuredResponse {
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
      } else {
        // Lines before any marker are general facts
        if (line.trim()) {
          if (!currentBlock) {
            currentBlock = { type: "fact", icon: "📋", title: "Análise" };
          }
          currentContent.push(line);
        }
      }
    }
  }
  flushBlock();

  // If no blocks were parsed, treat entire response as a single block
  if (blocks.length === 0 && rawText.trim()) {
    blocks.push({
      type: "fact",
      icon: "📋",
      title: "Resposta",
      content: rawText.trim(),
    });
  }

  return {
    blocks,
    rawText,
    disclaimer: "Os valores numéricos foram calculados pela engine determinística. A IA interpreta, não calcula.",
    contextSummary: `${blocks.filter(b => b.type === "fact").length} fato(s), ${blocks.filter(b => b.type === "alert").length} alerta(s), ${blocks.filter(b => b.type === "suggestion").length} sugestão(ões)`,
  };
}

function getDefaultTitle(type: AiResponseBlock["type"]): string {
  const titles: Record<string, string> = {
    fact: "Fato",
    alert: "Alerta",
    suggestion: "Sugestão",
    projection: "Projeção",
    question: "Pergunta",
  };
  return titles[type] || "Info";
}
