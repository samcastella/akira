'use client';

import { supabase } from '@/lib/supabaseClient';

/**
 * Cierra sesión globalmente, limpia estado local (akira_*) y fuerza reinicio en /login.
 */
export async function logoutAndResetApp(redirectTo: string = '/login') {
  try {
    await supabase.auth.signOut({ scope: 'global' as any });
  } catch (e) {
    // no-op
  }

  // Eliminar todas las claves propias por prefijo
  try {
    const clearPrefix = (storage: Storage, prefix: string) => {
      const keys: string[] = [];
      for (let i = 0; i < storage.length; i++) {
        const k = storage.key(i);
        if (k && k.startsWith(prefix)) keys.push(k);
      }
      keys.forEach((k) => storage.removeItem(k));
    };
    clearPrefix(localStorage, 'akira_');
    clearPrefix(sessionStorage, 'akira_');
  } catch (e) {
    // no-op
  }

  // Reinicio duro (evita volver con el botón atrás)
  try {
    window.location.replace(redirectTo);
  } catch {
    // Fallback por si replace no está disponible
    window.location.href = redirectTo;
  }
}
