'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

export default function WhoamiClient() {
  const [out, setOut] = useState<any>(null);
  const [log, setLog] = useState<Array<[AuthChangeEvent, boolean, number]>>([]);

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
      try { sub.subscription?.unsubscribe?.(); } catch {}
    };
  }, []);

  return (
    <section className="space-y-2">
      <h2 className="font-mono text-sm mb-1">client</h2>
      <pre className="text-xs bg-black/5 p-3 rounded">{JSON.stringify(out, null, 2)}</pre>

      <div className="flex gap-2">
        <button className="btn secondary" onClick={() => read()}>Releer (client)</button>
        <button
          className="btn secondary"
          onClick={async () => {
            await supabase.auth.getSession(); // fuerza refresco en memoria
            await read();
          }}
        >
          Forzar getSession()
        </button>
        <button
          className="btn secondary"
          onClick={async () => {
            await supabase.auth.signOut();
            await read();
          }}
        >
          Sign out
        </button>
      </div>

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
