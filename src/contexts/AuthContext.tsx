import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface Profile {
  id: string;
  user_id: string;
  nome: string;
  email: string | null;
  perfil: string | null;
  familia_id: string | null;
  avatar_url: string | null;
  preferences: Record<string, unknown>;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, nome: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const profileRequestRef = useRef(0);

  const clearLocalAuthState = () => {
    profileRequestRef.current += 1;
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  const fetchProfile = async (userId: string) => {
    const requestId = ++profileRequestRef.current;

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (requestId !== profileRequestRef.current) return;

    if (error || !data) {
      setProfile(null);
      return;
    }

    setProfile(data as Profile);
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  useEffect(() => {
    let isActive = true;

    const applySession = (nextSession: Session | null) => {
      if (!isActive) return;

      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        void fetchProfile(nextSession.user.id);
      } else {
        profileRequestRef.current += 1;
        setProfile(null);
      }

      setLoading(false);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      applySession(nextSession);
    });

    supabase.auth
      .getSession()
      .then(({ data: { session: restoredSession } }) => {
        applySession(restoredSession);
      })
      .catch(() => {
        if (!isActive) return;
        clearLocalAuthState();
        setLoading(false);
      });

    return () => {
      isActive = false;
      profileRequestRef.current += 1;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, nome: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nome },
        emailRedirectTo: window.location.origin,
      },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    clearLocalAuthState();

    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore server errors — local state is already cleared
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return context;
}
