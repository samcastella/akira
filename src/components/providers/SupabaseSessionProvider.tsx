// src/components/providers/SupabaseSessionProvider.tsx
'use client';

import { ReactNode, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

export default function SupabaseSessionProvider({ children }: { children: ReactNode }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    // Re-render en cambios de sesión
    const { data: sub } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        console.log('[auth] onAuthStateChange', event, session?.user?.id);
        setTick((t) => t + 1);
        try {
          window.dispatchEvent(new CustomEvent('akira:auth-changed', { detail: { event } }));
        } catch {}
      }
    );

    // Log inicial para verificar sesión
    (async () => {
      const { data } = await supabase.auth.getSession();
      console.log('[auth] initial session', data.session?.user?.id ?? null);
    })();

    return () => {
      try {
        sub?.subscription?.unsubscribe?.();
      } catch {}
    };
  }, []);

  return <>{children}</>;
}
