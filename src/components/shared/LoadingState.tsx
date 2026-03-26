import { Loader2 } from "lucide-react";

interface LoadingStateProps {
  message?: string;
  fullPage?: boolean;
}

export function LoadingState({ message = "Carregando...", fullPage = false }: LoadingStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${fullPage ? "min-h-[60vh]" : "py-16"}`}>
      <div className="relative">
        <div className="h-10 w-10 rounded-full border-2 border-muted" />
        <Loader2 className="h-10 w-10 animate-spin text-primary absolute inset-0" />
      </div>
      <p className="text-sm text-muted-foreground animate-pulse">{message}</p>
    </div>
  );
}
