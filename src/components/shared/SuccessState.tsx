import { CheckCircle2 } from "lucide-react";

interface SuccessStateProps {
  title: string;
  message?: string;
}

export function SuccessState({ title, message }: SuccessStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center animate-fade-in">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-success/10 mb-4">
        <CheckCircle2 className="h-8 w-8 text-success" />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      {message && <p className="text-sm text-muted-foreground mt-1 max-w-sm">{message}</p>}
    </div>
  );
}
