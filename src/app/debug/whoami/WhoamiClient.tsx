'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type ClientOut = {
  userId: string | null;
  email: string | null;
  expiresAt: string | null;
  provider: string | null;
};

export default function WhoamiClient() {
  const [out, setOut] = useState<ClientOut | null>(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<Array<[string, boolean, number]>>([]);

  const read = useCallback(async () => {
    const [{ data: s }, { data: u }] = await Promise.all([
      supabase.auth.getSession(),
      supabase.auth.getUser(),
    ]);
    const sess = s.session ?? null;
    const user = u.user ?? null;

    setOut({
      userId: user?.id ?? null,
      email: user?.email ?? null,
      provider:
        (user?.app_metadata as any)?.provider ??
        (Array.isArray((user?.app_metadata as any)?.providers)
          ? (user?.app_metadata as any).providers?.[0] ?? null
          : null),
      expiresAt: sess?.expires_at ? new Date(sess.expires_at * 1000).toISOString() : null,
    });
  }, []);

  useEffect(() => {
    const sub = supabase.auth.onAuthStateChange((e, s) => {
      setLog((old) => [...old.slice(-20), [e, !!s?.user?.id, Date.now()]]);
      void read();
      try {
        window.dispatchEvent(new CustomEvent('akira:auth-changed', { detail: { evt: e } }));
      } catch {}
    });

    void read();
    return () => {
      try {(sub as any)?.data?.subscription?.unsubscribe?.();} catch {}
      try {(sub as any)?.subscription?.unsubscribe?.();} catch {}
    };
  }, [read]);

  async function refreshNow() {
    setBusy(true);
    try {
      await supabase.auth.getSession();
      await read();
    } finally {
      setBusy(false);
    }
  }

  async function signOutAll() {
    setBusy(true);
    try {
      await supabase.auth.signOut();
      await read();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-2">
      <h2 className="font-mono text-sm mb-1">client</h2>
      <pre className="text-xs bg-black/5 p-3 rounded">{JSON.stringify(out, null, 2)}</pre>

      <div className="flex gap-2">
        <button onClick={read} disabled={busy} className="px-3 py-1.5 text-xs rounded border border-black bg-white">
          Releer (client)
        </button>
        <button onClick={refreshNow} disabled={busy} className="px-3 py-1.5 text-xs rounded border border-black bg-white">
          Forzar getSession()
        </button>
        <button onClick={signOutAll} disabled={busy} className="px-3 py-1.5 text-xs rounded border border-black bg-white">
          Sign out
        </button>
      </div>

      <details className="mt-2">
        <summary className="text-xs cursor-pointer">event log</summary>
        <pre className="text-[10px] bg-black/5 p-3 rounded overflow-auto max-h-48">
          {JSON.stringify(
            log.map(([e, ok, t]) => ({ e, ok, at: new Date(t).toISOString() })),
            null,
            2
          )}
        </pre>
      </details>
    </section>
  );
}
