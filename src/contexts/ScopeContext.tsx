import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useAuth } from "./AuthContext";

export type ScopeType = "private" | "family" | "business" | "all";

interface ScopeContextType {
  currentScope: ScopeType;
  setScope: (scope: ScopeType) => void;
  scopeLabel: string;
}

const ScopeContext = createContext<ScopeContextType | undefined>(undefined);

const SCOPE_LABELS: Record<ScopeType, string> = {
  private: "Pessoal",
  family: "Família",
  business: "Negócio",
  all: "Visão Geral",
};

export function ScopeProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const [currentScope, setCurrentScope] = useState<ScopeType>(() => {
    const saved = localStorage.getItem("financeai_scope");
    return (saved as ScopeType) || "private";
  });

  // Sync with profile preference on login or profile change
  useEffect(() => {
    if (profile?.preferences) {
      const prefs = profile.preferences as any;
      if (prefs.escopo_padrao && !localStorage.getItem("financeai_scope_initialized")) {
        setCurrentScope(prefs.escopo_padrao as ScopeType);
        localStorage.setItem("financeai_scope_initialized", "true");
      }
    }
  }, [profile]);

  useEffect(() => {
    if (user) {
      localStorage.setItem("financeai_scope", currentScope);
    } else {
      localStorage.removeItem("financeai_scope_initialized");
    }
  }, [currentScope, user]);

  const setScope = (scope: ScopeType) => {
    setCurrentScope(scope);
  };

  return (
    <ScopeContext.Provider
      value={{
        currentScope,
        setScope,
        scopeLabel: SCOPE_LABELS[currentScope],
      }}
    >
      {children}
    </ScopeContext.Provider>
  );
}

export function useScope() {
  const context = useContext(ScopeContext);
  if (!context) {
    throw new Error("useScope deve ser usado dentro de um ScopeProvider");
  }
  return context;
}
