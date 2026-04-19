import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildDiff, confidenceToNumeric } from "../captureLearningEvents";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() =>
            Promise.resolve({ data: { id: "abc-123" }, error: null })
          ),
        })),
      })),
    })),
  },
}));

import { recordCaptureLearningEvent } from "../captureLearningEvents";

const base = {
  valor: "100",
  tipo: "expense",
  descricao: "Mercado",
  data: "2026-04-19",
  categoria_id: "cat-1",
  scope: "private",
  source_type: "text",
};

describe("buildDiff", () => {
  it("aceita todos os campos quando ai === user", () => {
    const { acceptedFields, correctedFields, fieldDiff } = buildDiff(base, base);
    expect(acceptedFields).toHaveLength(6);
    expect(correctedFields).toHaveLength(0);
    expect(fieldDiff).toEqual({});
  });

  it("detecta correção de valor", () => {
    const user = { ...base, valor: "150" };
    const { correctedFields, fieldDiff } = buildDiff(base, user);
    expect(correctedFields).toContain("valor");
    expect(fieldDiff.valor).toEqual({ before: "100", after: "150" });
  });

  it("detecta correção de tipo", () => {
    const user = { ...base, tipo: "income" };
    const { correctedFields } = buildDiff(base, user);
    expect(correctedFields).toContain("tipo");
  });

  it("múltiplas correções simultâneas", () => {
    const user = { ...base, valor: "200", categoria_id: "cat-2", scope: "family" };
    const { correctedFields, acceptedFields } = buildDiff(base, user);
    expect(correctedFields).toHaveLength(3);
    expect(acceptedFields).toHaveLength(3);
  });

  it("não inclui source_type no diff (campo não rastreado)", () => {
    const user = { ...base, source_type: "ocr" };
    const { correctedFields } = buildDiff(base, user);
    expect(correctedFields).toHaveLength(0);
  });
});

describe("confidenceToNumeric", () => {
  it("alta → 0.90", () => expect(confidenceToNumeric("alta")).toBe(0.90));
  it("media → 0.65", () => expect(confidenceToNumeric("media")).toBe(0.65));
  it("baixa → 0.40", () => expect(confidenceToNumeric("baixa")).toBe(0.40));
  it("undefined → null", () => expect(confidenceToNumeric(undefined)).toBeNull());
});

describe("recordCaptureLearningEvent", () => {
  it("retorna id quando supabase insere com sucesso", async () => {
    const result = await recordCaptureLearningEvent({
      userId: "user-1",
      scope: "private",
      sourceType: "text",
      rawInput: "mercado 100",
      aiSuggested: base,
      userConfirmed: base,
    });
    expect(result.id).toBe("abc-123");
  });

  it("retorna { id: null } quando supabase retorna erro na resposta", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    vi.mocked(supabase.from).mockReturnValueOnce({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() =>
            Promise.resolve({ data: null, error: new Error("db error") })
          ),
        })),
      })),
    } as any);

    const result = await recordCaptureLearningEvent({
      userId: "user-1",
      scope: "private",
      sourceType: "text",
      rawInput: "teste",
      aiSuggested: base,
      userConfirmed: base,
    });
    expect(result.id).toBeNull();
  });

  it("retorna { id: null } quando supabase lança exceção", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    vi.mocked(supabase.from).mockReturnValueOnce({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.reject(new Error("network error"))),
        })),
      })),
    } as any);

    const result = await recordCaptureLearningEvent({
      userId: "user-1",
      scope: "private",
      sourceType: "text",
      rawInput: "teste",
      aiSuggested: base,
      userConfirmed: base,
    });
    expect(result.id).toBeNull();
  });
});
