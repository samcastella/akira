'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Props = {
  children: React.ReactNode;
  redirectTo?: string;
  fallback?: React.ReactNode; // opcional: UI mientras carga
};

/**
 * Componente de protección de rutas en cliente.
 * - Si hay sesión => renderiza children
 * - Si no hay sesión => redirige a `redirectTo`
 */
function RequireAuth({ children, redirectTo = '/login', fallback = null }: Props) {
  const router = useRouter();
  const [status, setStatus] = React.useState<'loading' | 'authed' | 'redirecting'>('loading');

  React.useEffect(() => {
    let active = true;

    // 1) Chequeo inicial
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session) setStatus('authed');
      else {
        setStatus('redirecting');
        router.replace(redirectTo);
      }
    });

    // 2) Suscripción a cambios de sesión
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (!active) return;
      if (session) setStatus('authed');
      else {
        setStatus('redirecting');
        router.replace(redirectTo);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [router, redirectTo]);

  if (status === 'loading') return <>{fallback}</>;
  if (status !== 'authed') return null; // evitando parpadeos durante la redirección

  return <>{children}</>;
}

export default RequireAuth;
export { RequireAuth };
