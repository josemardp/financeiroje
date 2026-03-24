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
import { Bot, Send, Loader2, AlertTriangle, Lightbulb, CheckCircle, HelpCircle, TrendingUp, Info } from "lucide-react";
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
  const [currentModel, setCurrentModel] = useState<"google/gemini-3-flash-preview" | "openai/gpt-5-mini">("google/gemini-3-flash-preview");
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
      // Collect financial context with explicit scope
      const context = await getFinancialContext(user.id, currentScope);

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
        await supabase.from("ai_messages").insert({
          conversation_id: convId,
          user_id: user.id,
          role: "user" as const,
          content: userText,
          contexto_enviado: context as any,
        });
      }

      // Build system prompt with real context
      const systemPrompt = buildSystemPrompt(context);
      
      const chatMessages = [
        { role: "system", content: systemPrompt },
        ...messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        { role: "user", content: userText },
      ];

      // Use real user session token for auth
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ messages: chatMessages.map(m => ({ role: m.role, content: m.content })), context, model: currentModel }),
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
          {/* Scope selector */}
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
          {/* Model selector */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => setCurrentModel("google/gemini-3-flash-preview")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                currentModel === "google/gemini-3-flash-preview"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:bg-muted"
              }`}
            >
              Gemini
            </button>
            <button
              onClick={() => setCurrentModel("openai/gpt-5-mini")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                currentModel === "openai/gpt-5-mini"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:bg-muted"
              }`}
            >
              GPT-5 Mini
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={startNewConversation}>Nova conversa</Button>
        </div>
      </PageHeader>

      {/* Scope indicator */}
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
                "Qual minha maior despesa?",
                "Tenho alguma dívida preocupante?",
                "Como posso economizar mais?",
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
            placeholder="Pergunte sobre suas finanças..."
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
            disabled={isStreaming}
          />
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
