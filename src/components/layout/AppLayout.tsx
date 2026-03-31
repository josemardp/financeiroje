import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { ScopeSwitcher } from "./ScopeSwitcher";
import { PwaInstallBanner } from "@/components/pwa/PwaInstallBanner";

export function AppLayout() {
  return (
    <SidebarProvider>
      <div className="flex min-h-svh w-full bg-background">
        <AppSidebar />
        <SidebarInset className="flex min-w-0 flex-1 flex-col">
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
