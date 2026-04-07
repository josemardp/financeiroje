/**
 * userProfile/buildArchetype.ts
 *
 * Função pura: classifica o arquétipo financeiro do usuário a partir de
 * métricas comportamentais pré-calculadas.
 *
 * Não faz IO. Sem imports de Supabase.
 * Usada tanto pelo contextCollector (Advisor) quanto pelo snapshot (Captura).
 */

export interface ArchetypeInputs {
  /** Quantidade de meses com dados no histórico disponível */
  monthsWithData: number;
  /** Média da taxa de economia (savingsRate) nos meses disponíveis. 0 se sem dados. */
  avgSavingsRate: number;
  consistenciaRegistro: "alta" | "media" | "baixa";
  /** 0-1: ratio de transações pendentes / total. Passar 0 quando não disponível. */
  indicadorEvitacao: number;
  /** 0-1: ratio de despesas pequenas (<R$50) / total de despesas. */
  indicadorImpulsividade: number;
  /** Coeficiente de variação dos gastos mensais. 0 quando <3 meses. */
  variabilidadeGastos: number;
  /** true se houver alertas críticos ativos. Passar false quando não disponível. */
  hasCriticalAlerts: boolean;
  /** true se reserva de emergência estiver abaixo da meta. Passar false quando não disponível. */
  reservaBaixaMeta: boolean;
  /** 0-1: metas com progresso / metas ativas. Passar 0 quando não disponível. */
  comprometimentoMetas: number;
}

export interface ArchetypeResult {
  arquetipoFinanceiro: "guardiao" | "explorador" | "lutador" | "construtor" | "indefinido";
  arquetipoDescricao: string;
}

/**
 * Classifica o arquétipo financeiro com base em métricas comportamentais.
 * Requer pelo menos 3 meses de histórico para emitir um arquétipo concreto;
 * retorna "indefinido" caso contrário.
 */
export function buildArchetype(inputs: ArchetypeInputs): ArchetypeResult {
  const {
    monthsWithData,
    avgSavingsRate,
    consistenciaRegistro,
    indicadorEvitacao,
    indicadorImpulsividade,
    variabilidadeGastos,
    hasCriticalAlerts,
    reservaBaixaMeta,
    comprometimentoMetas,
  } = inputs;

  if (monthsWithData < 3) {
    return {
      arquetipoFinanceiro: "indefinido",
      arquetipoDescricao: "Dados insuficientes para identificar perfil comportamental com segurança.",
    };
  }

  if (consistenciaRegistro === "alta" && indicadorEvitacao < 0.15 && avgSavingsRate > 15) {
    return {
      arquetipoFinanceiro: "guardiao",
      arquetipoDescricao:
        "Perfil Guardião: disciplinado, consistente e avesso ao risco. Tende a manter controle rígido das finanças, mas pode perder oportunidades por excesso de cautela ou dificuldade em delegar decisões financeiras.",
    };
  }

  if (indicadorImpulsividade > 0.5 || variabilidadeGastos > 0.5) {
    return {
      arquetipoFinanceiro: "explorador",
      arquetipoDescricao:
        "Perfil Explorador: espontâneo, variável e orientado ao presente. Vive intensamente o momento financeiro, mas tende a comprometer metas de longo prazo. Costuma ter dificuldade em manter orçamentos fixos.",
    };
  }

  if (avgSavingsRate < 5 && (hasCriticalAlerts || reservaBaixaMeta)) {
    return {
      arquetipoFinanceiro: "lutador",
      arquetipoDescricao:
        "Perfil Lutador: opera sob pressão financeira constante, com margens apertadas. O foco em sobrevivência do mês dificulta o planejamento de longo prazo. Tendência a adiar decisões difíceis.",
    };
  }

  if (comprometimentoMetas > 0.5 && avgSavingsRate > 5) {
    return {
      arquetipoFinanceiro: "construtor",
      arquetipoDescricao:
        "Perfil Construtor: orientado a metas e crescimento progressivo. Equilibra presente e futuro com foco em acumulação. Tende a ser paciente, mas pode sentir frustração em períodos de estagnação.",
    };
  }

  return {
    arquetipoFinanceiro: "indefinido",
    arquetipoDescricao: "Dados insuficientes para identificar perfil comportamental com segurança.",
  };
}
