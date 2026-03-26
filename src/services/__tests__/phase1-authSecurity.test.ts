import { describe, expect, it } from "vitest";
import {
  MIN_PASSWORD_LENGTH,
  matchesConfirmationPhrase,
  normalizeConfirmationPhrase,
  validatePasswordStrength,
} from "@/lib/authSecurity";

describe("authSecurity", () => {
  it("rejects short passwords", () => {
    expect(validatePasswordStrength("abc123")).toContain(String(MIN_PASSWORD_LENGTH));
  });

  it("rejects passwords without letters", () => {
    expect(validatePasswordStrength("12345678")).toContain("letra");
  });

  it("rejects passwords without numbers", () => {
    expect(validatePasswordStrength("abcdefgh")).toContain("número");
  });

  it("accepts strong password", () => {
    expect(validatePasswordStrength("Finance123")).toBeNull();
  });

  it("normalizes confirmation phrases", () => {
    expect(normalizeConfirmationPhrase("  excluir   minha conta ")).toBe("EXCLUIR MINHA CONTA");
  });

  it("matches confirmation phrase ignoring spacing and case", () => {
    expect(matchesConfirmationPhrase(" excluir   meus dados ", "EXCLUIR MEUS DADOS")).toBe(true);
  });
});
