'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type DayDraft = { date: string; title: string };

const randomCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
};

function eachDateInclusive(start: string, end: string): string[] {
  const out: string[] = [];
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export default function CrearRetoPage() {
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

  const [title, setTitle] = useState('');
  const [start, setStart] = useState<string>('');
  const [end, setEnd] = useState<string>('');
  const [days, setDays] = useState<DayDraft[]>([]);
  const [code, setCode] = useState<string | null>(null);
  const [createdOpen, setCreatedOpen] = useState(false);

  useEffect(() => {
    if (start && end) {
      const dates = eachDateInclusive(start, end);
      setDays(dates.map((d) => ({ date: d, title: title || 'Reto' })));
    } else {
      setDays([]);
    }
  }, [start, end, title]);

  function updateDay(idx: number, val: string) {
    setDays((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], title: val };
      return next;
    });
  }

  async function create() {
    if (!userId) return;
    if (!title || !start || !end || days.length === 0) return;

    // Genera código único con reintentos mínimos
    let code = randomCode();
    for (let i = 0; i < 5; i++) {
      const { data: clash } = await supabase.from('challenges').select('id').eq('code', code).maybeSingle();
      if (!clash) break;
      code = randomCode();
    }

    const { data: ch, error: e1 } = await supabase
      .from('challenges')
      .insert({ owner_id: userId, title, start, end, code })
      .select('id, code')
      .single();
    if (e1) { console.error(e1); return; }

    const payload = days.map((d) => ({ challenge_id: ch.id, day: d.date, title: d.title }));
    const { error: e2 } = await supabase.from('challenge_days').insert(payload);
    if (e2) { console.error(e2); }

    const { error: e3 } = await supabase.from('challenge_members').insert({ challenge_id: ch.id, user_id: userId });
    if (e3) { console.error(e3); }

    setCode(ch.code);
    setCreatedOpen(true);
  }

  const disabled = !userId;

  return (
    <main className="space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <h2 className="page-title">Crear reto conjunto</h2>
        <Link href="/amigos/retos" className="btn secondary">Volver</Link>
      </div>

      {disabled && (
        <div className="text-xs mb-1 rounded-xl border p-3" style={{ borderColor: 'var(--line)', background: '#fff' }}>
          Inicia sesión para crear un reto. <Link className="underline" href="/login?redirect=/amigos/retos/crear">Ir a login</Link>.
        </div>
      )}

      <section className="space-y-3 text-sm" style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius-card)', padding: 16 }}>
        <label className="block">
          <span className="text-xs font-medium">Nombre del reto</span>
          <input className="input mt-1 text-[16px]" placeholder="Entrenar, Correr, Meditar…" value={title} onChange={(e) => setTitle(e.target.value)} disabled={disabled} />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-medium">Inicio del reto</span>
            <input type="date" className="input mt-1 text-[16px]" value={start} onChange={(e) => setStart(e.target.value)} disabled={disabled} />
          </label>
          <label className="block">
            <span className="text-xs font-medium">Final del reto</span>
            <input type="date" className="input mt-1 text-[16px]" value={end} onChange={(e) => setEnd(e.target.value)} disabled={disabled} />
          </label>
        </div>

        {days.length > 0 && (
          <div className="mt-2">
            <p className="text-xs mb-2 muted">Edita los días (p. ej. “correr 1 km”, “correr 2 km”…)</p>
            <ul className="space-y-2 max-h-[260px] overflow-auto pr-1">
              {days.map((d, i) => (
                <li key={d.date} className="flex items-center gap-2">
                  <span className="text-xs shrink-0 w-[96px]">{d.date}</span>
                  <input className="input text-[14px] flex-1" value={d.title} onChange={(e) => updateDay(i, e.target.value)} disabled={disabled} />
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-2">
          <button className="btn" onClick={create} disabled={disabled || !title || !start || !end}>Crear reto</button>
          <button className="btn secondary" onClick={() => { setTitle(''); setStart(''); setEnd(''); setDays([]); setCode(null); }}>
            Limpiar
          </button>
        </div>

        {code && (
          <div className="bg-black/5 rounded-xl p-3 mt-2">
            <div className="text-xs muted">Código para compartir</div>
            <div className="text-lg font-semibold tracking-widest">{code}</div>
            <div className="text-xs mt-1">Tus amigos pueden ir a <b>Unirse con código</b> y pegarlo.</div>
          </div>
        )}
      </section>

      {createdOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl p-6 text-sm" style={{ width: 'min(90vw, 360px)' }} role="dialog" aria-modal="true">
            <p className="font-semibold">Reto creado con éxito</p>
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn" onClick={() => setCreatedOpen(false)}>Aceptar</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
