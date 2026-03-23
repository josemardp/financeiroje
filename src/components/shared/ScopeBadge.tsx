import { Badge } from "@/components/ui/badge";
import { SCOPE_LABELS } from "@/lib/constants";
import { User, Users, Briefcase } from "lucide-react";

const scopeConfig: Record<string, { icon: typeof User; variant: "default" | "secondary" | "outline" }> = {
  private: { icon: User, variant: "outline" },
  family: { icon: Users, variant: "secondary" },
  business: { icon: Briefcase, variant: "default" },
};

export function ScopeBadge({ scope }: { scope: string }) {
  const config = scopeConfig[scope] || scopeConfig.private;
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className="gap-1 text-xs">
      <Icon className="h-3 w-3" />
      {SCOPE_LABELS[scope] || scope}
    </Badge>
  );
}
