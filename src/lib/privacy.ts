import { supabase } from "@/integrations/supabase/client";

export interface PrivacyFunctionInput {
  currentPassword: string;
  reason?: string;
  confirmationPhrase: string;
}

interface PrivacyFunctionResponse<T = Record<string, unknown>> {
  ok: boolean;
  message: string;
  requestId?: string;
  payload?: T;
}

function extractEdgeError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export async function exportMyData(): Promise<PrivacyFunctionResponse<{ exportedAt: string; data: Record<string, unknown> }>> {
  const { data, error } = await supabase.functions.invoke("privacy-export", { body: {} });

  if (error) {
    throw new Error(extractEdgeError(error, "Falha ao exportar dados."));
  }

  return data as PrivacyFunctionResponse<{ exportedAt: string; data: Record<string, unknown> }>;
}

export async function deleteMyData(input: PrivacyFunctionInput): Promise<PrivacyFunctionResponse> {
  const { data, error } = await supabase.functions.invoke("privacy-delete-data", {
    body: input,
  });

  if (error) {
    throw new Error(extractEdgeError(error, "Falha ao excluir dados."));
  }

  return data as PrivacyFunctionResponse;
}

export async function deleteMyAccount(input: PrivacyFunctionInput): Promise<PrivacyFunctionResponse> {
  const { data, error } = await supabase.functions.invoke("privacy-delete-account", {
    body: input,
  });

  if (error) {
    throw new Error(extractEdgeError(error, "Falha ao excluir conta."));
  }

  return data as PrivacyFunctionResponse;
}

export function downloadJsonFile(filename: string, data: Record<string, unknown>) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
