import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY não configurada')
    }

    const { file } = await req.json()

    if (!file) {
      throw new Error('Nenhum arquivo fornecido')
    }

    // Detectar tipo de arquivo pelo base64 ou MIME type
    const isImage = file.startsWith('data:image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(file)
    const isPDF = file.startsWith('data:application/pdf') || file.endsWith('.pdf')

    let extractedText = ''
    let confidence = 0

    if (isImage) {
      // Processar imagem com OpenAI Vision
      console.log('Processando imagem com OpenAI Vision...')
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: `Você é um assistente especializado em extrair texto de recibos, notas fiscais e documentos financeiros.
Extraia TODO o texto visível na imagem de forma estruturada e organizada.
Inclua: valores, datas, descrições, estabelecimento, itens, totais.
Mantenha a formatação e hierarquia do texto original.`
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Extraia todo o texto desta imagem de forma estruturada:'
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: file
                  }
                }
              ]
            }
          ],
          max_tokens: 1000
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`Erro na API OpenAI: ${JSON.stringify(errorData)}`)
      }

      const data = await response.json()
      extractedText = data.choices[0]?.message?.content || ''
      confidence = 0.9 // Alta confiança para GPT-4 Vision

    } else if (isPDF) {
      // Para PDFs, usar uma biblioteca de parsing
      // Por enquanto, retornar mensagem de não suportado
      throw new Error('Processamento de PDF não implementado. Use imagens (JPG, PNG) para melhor resultado.')
      
    } else {
      throw new Error('Formato de arquivo não suportado. Use imagens (JPG, PNG, WEBP) ou PDFs.')
    }

    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error('Nenhum texto foi extraído da imagem. Tente com uma imagem mais clara.')
    }

    console.log('Texto extraído com sucesso:', extractedText.substring(0, 100) + '...')

    return new Response(
      JSON.stringify({
        text: extractedText,
        confidence: confidence,
        metadata: {
          method: isImage ? 'openai-vision' : 'pdf-parse',
          textLength: extractedText.length
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Erro no OCR:', error)
    
    return new Response(
      JSON.stringify({
        error: error.message,
        text: '',
        confidence: 0,
        metadata: {}
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200, // Retornar 200 para o frontend processar o erro
      },
    )
  }
})
