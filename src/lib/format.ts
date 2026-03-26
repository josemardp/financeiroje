// FinanceAI — Format utilities
import { LOCALE, CURRENCY } from "./constants";

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: CURRENCY,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat(LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(typeof date === "string" ? new Date(date) : date);
}

export function formatDateShort(date: string | Date): string {
  return new Intl.DateTimeFormat(LOCALE, {
    day: "2-digit",
    month: "short",
  }).format(typeof date === "string" ? new Date(date) : date);
}

export function formatPercent(value: number): string {
  return new Intl.NumberFormat(LOCALE, {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value / 100);
}

export function formatMonthYear(month: number, year: number): string {
  const date = new Date(year, month - 1, 1);
  return new Intl.DateTimeFormat(LOCALE, {
    month: "long",
    year: "numeric",
  }).format(date);
}

// Exportado para componentes de auditoria e fechamento.
export function formatTime(date: string | Date): string {
  return new Intl.DateTimeFormat(LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(typeof date === "string" ? new Date(date) : date);
}
