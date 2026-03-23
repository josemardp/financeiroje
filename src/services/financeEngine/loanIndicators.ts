import type { LoanRaw, InstallmentRaw, ExtraAmortizationRaw, LoanIndicatorResult, LoanSummary } from "./types";

/**
 * Calcula indicadores determinísticos por empréstimo.
 * Função PURA.
 */
export function calculateLoanIndicators(
  loans: LoanRaw[],
  installments: InstallmentRaw[],
  extraAmortizations: ExtraAmortizationRaw[]
): LoanSummary {
  if (!loans || loans.length === 0) {
    return { loans: [], totalSaldoDevedor: 0, totalCustoRestante: 0, totalParcelas: 0 };
  }

  const installmentsByLoan = groupBy(installments || [], "emprestimo_id");
  const amortByLoan = groupBy(extraAmortizations || [], "emprestimo_id");

  const results: LoanIndicatorResult[] = loans
    .filter((l) => l.ativo !== false)
    .map((loan) => {
      const loanInstallments = installmentsByLoan.get(loan.id) || [];
      const loanAmortizations = amortByLoan.get(loan.id) || [];

      const paidInstallments = loanInstallments.filter((i) => i.status === "pago" || i.data_pagamento);
      const pendingInstallments = loanInstallments.filter((i) => i.status !== "pago" && !i.data_pagamento);

      const totalJaPago = round2(
        paidInstallments.reduce((s, i) => s + Number(i.valor), 0) +
        loanAmortizations.reduce((s, a) => s + Number(a.valor), 0)
      );

      const saldoAtual = Number(loan.saldo_devedor) || Math.max(0, Number(loan.valor_original) - totalJaPago);
      const parcelasRestantes = Number(loan.parcelas_restantes) || pendingInstallments.length;
      const valorParcela = Number(loan.valor_parcela) || (pendingInstallments[0] ? Number(pendingInstallments[0].valor) : 0);
      const custoEstimadoRestante = round2(parcelasRestantes * valorParcela);
      const totalAPagar = round2(totalJaPago + custoEstimadoRestante);

      // Impacto de uma amortização extra: redução nos juros futuros estimada
      const taxaMensal = Number(loan.taxa_juros_mensal) || 0;
      const impactoAmortizacaoExtra = taxaMensal > 0 && parcelasRestantes > 0
        ? round2(saldoAtual * (taxaMensal / 100) * parcelasRestantes * 0.5) // estimativa simplificada
        : 0;

      return {
        loanId: loan.id,
        loanName: loan.nome,
        saldoAtual: round2(saldoAtual),
        parcelasRestantes,
        custoEstimadoRestante,
        totalJaPago,
        totalAPagar,
        impactoAmortizacaoExtra,
        taxaMensal,
        cetAnual: Number(loan.cet_anual) || 0,
      };
    });

  return {
    loans: results,
    totalSaldoDevedor: round2(results.reduce((s, r) => s + r.saldoAtual, 0)),
    totalCustoRestante: round2(results.reduce((s, r) => s + r.custoEstimadoRestante, 0)),
    totalParcelas: results.reduce((s, r) => s + r.parcelasRestantes, 0),
  };
}

function groupBy<T>(items: T[], key: keyof T): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = String(item[key]);
    const arr = map.get(k) || [];
    arr.push(item);
    map.set(k, arr);
  }
  return map;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
