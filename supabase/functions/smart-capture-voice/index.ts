import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ── Rate limiting (in-memory, per-isolate — resets on cold start) ──
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10; // max requests per window per user
const RATE_WINDOW_MS = 60_000; // 1 minute

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

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;
const ALLOWED_AUDIO_TYPES = new Set([
  "audio/webm",
  "audio/mp3",
  "audio/mpeg",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/wav",
  "audio/x-wav",
]);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function estimateBase64Size(base64: string) {
  const padding = (base64.match(/=+$/)?.[0].length ?? 0);
  return Math.floor((base64.length * 3) / 4) - padding;
}

function normalizeMoney(value: string) {
  return Number.parseFloat(value.replace(/\./g, "").replace(",", "."));
}

function parseTransactionText(input: string) {
  const text = input.trim();
  const today = new Date().toISOString().split("T")[0];
  const warnings: string[] = [];

  const moneyMatch =
    text.match(/R\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?)/i) ||
    text.match(/(\d+[.,]?\d*)\s*reais?/i) ||
    text.match(/(?:^|\s)(\d{1,4}[.,]?\d{0,2})(?:\s|$)/);

  const valor = moneyMatch ? normalizeMoney(moneyMatch[1]) : null;

  const incomePatterns = /\b(entrou|receb[ei]|sal[aá]rio|renda|pagamento|freelance|receita|ganho|ganhei)\b/i;
  const expensePatterns = /\b(gastei|paguei|comprei|despesa|conta|parcela|mercado|restaurante|almoço|jantar|lanche)\b/i;

  const hasIncomeHint = incomePatterns.test(text);
  const hasExpenseHint = expensePatterns.test(text);
  const tipo = hasIncomeHint && !hasExpenseHint ? "income" : "expense";

  if (hasIncomeHint && hasExpenseHint) {
    warnings.push("Transcrição contém sinais conflitantes de receita e despesa.");
  }

  let data = today;
  if (/\bontem\b/i.test(text)) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    data = yesterday.toISOString().split("T")[0];
  } else {
    const dateMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
    if (dateMatch) {
      const day = Number.parseInt(dateMatch[1], 10);
      const month = Number.parseInt(dateMatch[2], 10);
      const year = dateMatch[3]
        ? (dateMatch[3].length === 2 ? 2000 + Number.parseInt(dateMatch[3], 10) : Number.parseInt(dateMatch[3], 10))
        : new Date().getFullYear();
      data = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    } else if (!/\bhoje\b/i.test(text)) {
      warnings.push("Data inferida como hoje por ausência de data explícita.");
    }
  }

  const categoryHints: Record<string, string> = {
    "mercado|supermercado|feira": "Alimentação",
    "aluguel|condom[ií]nio": "Moradia",
    "uber|99|gasolina|combustível|transporte|ônibus": "Transporte",
    "farmácia|médico|consulta|exame|saúde|plano de saúde": "Saúde",
    "escola|faculdade|curso|educação|livro": "Educação",
    "netflix|spotify|streaming|assinatura": "Assinaturas",
    "pizza|restaurante|lanche|café|jantar|almoço": "Alimentação",
    "luz|energia|água|internet|telefone|celular": "Contas",
    "consignado|parcela|empréstimo|financiamento": "Dívidas",
    "salário|renda|freelance": "Renda",
  };

  let categoria: string | null = null;
  for (const [pattern, cat] of Object.entries(categoryHints)) {
    if (new RegExp(pattern, "i").test(text)) {
      categoria = cat;
      break;
    }
  }

  let descricao = text
    .replace(/R\$\s*\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?/gi, "")
    .replace(/\d+[.,]?\d*\s*reais?/gi, "")
    .replace(/\b(hoje|ontem)\b/gi, "")
    .replace(/\b(gastei|paguei|comprei|entrou|recebi|ganhei)\b/gi, "")
    .replace(/\b(de|com|no|na|em|do|da|para|pra)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!descricao) descricao = text.slice(0, 80);
  descricao = descricao.charAt(0).toUpperCase() + descricao.slice(1);

  const confidence = !valor
    ? "baixa"
    : categoria
      ? "alta"
      : "media";

  if (!valor) warnings.push("Valor não identificado com clareza na transcrição.");
  if (!categoria) warnings.push("Categoria não identificada com clareza na transcrição.");

  return {
    valor,
    tipo,
    data,
    categoria,
    descricao,
    moeda: "BRL",
    confidence,
    warnings,
  };
}

serve(async (req) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return json({ error: "Unauthorized" }, 401);
  }

  const openAiApiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openAiApiKey) {
    return json({ error: "OPENAI_API_KEY is not configured" }, 500);
  }

  try {
    const body = await req.json();
    const { audio_base64, mime_type, file_name } = body ?? {};

    if (!audio_base64 || typeof audio_base64 !== "string") {
      return json({ error: "audio_base64 is required" }, 400);
    }

    if (!mime_type || typeof mime_type !== "string") {
      return json({ error: "mime_type is required" }, 400);
    }

    if (!ALLOWED_AUDIO_TYPES.has(mime_type)) {
      return json({ error: `Unsupported audio type: ${mime_type}` }, 400);
    }

    const estimatedSize = estimateBase64Size(audio_base64);
    if (estimatedSize > MAX_FILE_SIZE_BYTES) {
      return json({ error: `Audio file exceeds ${MAX_FILE_SIZE_BYTES} bytes` }, 413);
    }

    const audioBytes = Uint8Array.from(atob(audio_base64), (char) => char.charCodeAt(0));
    const blob = new Blob([audioBytes], { type: mime_type });

    const formData = new FormData();
    formData.append("file", blob, file_name || "smart-capture-audio.webm");
    formData.append("model", "whisper-1");
    formData.append("language", "pt");
    formData.append("response_format", "verbose_json");

    const transcriptionResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiApiKey}`,
      },
      body: formData,
    });

    if (!transcriptionResponse.ok) {
      const errorText = await transcriptionResponse.text();
      return json({
        error: "Audio transcription failed",
        details: errorText,
      }, 502);
    }

    const transcriptionPayload = await transcriptionResponse.json();
    const transcription = String(transcriptionPayload.text || "").trim();

    if (!transcription) {
      return json({ error: "Empty transcription returned by provider" }, 422);
    }

    const extracted_fields = parseTransactionText(transcription);

    return json({
      transcription,
      extracted_fields,
      confidence: extracted_fields.confidence,
      warnings: extracted_fields.warnings,
    });
  } catch (error) {
    return json({
      error: "Voice processing failed",
      details: error instanceof Error ? error.message : "Unknown error",
    }, 500);
  }
});
