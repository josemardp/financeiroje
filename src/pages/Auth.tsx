import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Brain, CloudOff } from "lucide-react";

/**
 * O app é um cliente do Supabase: sem backend no ar, nenhuma tela funciona.
 * Antes desta checagem, com o projeto pausado, clicar em "Entrar" não produzia
 * efeito nenhum — nem erro, nem carregando — porque o supabase-js fica em
 * retry de rede e só devolve o erro muito depois. Quem abria o link concluía,
 * com razão, que o app estava quebrado.
 *
 * O ping é no /auth/v1/health, que responde sem credencial. `no-cors` deixa a
 * resposta opaca: o que interessa é se a requisição sai ou estoura, e é por
 * isso que não se lê o status aqui.
 */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;

async function backendResponde(): Promise<boolean> {
  if (!SUPABASE_URL) return false;
  try {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 6000);
    await fetch(`${SUPABASE_URL}/auth/v1/health`, {
      mode: "no-cors",
      signal: abort.signal,
    });
    clearTimeout(timer);
    return true;
  } catch {
    return false;
  }
}

function erroDeRede(error: Error | null): boolean {
  if (!error) return false;
  const m = `${error.name} ${error.message}`.toLowerCase();
  return m.includes("fetch") || m.includes("network") || m.includes("failed to");
}

export default function Auth() {
  const { user, loading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [backendFora, setBackendFora] = useState(false);

  useEffect(() => {
    let vivo = true;
    backendResponde().then((ok) => {
      if (vivo) setBackendFora(!ok);
    });
    return () => {
      vivo = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) return <Navigate to="/" replace />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
              <Brain className="h-6 w-6 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">FinanceAI</h1>
          </div>
          <p className="text-muted-foreground">Assistente Financeiro Familiar com IA</p>
        </div>

        {backendFora && (
          <div
            role="status"
            className="flex gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-left text-sm"
          >
            <CloudOff className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
            <div className="space-y-1">
              <p className="font-medium text-foreground">Backend indisponível</p>
              <p className="text-muted-foreground">
                Esta demonstração pública está sem banco de dados no ar, então entrar e criar
                conta não vão funcionar agora. O código completo, com as migrations e as
                instruções para rodar o projeto na sua máquina, está no repositório.
              </p>
            </div>
          </div>
        )}

        <Card>
          <Tabs defaultValue="login">
            <CardHeader className="pb-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Entrar</TabsTrigger>
                <TabsTrigger value="register">Criar conta</TabsTrigger>
              </TabsList>
            </CardHeader>

            <TabsContent value="login">
              <LoginForm isSubmitting={isSubmitting} setIsSubmitting={setIsSubmitting} />
            </TabsContent>

            <TabsContent value="register">
              <RegisterForm isSubmitting={isSubmitting} setIsSubmitting={setIsSubmitting} />
            </TabsContent>
          </Tabs>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Seus dados são protegidos com criptografia e isolamento por usuário.
        </p>
      </div>
    </div>
  );
}

function LoginForm({ isSubmitting, setIsSubmitting }: { isSubmitting: boolean; setIsSubmitting: (v: boolean) => void }) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [sendingReset, setSendingReset] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { error } = await signIn(email, password);
      if (erroDeRede(error)) {
        toast.error("Servidor fora do ar", {
          description:
            "Não foi possível falar com o backend. Se você abriu pelo link de demonstração, o banco está pausado; veja o README para rodar local.",
        });
      } else if (error) {
        toast.error("Erro ao entrar", { description: error.message });
      }
    } catch (err) {
      // signInWithPassword pode rejeitar em vez de devolver erro quando a rede
      // falha antes da primeira resposta. Sem este catch o clique fica mudo.
      toast.error("Servidor fora do ar", {
        description:
          "Não foi possível falar com o backend. Se você abriu pelo link de demonstração, o banco está pausado; veja o README para rodar local.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendingReset(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast.error("Erro ao enviar email", { description: "Verifique o endereço e tente novamente." });
    } else {
      toast.success("Email enviado!", { description: "Verifique sua caixa de entrada para redefinir a senha." });
      setForgotMode(false);
    }
    setSendingReset(false);
  };

  if (forgotMode) {
    return (
      <form onSubmit={handleForgotPassword}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="forgot-email">Email da conta</Label>
            <Input id="forgot-email" type="email" placeholder="seu@email.com" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} required />
          </div>
          <Button type="submit" className="w-full" disabled={sendingReset}>
            {sendingReset ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Enviar link de recuperação
          </Button>
          <Button type="button" variant="ghost" className="w-full" onClick={() => setForgotMode(false)}>
            Voltar para login
          </Button>
        </CardContent>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="login-email">Email</Label>
          <Input id="login-email" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="login-password">Senha</Label>
          <Input id="login-password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Entrar
        </Button>
        <button
          type="button"
          className="w-full text-center text-sm text-muted-foreground hover:text-primary transition-colors"
          onClick={() => { setForgotMode(true); setForgotEmail(email); }}
        >
          Esqueci minha senha
        </button>
      </CardContent>
    </form>
  );
}

function RegisterForm({ isSubmitting, setIsSubmitting }: { isSubmitting: boolean; setIsSubmitting: (v: boolean) => void }) {
  const { signUp } = useAuth();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Senha deve ter no mínimo 6 caracteres");
      return;
    }
    setIsSubmitting(true);
    try {
      const { error } = await signUp(email, password, nome);
      if (erroDeRede(error)) {
        toast.error("Servidor fora do ar", {
          description:
            "Não foi possível falar com o backend. Se você abriu pelo link de demonstração, o banco está pausado; veja o README para rodar local.",
        });
      } else if (error) {
        toast.error("Erro ao criar conta", { description: error.message });
      } else {
        toast.success("Conta criada!", { description: "Verifique seu email para confirmar." });
      }
    } catch (err) {
      toast.error("Servidor fora do ar", {
        description:
          "Não foi possível falar com o backend. Se você abriu pelo link de demonstração, o banco está pausado; veja o README para rodar local.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="register-nome">Nome</Label>
          <Input id="register-nome" placeholder="Seu nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="register-email">Email</Label>
          <Input id="register-email" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="register-password">Senha</Label>
          <Input id="register-password" type="password" placeholder="Mínimo 6 caracteres" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Criar conta
        </Button>
      </CardContent>
    </form>
  );
}
