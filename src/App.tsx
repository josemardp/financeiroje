import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import Budget from "./pages/Budget";
import Recurring from "./pages/Recurring";
import Loans from "./pages/Loans";
import Goals from "./pages/Goals";
import Subscriptions from "./pages/Subscriptions";
import Forecast from "./pages/Forecast";
import AiAdvisor from "./pages/AiAdvisor";
import HealthScore from "./pages/HealthScore";
import Alerts from "./pages/Alerts";
import Documents from "./pages/Documents";
import FamilyValues from "./pages/FamilyValues";
import SettingsPage from "./pages/Settings";
import SmartCapture from "./pages/SmartCapture";
import MonthlyClosing from "./pages/MonthlyClosing";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/transacoes" element={<Transactions />} />
        <Route path="/orcamento" element={<Budget />} />
        <Route path="/recorrencias" element={<Recurring />} />
        <Route path="/dividas" element={<Loans />} />
        <Route path="/metas" element={<Goals />} />
        <Route path="/assinaturas" element={<Subscriptions />} />
        <Route path="/previsao" element={<Forecast />} />
        <Route path="/ia" element={<AiAdvisor />} />
        <Route path="/score" element={<HealthScore />} />
        <Route path="/alertas" element={<Alerts />} />
        <Route path="/documentos" element={<Documents />} />
        <Route path="/valores" element={<FamilyValues />} />
        <Route path="/configuracoes" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
