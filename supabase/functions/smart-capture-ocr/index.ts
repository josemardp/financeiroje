// Edge Function: smart-capture-ocr
// Handles image, pdf, docx OCR via OpenAI

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  try {
    const auth = req.headers.get("Authorization");
    if (!auth || !auth.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const body = await req.json();
    const { file_base64, mime_type } = body;

    if (!file_base64 || !mime_type) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), { status: 400 });
    }

    const allowed = [
      "image/png",
      "image/jpeg",
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ];

    if (!allowed.includes(mime_type)) {
      return new Response(JSON.stringify({ error: "Unsupported file type" }), { status: 400 });
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    const prompt = `Extract financial transaction data from this input. Return JSON with: valor, tipo, data, categoria, descricao, moeda, confidence, warnings`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: prompt },
              { type: "input_image", image_base64: file_base64 }
            ]
          }
        ]
      })
    });

    const result = await response.json();

    return new Response(JSON.stringify({
      extracted_fields: result,
      confidence: "medium",
      warnings: []
    }), { status: 200 });

  } catch (err) {
    return new Response(JSON.stringify({ error: "Processing failed" }), { status: 500 });
  }
});