import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Download, Share, X } from "lucide-react";
import { usePwaInstall } from "@/hooks/use-pwa-install";

type PwaInstallBannerProps = {
  className?: string;
};

export function PwaInstallBanner({ className }: PwaInstallBannerProps) {
  const { canPromptInstall, dismiss, isIOSFallback, isAndroidFallback, promptInstall, shouldShow } = usePwaInstall();

  if (!shouldShow) return null;

  return (
    <Card className={cn("border-primary/15 bg-primary/5 shadow-none md:hidden", className)}>
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            {isIOSFallback ? <Share className="h-5 w-5" /> : <Download className="h-5 w-5" />}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Instale o FinanceAI</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {isIOSFallback
                ? "No iPhone, toque em Compartilhar e depois em Adicionar à Tela de Início para usar como app."
                : isAndroidFallback
                  ? "No Android/Chrome, abra o menu ⋮ e procure por Instalar app ou Adicionar à tela inicial se o Chrome ainda não mostrar o prompt automaticamente."
                  : "Instale o FinanceAI para abrir mais rápido, usar em tela cheia e ter experiência de app no celular."}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {canPromptInstall ? (
                <Button size="sm" className="h-8 rounded-lg px-3" onClick={() => void promptInstall()}>
                  <Download className="mr-1.5 h-4 w-4" />
                  Instalar app
                </Button>
              ) : null}

              <Button variant="ghost" size="sm" className="h-8 rounded-lg px-2.5 text-xs" onClick={() => dismiss()}>
                Agora não
              </Button>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="-mr-2 -mt-1 h-8 w-8 shrink-0 rounded-lg text-muted-foreground"
            onClick={() => dismiss()}
            aria-label="Fechar aviso de instalação"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
