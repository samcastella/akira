// src/app/debug/whoami/WhoamiClient.tsx
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { logoutAndResetApp } from '@/lib/logout';

export default function WhoamiClient() {
  const [out, setOut] = useState<any>(null);
  const [log, setLog] = useState<Array<[AuthChangeEvent, boolean, number]>>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function read() {
    const { data } = await supabase.auth.getSession();
    const s = data.session ?? null;
    setOut({
      client_userId: s?.user?.id ?? null,
      client_email: s?.user?.email ?? null,
      client_expiresAt: s?.expires_at ? new Date(s.expires_at * 1000).toISOString() : null,
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
      try {
        // @supabase/supabase-js v2
        sub.subscription?.unsubscribe?.();
      } catch {}
    };
  }, []);

  async function forceRefreshSession() {
    await supabase.auth.getSession();
    await read();
  }

  async function syncServerCookies() {
    setBusy(true);
    setMsg(null);
    try {
      // 1) Asegura que tenemos tokens en cliente
      let at: string | undefined;
      let rt: string | undefined;
      for (let i = 0; i < 6; i++) {
        const { data } = await supabase.auth.getSession();
        at = data.session?.access_token;
        rt = data.session?.refresh_token;
        if (at && rt) break;
        await new Promise((r) => setTimeout(r, 120));
      }

      if (!at || !rt) {
        setMsg('No hay tokens en la sesión del cliente.');
        return;
      }

      // 2) Enviar tokens al endpoint server para fijar cookies httpOnly
      const resp = await fetch('/auth/set', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ access_token: at, refresh_token: rt }),
      });

      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        setMsg(`Servidor no aceptó tokens (${resp.status}): ${j?.error || 'error'}`);
        return;
      }

      setMsg('Cookies server sincronizadas. Recargando...');
      // Recarga para que el server reciba la request con cookies nuevas
      setTimeout(() => window.location.reload(), 200);
    } catch (e: any) {
      setMsg(e?.message || 'Fallo al sincronizar cookies en el servidor.');
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
