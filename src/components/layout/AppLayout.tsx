import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { ScopeSwitcher } from "./ScopeSwitcher";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export function AppLayout() {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <SidebarInset className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:px-4 lg:px-6">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <SidebarTrigger className="-ml-1" />
              <div className="hidden min-w-0 sm:flex items-center gap-2">
                <span className="truncate font-bold text-sm tracking-tight">FinanceAI</span>
                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md font-mono">v3.8</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <ScopeSwitcher />
              <ThemeToggle />
            </div>
          </header>

          <main className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-3 sm:p-4 lg:p-6">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
