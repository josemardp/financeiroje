export const MIN_PASSWORD_LENGTH = 8;

export function validatePasswordStrength(password: string): string | null {
  const normalized = password.trim();

  if (normalized.length < MIN_PASSWORD_LENGTH) {
    return `Senha deve ter no mínimo ${MIN_PASSWORD_LENGTH} caracteres.`;
  }

  if (!/[A-Za-zÀ-ÿ]/.test(normalized)) {
    return "Senha deve conter pelo menos uma letra.";
  }

  if (!/\d/.test(normalized)) {
    return "Senha deve conter pelo menos um número.";
  }

  return null;
}

export function normalizeConfirmationPhrase(value: string): string {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

export function matchesConfirmationPhrase(value: string, expected: string): boolean {
  return normalizeConfirmationPhrase(value) === normalizeConfirmationPhrase(expected);
}
