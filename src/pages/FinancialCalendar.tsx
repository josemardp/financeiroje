import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useScope } from "@/contexts/ScopeContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ScopeBadge } from "@/components/shared/ScopeBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, ChevronLeft, ChevronRight, Landmark, Wallet, Briefcase } from "lucide-react";
import { calculateFinancialCalendar } from "@/services/financeEngine";
import { formatCurrency, formatDateShort } from "@/lib/format";

const WEEK_DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function addMonth(month: number, year: number, delta: number) {
  const date = new Date(year, month - 1 + delta, 1);
  return { month: date.getMonth() + 1, year: date.getFullYear() };
}

export default function FinancialCalendar() {
  const { user } = useAuth();
  const { currentScope } = useScope();
  const today = new Date();
  const [view, setView] = useState({ month: today.getMonth() + 1, year: today.getFullYear() });

  const { data: calendarData, isLoading } = useQuery({
    queryKey: ["financial-calendar", user?.id, currentScope, view.month, view.year],
    queryFn: async () => {
      let recurringQuery = supabase.from("recurring_transactions").select("*").eq("ativa", true);
      let loansQuery = supabase.from("loans").select("*").eq("ativo", true);
      let subscriptionsQuery = supabase.from("subscriptions").select("*");
      if (currentScope !== "all") {
        recurringQuery = recurringQuery.eq("scope", currentScope);
        loansQuery = loansQuery.eq("scope", currentScope);
        subscriptionsQuery = subscriptionsQuery.eq("scope", currentScope);
      }

      const [{ data: recurrings }, { data: loans }, { data: installments }, { data: subscriptions }] =
        await Promise.all([
          recurringQuery,
          loansQuery,
          supabase.from("loan_installments").select("*").neq("status", "pago"),
          subscriptionsQuery,
        ]);

      const visibleLoanIds = new Set((loans || []).map((loan: any) => loan.id));
      const scopedInstallments = (installments || [])
        .filter((item: any) => visibleLoanIds.has(item.emprestimo_id))
        .map((item: any) => ({
          ...item,
          emprestimo_nome: (loans || []).find((loan: any) => loan.id === item.emprestimo_id)?.nome || null,
          scope: (loans || []).find((loan: any) => loan.id === item.emprestimo_id)?.scope || null,
        }));

      return calculateFinancialCalendar({
        month: view.month,
        year: view.year,
        recurrings: recurrings || [],
        installments: scopedInstallments,
        subscriptions: subscriptions || [],
      });
    },
    enabled: !!user,
  });

  const groupedByDate = useMemo(() => {
    const groups = new Map<string, any[]>();
    for (const item of calendarData?.items || []) {
      const arr = groups.get(item.date) || [];
      arr.push(item);
      groups.set(item.date, arr);
    }
    return groups;
  }, [calendarData]);

  const calendarGrid = useMemo(() => {
    const firstDay = new Date(view.year, view.month - 1, 1);
    const startOffset = firstDay.getDay();
    const daysInMonth = new Date(view.year, view.month, 0).getDate();
    const cells: Array<{ date: string | null; day: number | null; items: any[] }> = [];

    for (let i = 0; i < startOffset; i += 1) {
      cells.push({ date: null, day: null, items: [] });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(view.year, view.month - 1, day).toISOString().split("T")[0];
      cells.push({ date, day, items: groupedByDate.get(date) || [] });
    }

    while (cells.length % 7 !== 0) {
      cells.push({ date: null, day: null, items: [] });
    }

    return cells;
  }, [groupedByDate, view.month, view.year]);

  const title = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(new Date(view.year, view.month - 1, 1));

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Calendário Financeiro"
        description="Agenda mensal funcional com contas, assinaturas, parcelas e compromissos relevantes"
      >
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setView(addMonth(view.month, view.year, -1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Badge variant="secondary" className="capitalize px-3 py-1">
            {title}
          </Badge>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setView(addMonth(view.month, view.year, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </PageHeader>

      {calendarData && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-xs uppercase text-muted-foreground">Saídas do mês</p>
              <p className="text-xl font-bold font-mono text-destructive">
                {formatCurrency(calendarData.totalOutflow || 0)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-xs uppercase text-muted-foreground">Entradas do mês</p>
              <p className="text-xl font-bold font-mono text-success">
                {formatCurrency(calendarData.totalInflow || 0)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-xs uppercase text-muted-foreground">Itens próximos</p>
              <p className="text-xl font-bold font-mono">{calendarData.dueSoonCount || 0}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <CalendarDays className="h-6 w-6 animate-pulse text-muted-foreground" />
        </div>
      ) : !calendarData || calendarData.items.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Calendário sem eventos"
          description="Cadastre assinaturas, dívidas e recorrências para transformar este mês em uma agenda financeira útil."
        />
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Visão mensal</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-7 gap-2 text-xs font-medium text-muted-foreground">
                {WEEK_DAYS.map((label) => (
                  <div key={label} className="px-2">
                    {label}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-2">
                {calendarGrid.map((cell, index) => (
                  <div
                    key={`${cell.date || "empty"}-${index}`}
                    className="min-h-[120px] rounded-lg border bg-card p-2"
                  >
                    {cell.day ? (
                      <>
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-sm font-semibold">{cell.day}</span>
                          {cell.items.length > 0 && (
                            <Badge variant="outline" className="text-[10px]">
                              {cell.items.length}
                            </Badge>
                          )}
                        </div>
                        <div className="space-y-1">
                          {cell.items.slice(0, 3).map((item: any) => (
                            <div
                              key={item.id}
                              className="rounded-md bg-muted/50 px-2 py-1 text-[11px] leading-tight"
                            >
                              <div className="truncate font-medium">{item.title}</div>
                              <div className={item.kind === "income" ? "text-success" : "text-destructive"}>
                                {item.kind === "income" ? "+" : "-"}
                                {formatCurrency(Number(item.amount || 0))}
                              </div>
                            </div>
                          ))}
                          {cell.items.length > 3 && (
                            <div className="text-[10px] text-muted-foreground">
                              +{cell.items.length - 3} item(ns)
                            </div>
                          )}
                        </div>
                      </>
                    ) : null}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Agenda detalhada</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {calendarData.items.map((item: any) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 rounded-xl border p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{item.title}</p>
                      {item.scope ? <ScopeBadge scope={item.scope} /> : null}
                      {item.type === "subscription" ? (
                        <Badge variant="secondary"><Wallet className="mr-1 h-3 w-3" /> Assinatura</Badge>
                      ) : null}
                      {item.type === "installment" ? (
                        <Badge variant="outline"><Landmark className="mr-1 h-3 w-3" /> Parcela</Badge>
                      ) : null}
                      {item.type === "business_commitment" ? (
                        <Badge variant="default"><Briefcase className="mr-1 h-3 w-3" /> Negócio</Badge>
                      ) : null}
                    </div>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">{formatDateShort(item.date)}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-mono font-bold ${item.kind === "income" ? "text-success" : "text-destructive"}`}>
                      {item.kind === "income" ? "+" : "-"}
                      {formatCurrency(Number(item.amount || 0))}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
