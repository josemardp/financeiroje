import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import ErrorBoundary from "@/components/shared/ErrorBoundary";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";

// Lazy-loaded pages to reduce initial bundle
const Transactions = lazy(() => import("./pages/Transactions"));
const Budget = lazy(() => import("./pages/Budget"));
const Recurring = lazy(() => import("./pages/Recurring"));
const Loans = lazy(() => import("./pages/Loans"));
const Goals = lazy(() => import("./pages/Goals"));
const Subscriptions = lazy(() => import("./pages/Subscriptions"));
const Forecast = lazy(() => import("./pages/Forecast"));
const AiAdvisor = lazy(() => import("./pages/AiAdvisor"));
const HealthScore = lazy(() => import("./pages/HealthScore"));
const Alerts = lazy(() => import("./pages/Alerts"));
const Documents = lazy(() => import("./pages/Documents"));
const FamilyValues = lazy(() => import("./pages/FamilyValues"));
const SettingsPage = lazy(() => import("./pages/Settings"));
const SmartCapture = lazy(() => import("./pages/SmartCapture"));
const MonthlyClosing = lazy(() => import("./pages/MonthlyClosing"));
const Accounts = lazy(() => import("./pages/Accounts"));
const Reports = lazy(() => import("./pages/Reports"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));

const LazyFallback = () => (
  <div className="flex min-h-[40vh] items-center justify-center">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
);

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
      <Route path="/auth" element={<ErrorBoundary><Auth /></ErrorBoundary>} />
      <Route path="/reset-password" element={<ErrorBoundary><Suspense fallback={<LazyFallback />}><ResetPassword /></Suspense></ErrorBoundary>} />
      <Route
        element={
          <ProtectedRoute>
            <ErrorBoundary>
              <AppLayout />
            </ErrorBoundary>
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/transacoes" element={<Suspense fallback={<LazyFallback />}><Transactions /></Suspense>} />
        <Route path="/orcamento" element={<Suspense fallback={<LazyFallback />}><Budget /></Suspense>} />
        <Route path="/recorrencias" element={<Suspense fallback={<LazyFallback />}><Recurring /></Suspense>} />
        <Route path="/contas" element={<Suspense fallback={<LazyFallback />}><Accounts /></Suspense>} />
        <Route path="/dividas" element={<Suspense fallback={<LazyFallback />}><Loans /></Suspense>} />
        <Route path="/metas" element={<Suspense fallback={<LazyFallback />}><Goals /></Suspense>} />
        <Route path="/assinaturas" element={<Suspense fallback={<LazyFallback />}><Subscriptions /></Suspense>} />
        <Route path="/previsao" element={<Suspense fallback={<LazyFallback />}><Forecast /></Suspense>} />
        <Route path="/ia" element={<Suspense fallback={<LazyFallback />}><AiAdvisor /></Suspense>} />
        <Route path="/score" element={<Suspense fallback={<LazyFallback />}><HealthScore /></Suspense>} />
        <Route path="/alertas" element={<Suspense fallback={<LazyFallback />}><Alerts /></Suspense>} />
        <Route path="/documentos" element={<Suspense fallback={<LazyFallback />}><Documents /></Suspense>} />
        <Route path="/valores" element={<Suspense fallback={<LazyFallback />}><FamilyValues /></Suspense>} />
        <Route path="/captura" element={<Suspense fallback={<LazyFallback />}><SmartCapture /></Suspense>} />
        <Route path="/fechamento" element={<Suspense fallback={<LazyFallback />}><MonthlyClosing /></Suspense>} />
        <Route path="/relatorios" element={<Suspense fallback={<LazyFallback />}><Reports /></Suspense>} />
        <Route path="/configuracoes" element={<Suspense fallback={<LazyFallback />}><SettingsPage /></Suspense>} />
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
