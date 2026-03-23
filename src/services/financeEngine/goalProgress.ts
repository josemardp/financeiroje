import type { GoalRaw, GoalContributionRaw, GoalProgressResult } from "./types";

/**
 * Calcula o progresso de cada meta/sonho.
 * Função PURA.
 */
export function calculateGoalProgress(
  goals: GoalRaw[],
  contributions: GoalContributionRaw[]
): GoalProgressResult[] {
  if (!goals || goals.length === 0) return [];

  const contribByGoal = new Map<string, GoalContributionRaw[]>();
  for (const c of contributions || []) {
    const arr = contribByGoal.get(c.goal_id) || [];
    arr.push(c);
    contribByGoal.set(c.goal_id, arr);
  }

  return goals.map((g) => {
    const goalContribs = contribByGoal.get(g.id) || [];
    const totalContributed = goalContribs.reduce((s, c) => s + Number(c.valor), 0);
    const valorAtual = Number(g.valor_atual) || 0;
    const valorAlvo = Number(g.valor_alvo) || 1;
    const currentValue = Math.max(valorAtual, totalContributed);

    const progressPercent = round2(Math.min(100, (currentValue / valorAlvo) * 100));
    const remainingAmount = round2(Math.max(0, valorAlvo - currentValue));

    // Project completion date based on average monthly contribution
    let projectedCompletionDate: string | null = null;
    let monthlyContributionNeeded: number | null = null;
    let isOnTrack = false;

    if (g.prazo) {
      const deadline = new Date(g.prazo);
      const now = new Date();
      const monthsRemaining = Math.max(1,
        (deadline.getFullYear() - now.getFullYear()) * 12 +
        (deadline.getMonth() - now.getMonth())
      );

      monthlyContributionNeeded = remainingAmount > 0
        ? round2(remainingAmount / monthsRemaining)
        : 0;

      // Check if on track based on contribution history
      if (goalContribs.length >= 2) {
        const sorted = [...goalContribs].sort((a, b) => a.data.localeCompare(b.data));
        const firstDate = new Date(sorted[0].data);
        const monthsElapsed = Math.max(1,
          (now.getFullYear() - firstDate.getFullYear()) * 12 +
          (now.getMonth() - firstDate.getMonth())
        );
        const avgMonthly = totalContributed / monthsElapsed;

        if (avgMonthly > 0 && remainingAmount > 0) {
          const monthsToComplete = remainingAmount / avgMonthly;
          const completionDate = new Date(now);
          completionDate.setMonth(completionDate.getMonth() + Math.ceil(monthsToComplete));
          projectedCompletionDate = completionDate.toISOString().split("T")[0];
          isOnTrack = completionDate <= deadline;
        }
      }

      if (remainingAmount === 0) isOnTrack = true;
    }

    return {
      goalId: g.id,
      goalName: g.nome,
      progressPercent,
      remainingAmount,
      projectedCompletionDate,
      monthlyContributionNeeded,
      isOnTrack,
      totalContributed: round2(totalContributed),
    };
  });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
