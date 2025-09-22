// src/components/auth/RequireAuth.tsx
'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { supabase, isSupabaseEnvReady } from '@/lib/supabaseClient';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

type Props = {
  children: React.ReactNode;
  /**
   * Comportamiento cuando NO hay sesión:
   * - null (por defecto): NO redirige. Deja que el Layout muestre el overlay (recomendado).
   * - string (p.ej. '/login'): redirige a esa ruta. Si es '/login', añadirá ?redirect=<ruta-actual>.
   */
  redirectTo?: string | null;
  /** UI mientras comprobamos sesión */
  fallback?: React.ReactNode;
};

export default function RequireAuth({
  children,
  redirectTo = null, // overlay mode por defecto
  fallback = <div className="p-4 text-sm">Comprobando sesión…</div>,
}: Props) {
  const pathname = usePathname();
  const SUPA_READY = isSupabaseEnvReady();

  const [mounted, setMounted] = React.useState(false);
  const [checked, setChecked] = React.useState(false);
  const [hasSession, setHasSession] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Chequeo inicial + suscripción (sin navegar en SIGNED_IN)
  React.useEffect(() => {
    if (!SUPA_READY) {
      // Sin env -> no podemos autenticar; marca como “sin sesión” y deja overlay/redirect actuar
      setHasSession(false);
      setChecked(true);
      return;
    }

    let active = true;

    (async () => {
      try {
        const { data }: { data: { session: Session | null } } = await supabase.auth.getSession();
        if (!active) return;
        setHasSession(!!data.session);
      } catch {
        if (!active) return;
        setHasSession(false);
      } finally {
        if (active) setChecked(true);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(
      (_evt: AuthChangeEvent, session: Session | null) => {
        if (!active) return;
        // Solo sincronizamos estado; NO navegamos aquí.
        setHasSession(!!session);
      }
    );

    return () => {
      active = false;
      try {
        // v2: dos variantes posibles según minor
        (sub as any)?.subscription?.unsubscribe?.();
        (sub as any)?.unsubscribe?.();
      } catch {}
    };
  }, [SUPA_READY]);

  // Redirección única si se solicitó y no hay sesión
  React.useEffect(() => {
    if (!checked) return;
    if (hasSession) return;
    if (!redirectTo) return;

    // Construye destino final (si es /login, añade ?redirect=<ruta-actual>)
    const dest =
      redirectTo === '/login'
        ? `/login?redirect=${encodeURIComponent(pathname || '/')}`
        : redirectTo;

    // Redirección con recarga (segura para cookies)
    if (typeof window !== 'undefined') {
      window.location.replace(dest);
    }
  }, [checked, hasSession, redirectTo, pathname]);

  // Evita SSR/flicker
  if (!mounted) return null;

  // Mientras comprobamos, muestra fallback
  if (!checked) return <>{fallback}</>;

  // Si no hay sesión:
  // - overlay mode (redirectTo === null): no renderizamos hijos; el Layout pondrá el modal encima.
  // - redirect mode: ya estamos redirigiendo; no pintes nada.
  if (!hasSession) return null;

  // Autenticado → renderiza contenido protegido
  return <>{children}</>;
}

export { RequireAuth };
