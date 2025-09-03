'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';

type SessionContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
};

const SupabaseSessionContext = createContext<SessionContextValue>({
  session: null,
  user: null,
  loading: true,
});

export function SupabaseSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Carga inicial de la sesión
  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!isMounted) return;
        if (error) {
          // No hacemos throw para no bloquear la app; simplemente marcamos sin sesión.
          setSession(null);
        } else {
          setSession(data.session ?? null);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    // Suscripción a cambios de autenticación
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession ?? null);
    });

    // Revalidar al volver a la pestaña (por si el token se actualizó en otra)
    const onVis = async () => {
      if (document.visibilityState === 'visible') {
        const { data } = await supabase.auth.getSession();
        setSession(data.session ?? null);
      }
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      isMounted = false;
      sub.subscription.unsubscribe();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({ session, user: session?.user ?? null, loading }),
    [session, loading]
  );

  return (
    <SupabaseSessionContext.Provider value={value}>
      {children}
    </SupabaseSessionContext.Provider>
  );
}

export function useSupabaseSession() {
  return useContext(SupabaseSessionContext);
}
export default SupabaseSessionProvider;