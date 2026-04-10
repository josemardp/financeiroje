import { supabase } from "@/integrations/supabase/client";

export type ConfirmedForm = {
  valor: string;
  tipo: string;
  descricao: string;
  data: string;
  categoria_id: string;
  scope: string;
  source_type: string;
};

type LearningEventInput = {
  userId: string;
  scope: string;
  sourceType: string;
  rawInput: string;
  ocrText?: string;
  aiSuggested: ConfirmedForm;
  userConfirmed: ConfirmedForm;
  confidenceBefore?: "alta" | "media" | "baixa";
  timeInMirrorMs?: number;
};

const TRACKED_FIELDS = [
  "valor",
  "tipo",
  "descricao",
  "data",
  "categoria_id",
  "scope",
] as const;

function buildDiff(ai: ConfirmedForm, user: ConfirmedForm) {
  const fieldDiff: Record<string, { before: unknown; after: unknown }> = {};
  const acceptedFields: string[] = [];
  const correctedFields: string[] = [];

  for (const field of TRACKED_FIELDS) {
    if (ai[field] === user[field]) {
      acceptedFields.push(field);
    } else {
      correctedFields.push(field);
      fieldDiff[field] = { before: ai[field], after: user[field] };
    }
  }

  return { fieldDiff, acceptedFields, correctedFields };
}

function confidenceToNumeric(c?: "alta" | "media" | "baixa"): number | null {
  if (c === "alta") return 0.90;
  if (c === "media") return 0.65;
  if (c === "baixa") return 0.40;
  return null;
}

export async function recordCaptureLearningEvent(
  input: LearningEventInput
): Promise<{ id: string | null }> {
  try {
    const { fieldDiff, acceptedFields, correctedFields } = buildDiff(
      input.aiSuggested,
      input.userConfirmed
    );

    const { data, error } = await supabase
      .from("capture_learning_events")
      .insert({
        user_id: input.userId,
        scope: input.scope,
        source_type: input.sourceType,
        raw_input: input.rawInput,
        ocr_text: input.ocrText ?? null,
        ai_suggested_json: input.aiSuggested,
        user_confirmed_json: input.userConfirmed,
        field_diff_json: fieldDiff,
        accepted_fields: acceptedFields,
        corrected_fields: correctedFields,
        confidence_before: confidenceToNumeric(input.confidenceBefore),
        time_in_mirror_ms: input.timeInMirrorMs ?? null,
      })
      .select("id")
      .single();

    if (error) return { id: null };
    return { id: data.id };
  } catch {
    return { id: null };
  }
}

export async function linkEventToTransaction(
  eventId: string,
  transactionId: string
): Promise<void> {
  await supabase
    .from("capture_learning_events")
    .update({ transaction_id: transactionId })
    .eq("id", eventId);
}
