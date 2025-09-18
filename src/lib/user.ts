'use client';

import React, { useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

/**
 * Provider mínimo que:
 * - Hace un getSession() al montar (calienta la sesión)
 * - Se suscribe a cambios de auth para mantenerla fresca
 * - NO redirige, NO muestra UI, NO decide gating
 */
export default function SupabaseSessionProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    let active = true;

    // Calienta la sesión al montar (ignora errores)
    supabase.auth.getSession().catch(() => {});

    // Suscripción pasiva (sin redirecciones)
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, _session) => {
      if (!active) return;
      // No hacemos nada aquí: LayoutClient/RequireAuth gestionan la UI
    });

    return () => {
      active = false;
      try { (sub as any)?.subscription?.unsubscribe?.(); } catch {}
      try { (sub as any)?.unsubscribe?.(); } catch {}
    };
  }, []);

  return <>{children}</>;
}
