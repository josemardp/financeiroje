import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;

type StructuredTransactionType = "income" | "expense" | "unknown";
type StructuredScope = "private" | "family" | "business" | "unknown";
type StructuredConfidence = "alta" | "media" | "baixa";

interface StructuredInterpretPayload {
  transaction_type: StructuredTransactionType;
  amount: number | null;
  date: string | null;
  description: string | null;
  merchant_name: string | null;
  counterparty: string | null;
  scope: StructuredScope;
  category_hint: string | null;
  confidence: StructuredConfidence;
  evidence: string[];
  missing_fields: string[];
  installment_text: string | null;
}

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }

  entry.count++;
  return entry.count <= RATE_LIMIT;
}

function parseLocalizedAmount(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 && value <= 1_000_000 ? value : null;
  }

  if (typeof value !== "string") return null;

  const cleaned = value.replace(/R\$/gi, "").replace(/\s+/g, "").trim();
  if (!cleaned) return null;

  let normalized = cleaned;
  if (cleaned.includes(",") && cleaned.includes(".")) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (cleaned.includes(",")) {
    normalized = cleaned.replace(",", ".");
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 1_000_000 ? parsed : null;
}

function normalizeTransactionType(value: unknown): StructuredTransactionType {
  return value === "income" || value === "expense" ? value : "unknown";
}

function normalizeScope(value: unknown): StructuredScope {
  return value === "private" || value === "family" || value === "business" ? value : "unknown";
}

function normalizeConfidence(value: unknown): StructuredConfidence {
  return value === "alta" || value === "media" ? value : "baixa";
}

