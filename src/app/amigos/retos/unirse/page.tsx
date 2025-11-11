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

  // Modal de éxito
  const [joined, setJoined] = useState<{ open: boolean; challengeId?: string }>({ open: false });

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
      // ⚠️ Ajusta el nombre/params de tu RPC si es distinto
      const { data, error } = await supabase.rpc('join_challenge_by_code', { _code: clean });
      if (error) {
        const m = String(error.message || '');
        if (m.includes('RETO_NO_ENCONTRADO')) throw new Error('No existe ningún reto con ese código.');
        if (m.includes('NO_AUTH')) throw new Error('Debes iniciar sesión para unirte.');
        throw error;
      }
      // La RPC devuelve el id del reto. Si no, recupéralo por código:
      let challengeId = String(data || '');
      if (!challengeId) {
        const { data: c, error: e2 } = await supabase.from('challenges').select('id').eq('join_code', clean).single();
        if (e2) throw e2;
        challengeId = c?.id;
      }
      if (!challengeId) throw new Error('No se pudo unir al reto.');

      // Abre modal de éxito
      setJoined({ open: true, challengeId });
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

        {msg && <p className="text-xs mt-1 text-red-600">{msg}</p>}
      </section>

      {/* Modal de éxito */}
      {joined.open && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm grid place-items-center">
          <div className="bg-white rounded-2xl p-5 w-[90%] max-w-sm relative shadow-xl">
            <button
              className="absolute top-3 right-3 text-neutral-400 hover:text-black"
              onClick={() => setJoined({ open: false, challengeId: joined.challengeId })}
              aria-label="Cerrar"
            >
              ×
            </button>
            <h3 className="text-lg font-semibold">¡Te has unido al reto con éxito!</h3>
            <p className="text-sm text-neutral-600 mt-1">
              A partir de ahora lo puedes ver en <b>Retos con amigos</b>.
            </p>
            <div className="mt-4">
              <button
                onClick={() => {
                  const id = joined.challengeId;
                  setJoined({ open: false, challengeId: id });
                  if (id) router.push(`/amigos/retos/${id}`);
                }}
                className="w-full rounded-xl bg-black text-white px-4 py-2 text-sm font-semibold hover:opacity-90"
              >
                Ver reto
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
