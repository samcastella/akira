// src/app/amigos/retos/crear/personalizar/page.tsx
'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useAuthUserId } from '@/lib/user';
import {
  ensureChallengeDays,
  setChallengeMeta,
  upsertDayLabel,
  uploadChallengeCover,
} from '@/lib/challenges';

type DayRow = { day: number; label: string };

function bust(url: string | null): string | null {
  if (!url) return null;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}v=${Date.now()}`;
}

function PersonalizarRetoPageInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const uid = useAuthUserId();

  const cid = sp.get('cid') || '';
  const duration = useMemo(
    () => Math.max(1, Math.min(365, Number(sp.get('duration') || 30))),
    [sp]
  );

  const [loading, setLoading] = useState(true);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [title, setTitle] = useState<string>('');
  const [customize, setCustomize] = useState(false);

  const [rules, setRules] = useState('');
  const [savingRules, setSavingRules] = useState<'idle' | 'saving' | 'saved'>('idle');

  const [coverUrl, setCoverUrl] = useState<string | null>(null); // para mostrar (cache-busted)
  const [savingCover, setSavingCover] = useState(false);

  const [days, setDays] = useState<DayRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const isOwner = ownerId && uid ? ownerId === uid : false;

  // Carga meta + owner + (opcional) días
  useEffect(() => {
    let ok = true;
    (async () => {
      if (!cid) return;
      setLoading(true);
      setMsg(null);
      try {
        const { data: ch, error } = await supabase
          .from('challenges')
          .select('owner_id, title, customize_days, rules, cover_url')
          .eq('id', cid)
          .single();
        if (error) throw error;
        if (!ok) return;

        setOwnerId(ch?.owner_id ?? null);
        setTitle(ch?.title ?? '');
        const cst = Boolean(ch?.customize_days);
        setCustomize(cst);
        setRules(ch?.rules || '');
        // aplicamos cache-busting solo para visualizar; en BD se guarda sin query
        setCoverUrl(bust(ch?.cover_url || null));

        if (cst) {
          await ensureChallengeDays(cid, duration);
          const { data: ds } = await supabase
            .from('challenge_days')
            .select('day_index, label')
            .eq('challenge_id', cid)
            .order('day_index', { ascending: true });

          if (!ok) return;
          const map = new Map((ds || []).map((r) => [r.day_index as number, r.label || '']));
          setDays(
            Array.from({ length: duration }, (_, i) => {
              const d = i + 1;
              return { day: d, label: map.get(d) || '' };
            })
          );
        } else {
          setDays(Array.from({ length: duration }, (_, i) => ({ day: i + 1, label: '' })));
        }
      } catch (e: any) {
        setMsg(e?.message || 'No se pudo cargar el reto.');
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      ok = false;
    };
  }, [cid, duration]);

  async function handleToggleCustomize(next: boolean) {
    if (!isOwner) return;
    setCustomize(next);
    try {
      await setChallengeMeta(cid, next, null, null);
      if (next) {
        await ensureChallengeDays(cid, duration);
        const { data: ds } = await supabase
          .from('challenge_days')
          .select('day_index, label')
          .eq('challenge_id', cid)
          .order('day_index', { ascending: true });
        const map = new Map((ds || []).map((r) => [r.day_index as number, r.label || '']));
        setDays(
          Array.from({ length: duration }, (_, i) => {
            const d = i + 1;
            return { day: d, label: map.get(d) || '' };
          })
        );
      } else {
        // al desactivar, mostramos lista genérica (sin perder lo ya guardado en DB)
        setDays(Array.from({ length: duration }, (_, i) => ({ day: i + 1, label: '' })));
      }
    } catch (e: any) {
      setMsg(e?.message || 'No se pudo actualizar la personalización.');
    }
  }

  async function handleLabelChange(idx: number, value: string) {
    if (!isOwner) return;
    const dayNum = idx + 1;
    setDays((prev) => {
      const copy = [...prev];
      copy[idx] = { day: dayNum, label: value };
      return copy;
    });
    try {
      await upsertDayLabel(cid, dayNum, value);
    } catch (e: any) {
      setMsg(e?.message || 'No se pudo guardar el día.');
    }
  }

  async function handleSelectCover(file: File) {
    if (!isOwner) return;
    try {
      setSavingCover(true);
      const url = await uploadChallengeCover(cid, file); // devuelve URL pública base
      // Guardamos en BD la URL base (sin query)…
      const baseUrl = url.split('?')[0];
      await setChallengeMeta(cid, null, null, baseUrl);
      // …y para pintar forzamos cache-busting
      setCoverUrl(bust(baseUrl));
    } catch (e: any) {
      setMsg(e?.message || 'No se pudo subir la portada.');
    } finally {
      setSavingCover(false);
    }
  }

  // AUTOGUARDADO (debounce) de Normas
  useEffect(() => {
    if (!isOwner || !cid) return;
    if (savingRules === 'idle') return;

    const t = setTimeout(async () => {
      try {
        await setChallengeMeta(cid, null, rules, null);
        setSavingRules('saved');
        const t2 = setTimeout(() => setSavingRules('idle'), 1200);
        return () => clearTimeout(t2);
      } catch (e: any) {
        setMsg(e?.message || 'No se pudieron guardar las normas.');
        setSavingRules('idle');
      }
    }, 400); // 400ms debounce

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rules, cid, isOwner]);

  // onChange del textarea: solo toca estado y marca "saving"
  function handleRulesInput(v: string) {
    if (!isOwner) return;
    setRules(v);
    setSavingRules('saving');
  }

  // Guardado final antes de continuar a revisión
  async function handleContinue() {
    if (!isOwner) {
      router.push(`/amigos/retos/crear/revision?cid=${cid}`);
      return;
    }
    // Si hay un guardado en curso, no permitimos continuar
    if (savingRules === 'saving' || savingCover) {
      setMsg('Espera a que termine de guardarse la información…');
      return;
    }
    try {
      await setChallengeMeta(cid, null, rules, coverUrl ? coverUrl.split('?')[0] : null);
      router.push(`/amigos/retos/crear/revision?cid=${cid}`);
    } catch (e: any) {
      setMsg(e?.message || 'No se pudo guardar antes de continuar.');
    }
  }

  if (!cid) {
    return (
      <main className="container mx-auto px-4 max-w-screen-sm py-6">
        <p>Falta el parámetro <code>cid</code>.</p>
      </main>
    );
  }

  const continueDisabled = savingCover || savingRules === 'saving';

  return (
    <main className="container mx-auto px-4 max-w-screen-md py-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Personalizar reto</h1>
        <p className="text-sm muted">Reto: <span className="font-medium">{title || '—'}</span></p>
        {!isOwner && (
          <p className="text-xs text-orange-600">
            Solo el propietario del reto puede editar. Estás en modo lectura.
          </p>
        )}
      </header>

      {msg && <div className="text-sm text-red-600">{msg}</div>}
      {loading && <div>Cargando…</div>}

      {!loading && (
        <>
          {/* Portada */}
          <section className="space-y-2">
            <label className="block text-sm">Portada del reto</label>
            <div className="flex items-center gap-3">
              <div className="w-28 h-16 rounded-xl border flex items-center justify-center overflow-hidden">
                {coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={coverUrl} alt="Portada" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs text-gray-500">Sin imagen</span>
                )}
              </div>
              {isOwner && (
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleSelectCover(f);
                    }}
                  />
                  {savingCover && <span className="text-xs text-gray-500">Subiendo…</span>}
                </div>
              )}
            </div>
          </section>

          {/* Normas */}
          <section className="space-y-2">
            <label className="block text-sm">Normas del reto</label>
            <textarea
              value={rules}
              onChange={(e) => handleRulesInput(e.target.value)}
              disabled={!isOwner}
              className="w-full min-h-28 rounded-xl border px-3 py-2"
              style={{ borderColor: 'var(--line)' }}
              placeholder="Escribe reglas, premios, penalizaciones, etc."
            />
            <div className="text-xs mt-1">
              {savingRules === 'saving' && <span className="text-gray-500">Guardando…</span>}
              {savingRules === 'saved' && <span className="text-green-600">Guardado ✓</span>}
            </div>
          </section>

          {/* Toggle días personalizados */}
          <section className="space-y-2">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={customize}
                onChange={(e) => handleToggleCustomize(e.target.checked)}
                disabled={!isOwner}
              />
              <span className="text-sm">Personalizar cada día del reto</span>
            </label>
            <p className="text-xs text-gray-500">
              Duración: {duration} días. Si activas, podrás editar el texto de cada día.
            </p>
          </section>

          {/* Lista de días */}
          {customize && (
            <section className="space-y-2">
              {days.map((d, i) => (
                <div key={d.day} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-3 text-sm">Día {d.day}</div>
                  <input
                    className="col-span-9 rounded-xl border px-3 py-2 text-sm"
                    style={{ borderColor: 'var(--line)' }}
                    placeholder={`Día ${d.day} – ...`}
                    value={d.label}
                    onChange={(e) => handleLabelChange(i, e.target.value)}
                    disabled={!isOwner}
                  />
                </div>
              ))}
            </section>
          )}

          <div className="pt-2">
            <button
              onClick={handleContinue}
              disabled={continueDisabled}
              className="w-full rounded-2xl border px-4 py-3 hover:bg-black/5 transition disabled:opacity-50"
              style={{ borderColor: 'var(--line)' }}
            >
              {continueDisabled ? 'Guardando…' : 'Continuar a revisión'}
            </button>
          </div>
        </>
      )}
    </main>
  );
}

export default function PersonalizarRetoPage() {
  return (
    <Suspense fallback={<div className="container mx-auto px-4 py-6">Cargando…</div>}>
      <PersonalizarRetoPageInner />
    </Suspense>
  );
}
