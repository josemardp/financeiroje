/**
 * FinanceAI — Utilitários de Metadados e Rastreabilidade
 * Funções para adicionar, validar e gerenciar metadados de dados financeiros.
 */

import type { DataMetadata } from "./contracts";

/**
 * Cria metadados padrão para um novo dado.
 */
export function createMetadata(
  source: DataMetadata["source"],
  confidence: DataMetadata["confidence"],
  status: DataMetadata["status"],
  createdBy?: string
): DataMetadata {
  const now = new Date().toISOString();
  return {
    source,
    confidence,
    status,
    createdAt: now,
    updatedAt: now,
    createdBy,
  };
}

/**
 * Atualiza metadados existentes.
 */
export function updateMetadata(
  metadata: DataMetadata,
  updates: Partial<Omit<DataMetadata, "createdAt" | "createdBy">>
): DataMetadata {
  return {
    ...metadata,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Determina o status de um dado com base em suas características.
 */
export function inferDataStatus(data: {
  hasRequiredFields: boolean;
  hasConflicts: boolean;
  isEstimate: boolean;
  userConfirmed: boolean;
}): DataMetadata["status"] {
  if (data.hasConflicts) return "inconsistent";
  if (!data.hasRequiredFields) return "incomplete";
  if (data.isEstimate) return "estimated";
  if (data.userConfirmed) return "confirmed";
  return "suggested";
}

/**
 * Determina o nível de confiança com base em múltiplos fatores.
 */
export function inferConfidenceLevel(data: {
  dataCompleteness: number; // 0-100
  sourceReliability: number; // 0-100
  userConfidence?: "alta" | "media" | "baixa";
}): DataMetadata["confidence"] {
  if (data.userConfidence) return data.userConfidence;

  const avgScore = (data.dataCompleteness + data.sourceReliability) / 2;

  if (avgScore >= 80) return "alta";
  if (avgScore >= 50) return "media";
  return "baixa";
}

/**
 * Valida se os metadados estão completos e consistentes.
 */
export function validateMetadata(metadata: DataMetadata): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!metadata.status) errors.push("Status é obrigatório");
  if (!metadata.createdAt) errors.push("createdAt é obrigatório");
  if (!metadata.updatedAt) errors.push("updatedAt é obrigatório");

  const createdDate = new Date(metadata.createdAt);
  const updatedDate = new Date(metadata.updatedAt);

  if (createdDate > updatedDate) {
    errors.push("createdAt não pode ser posterior a updatedAt");
  }

  if (metadata.createdBy && metadata.updatedBy) {
    if (createdDate > updatedDate && metadata.createdBy !== metadata.updatedBy) {
      errors.push("Se createdBy !== updatedBy, updatedAt deve ser > createdAt");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Calcula a qualidade geral dos metadados.
 */
export function calculateMetadataQuality(metadata: DataMetadata): {
  score: number; // 0-100
  level: "excelente" | "bom" | "aceitavel" | "ruim";
} {
  let score = 0;

  // Status definido (25 pontos)
  if (metadata.status) score += 25;

  // Timestamps válidos (25 pontos)
  if (metadata.createdAt && metadata.updatedAt) {
    const createdDate = new Date(metadata.createdAt);
    const updatedDate = new Date(metadata.updatedAt);
    if (createdDate <= updatedDate) score += 25;
  }

  // Source definido (20 pontos)
  if (metadata.source) score += 20;

  // Confidence definido (20 pontos)
  if (metadata.confidence) score += 20;

  // Rastreabilidade completa (10 pontos)
  if (metadata.createdBy && metadata.updatedBy) score += 10;

  let level: "excelente" | "bom" | "aceitavel" | "ruim";
  if (score >= 90) level = "excelente";
  else if (score >= 70) level = "bom";
  else if (score >= 50) level = "aceitavel";
  else level = "ruim";

  return { score, level };
}

/**
 * Agrupa dados por status para análise.
 */
export function groupByStatus<T extends { metadata: DataMetadata }>(
  items: T[]
): Record<DataMetadata["status"], T[]> {
  const grouped: Record<DataMetadata["status"], T[]> = {
    confirmed: [],
    suggested: [],
    incomplete: [],
    inconsistent: [],
    missing: [],
    estimated: [],
  };

  for (const item of items) {
    grouped[item.metadata.status].push(item);
  }

  return grouped;
}

/**
 * Agrupa dados por source para análise.
 */
export function groupBySource<T extends { metadata: DataMetadata }>(
  items: T[]
): Record<string, T[]> {
  const grouped: Record<string, T[]> = {};

  for (const item of items) {
    const source = item.metadata.source || "unknown";
    if (!grouped[source]) grouped[source] = [];
    grouped[source].push(item);
  }

  return grouped;
}

/**
 * Agrupa dados por confidence para análise.
 */
export function groupByConfidence<T extends { metadata: DataMetadata }>(
  items: T[]
): Record<string, T[]> {
  const grouped: Record<string, T[]> = {};

  for (const item of items) {
    const confidence = item.metadata.confidence || "unknown";
    if (!grouped[confidence]) grouped[confidence] = [];
    grouped[confidence].push(item);
  }

  return grouped;
}

/**
 * Calcula estatísticas de metadados para um conjunto de dados.
 */
export function calculateMetadataStats(items: Array<{ metadata: DataMetadata }>) {
  const stats = {
    total: items.length,
    byStatus: {
      confirmed: 0,
      suggested: 0,
      incomplete: 0,
      inconsistent: 0,
      missing: 0,
      estimated: 0,
    },
    byConfidence: {
      alta: 0,
      media: 0,
      baixa: 0,
      unknown: 0,
    },
    bySource: {} as Record<string, number>,
    averageQualityScore: 0,
    qualityDistribution: {
      excelente: 0,
      bom: 0,
      aceitavel: 0,
      ruim: 0,
    },
  };

  let totalQualityScore = 0;

  for (const item of items) {
    const { metadata } = item;

    // Status
    stats.byStatus[metadata.status]++;

    // Confidence
    if (metadata.confidence) {
      stats.byConfidence[metadata.confidence]++;
    } else {
      stats.byConfidence.unknown++;
    }

    // Source
    const source = metadata.source || "unknown";
    stats.bySource[source] = (stats.bySource[source] || 0) + 1;

    // Quality
    const quality = calculateMetadataQuality(metadata);
    totalQualityScore += quality.score;
    stats.qualityDistribution[quality.level]++;
  }

  stats.averageQualityScore = items.length > 0 ? totalQualityScore / items.length : 0;

  return stats;
}

/**
 * Gera um relatório de rastreabilidade para um dado.
 */
export function generateTraceabilityReport(metadata: DataMetadata): string {
  const lines: string[] = [];

  lines.push("=== RELATÓRIO DE RASTREABILIDADE ===");
  lines.push("");

  lines.push(`Status: ${metadata.status}`);
  lines.push(`Confiança: ${metadata.confidence || "não definida"}`);
  lines.push(`Origem: ${metadata.source || "não definida"}`);
  lines.push("");

  lines.push(`Criado em: ${new Date(metadata.createdAt).toLocaleString("pt-BR")}`);
  if (metadata.createdBy) lines.push(`Criado por: ${metadata.createdBy}`);

  lines.push(`Atualizado em: ${new Date(metadata.updatedAt).toLocaleString("pt-BR")}`);
  if (metadata.updatedBy) lines.push(`Atualizado por: ${metadata.updatedBy}`);

  lines.push("");

  const quality = calculateMetadataQuality(metadata);
  lines.push(`Qualidade dos Metadados: ${quality.level} (${quality.score}/100)`);

  const validation = validateMetadata(metadata);
  if (!validation.valid) {
    lines.push("");
    lines.push("⚠️ Problemas Detectados:");
    validation.errors.forEach((err) => lines.push(`  - ${err}`));
  }

  return lines.join("\n");
}
