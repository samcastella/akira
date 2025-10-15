'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useAuthUserId } from '@/lib/user';
import { ChevronRight } from 'lucide-react';

function genJoinCode(len = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function CrearRetoPage() {
  const router = useRouter();
  const uid = useAuthUserId();
  const todayISO = useMemo(() => toISODate(new Date()), []);

  const [title, setTitle] = useState('');
  const [start, setStart] = useState(todayISO);
  const [duration, setDuration] = useState(30);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    if (!uid) return setErrorMsg('Debes iniciar sesión para crear un reto.');
    if (!title.trim()) return setErrorMsg('Ponle un título al reto.');
    if (duration < 1 || duration > 365) return setErrorMsg('Duración no válida (1–365 días).');

    setSubmitting(true);
    try {
      // calcular end
      const startDate = new Date(start + 'T00:00:00');
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + Number(duration));
      const endISO = toISODate(endDate);

      // generar code único (reintentos si colisión)
      let code = genJoinCode(6);
      let createdId: string | null = null;

      for (let attempt = 0; attempt < 6; attempt++) {
        const { data, error } = await supabase
          .from('challenges')
          .insert([{ owner_id: uid, code, title: title.trim(), start, end: endISO, join_code: code }])
          .select('id')
          .single();

        if (error) {
          const msg = String(error.message || '');
          if ((error as any).code === '23505' || msg.includes('duplicate key')) {
            code = genJoinCode(7);
            continue;
          }
          throw error;
        }
        createdId = data?.id ?? null;
        break;
      }

      if (!createdId) throw new Error('No se pudo crear el reto (código ocupado). Prueba de nuevo.');

      // añadir creador como miembro (sin SELECT implícito)
      const { error: mErr } = await supabase
        .from('challenge_members')
        .insert([{ challenge_id: createdId, user_id: uid }]);
      if (mErr) throw mErr;

      router.push(`/amigos/retos/${createdId}`);
    } catch (err: any) {
      setErrorMsg(err?.message ?? 'Error al crear el reto.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="container mx-auto px-4 max-w-screen-sm py-4">
      <header className="mb-4">
        <h1 className="text-xl font-semibold">Crear reto</h1>
        <p className="text-sm muted mt-1">Define tu reto y comparte el código con tus amigos.</p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm mb-1">Título del reto</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-xl border px-3 py-2"
            style={{ borderColor: 'var(--line)' }}
            placeholder="Reto 30 días corriendo"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1">Fecha de inicio</label>
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="w-full rounded-xl border px-3 py-2"
              style={{ borderColor: 'var(--line)' }}
              required
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Duración (días)</label>
            <input
              type="number"
              min={1}
              max={365}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full rounded-xl border px-3 py-2"
              style={{ borderColor: 'var(--line)' }}
              required
            />
          </div>
        </div>

        {errorMsg && <div className="text-sm text-red-600">{errorMsg}</div>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-2xl border px-4 py-3 flex items-center justify-center gap-2 hover:bg-black/5 transition"
          style={{ borderColor: 'var(--line)' }}
        >
          <span>{submitting ? 'Creando…' : 'Crear y continuar'}</span>
          <ChevronRight className="h-5 w-5" />
        </button>
      </form>
    </main>
  );
}
