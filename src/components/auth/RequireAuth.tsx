'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

type Props = {
  children: React.ReactNode;
  /**
   * Comportamiento cuando NO hay sesión:
   * - null (por defecto): NO redirige. Deja que el Layout muestre el overlay (recomendado).
   * - string (p.ej. '/login'): redirige a esa ruta.
   */
  redirectTo?: string | null;
  /** UI mientras comprobamos sesión */
  fallback?: React.ReactNode;
};

function RequireAuth({
  children,
  redirectTo = null, // ⬅️ overlay mode por defecto (sin redirección)
  fallback = null,
}: Props) {
  const router = useRouter();
  const [mounted, setMounted] = React.useState(false);
  const [status, setStatus] = React.useState<'loading' | 'authed' | 'noauth' | 'redirecting'>('loading');

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    let active = true;

    // 1) Chequeo inicial
    (async () => {
      const { data }: { data: { session: Session | null } } = await supabase.auth.getSession();
      if (!active) return;
      if (data.session) {
        setStatus('authed');
      } else {
        if (redirectTo) {
          setStatus('redirecting');
          router.replace(redirectTo);
        } else {
          setStatus('noauth'); // deja al Layout mostrar el overlay
        }
      }
    })();

    // 2) Suscripción a cambios de sesión
    const { data: sub } = supabase.auth.onAuthStateChange(
      (evt: AuthChangeEvent, session: Session | null) => {
        if (!active) return;
        if (session) {
          setStatus('authed');
        } else {
          if (redirectTo) {
            setStatus('redirecting');
            router.replace(redirectTo);
          } else {
            setStatus('noauth');
          }
        }
      }
    );

    return () => {
      active = false;
      try {
        // @supabase/supabase-js v2
        sub.subscription?.unsubscribe?.();
      } catch {}
    };
  }, [router, redirectTo]);

  // Evita SSR/flicker
  if (!mounted) return null;

  if (status === 'loading') return <>{fallback}</>;
  if (status !== 'authed') return null; // en overlay mode, el Layout pondrá el modal encima

  return <>{children}</>;
}

export default RequireAuth;
export { RequireAuth };
