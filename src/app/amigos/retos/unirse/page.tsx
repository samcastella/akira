'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

export default function UnirseRetoPage() {
  const [userId, setUserId] = useState<string | undefined>(undefined);

  useEffect(() => {
    let ok = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!ok) return;
      setUserId(data.session?.user?.id ?? undefined);
    })();
    return () => { ok = false; };
  }, []);

  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  async function join() {
    if (!userId) { setMsg('Debes iniciar sesión para unirte.'); return; }
    try {
      const { data, error } = await supabase.rpc('join_challenge_by_code', { p_code: code.trim().toUpperCase() });
      if (error) throw error;
      if (!data) throw new Error('Código no válido');
      setMsg('¡Te has unido con éxito!');
    } catch (e: any) {
      setMsg(e?.message || 'Código no válido');
    }
  }

  return (
    <main className="space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <h2 className="page-title">Unirse a un reto</h2>
        <Link href="/amigos/retos" className="btn secondary">Volver</Link>
      </div>

      <section className="space-y-3" style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius-card)', padding: 16 }}>
        {!userId && <div className="text-xs">Inicia sesión para unirte a un reto.</div>}
        <label className="block">
          <span className="text-xs font-medium">Código del reto</span>
          <input className="input mt-1 text-[16px]" value={code} onChange={(e) => setCode(e.target.value)} placeholder="ABC123" disabled={!userId} />
        </label>
        <button className="btn" onClick={join} disabled={!userId || !code.trim()}>Unirme</button>
        {msg && <p className="text-xs mt-1">{msg}</p>}
      </section>
    </main>
  );
}
