import { describe, it, expect } from "vitest";
import { buildArchetype, type ArchetypeInputs } from "../buildArchetype";

// Base com 3 meses de dados — suficiente para classificar
const base: ArchetypeInputs = {
  monthsWithData: 3,
  avgSavingsRate: 10,
  consistenciaRegistro: "media",
  indicadorEvitacao: 0.1,
  indicadorImpulsividade: 0.2,
  variabilidadeGastos: 0.2,
  hasCriticalAlerts: false,
  reservaBaixaMeta: false,
  comprometimentoMetas: 0.3,
};

describe("buildArchetype", () => {
  it('retorna "indefinido" quando monthsWithData < 3', () => {
    const result = buildArchetype({ ...base, monthsWithData: 2 });
    expect(result.arquetipoFinanceiro).toBe("indefinido");
    expect(result.arquetipoDescricao).toContain("Dados insuficientes");
  });

  it('retorna "indefinido" quando monthsWithData = 0', () => {
    const result = buildArchetype({ ...base, monthsWithData: 0 });
    expect(result.arquetipoFinanceiro).toBe("indefinido");
  });

  it('classifica como "guardiao" — alta consistência, baixa evitação, economia > 15%', () => {
    const result = buildArchetype({
      ...base,
      consistenciaRegistro: "alta",
      indicadorEvitacao: 0.05,
      avgSavingsRate: 20,
    });
    expect(result.arquetipoFinanceiro).toBe("guardiao");
    expect(result.arquetipoDescricao).toContain("Guardião");
  });

  it('classifica como "explorador" — alta impulsividade', () => {
    const result = buildArchetype({
      ...base,
      indicadorImpulsividade: 0.6,
    });
    expect(result.arquetipoFinanceiro).toBe("explorador");
    expect(result.arquetipoDescricao).toContain("Explorador");
  });

  it('classifica como "explorador" — alta variabilidade de gastos', () => {
    const result = buildArchetype({
      ...base,
      indicadorImpulsividade: 0.2,
      variabilidadeGastos: 0.6,
    });
    expect(result.arquetipoFinanceiro).toBe("explorador");
  });

  it('classifica como "lutador" — economia baixa + alertas críticos', () => {
    const result = buildArchetype({
      ...base,
      avgSavingsRate: 2,
      hasCriticalAlerts: true,
      indicadorImpulsividade: 0.2,
      variabilidadeGastos: 0.2,
    });
    expect(result.arquetipoFinanceiro).toBe("lutador");
    expect(result.arquetipoDescricao).toContain("Lutador");
  });

  it('classifica como "lutador" — economia baixa + reserva abaixo da meta', () => {
    const result = buildArchetype({
      ...base,
      avgSavingsRate: 2,
      reservaBaixaMeta: true,
      hasCriticalAlerts: false,
      indicadorImpulsividade: 0.2,
      variabilidadeGastos: 0.2,
    });
    expect(result.arquetipoFinanceiro).toBe("lutador");
  });

  it('classifica como "construtor" — comprometimento alto + economia moderada', () => {
    const result = buildArchetype({
      ...base,
      comprometimentoMetas: 0.7,
      avgSavingsRate: 8,
      indicadorImpulsividade: 0.2,
      variabilidadeGastos: 0.2,
    });
    expect(result.arquetipoFinanceiro).toBe("construtor");
    expect(result.arquetipoDescricao).toContain("Construtor");
  });

  it('retorna "indefinido" quando nenhuma condição é satisfeita (3+ meses, mas perfil ambíguo)', () => {
    // Não é guardiao (consistência baixa), não explorador, não lutador (savings > 5), não construtor (comprometimento baixo)
    const result = buildArchetype({
      ...base,
      consistenciaRegistro: "baixa",
      indicadorEvitacao: 0.5,
      avgSavingsRate: 6,
      comprometimentoMetas: 0.2,
      indicadorImpulsividade: 0.2,
      variabilidadeGastos: 0.2,
      hasCriticalAlerts: false,
      reservaBaixaMeta: false,
    });
    expect(result.arquetipoFinanceiro).toBe("indefinido");
  });

  it("guardiao tem prioridade sobre explorador quando ambas as condições estão presentes", () => {
    // A ordem dos ifs é: guardiao → explorador → lutador → construtor
    // Guardião requer consistencia=alta, evitacao<0.15, savings>15
    // Se ao mesmo tempo impulsividade>0.5, guardiao vence por aparecer primeiro
    const result = buildArchetype({
      ...base,
      consistenciaRegistro: "alta",
      indicadorEvitacao: 0.05,
      avgSavingsRate: 20,
      indicadorImpulsividade: 0.8, // explorador também se encaixaria
    });
    expect(result.arquetipoFinanceiro).toBe("guardiao");
  });
});