function normalizeDate(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

function sanitizeNullableString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeEvidence(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function normalizeMissingFields(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .filter((item) =>
      ["valor", "tipo", "data", "descricao", "categoria", "escopo"].includes(item)
    )
    .slice(0, 6);
}

function confidenceToNumber(confidence: StructuredConfidence) {
  switch (confidence) {
    case "alta":
      return 0.9;
    case "media":
      return 0.7;
    default:
      return 0.45;
  }
}

function extractMessageContent(payload: any) {
  const rawContent = payload?.choices?.[0]?.message?.content;

  if (typeof rawContent === "string") {
    return rawContent.trim();
  }

  if (Array.isArray(rawContent)) {
    return rawContent
      .map((item) => (typeof item?.text === "string" ? item.text : ""))
      .join("\n")
      .trim();
  }

  return "";
}

function buildMissingFields(parsed: StructuredInterpretPayload) {
  const inferred = new Set<string>(parsed.missing_fields);

  if (!parsed.amount) inferred.add("valor");
  if (parsed.transaction_type === "unknown") inferred.add("tipo");
  if (!parsed.date) inferred.add("data");
  if (!parsed.description && !parsed.merchant_name && !parsed.counterparty) inferred.add("descricao");
  if (!parsed.category_hint) inferred.add("categoria");

  return Array.from(inferred);
}

function parseStructuredPayload(content: string): StructuredInterpretPayload | null {
  if (!content) return null;

  try {
    const parsed = JSON.parse(content);

    return {
      transaction_type: normalizeTransactionType(parsed?.transaction_type),
      amount: parseLocalizedAmount(parsed?.amount ?? parsed?.total_amount),
      date: normalizeDate(parsed?.date),
      description: sanitizeNullableString(parsed?.description),
      merchant_name: sanitizeNullableString(parsed?.merchant_name),
      counterparty: sanitizeNullableString(parsed?.counterparty),
      scope: normalizeScope(parsed?.scope),
      category_hint: sanitizeNullableString(parsed?.category_hint),
      confidence: normalizeConfidence(parsed?.confidence),
      evidence: normalizeEvidence(parsed?.evidence),
      missing_fields: normalizeMissingFields(parsed?.missing_fields),
      installment_text: sanitizeNullableString(parsed?.installment_text),
    };
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!checkRateLimit(user.id)) {
      return new Response(
        JSON.stringify({
          error: "Limite de requisições excedido. Aguarde um momento.",
          code: "INTERPRET_RATE_LIMITED",
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY não configurada no servidor" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json().catch(() => null);
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    const sourceKind = typeof body?.source_kind === "string" ? body.source_kind.trim() : "free_text";
    const userName = typeof body?.user_name === "string" && body.user_name.trim() ? body.user_name.trim() : null;

    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD no fuso UTC (próximo o suficiente para BR)

    if (!text || text.length < 3) {
      return new Response(
        JSON.stringify({ error: "Texto insuficiente para interpretação." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (text.length > 16_000) {
      return new Response(
        JSON.stringify({ error: "Texto muito grande para interpretação nesta etapa." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const openAiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Você é um extrator estruturado de transações financeiras para o FinanceAI. Responda somente com JSON válido.\n\nREGRAS DE VALOR: amount é o valor total da transação, nunca o valor unitário da parcela quando houver total explícito. Ex: 'R$ 365,67' + '12x de R$ 30,47' → amount=365.67. Se houver APENAS parcela sem total (ex: '12x de 30,47'), amount=null e missing_fields inclui 'valor'. installment_text captura o texto de parcelamento (ex: '12x de R$ 30,47', '3x sem juros').\n\nREGRAS DE DATA: date em ISO YYYY-MM-DD. Entenda '28 Mar, 2026', '28/03/2026', '28 março 2026'. Para 'hoje'/'ontem'/'semana passada' use o campo 'hoje' informado pelo usuário.\n\nREGRAS DE TIPO E DIREÇÃO: O campo 'usuario_do_app' indica o nome real do usuário logado no app. Use-o para identificar a direção da transação no comprovante. Se o usuario_do_app aparece como Origem/Pagador/De/Remetente/Solicitante → ele pagou → transaction_type='expense', counterparty=Destino/Beneficiário/Para/Recebedor/Destinatário. Se o usuário aparece como Destino/Beneficiário/Recebedor/Destinatário → ele recebeu → transaction_type='income', counterparty=Origem/Pagador/Remetente/Solicitante. Sinais fortes de RECEITA: 'Dados de quem recebeu', 'Nome do destinatário', 'recebedor', 'beneficiário', 'PIX recebido', 'transferência recebida', 'depósito recebido', 'crédito em conta'. Sinais de DESPESA: comprovantes de venda, link de pagamento, cartão débito/crédito, PIX enviado (usuário é remetente/solicitante), boleto pago. REGRA CRÍTICA — COMPROVANTES COM DESTINATÁRIO EXPLÍCITO: Sempre que o comprovante contiver o campo 'Nome do destinatário' ou 'Dados de quem recebeu', assuma que quem enviou o comprovante É o destinatário/recebedor → transaction_type='income', counterparty=Solicitante/Pagador/Remetente. Isso se aplica mesmo que o título diga 'Comprovante de Pagamento Pix' — esse título refere-se ao pagamento feito PELA outra parte, não pelo usuário. EXEMPLO SICREDI: 'Solicitante: Maria' + 'Nome do destinatário: João' → João recebeu → income, counterparty='Maria'. EXEMPLO NUBANK: 'Dados de quem recebeu: João' + 'Dados de quem fez a transação: Maria' → João recebeu → income, counterparty='Maria'.\n\nREGRAS DE DESCRIÇÃO E CONTRAPARTE: counterparty = nome da PESSOA (não banco/instituição) da outra parte. Para RECEITA PIX: counterparty = campo 'Solicitante' ou 'Nome do pagador' ou 'Remetente' (quem enviou o dinheiro); merchant_name = null. Para DESPESA PIX: counterparty = campo 'Nome do destinatário' ou 'Beneficiário' (quem recebeu); merchant_name = nome do estabelecimento se for comércio. NUNCA use nome de banco/instituição (ex: 'BCO SANTANDER', 'NU PAGAMENTOS', 'BANCO SICREDI') como counterparty ou merchant_name quando houver nome de pessoa disponível. description = frase curta e humana: para receita PIX use 'PIX recebido de [nome do Solicitante/pagador]'; para despesa PIX use 'PIX enviado para [nome do destinatário]'; para outros: 'Compra no Mercado X', 'Boleto Claro'. Nunca deixe description null se houver counterparty.\n\nRetorne JSON com: transaction_type, amount, date, description, merchant_name, counterparty, scope, category_hint, confidence, evidence, missing_fields, installment_text.",
          },
          {
            role: "user",
            content: `hoje: ${today}\nsource_kind: ${sourceKind}${userName ? `\nusuario_do_app: ${userName}` : ""}\n\ntexto:\n${text}`,
          },
        ],
        max_tokens: 900,
      }),
    });

    if (!openAiRes.ok) {
      const errText = await openAiRes.text();
      console.error("OpenAI interpret error:", openAiRes.status, errText);

      return new Response(
        JSON.stringify({ error: "Erro na interpretação estruturada do texto" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const openAiData = await openAiRes.json();
    const content = extractMessageContent(openAiData);
    const structured = parseStructuredPayload(content);

    if (!structured) {
      return new Response(
        JSON.stringify({ error: "A IA não retornou estrutura utilizável para este texto." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const missingFields = buildMissingFields(structured);

    // Determine status
    const hasCriticalFields = structured.amount !== null && structured.transaction_type !== "unknown";
    const status = hasCriticalFields ? "complete" : missingFields.length > 2 ? "ambiguous" : "partial";

    return new Response(
      JSON.stringify({
        text,
        confidence: confidenceToNumber(structured.confidence),
        metadata: {
          transactionType: structured.transaction_type,
          amount: structured.amount,
          totalAmount: structured.amount ?? undefined,
          date: structured.date ?? undefined,
          description: structured.description ?? undefined,
          merchantName: structured.merchant_name ?? undefined,
          counterparty: structured.counterparty ?? undefined,
          scope: structured.scope,
          categoryHint: structured.category_hint ?? undefined,
          evidence: structured.evidence,
          confidence: structured.confidence,
          installmentText: structured.installment_text ?? undefined,
        },
        missingFields,
        status,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("smart-capture-interpret error:", e);

    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
