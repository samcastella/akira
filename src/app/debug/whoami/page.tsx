'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function WhoAmI() {
  const [info, setInfo] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setInfo({
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
        anonKeyPrefix: (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').slice(0, 8),
        email: data?.user?.email ?? null,
        user_id: data?.user?.id ?? null,
      });
    })();
  }, []);

  return (
    <main style={{ padding: 16, fontFamily: 'system-ui' }}>
      <h1 style={{ fontSize: 18, marginBottom: 8 }}>Debug · WhoAmI</h1>
      <pre style={{ whiteSpace: 'pre-wrap' }}>
        {JSON.stringify(info, null, 2)}
      </pre>
      <p style={{ marginTop: 8, opacity: 0.7 }}>
        Abre esta página en el móvil para confirmar URL de Supabase + sesión.
      </p>
    </main>
  );
}
