import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { ScopeSwitcher } from "./ScopeSwitcher";
import { PwaInstallBanner } from "@/components/pwa/PwaInstallBanner";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AppLayout() {
  const { isDemo, signOut } = useAuth();

  return (
    <SidebarProvider>
      <div className="flex min-h-svh w-full bg-background">
        <AppSidebar />
        <SidebarInset className="flex min-w-0 flex-1 flex-col">
          {isDemo && (
            <div className="bg-amber-500/15 border-b border-amber-500/30 px-3 py-1.5 sm:px-4 text-xs text-amber-200 flex items-center justify-between gap-2 z-30">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-semibold text-amber-400 shrink-0">MODO DEMO ATIVO:</span>
                <span className="truncate text-amber-200/90">Dados fictícios isolados para avaliação de recrutadores e demonstração de portfólio.</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs text-amber-300 hover:text-amber-100 hover:bg-amber-500/20 shrink-0 gap-1 px-2"
                onClick={() => signOut()}
              >
                <LogOut className="h-3 w-3" />
                Sair da Demo
              </Button>
            </div>
          )}
          <header className="safe-area-top sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-4 lg:px-6">
            <div className="flex min-w-0 items-center gap-2">
              <SidebarTrigger className="-ml-1" />
              <span className="hidden text-sm font-semibold sm:inline-block">FinanceAI</span>
            </div>

            <div className="flex min-w-0 items-center gap-2">
              <ScopeSwitcher />
            </div>
          </header>

          <main className="safe-area-bottom flex-1 overflow-x-hidden overflow-y-auto px-3 py-4 sm:px-4 lg:px-6 lg:py-6">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
              <PwaInstallBanner />
              <Outlet />
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
