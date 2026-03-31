import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SmartCapture from "../SmartCapture";

const mocks = vi.hoisted(() => ({
  transactionInsert: vi.fn(),
  transactionUpdate: vi.fn(),
  learningInsert: vi.fn(),
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-smartcapture-test" },
  }),
}));

vi.mock("@/contexts/ScopeContext", () => ({
  useScope: () => ({
    currentScope: "private",
    scopeLabel: "Pessoal",
  }),
}));

vi.mock("@/services/smartCapture/hooks/useVoiceCapture", () => ({
  useVoiceCapture: () => ({
    isRecording: false,
    isTranscribing: false,
    result: null,
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
    resetVoice: vi.fn(),
  }),
}));

vi.mock("@/services/smartCapture/hooks/useOcrCapture", () => ({
  useOcrCapture: () => ({
    isProcessing: false,
    result: null,
    processImage: vi.fn(),
    resetOcr: vi.fn(),
  }),
}));

vi.mock("@/components/shared/PageHeader", () => ({
  PageHeader: ({ title, description }: { title: string; description?: string }) => (
    <div>
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
    </div>
  ),
}));

vi.mock("@/components/shared/DataStatusBadge", () => ({
  DataStatusBadge: ({ status }: { status: string }) => <span>{status}</span>,
}));

vi.mock("sonner", () => ({
  toast: mocks.toast,
}));

vi.mock("@/integrations/supabase/client", () => {
  const categories = [{ id: "cat-food", nome: "Alimentação", icone: "🍕" }];

  return {
    supabase: {
      from: vi.fn((table: string) => {
        if (table === "categories") {
          return {
            select: vi.fn(() => ({
              order: vi.fn(async () => ({ data: categories, error: null })),
            })),
          };
        }

        if (table === "transactions") {
          return {
            insert: mocks.transactionInsert.mockImplementation((payload) => ({
              select: vi.fn(() => ({
                single: vi.fn(async () => ({ data: { id: "tx-smartcapture-test" }, error: null })),
              })),
            })),
            update: mocks.transactionUpdate.mockImplementation((payload) => ({
              eq: vi.fn(() => ({
                eq: vi.fn(async () => ({ error: null })),
              })),
            })),
          };
        }

        if (table === "smart_capture_learning") {
          return {
            insert: mocks.learningInsert.mockImplementation(async (payload) => ({ error: null })),
          };
        }

        throw new Error(`Unexpected table in SmartCapture test: ${table}`);
      }),
    },
  };
});

function renderSmartCapture() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <SmartCapture />
    </QueryClientProvider>,
  );
}

describe("SmartCapture integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("bloqueia persistência sem confirmação explícita no Modo Espelho", async () => {
    renderSmartCapture();

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "gastei 52,00 com pizza hoje" },
    });

    fireEvent.click(screen.getByRole("button", { name: /interpretar com ia/i }));

    await screen.findByRole("heading", { name: /modo espelho/i });

    const saveButton = screen.getByRole("button", { name: /confirmar e salvar/i }) as HTMLButtonElement;

    expect(saveButton).toBeDisabled();

    saveButton.disabled = false;
    saveButton.removeAttribute("disabled");
    fireEvent.click(saveButton);

    expect(mocks.transactionInsert).not.toHaveBeenCalled();
    expect(mocks.learningInsert).not.toHaveBeenCalled();
    expect(mocks.transactionUpdate).not.toHaveBeenCalled();
    expect(mocks.toast.error).toHaveBeenCalledWith("Confirme explicitamente a revisão antes de salvar");
  });

  it("permite tentativa de persistência após confirmação explícita no Modo Espelho", async () => {
    renderSmartCapture();

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "gastei 52,00 com pizza hoje" },
    });

    fireEvent.click(screen.getByRole("button", { name: /interpretar com ia/i }));

    await screen.findByRole("heading", { name: /modo espelho/i });

    const saveButton = screen.getByRole("button", { name: /confirmar e salvar/i });

    expect(saveButton).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox"));

    await waitFor(() => {
      expect(saveButton).toBeEnabled();
    });

    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mocks.transactionInsert).toHaveBeenCalledTimes(1);
      expect(mocks.learningInsert).toHaveBeenCalledTimes(1);
      expect(mocks.transactionUpdate).toHaveBeenCalledTimes(1);
    });

    expect(mocks.transactionInsert.mock.calls[0][0]).toMatchObject({
      user_id: "user-smartcapture-test",
      valor: 52,
      tipo: "expense",
      scope: "private",
      source_type: "free_text",
      data_status: "confirmed",
    });

    expect(mocks.learningInsert.mock.calls[0][0]).toMatchObject({
      user_id: "user-smartcapture-test",
      transaction_id: "tx-smartcapture-test",
      source_type: "free_text",
      transaction_type: "expense",
      scope: "private",
      confirmation_method: "mirror_confirmed",
    });

    expect(mocks.transactionUpdate.mock.calls[0][0]).toMatchObject({
      updated_by: "user-smartcapture-test",
    });

    expect(String(mocks.transactionUpdate.mock.calls[0][0].validation_notes)).toContain('"learning_status":"saved"');
  });
});
