// src/components/providers/SupabaseSessionProvider.tsx
'use client';

import { ReactNode, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function SupabaseSessionProvider({ children }: { children: ReactNode }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    // Re-render en cambios de sesión
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[auth] onAuthStateChange', event, session?.user?.id);
      setTick(t => t + 1);
      window.dispatchEvent(new CustomEvent('akira:auth-changed', { detail: { event } }));
    });

    // Log inicial para verificar sesión
    (async () => {
      const { data } = await supabase.auth.getSession();
      console.log('[auth] initial session', data.session?.user?.id ?? null);
    })();

    return () => sub.subscription.unsubscribe();
  }, []);

  return <>{children}</>;
}
