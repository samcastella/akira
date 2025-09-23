// src/lib/logout.ts
'use client';

import { supabase } from '@/lib/supabaseClient';

/**
 * Cierra sesión de forma robusta:
 * 1) Pide al servidor que borre la cookie httpOnly de Supabase (sb-*-auth-token).
 * 2) Cierra sesión del SDK en el cliente (memoria + storage).
 * 3) Limpia storage local de la app.
 * 4) Redirige (por defecto a /login).
 */
export async function logoutAndResetApp(redirectTo: string = '/login') {
  // 1) Server sign-out: borra cookie httpOnly sb-*-auth-token
  try {
    await fetch('/auth/signout', {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers: { 'content-type': 'application/json' },
    });
    // pequeño margen para aplicar Set-Cookie
    await new Promise((r) => setTimeout(r, 150));
  } catch {
    // no-op
  }

  // 2) Client sign-out: borra sesión en memoria y storage del SDK
  try {
    await supabase.auth.signOut({ scope: 'global' as any });
  } catch {
    // no-op
  }

  // 3) Limpieza de almacenamiento local de la app
  try {
    const clearPrefix = (storage: Storage, prefix: string) => {
      const keys: string[] = [];
      for (let i = 0; i < storage.length; i++) {
        const k = storage.key(i);
        if (k && k.startsWith(prefix)) keys.push(k);
      }
      keys.forEach((k) => storage.removeItem(k));
    };

    // Claves propias
    clearPrefix(localStorage, 'akira_');
    clearPrefix(sessionStorage, 'akira_');

    // Clave de auth del SDK (definida en supabaseClient.ts)
    try { localStorage.removeItem('akira.auth'); } catch {}

    // Bandera de “visto” que usas en la UI
    try { localStorage.removeItem('akira_seen_auth_v1'); } catch {}

    // Algunas previews añaden este JWT propio de Vercel; lo limpiamos por si acaso
    try { document.cookie = `_vercel_jwt=; Max-Age=0; path=/`; } catch {}

    // Notificación a listeners internos
    try { window.dispatchEvent(new CustomEvent('akira:user-updated')); } catch {}
  } catch {
    // no-op
  }

  // 4) Redirección “dura”
  try {
    window.location.replace(redirectTo);
  } catch {
    window.location.href = redirectTo;
  }
}
