// src/app/debug/whoami/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function WhoAmI() {
  const [out, setOut] = useState<any>(null);

  const read = async () => {
    const { data } = await supabase.auth.getSession();
    const s = data.session ?? null;
    setOut({
      userId: s?.user?.id ?? null,
      email: s?.user?.email ?? null,
      expiresAt: s?.expires_at ? new Date(s.expires_at * 1000).toISOString() : null,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '(no NEXT_PUBLIC_SUPABASE_URL)',
    });
  };

  useEffect(() => {
    read();
    const h = () => read();
    window.addEventListener('akira:auth-changed', h);
    return () => window.removeEventListener('akira:auth-changed', h);
  }, []);

  return (
    <main style={{ padding: 16 }}>
      <h1>Debug · WhoAmI</h1>
      <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(out, null, 2)}</pre>
      <button onClick={read} style={{ marginTop: 12 }}>Releer sesión</button>
    </main>
  );
}
