'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Challenge = {
  id: string;
  title: string;
  code: string;
  start: string; // date
  end: string;   // date
};

export default function ChallengeDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const challengeId = params?.id;

  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'reto' | 'ranking'>('reto');

  useEffect(() => {
    if (!challengeId) return;
    (async () => {
      setLoading(true);
      setErr(null);
      const { data, error } = await supabase
        .from('challenges')
        .select('id,title,code,start,end')
        .eq('id', challengeId)
        .single();
      if (error) {
        setErr(error.message);
      } else {
        setChallenge(data as Challenge);
      }
      setLoading(false);
    })();
  }, [challengeId]);

  function copyCode() {
    if (!challenge?.code) return;
    navigator.clipboard?.writeText(challenge.code);
  }

  if (loading) {
    return (
      <main className="container mx-auto px-4 py-6">
        <div className="animate-pulse h-6 w-40 rounded bg-black/10 mb-3" />
        <div className="animate-pulse h-4 w-60 rounded bg-black/10" />
      </main>
    );
  }

  if (err || !challenge) {
    return (
      <main className="container mx-auto px-4 py-6 space-y-3">
        <h1 className="text-xl font-semibold">Reto no disponible</h1>
        <p className="text-sm muted">
          {err ?? 'No hemos podido encontrar este reto o no tienes permisos para verlo.'}
        </p>
        <button
          onClick={() => router.push('/amigos/retos/mis-retos')}
          className="rounded-xl border px-4 py-2 hover:bg-black/5 transition"
          style={{ borderColor: 'var(--line)' }}
        >
          Volver a mis retos
        </button>
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 py-6 space-y-4">
      {/* Header */}
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">{challenge.title}</h1>
        <p className="text-sm muted">
          {challenge.start} → {challenge.end}
        </p>

        {/* Código para invitar */}
        <div className="mt-3 flex items-center gap-2">
          <div
            className="rounded-xl border px-3 py-2 text-sm"
            style={{ borderColor: 'var(--line)' }}
          >
            Código: <span className="font-mono font-medium">{challenge.code}</span>
          </div>
          <button
            onClick={copyCode}
            className="rounded-xl border px-3 py-2 text-sm hover:bg-black/5 transition"
            style={{ borderColor: 'var(--line)' }}
            title="Copiar código"
          >
            Copiar
          </button>
        </div>
      </header>

      {/* Tabs */}
      <nav
        className="flex gap-2 border-b"
        style={{ borderColor: 'var(--line)' }}
      >
        {(['reto','ranking'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-2 text-sm rounded-t-lg border ${
              activeTab === tab ? 'bg-black/5' : 'hover:bg-black/5'
            }`}
            style={{ borderColor: 'var(--line)' }}
          >
            {tab === 'reto' ? 'Reto' : 'Ranking'}
          </button>
        ))}
      </nav>

      {/* Contenido por tab */}
      {activeTab === 'reto' ? (
        <section className="space-y-3">
          <div
            className="rounded-2xl border p-4"
            style={{ borderColor: 'var(--line)' }}
          >
            <h2 className="font-medium mb-1">Hoy</h2>
            <p className="text-sm muted mb-3">
              Aquí irá: subir foto del día y lista de validaciones pendientes de tus amigos.
            </p>
            <div className="flex gap-2">
              <button
                className="rounded-xl border px-3 py-2 text-sm hover:bg-black/5 transition"
                style={{ borderColor: 'var(--line)' }}
                onClick={() => alert('TODO: Subir foto')}
              >
                Subir foto del día
              </button>
              <button
                className="rounded-xl border px-3 py-2 text-sm hover:bg-black/5 transition"
                style={{ borderColor: 'var(--line)' }}
                onClick={() => alert('TODO: Validar pendientes')}
              >
                Validar pendientes
              </button>
            </div>
          </div>
        </section>
      ) : (
        <section
          className="rounded-2xl border p-4"
          style={{ borderColor: 'var(--line)' }}
        >
          <h2 className="font-medium mb-1">Ranking</h2>
          <p className="text-sm muted">
            Aquí mostraremos la tabla de puntos (sumas de +5 por día válido).
          </p>
        </section>
      )}
    </main>
  );
}
