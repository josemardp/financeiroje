import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  trend?: number;
  trendLabel?: string;
  variant?: "default" | "success" | "warning" | "destructive";
  subtitle?: string;
}

const variantStyles = {
  default: "text-foreground",
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
};

const iconBgStyles = {
  default: "bg-primary/10",
  success: "bg-success/10",
  warning: "bg-warning/10",
  destructive: "bg-destructive/10",
};

const iconColorStyles = {
  default: "text-primary",
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
};

export function KpiCard({ title, value, icon: Icon, trend, trendLabel, variant = "default", subtitle }: KpiCardProps) {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className={cn("text-2xl font-bold font-mono tracking-tight", variantStyles[variant])}>{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", iconBgStyles[variant])}>
            <Icon className={cn("h-5 w-5", iconColorStyles[variant])} />
          </div>
        </div>
        {trend !== undefined && (
          <div className="flex items-center gap-1.5 mt-3 text-xs">
            {trend >= 0 ? (
              <TrendingUp className="h-3 w-3 text-success" />
            ) : (
              <TrendingDown className="h-3 w-3 text-destructive" />
            )}
            <span className={cn("font-medium", trend >= 0 ? "text-success" : "text-destructive")}>
              {trend > 0 ? "+" : ""}{trend.toFixed(1)}%
            </span>
            {trendLabel && <span className="text-muted-foreground">{trendLabel}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
