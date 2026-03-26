import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { ScopeSwitcher } from "./ScopeSwitcher";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export function AppLayout() {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex flex-col flex-1">
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 lg:px-6">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="-ml-1" />
              <div className="hidden sm:flex items-center gap-2">
                <span className="font-bold text-sm tracking-tight">FinanceAI</span>
                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md font-mono">v3.8</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ScopeSwitcher />
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 p-4 lg:p-6 overflow-auto">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
