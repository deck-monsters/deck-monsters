import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase.js';
import { reconnectWsClient, setTRPCToken } from './trpc.js';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  /** True after the user lands from a password recovery email link (or recovery hash is present). */
  passwordRecovery: boolean;
  signInWithDiscord: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<string | null>;
  signUpWithEmail: (email: string, password: string) => Promise<string | null>;
  sendPasswordResetEmail: (email: string) => Promise<string | null>;
  updatePassword: (newPassword: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function urlHasRecoveryType(): boolean {
  if (typeof window === 'undefined') return false;
  const fromHash = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('type');
  if (fromHash === 'recovery') return true;
  const fromQuery = new URLSearchParams(window.location.search).get('type');
  return fromQuery === 'recovery';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session);
        setTRPCToken(data.session?.access_token ?? null);
        if (data.session && urlHasRecoveryType()) {
          setPasswordRecovery(true);
        }
      })
      .catch(() => {
        // Ignore network errors — session stays null, user sees login page
      })
      .finally(() => setLoading(false));

    const { data: listener } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setTRPCToken(s?.access_token ?? null);
      if (event === 'PASSWORD_RECOVERY' || (event === 'INITIAL_SESSION' && s && urlHasRecoveryType())) {
        setPasswordRecovery(true);
      }
      if (event === 'SIGNED_OUT') {
        setPasswordRecovery(false);
      }
      if (event === 'TOKEN_REFRESHED') {
        reconnectWsClient();
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function signInWithDiscord() {
    await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: { redirectTo: window.location.origin },
    });
  }

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  }

  async function signInWithApple() {
    await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo: window.location.origin },
    });
  }

  async function signInWithEmail(email: string, password: string): Promise<string | null> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error?.message ?? null;
  }

  async function signUpWithEmail(email: string, password: string): Promise<string | null> {
    const { error } = await supabase.auth.signUp({ email, password });
    return error?.message ?? null;
  }

  async function sendPasswordResetEmail(email: string): Promise<string | null> {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return error?.message ?? null;
  }

  async function updatePassword(newPassword: string): Promise<string | null> {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (!error) {
      setPasswordRecovery(false);
    }
    return error?.message ?? null;
  }

  async function signOut() {
    setPasswordRecovery(false);
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        passwordRecovery,
        signInWithDiscord,
        signInWithGoogle,
        signInWithApple,
        signInWithEmail,
        signUpWithEmail,
        sendPasswordResetEmail,
        updatePassword,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
