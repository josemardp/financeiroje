import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { isDemoMode, activateDemoMode, exitDemoMode, DEMO_USER_ID } from "@/services/demoMode/demoData";

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
  isDemo: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, nome: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  enterDemoMode: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const nativeAuthTokenKey = "supabase.auth.token";
const nativeSupabaseUrlKey = "supabase.url";

async function syncNativeAuthSession(nextSession: Session | null) {
  if (!Capacitor.isNativePlatform()) return;

  if (nextSession?.access_token) {
    await Promise.all([
      Preferences.set({ key: nativeAuthTokenKey, value: nextSession.access_token }),
      Preferences.set({ key: nativeSupabaseUrlKey, value: import.meta.env.VITE_SUPABASE_URL }),
    ]);
    return;
  }

  await Promise.all([
    Preferences.remove({ key: nativeAuthTokenKey }),
    Preferences.remove({ key: nativeSupabaseUrlKey }),
  ]);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(isDemoMode());
  const profileRequestRef = useRef(0);

  const clearLocalAuthState = () => {
    profileRequestRef.current += 1;
    setUser(null);
    setSession(null);
    setProfile(null);
    void syncNativeAuthSession(null);
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

  const enterDemoMode = () => {
    activateDemoMode();
    setIsDemo(true);
    const demoUser = {
      id: DEMO_USER_ID,
      email: "recrutador@demo.local",
      app_metadata: {},
      user_metadata: { nome: "Avaliador Portfólio" },
      aud: "authenticated",
      created_at: new Date().toISOString(),
    } as unknown as User;
    const demoSession = {
      access_token: "demo-token",
      refresh_token: "demo-refresh",
      expires_in: 3600,
      token_type: "bearer",
      user: demoUser,
    } as unknown as Session;
    setUser(demoUser);
    setSession(demoSession);
    setProfile({
      id: DEMO_USER_ID,
      user_id: DEMO_USER_ID,
      nome: "Avaliador Portfólio",
      email: "recrutador@demo.local",
      perfil: "admin",
      familia_id: null,
      avatar_url: null,
      preferences: {},
    });
    setLoading(false);
  };

  useEffect(() => {
    let isActive = true;

    if (isDemoMode()) {
      enterDemoMode();
      return;
    }

    const applySession = (nextSession: Session | null) => {
      if (!isActive) return;

      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      void syncNativeAuthSession(nextSession);

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
    if (isDemoMode()) {
      exitDemoMode();
      setIsDemo(false);
    }
    clearLocalAuthState();

    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore server errors — local state is already cleared
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, session, profile, loading, isDemo, signIn, signUp, signOut, refreshProfile, enterDemoMode }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return context;
}
