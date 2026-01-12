import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type AuthCtx = {
  loading: boolean;
  session: Session | null;
  userEmail: string | null;
  provider: string | null;
  signInMicrosoft: (opts?: { forceAccountSelect?: boolean }) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthCtx | null>(null);

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!alive) return;
      setSession(data.session ?? null);
      setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession ?? null);
      setLoading(false);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const userEmail = session?.user?.email ?? null;
  const provider =
    ((session?.user?.app_metadata as any)?.provider as string | undefined) ??
    ((session?.user?.identities?.[0] as any)?.provider as string | undefined) ??
    null;

  const signInMicrosoft: AuthCtx['signInMicrosoft'] = async (opts) => {
    const force = opts?.forceAccountSelect ?? true;

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        // Wir kommen nach Login einfach zurück auf Root
        redirectTo: `${window.location.origin}/`,
        scopes: 'email',
        queryParams: force ? { prompt: 'select_account' } : undefined,
      },
    });

    if (error) throw error;
    if (data?.url) window.location.href = data.url;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const value = useMemo<AuthCtx>(
    () => ({ loading, session, userEmail, provider, signInMicrosoft, signOut }),
    [loading, session, userEmail, provider]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
