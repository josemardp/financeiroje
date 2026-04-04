import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getFinancialContext } from "@/services/aiAdvisor/contextCollector";
import { parseAiResponse } from "@/services/aiAdvisor/responseParser";
import { buildSystemPrompt } from "@/services/aiAdvisor/systemPrompt";
import type { AiResponseBlock } from "@/services/aiAdvisor/types";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Bot, Send, Loader2, AlertTriangle, Lightbulb, CheckCircle, HelpCircle, TrendingUp, Info, Mic, MicOff } from "lucide-react";
import { VoiceAdapter } from "@/services/smartCapture/adapters/VoiceAdapter";
import ReactMarkdown from "react-markdown";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-advisor`;

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  blocks?: AiResponseBlock[];
  timestamp: string;
}

export default function AiAdvisor() {
  const { user, session } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [currentScope, setCurrentScope] = useState<"private" | "family" | "business">("private");
  const [currentModel, setCurrentModel] = useState<"auto" | "google/gemini-3-flash-preview" | "openai/gpt-4o-mini" | "anthropic/claude-haiku-4-5">("auto");
  const [lastUsedModel, setLastUsedModel] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: conversations } = useQuery({
    queryKey: ["ai-conversations"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ai_conversations")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(10);
      return data || [];
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!conversationId) return;
    supabase
      .from("ai_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at")
      .then(({ data }) => {
        if (data) {
          setMessages(data.map((m: any) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            blocks: m.role === "assistant" ? parseAiResponse(m.content).blocks : undefined,
            timestamp: m.created_at,
          })));
        }
      });
  }, [conversationId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const routeModel = (intent: string): "google/gemini-3-flash-preview" | "openai/gpt-4o-mini" | "anthropic/claude-haiku-4-5" => {
    if (["decision", "progress", "monthly_focus"].includes(intent)) return "anthropic/claude-haiku-4-5";
    if (["weekly_review", "escape_red", "cutting", "goal", "reserve"].includes(intent)) return "openai/gpt-4o-mini";
    return "google/gemini-3-flash-preview"; // mercado, generic e demais
  };

  const handleVoiceToggle = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        setIsRecording(false);
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        if (blob.size < 1000) return;
        setIsTranscribing(true);
        try {
          const result = await VoiceAdapter.transcribe(blob);
          if (result.text) setInput(prev => (prev ? prev + " " + result.text : result.text));
        } catch (err: any) {
          toast.error("Erro na transcrição", { description: err.message });
        } finally {
          setIsTranscribing(false);
        }
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch {
      toast.error("Microfone não permitido", { description: "Autorize o acesso ao microfone nas configurações do navegador." });
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !user || !session || isStreaming) return;
    const userText = input.trim();
    setInput("");

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: userText,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setIsStreaming(true);

    try {
      const lowerInput = userText.toLowerCase();
      let userIntentHint: "escape_red" | "goal" | "reserve" | "purchase" | "cutting" | "checklist" | "weekly_review" | "monthly_focus" | "progress" | "decision" | "mercado" | "generic" = "generic";

      // Perguntas de mercado → Gemini com Google Search (dados em tempo real)
      const isMarketQuestion =
        lowerInput.includes("cotação") ||
        lowerInput.includes("cotacao") ||
        lowerInput.includes("dólar") ||
        lowerInput.includes("dolar") ||
        lowerInput.includes("euro") ||
        lowerInput.includes("câmbio") ||
        lowerInput.includes("cambio") ||
        lowerInput.includes("selic") ||
        lowerInput.includes("ipca") ||
        lowerInput.includes("inflação") ||
        lowerInput.includes("inflacao") ||
        lowerInput.includes("taxa de juros") ||
        lowerInput.includes("juros hoje") ||
        lowerInput.includes("taxa básica") ||
        lowerInput.includes("taxa basica") ||
        lowerInput.includes("bcb") ||
        lowerInput.includes("banco central") ||
        lowerInput.includes("ibovespa") ||
        lowerInput.includes("bolsa hoje") ||
        lowerInput.includes("notícia econômica") ||
        lowerInput.includes("noticia economica") ||
        lowerInput.includes("mercado hoje") ||
        lowerInput.includes("economia hoje") ||
        lowerInput.includes("preço do ouro") ||
        lowerInput.includes("preco do ouro") ||
        lowerInput.includes("bitcoin hoje") ||
        lowerInput.includes("criptomoeda");

      const isDecisionQuestion =
        lowerInput.includes("posso comprar") ||
        lowerInput.includes("devo comprar") ||
        lowerInput.includes("vale a pena comprar") ||
        lowerInput.includes("vale a pena gastar") ||
        lowerInput.includes("essa compra atrapalha") ||
        lowerInput.includes("devo priorizar") ||
        lowerInput.includes("priorizar reserva ou meta") ||
        lowerInput.includes("é melhor guardar caixa") ||
        lowerInput.includes("guardar caixa ou aportar") ||
        lowerInput.includes("devo aportar") ||
        lowerInput.includes("devo segurar caixa") ||
        lowerInput.includes("segurar caixa") ||
        lowerInput.includes("vale antecipar") ||
        lowerInput.includes("antecipar essa dívida") ||
        lowerInput.includes("devo cortar") ||
        lowerInput.includes("essa assinatura") ||
        lowerInput.includes("esse custo recorrente") ||
        lowerInput.includes("qual decisão faz mais sentido agora") ||
        lowerInput.includes("qual faz mais sentido agora") ||
        lowerInput.includes("o que é mais inteligente financeiramente agora") ||
        lowerInput.includes("devo pagar isso");
      
      if (isMarketQuestion) {
        userIntentHint = "mercado";
      }
      else if (isDecisionQuestion) {
        userIntentHint = "decision";
      }
      else if (lowerInput.includes("semana") || lowerInput.includes("semanal") || lowerInput.includes("como foi minha semana") || lowerInput.includes("o que revisar esta semana") || lowerInput.includes("saindo do controle")) {
        userIntentHint = "weekly_review";
      }
      else if (lowerInput.includes("mês") || lowerInput.includes("mensal") || lowerInput.includes("foco do mês") || lowerInput.includes("qual meu foco") || lowerInput.includes("prioridade agora") || lowerInput.includes("restante do mês")) {
        userIntentHint = "monthly_focus";
      }
      else if (
        lowerInput.includes("melhorando") ||
        lowerInput.includes("avancei") ||
        lowerInput.includes("caminho certo") ||
        lowerInput.includes("evoluindo") ||
        lowerInput.includes("estou no caminho") ||
        lowerInput.includes("o que melhorou") ||
        lowerInput.includes("o que mudou") ||
        lowerInput.includes("houve avanço") ||
        lowerInput.includes("qual foi meu progresso") ||
        lowerInput.includes("continua travado") ||
        lowerInput.includes("continua igual") ||
        lowerInput.includes("está se repetindo") ||
        lowerInput.includes("to repetindo") ||
        lowerInput.includes("estou repetindo") ||
        lowerInput.includes("patinando") ||
        lowerInput.includes("piorou") ||
        lowerInput.includes("estou avançando") ||
        lowerInput.includes("avançando") ||
        lowerInput.includes("onde estou patinando") ||
        lowerInput.includes("o que piorou") ||
        lowerInput.includes("erros repetidos") ||
        lowerInput.includes("mesmos erros")
      ) {
        userIntentHint = "progress";
      }
      else if (lowerInput.includes("vermelho") || lowerInput.includes("dívida") || lowerInput.includes("gastando demais") || lowerInput.includes("organizar")) {
        userIntentHint = "escape_red";
      } else if (lowerInput.includes("meta") || lowerInput.includes("alcançar") || lowerInput.includes("acelerar")) {
        userIntentHint = "goal";
      } else if (lowerInput.includes("reserva") || lowerInput.includes("protegido") || lowerInput.includes("emergência")) {
        userIntentHint = "reserve";
      } else if (lowerInput.includes("comprar") || lowerInput.includes("vale a pena") || lowerInput.includes("posso")) {
        userIntentHint = "purchase";
      } else if (lowerInput.includes("cortar") || lowerInput.includes("errando") || lowerInput.includes("atacar")) {
        userIntentHint = "cutting";
      } else if (lowerInput.includes("checklist") || lowerInput.includes("revisar") || lowerInput.includes("priorizar") || lowerInput.includes("organize") || lowerInput.includes("passos") || lowerInput.includes("fazer agora")) {
        userIntentHint = "checklist";
      }

      const context = await getFinancialContext(user.id, currentScope);
      context.userIntentHint = userIntentHint;

      const effectiveModel = currentModel === "auto" ? routeModel(userIntentHint) : currentModel;
      setLastUsedModel(effectiveModel);

      let convId = conversationId;
      if (!convId) {
        const { data: conv } = await supabase
          .from("ai_conversations")
          .insert({ user_id: user.id, titulo: userText.substring(0, 60), scope: currentScope })
          .select("id")
          .single();
        if (conv) {
          convId = conv.id;
          setConversationId(convId);
        }
      }

      if (convId) {
        await supabase.from("ai_messages").insert([{
          conversation_id: convId,
          user_id: user.id,
          role: "user" as const,
          content: userText,
          contexto_enviado: context as any,
        }]);
      }

      const systemPrompt = buildSystemPrompt(context);
      
      const chatMessages = [
        { role: "system", content: systemPrompt },
        ...messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        { role: "user", content: userText },
      ];

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ messages: chatMessages.map(m => ({ role: m.role, content: m.content })), context, model: effectiveModel }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `Erro ${resp.status}`);
      }

      if (!resp.body) throw new Error("Sem resposta do servidor");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";
      let textBuffer = "";
      const assistantId = crypto.randomUUID();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantText += content;
              const blocks = parseAiResponse(assistantText).blocks;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant" && last.id === assistantId) {
                  return prev.map((m, i) => i === prev.length - 1
                    ? { ...m, content: assistantText, blocks }
                    : m
                  );
                }
                return [...prev, {
                  id: assistantId,
                  role: "assistant",
                  content: assistantText,
                  blocks,
                  timestamp: new Date().toISOString(),
                }];
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      if (convId && assistantText) {
        await supabase.from("ai_messages").insert({
          conversation_id: convId,
          user_id: user.id,
          role: "assistant" as const,
          content: assistantText,
        });
      }

      queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });
    } catch (err: any) {
      toast.error("Erro ao consultar IA", { description: err.message });
    } finally {
      setIsStreaming(false);
    }
  };

  const startNewConversation = () => {
    setConversationId(null);
    setMessages([]);
  };

  const scopeLabels: Record<string, string> = { private: "Pessoal", family: "Família", business: "Negócio" };

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] animate-fade-in">
      <PageHeader title="IA Conselheira" description="Protocolo zero-alucinação — interpreta, nunca calcula">
        <div className="flex gap-2 items-center">
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(["private", "family", "business"] as const).map(scope => (
              <button
                key={scope}
                onClick={() => setCurrentScope(scope)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  currentScope === scope
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                {scopeLabels[scope]}
              </button>
            ))}
          </div>
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(["auto", "google/gemini-3-flash-preview", "openai/gpt-4o-mini", "anthropic/claude-haiku-4-5"] as const).map(m => (
              <button
                key={m}
                onClick={() => setCurrentModel(m)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  currentModel === m
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                {m === "auto" ? "Auto" : m === "google/gemini-3-flash-preview" ? "Gemini" : m === "openai/gpt-4o-mini" ? "GPT-4o" : "Claude"}
              </button>
            ))}
          </div>
          {currentModel === "auto" && lastUsedModel && (
            <Badge variant="outline" className="text-[10px]">
              Usando: {lastUsedModel === "anthropic/claude-haiku-4-5" ? "Claude" : lastUsedModel === "openai/gpt-4o-mini" ? "GPT-4o" : "Gemini"}
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={startNewConversation}>Nova conversa</Button>
        </div>
      </PageHeader>

      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3 px-1">
        <Badge variant="outline" className="text-[10px]">Escopo: {scopeLabels[currentScope]}</Badge>
        <span>A IA só responderá sobre dados do escopo selecionado.</span>
      </div>

      {conversations && conversations.length > 0 && !conversationId && messages.length === 0 && (
        <div className="mb-4 space-y-2">
          <p className="text-sm text-muted-foreground">Conversas recentes:</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {conversations.slice(0, 4).map((c: any) => (
              <Card key={c.id} className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setConversationId(c.id)}>
                <CardContent className="p-3">
                  <p className="text-sm font-medium truncate">{c.titulo || "Conversa"}</p>
                  <p className="text-xs text-muted-foreground">{new Date(c.updated_at).toLocaleDateString("pt-BR")}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Bot className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Como posso ajudar?</h3>
            <p className="text-sm text-muted-foreground max-w-md mb-6">
              Faço análises baseadas nos seus dados reais. Nunca invento números.
            </p>
            <div className="grid gap-2 sm:grid-cols-2 max-w-lg">
              {[
                "Como estão minhas finanças este mês?",
                "Posso comprar isso agora?",
                "Devo priorizar reserva ou meta?",
                "Devo cortar essa assinatura?",
              ].map((q) => (
                <Button key={q} variant="outline" size="sm" className="text-left h-auto py-2 px-3"
                  onClick={() => { setInput(q); }}>
                  <span className="text-xs">{q}</span>
                </Button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] ${msg.role === "user"
              ? "bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-3"
              : "space-y-3"
            }`}>
              {msg.role === "user" ? (
                <p className="text-sm">{msg.content}</p>
              ) : msg.blocks && msg.blocks.length > 0 ? (
                <>
                  {msg.blocks.map((block, i) => (
                    <ResponseBlock key={i} block={block} />
                  ))}
                  <p className="text-[10px] text-muted-foreground italic mt-2">
                    Valores calculados pela engine determinística. A IA interpreta, não calcula.
                  </p>
                </>
              ) : (
                <Card>
                  <CardContent className="p-4 prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        ))}

        {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex justify-start">
            <Card><CardContent className="p-4 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Analisando seus dados...</span>
            </CardContent></Card>
          </div>
        )}

        <div ref={scrollRef} />
      </div>

      <div className="border-t border-border pt-4">
        <div className="flex gap-2">
          <Textarea
            placeholder={isRecording ? "Gravando... clique no microfone para parar" : "Pergunte sobre suas finanças..."}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={1}
            className="resize-none min-h-[44px]"
            disabled={isStreaming || isRecording}
          />
          <Button
            onClick={handleVoiceToggle}
            disabled={isStreaming || isTranscribing}
            size="icon"
            variant={isRecording ? "destructive" : "outline"}
            className="shrink-0 h-11 w-11"
            title={isRecording ? "Parar gravação" : "Gravar áudio"}
          >
            {isTranscribing
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : isRecording
              ? <MicOff className="h-4 w-4" />
              : <Mic className="h-4 w-4" />}
          </Button>
          <Button onClick={handleSend} disabled={isStreaming || !input.trim()} size="icon" className="shrink-0 h-11 w-11">
            {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ResponseBlock({ block }: { block: AiResponseBlock }) {
  const iconMap: Record<string, React.ReactNode> = {
    fact: <CheckCircle className="h-4 w-4 text-[hsl(var(--status-confirmed))]" />,
    alert: <AlertTriangle className="h-4 w-4 text-[hsl(var(--warning))]" />,
    suggestion: <Lightbulb className="h-4 w-4 text-[hsl(var(--info))]" />,
    projection: <TrendingUp className="h-4 w-4 text-[hsl(var(--status-estimated))]" />,
    question: <HelpCircle className="h-4 w-4 text-muted-foreground" />,
  };

  const typeLabels: Record<string, string> = {
    fact: "FATO", alert: "ALERTA", suggestion: "SUGESTÃO", projection: "PROJEÇÃO", question: "PERGUNTA",
  };

  return (
    <Card className="border-l-4" style={{
      borderLeftColor: block.type === "fact" ? "hsl(var(--status-confirmed))"
        : block.type === "alert" ? "hsl(var(--warning))"
        : block.type === "projection" ? "hsl(var(--status-estimated))"
        : block.type === "suggestion" ? "hsl(var(--info))"
        : "hsl(var(--border))"
    }}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          {iconMap[block.type] || <Info className="h-4 w-4" />}
          <Badge variant="outline" className="text-[10px]">
            {typeLabels[block.type] || block.type.toUpperCase()}
          </Badge>
          {block.title && <span className="text-sm font-medium">{block.title}</span>}
        </div>
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <ReactMarkdown>{block.content}</ReactMarkdown>
        </div>
      </CardContent>
    </Card>
  );
}
