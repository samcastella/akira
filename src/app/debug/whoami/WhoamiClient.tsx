'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { logoutAndResetApp } from '@/lib/logout';

type ClientOut = {
  client_userId: string | null;
  client_email: string | null;
  client_expiresAt: string | null;
  client_user_via_getUser: string | null;
  hasLocalStorageAuthKey: boolean | null;
};

export default function WhoamiClient() {
  const [out, setOut] = useState<ClientOut | null>(null);
  const [log, setLog] = useState<Array<[AuthChangeEvent, boolean, number]>>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function read() {
    const [{ data: s }, { data: u }] = await Promise.all([
      supabase.auth.getSession(),
      supabase.auth.getUser(),
    ]);
    const session = s.session ?? null;

    let hasKey: boolean | null = null;
    try {
      hasKey = typeof window !== 'undefined' ? !!localStorage.getItem('akira.auth') : null;
    } catch {
      hasKey = null;
    }

    setOut({
      client_userId: session?.user?.id ?? null,
      client_email: session?.user?.email ?? null,
      client_expiresAt: session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
      client_user_via_getUser: u.user?.id ?? null,
      hasLocalStorageAuthKey: hasKey,
    });
  }

  useEffect(() => {
    void read();
    const { data: sub } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        setLog((old) => [...old.slice(-20), [event, !!session?.user?.id, Date.now()]]);
        void read();
        try {
          window.dispatchEvent(new CustomEvent('akira:auth-changed', { detail: { evt: event } }));
        } catch {}
      }
    );
    return () => {
      try { sub.subscription?.unsubscribe?.(); } catch {}
    };
  }, []);

  async function forceRefreshSession() {
    await supabase.auth.getSession(); // fuerza refresco en memoria
    await read();
  }

  /**
   * Lee la cookie httpOnly en el servidor (/auth/set),
   * recibe access/refresh y los inyecta en el SDK del cliente.
   */
  async function syncServerCookies() {
    setBusy(true);
    setMsg(null);
    try {
      const resp = await fetch('/auth/set', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers: { 'content-type': 'application/json' },
      });

      const j = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setMsg(`Servidor sin sesión (${resp.status})${j?.error ? `: ${j.error}` : ''}`);
        return;
      }

      const at = j?.access_token as string | undefined;
      const rt = j?.refresh_token as string | undefined;

      if (!at || !rt) {
        setMsg('El servidor no devolvió tokens válidos.');
        return;
      }

      await supabase.auth.setSession({ access_token: at, refresh_token: rt });
      await supabase.auth.getSession().catch(() => {});
      setMsg('Sesión del cliente hidratada desde cookie httpOnly.');
      await read();
    } catch (e: any) {
      setMsg(e?.message || 'Fallo al sincronizar sesión desde el servidor.');
    } finally {
      setBusy(false);
    }
  }

  async function doSignOut() {
    setBusy(true);
    setMsg(null);
    try {
      await logoutAndResetApp('/login');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-2">
      <h2 className="font-mono text-sm mb-1">client</h2>
      <pre className="text-xs bg-black/5 p-3 rounded">{JSON.stringify(out, null, 2)}</pre>

      <div className="flex flex-wrap gap-2">
        <button className="btn secondary" onClick={() => read()}>Releer (client)</button>
        <button className="btn secondary" onClick={forceRefreshSession}>
          Forzar getSession()
        </button>
        <button className="btn secondary" onClick={syncServerCookies} disabled={busy}>
          {busy ? 'Sincronizando…' : 'Sync server cookies'}
        </button>
        <button className="btn secondary" onClick={doSignOut} disabled={busy}>
          {busy ? 'Saliendo…' : 'Sign out'}
        </button>
      </div>

      {msg && <div className="text-[11px] text-amber-700">{msg}</div>}

      <div className="mt-3">
        <div className="font-mono text-sm mb-1">event log</div>
        <pre className="text-xs bg-black/5 p-3 rounded" style={{ maxHeight: 240, overflow: 'auto' }}>
{JSON.stringify(
  log.map(([evt, ok, ts]) => ({ evt, ok, at: new Date(ts).toISOString() })),
  null,
  2
)}
        </pre>
      </div>
    </section>
  );
}
