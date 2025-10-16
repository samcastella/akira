// src/app/amigos/retos/crear/revision/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useAuthUserId } from '@/lib/user';

type Challenge = {
  id: string;
  owner_id: string;
  title: string;
  start: string; // yyyy-mm-dd
  end: string;   // yyyy-mm-dd
  rules: string | null;
  cover_url: string | null;
  join_code: string;
  customize_days: boolean;
};

type DayRow = { day_index: number; label: string | null };
type MemberRow = { user_id: string };

function daysBetween(startISO: string, endISO: string): number {
  // calculamos duración en días usando fechas a medianoche
  const s = new Date(startISO + 'T00:00:00');
  const e = new Date(endISO + 'T00:00:00');
  const MS = 24 * 60 * 60 * 1000;
  const diff = Math.round((e.getTime() - s.getTime()) / MS);
  // Por cómo creamos el reto, end = start + duration → diff ya es "duration"
  return Math.max(1, Math.min(365, diff));
}

export default function RevisionRetoPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const uid = useAuthUserId();

  const cid = sp.get('cid') || '';

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [ch, setCh] = useState<Challenge | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [days, setDays] = useState<DayRow[]>([]);

  const isOwner = ch?.owner_id && uid ? ch.owner_id === uid : false;
  const duration = useMemo(
    () => (ch ? daysBetween(ch.start, ch.end) : 0),
    [ch?.start, ch?.end]
  );

  useEffect(() => {
    let ok = true;
    (async () => {
      if (!cid) return;
      setLoading(true);
      setMsg(null);
      try {
        // 1) challenge base
        const { data: challenge, error: e1 } = await supabase
          .from('challenges')
          .select('id, owner_id, title, start, end, rules, cover_url, join_code, customize_days')
          .eq('id', cid)
          .single();
        if (e1) throw e1;
        if (!ok) return;

        setCh(challenge as Challenge);

        // 2) miembros (por ahora nos basta el conteo / listado simple)
        const { data: mems, error: e2 } = await supabase
          .from('challenge_members')
          .select('user_id')
          .eq('challenge_id', cid);
        if (e2) throw e2;
        if (!ok) return;

        setMembers((mems || []) as MemberRow[]);

        // 3) días (si hay personalización cargamos labels; si no, lista vacía para generar genéricos)
        if ((challenge as Challenge).customize_days) {
          const { data: ds, error: e3 } = await supabase
            .from('challenge_days')
            .select('day_index, label')
            .eq('challenge_id', cid)
            .order('day_index', { ascending: true });
          if (e3) throw e3;
          if (!ok) return;

          setDays((ds || []) as DayRow[]);
        } else {
          setDays([]); // generaremos "Día 1, Día 2..." en render
        }
      } catch (e: any) {
        setMsg(e?.message || 'No se pudo cargar la revisión del reto.');
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      ok = false;
    };
  }, [cid]);

  if (!cid) {
    return (
      <main className="container mx-auto px-4 max-w-screen-sm py-6">
        <p>Falta el parámetro <code>cid</code>.</p>
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 max-w-screen-md py-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Revisión del reto</h1>
        {ch && (
          <p className="text-sm muted">
            {new Date(ch.start + 'T00:00:00').toLocaleDateString()} · {duration} días
          </p>
        )}
        {!isOwner && (
          <p className="text-xs text-orange-600">
            Solo el propietario puede publicar cambios. Vista de revisión en modo lectura.
          </p>
        )}
      </header>

      {msg && <div className="text-sm text-red-600">{msg}</div>}
      {loading && <div>Cargando…</div>}

      {!loading && ch && (
        <>
          {/* Portada */}
          <section className="space-y-3">
            <div className="w-full aspect-[3/1] rounded-2xl border overflow-hidden flex items-center justify-center">
              {ch.cover_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={ch.cover_url} alt="Portada del reto" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-sm text-gray-500">
                  Sin imagen de portada
                </div>
              )}
            </div>
            <div>
              <h2 className="text-lg font-semibold">{ch.title}</h2>
              {ch.rules ? (
                <p className="text-sm mt-1 whitespace-pre-wrap">{ch.rules}</p>
              ) : (
                <p className="text-sm mt-1 text-gray-500">Sin normas definidas.</p>
              )}
            </div>
          </section>

          {/* Meta: participantes y código */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border p-3" style={{ borderColor: 'var(--line)' }}>
              <div className="text-xs text-gray-500 mb-1">Participantes</div>
              <div className="text-base font-medium">{members.length || 1}</div>
              <div className="text-xs text-gray-500">Incluye al creador del reto</div>
            </div>
            <div className="rounded-xl border p-3" style={{ borderColor: 'var(--line)' }}>
              <div className="text-xs text-gray-500 mb-1">Código del reto</div>
              <div className="text-base font-semibold tracking-wider">{ch.join_code}</div>
              <div className="text-xs text-gray-500">Compártelo para invitar</div>
            </div>
          </section>

          {/* Días */}
          <section className="space-y-2">
            <h3 className="text-sm font-medium">Estructura de días</h3>

            {/* Si hay personalización, usamos labels; si no, generamos “Día X” genérico */}
            <div className="rounded-xl border" style={{ borderColor: 'var(--line)' }}>
              <ul className="divide-y" style={{ borderColor: 'var(--line)' }}>
                {ch.customize_days
                  ? (
                    days.length
                      ? days.map((r) => (
                          <li key={r.day_index} className="p-3 flex items-center gap-3">
                            {/* check decorativo (disabled) */}
                            <input type="checkbox" disabled className="h-4 w-4" />
                            <div className="text-sm">
                              <span className="font-medium mr-2">Día {r.day_index}</span>
                              <span className="text-gray-700">{r.label || '—'}</span>
                            </div>
                          </li>
                        ))
                      : Array.from({ length: duration }, (_, i) => i + 1).map((d) => (
                          <li key={d} className="p-3 flex items-center gap-3">
                            <input type="checkbox" disabled className="h-4 w-4" />
                            <div className="text-sm">
                              <span className="font-medium mr-2">Día {d}</span>
                              <span className="text-gray-500">—</span>
                            </div>
                          </li>
                        ))
                  )
                  : Array.from({ length: duration }, (_, i) => i + 1).map((d) => (
                      <li key={d} className="p-3 flex items-center gap-3">
                        <input type="checkbox" disabled className="h-4 w-4" />
                        <div className="text-sm">
                          <span className="font-medium mr-2">Día {d}</span>
                          <span className="text-gray-500">—</span>
                        </div>
                      </li>
                    ))}
              </ul>
            </div>
          </section>

          <div className="pt-2 flex gap-3">
            <button
              onClick={() => router.push(`/amigos/retos/crear/personalizar?cid=${cid}&duration=${duration}`)}
              className="flex-1 rounded-2xl border px-4 py-3 hover:bg-black/5 transition"
              style={{ borderColor: 'var(--line)' }}
            >
              Volver a personalizar
            </button>

            <button
              onClick={() => router.push(`/amigos/retos/${cid}`)}
              className="flex-1 rounded-2xl border px-4 py-3 hover:bg-black/5 transition"
              style={{ borderColor: 'var(--line)' }}
            >
              Publicar y ver reto
            </button>
          </div>
        </>
      )}
    </main>
  );
}
