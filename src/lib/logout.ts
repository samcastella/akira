// src/lib/logout.ts
'use client';

import { supabase } from '@/lib/supabaseClient';

/**
 * Cierra sesión globalmente, limpia estado local y pide al servidor
 * que elimine las cookies de Supabase (sb-...).
 * Luego redirige a /login (o a la ruta indicada).
 */
export async function logoutAndResetApp(redirectTo: string = '/login') {
  // 1) Cierre de sesión en cliente (borra memoria + storage de supabase-js)
  try {
    await supabase.auth.signOut({ scope: 'global' as any });
  } catch {
    // noop
  }

  // 2) Cierre de sesión en servidor (elimina cookies sb-... httpOnly)
  try {
    await fetch('/auth/signout', {
      method: 'POST',
      credentials: 'include',
    }).catch(() => {});
    // Pequeña espera para asegurarnos de que el navegador aplica las cookies de la respuesta
    await new Promise((r) => setTimeout(r, 80));
  } catch {
    // noop
  }

  // 3) Limpieza de almacenamiento local de la app
  try {
    // Borra claves con prefijo akira_
    const clearPrefix = (storage: Storage, prefix: string) => {
      const keys: string[] = [];
      for (let i = 0; i < storage.length; i++) {
        const k = storage.key(i);
        if (k && k.startsWith(prefix)) keys.push(k);
      }
      keys.forEach((k) => storage.removeItem(k));
    };

    // Tus claves de app
    clearPrefix(localStorage, 'akira_');
    clearPrefix(sessionStorage, 'akira_');

    // Clave del auth de Supabase que definimos en supabaseClient.ts
    // (guardado en localStorage a menos que estuviera en el fallback en memoria)
    try {
      localStorage.removeItem('akira.auth');
    } catch {}

    // Otras banderas que usas
    try {
      localStorage.removeItem('akira_seen_auth_v1');
    } catch {}

    // Notifica a listeners internos (por si quieres reaccionar en UI)
    try {
      window.dispatchEvent(new CustomEvent('akira:user-updated'));
    } catch {}
  } catch {
    // noop
  }

  // 4) Reinicio duro (evita volver con atrás)
  try {
    window.location.replace(redirectTo);
  } catch {
    window.location.href = redirectTo;
  }
}
