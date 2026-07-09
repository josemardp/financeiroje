export type BankNotificationAmountCheck = {
  amounts: number[];
  hasExactlyOneAmount: boolean;
};

/**
 * Localiza valores monetários escritos literalmente em notificações bancárias.
 * Não deduz valores a partir de parcelas, limites ou outros números do texto.
 */
export function checkBankNotificationAmounts(text: string): BankNotificationAmountCheck {
  const amounts: number[] = [];
  const matches = text.matchAll(/(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}|\d+\.\d{2})/gi);

  for (const match of matches) {
    const normalized = match[1].replace(/\./g, "").replace(",", ".");
    const amount = Number(normalized);

    if (Number.isFinite(amount) && amount > 0 && amount <= 1_000_000) {
      amounts.push(amount);
    }
  }

  return { amounts, hasExactlyOneAmount: amounts.length === 1 };
}
