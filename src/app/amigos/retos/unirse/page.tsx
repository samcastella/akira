'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function UnirseRetoPage() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUserId(data.user?.id ?? null);
      setAuthReady(true);
      const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
        setUserId(session?.user?.id ?? null);
      });
      unsub = () => sub.subscription.unsubscribe();
    })();
    return () => { if (unsub) unsub(); };
  }, []);

  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function join() {
    setMsg(null);
    if (!userId) { setMsg('Debes iniciar sesión para unirte.'); return; }

    const clean = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{4,10}$/.test(clean)) {
      setMsg('Código no válido.');
      return;
    }

    setLoading(true);
    try {
      // 👈 clave: usar _code, no p_code
      const { data, error } = await supabase.rpc('join_challenge_by_code', { _code: clean });
      if (error) {
        if (String(error.message).includes('RETO_NO_ENCONTRADO')) {
          throw new Error('No existe ningún reto con ese código.');
        }
        if (String(error.message).includes('NO_AUTH')) {
          throw new Error('Debes iniciar sesión para unirte.');
        }
        throw error;
      }
      const challengeId = String(data);
      if (!challengeId) throw new Error('No se pudo unir al reto.');

      // Redirigir al detalle del reto
      router.push(`/amigos/retos/${challengeId}`);
    } catch (e: any) {
      setMsg(e?.message || 'No hemos podido unirte al reto.');
    } finally {
      setLoading(false);
    }
  }

  if (!authReady) {
    return (
      <main className="space-y-3 text-sm container mx-auto px-4 py-6">
        <div className="animate-pulse h-6 w-40 rounded bg-black/10 mb-3" />
        <div className="animate-pulse h-4 w-60 rounded bg-black/10" />
      </main>
    );
  }

  return (
    <main className="space-y-3 text-sm container mx-auto px-4 py-6">
      <div className="flex items-center justify-between">
        <h2 className="page-title">Unirse a un reto</h2>
        <Link href="/amigos/retos" className="btn secondary">Volver</Link>
      </div>

      <section className="space-y-3 rounded-2xl border p-4" style={{ borderColor: 'var(--line)' }}>
        {!userId && <div className="text-xs">Inicia sesión para unirte a un reto.</div>}

        <label className="block">
          <span className="text-xs font-medium">Código del reto</span>
          <input
            className="input mt-1 text-[16px] font-mono"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABC123"
            disabled={!userId || loading}
            maxLength={10}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
          />
        </label>

        <button className="btn" onClick={join} disabled={!userId || !code.trim() || loading}>
          {loading ? 'Uniéndote…' : 'Unirme'}
        </button>

        {msg && <p className="text-xs mt-1">{msg}</p>}
      </section>
    </main>
  );
}
