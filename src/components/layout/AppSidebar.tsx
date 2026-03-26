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

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
            <Brain className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          <div>
            <span className="text-base font-bold text-sidebar-foreground">FinanceAI</span>
            <span className="block text-[10px] text-sidebar-foreground/50 leading-none">v3.7</span>
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
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">{profile?.nome || "Usuário"}</p>
            <p className="text-xs text-sidebar-foreground/50 truncate">{profile?.email}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={signOut}
            className="text-sidebar-foreground/50 hover:text-sidebar-foreground shrink-0"
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
