import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  Target,
  CreditCard,
  BarChart3,
  Bot,
  Bell,
  FileText,
  Heart,
  Settings,
  LogOut,
  Brain,
  PiggyBank,
  CalendarDays,
  TrendingUp,
  Zap,
  Lock,
  Landmark,
  FileSpreadsheet,
  PieChart,
  Briefcase,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

const mainNav = [
  { title: "Dashboard", icon: LayoutDashboard, href: "/" },
  { title: "Transações", icon: ArrowLeftRight, href: "/transacoes" },
  { title: "Negócio / MEI", icon: Briefcase, href: "/negocio" },
  { title: "Fiscal / IRPF", icon: FileText, href: "/fiscal" },
  { title: "Contas", icon: Landmark, href: "/contas" },
  { title: "Orçamento", icon: PiggyBank, href: "/orcamento" },
  { title: "Recorrências", icon: CalendarDays, href: "/recorrencias" },
];

const financeNav = [
  { title: "Calendário Financeiro", icon: CalendarDays, href: "/calendario" },
  { title: "Patrimônio & Investimentos", icon: PieChart, href: "/patrimonio" },
  { title: "Dívidas", icon: CreditCard, href: "/dividas" },
  { title: "Metas & Sonhos", icon: Target, href: "/metas" },
  { title: "Assinaturas", icon: Wallet, href: "/assinaturas" },
  { title: "Previsão de Caixa", icon: TrendingUp, href: "/previsao" },
];

const toolsNav = [
  { title: "IA Conselheira", icon: Bot, href: "/ia" },
  { title: "Captura Inteligente", icon: Zap, href: "/captura" },
  { title: "Score Financeiro", icon: BarChart3, href: "/score" },
  { title: "Alertas", icon: Bell, href: "/alertas" },
  { title: "Fechamento Mensal", icon: Lock, href: "/fechamento" },
  { title: "Documentos / IR", icon: FileText, href: "/documentos" },
  { title: "Relatórios", icon: FileSpreadsheet, href: "/relatorios" },
  { title: "Valores Familiares", icon: Heart, href: "/valores" },
];

export function AppSidebar() {
  const location = useLocation();
  const { profile, signOut } = useAuth();

  const initials = (profile?.nome || "U")
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sidebar-primary shadow-lg shadow-sidebar-primary/20 transition-transform group-hover:scale-105">
            <Brain className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          <div>
            <span className="text-base font-bold text-sidebar-foreground tracking-tight">FinanceAI</span>
            <span className="block text-[10px] text-sidebar-foreground/40 leading-none font-mono">v3.8 • premium</span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <NavGroup label="Principal" items={mainNav} currentPath={location.pathname} />
        <NavGroup label="Financeiro" items={financeNav} currentPath={location.pathname} />
        <NavGroup label="Ferramentas" items={toolsNav} currentPath={location.pathname} />

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location.pathname === "/configuracoes"}>
                  <Link to="/configuracoes"><Settings className="h-4 w-4" /><span>Configurações</span></Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8 border border-sidebar-border">
            <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-xs font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-sidebar-foreground truncate">{profile?.nome || "Usuário"}</p>
            <p className="text-[11px] text-sidebar-foreground/40 truncate">{profile?.email}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={signOut}
            className="text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent shrink-0 h-8 w-8"
            title="Sair"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

function NavGroup({
  label,
  items,
  currentPath,
}: {
  label: string;
  items: typeof mainNav;
  currentPath: string;
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton asChild isActive={currentPath === item.href}>
                <Link to={item.href}>
                  <item.icon className="h-4 w-4" />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
