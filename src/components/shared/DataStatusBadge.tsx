import { Badge } from "@/components/ui/badge";
import { DATA_STATUS_LABELS } from "@/lib/constants";
import { CheckCircle2, AlertCircle, HelpCircle, AlertTriangle, Eye, Calculator } from "lucide-react";

const statusConfig: Record<string, { icon: typeof CheckCircle2; className: string }> = {
  confirmed: { icon: CheckCircle2, className: "data-badge-confirmed" },
  suggested: { icon: Eye, className: "data-badge-suggested" },
  incomplete: { icon: HelpCircle, className: "data-badge-incomplete" },
  inconsistent: { icon: AlertTriangle, className: "data-badge-inconsistent" },
  estimated: { icon: Calculator, className: "data-badge-estimated" },
  missing: { icon: AlertCircle, className: "text-muted-foreground bg-muted" },
};

interface DataStatusBadgeProps {
  status: string;
  showLabel?: boolean;
}

export function DataStatusBadge({ status, showLabel = true }: DataStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.missing;
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={`gap-1 text-xs font-medium ${config.className}`}>
      <Icon className="h-3 w-3" />
      {showLabel && <span>{DATA_STATUS_LABELS[status] || status}</span>}
    </Badge>
  );
}
