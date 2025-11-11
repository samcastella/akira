'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { loadLS, saveLS, todayKey, formatDateLabel, fmtTime, hhmmFromTs, currentHHMM } from './_helpers';
import CalorieCalculatorModal, { MealResult } from '@/components/CalorieCalculatorModal';

const LS_MEALS = 'akira_meals_v1';
const LS_MEALS_PROFILE = 'akira_meals_profile_v1';

type MealType = 'Desayuno' | 'Almuerzo' | 'Comida' | 'Merienda' | 'Cena' | 'Picoteo';
type MealEntry = { id: string; ts: number; type: MealType; title: string; calories?: number };
type MealsByDay = Record<string, MealEntry[]>;
type MealProfile = { height?: number; weight?: number; target?: number };

export default function ComidasTool() {
  // Perfil
  const [profile, setProfile] = useState<MealProfile>(() => loadLS<MealProfile>(LS_MEALS_PROFILE, {}));
  const [editingProfile, setEditingProfile] = useState(false);
  useEffect(() => { saveLS(LS_MEALS_PROFILE, profile); }, [profile]);

  // Entradas por día
  const [byDay, setByDay] = useState<MealsByDay>(() => loadLS<MealsByDay>(LS_MEALS, {}));
  useEffect(() => { saveLS(LS_MEALS, byDay); }, [byDay]);

  const today = todayKey();

  // Abrir/cerrar por día (hoy abierto por defecto)
  const [openDays, setOpenDays] = useState<Record<string, boolean>>({});
  useEffect(() => { setOpenDays(o => ({ ...o, [today]: true })); }, [today]);

  // Formularios por día (para poder añadir en días pasados)
  type FormState = { type: MealType; title: string; calStr: string; time: string };
  const [forms, setForms] = useState<Record<string, FormState>>({});
  const getForm = (dk: string): FormState =>
    forms[dk] || { type: 'Comida', title: '', calStr: '', time: currentHHMM() };
  const setForm = (dk: string, next: Partial<FormState>) =>
    setForms(prev => ({ ...prev, [dk]: { ...getForm(dk), ...next } }));

  // Edición inline
  const [editingEntry, setEditingEntry] = useState<{ id: string; day: string } | null>(null);
  const [editForm, setEditForm] = useState<FormState>({ type: 'Comida', title: '', calStr: '', time: '' });

  // Días disponibles
  const allDays = useMemo(() => {
    const s = new Set<string>(Object.keys(byDay));
    s.add(today);
    return Array.from(s).sort((a,b)=>b.localeCompare(a));
  }, [byDay, today]);

  const summarize = (arr: MealEntry[]) => {
    const count = arr.length;
    const provided = arr.some(m => typeof m.calories === 'number');
    const kcal = provided ? arr.reduce((acc, m) => acc + (m.calories || 0), 0) : null;
    const diff = (typeof profile.target === 'number' && kcal !== null) ? (kcal - profile.target) : null;
    return { count, kcal, diff };
  };

  const addMealForDay = (dk: string) => {
    const f = getForm(dk);
    const title = f.title.trim();
    if (!title) return;

    const calories = f.calStr.trim() ? Math.max(0, Number(f.calStr.trim())) : undefined;
    const hhmm = /^\d{2}:\d{2}$/.test(f.time) ? f.time : currentHHMM();
    const ts = new Date(`${dk}T${hhmm}:00`).getTime();

    const entry: MealEntry = { id: crypto.randomUUID(), ts, type: f.type, title, calories };
    setByDay(prev => {
      const arr = prev[dk] || [];
      const newArr = [entry, ...arr].sort((a,b)=>b.ts - a.ts);
      return { ...prev, [dk]: newArr };
    });
    setForm(dk, { title: '', calStr: '', time: currentHHMM() });
    setOpenDays(o => ({ ...o, [dk]: true }));
  };

  const deleteMeal = (dk: string, id: string) => {
    setByDay(prev => ({ ...prev, [dk]: (prev[dk] || []).filter(m => m.id !== id) }));
    if (editingEntry?.id === id) setEditingEntry(null);
  };

  const startEditMeal = (dk: string, e: MealEntry) => {
    setEditingEntry({ id: e.id, day: dk });
    setEditForm({
      type: e.type,
      title: e.title,
      calStr: typeof e.calories === 'number' ? String(e.calories) : '',
      time: hhmmFromTs(e.ts),
    });
  };

  const saveEditMeal = () => {
    if (!editingEntry) return;
    const { id, day } = editingEntry;
    const f = editForm;
    const title = f.title.trim();
    if (!title) return;

    const calories = f.calStr.trim() ? Math.max(0, Number(f.calStr.trim())) : undefined;
    const hhmm = /^\d{2}:\d{2}$/.test(f.time) ? f.time : currentHHMM();
    const ts = new Date(`${day}T${hhmm}:00`).getTime();

    setByDay(prev => {
      const arr = prev[day] || [];
      const newArr = arr
        .map(m => (m.id === id ? { ...m, type: f.type, title, calories, ts } : m))
        .sort((a,b)=>b.ts - a.ts);
      return { ...prev, [day]: newArr };
    });
    setEditingEntry(null);
  };

  // Modal calculadora
  const [calcOpen, setCalcOpen] = useState(false);
  const [calcDay, setCalcDay] = useState<string | null>(null);

  return (
    <div>
      {/* Perfil */}
      <section className="rounded-2xl p-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <strong>Mi perfil</strong>
          {!editingProfile ? (
            <button className="btn secondary" onClick={() => setEditingProfile(true)}>Editar</button>
          ) : (
            <div className="flex gap-2">
              <button className="btn" onClick={() => setEditingProfile(false)}>Guardar</button>
              <button className="btn ghost" onClick={() => { setEditingProfile(false); }}>Cancelar</button>
            </div>
          )}
        </div>

        <div className="rows mt-3">
          {!editingProfile ? (
            <div className="muted" style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
              <span>Altura: <b>{profile.height ?? '—'}</b> cm</span>
              <span>Peso: <b>{profile.weight ?? '—'}</b> kg</span>
              <span>Calorías deseadas: <b>{profile.target ?? '—'}</b> kcal</span>
            </div>
          ) : (
            <div className="row" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:8 }}>
              <input className="input" inputMode="numeric" placeholder="Altura (cm)" value={profile.height ?? ''}
                     onChange={e=>setProfile(p=>({ ...p, height: e.target.value ? Number(e.target.value) : undefined }))} />
              <input className="input" inputMode="numeric" placeholder="Peso (kg)" value={profile.weight ?? ''}
                     onChange={e=>setProfile(p=>({ ...p, weight: e.target.value ? Number(e.target.value) : undefined }))} />
              <input className="input" inputMode="numeric" placeholder="Calorías deseadas (kcal)" value={profile.target ?? ''}
                     onChange={e=>setProfile(p=>({ ...p, target: e.target.value ? Number(e.target.value) : undefined }))} />
            </div>
          )}
        </div>
      </section>

      {/* Días */}
      <section className="rows" style={{ marginTop: 12 }}>
        {allDays.map(dk => {
          const arr = (byDay[dk] || []).slice().sort((a,b)=>b.ts - a.ts);
          const { count, kcal, diff } = summarize(arr);
          const open = !!openDays[dk];
          const form = getForm(dk);

          return (
            <div key={dk} className="border rounded-2xl p-4" style={{ borderColor: 'var(--line)' }}>
              {/* Resumen */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <div>· <b>Fecha:</b> {formatDateLabel(dk)}</div>
                  <div className="muted" style={{ marginTop: 4 }}>
                    <div>· Número de comidas: <b>{count}</b></div>
                    <div>· Calorías consumidas: <b>{kcal !== null ? kcal : '—'}</b></div>
                    <div>· Diferencia vs objetivo: <b>{diff !== null ? `${diff > 0 ? `+${diff}` : diff} kcal` : '—'}</b></div>
                  </div>
                </div>
                <button
                  className="btn secondary inline-flex items-center px-2 py-1"
                  aria-label={open ? 'Ocultar' : 'Ver detalles'}
                  title={open ? 'Ocultar' : 'Ver detalles'}
                  onClick={() => setOpenDays(o => ({ ...o, [dk]: !o[dk] }))}
                >
                  {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>

              {/* Detalle */}
              {open && (
                <div className="rows mt-3">
                  {/* Form */}
                  <div className="row" style={{ display:'grid', gap:8, gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))' }}>
                    <select className="input" value={form.type} onChange={e=>setForm(dk, { type: e.target.value as MealType })}>
                      {(['Desayuno','Almuerzo','Comida','Merienda','Cena','Picoteo'] as MealType[]).map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <textarea className="textarea" rows={2} placeholder="Comida (p. ej., Huevos con bacon)" value={form.title} onChange={e=>setForm(dk, { title: e.target.value })} />
                    <input className="input" inputMode="numeric" placeholder="Calorías (kcal · opcional)" value={form.calStr} onChange={e=>setForm(dk, { calStr: e.target.value })} />
                    <input className="input" type="time" placeholder="Hora (opcional)" value={form.time} onChange={e=>setForm(dk, { time: e.target.value })} />

                    <button className="btn"
                      onClick={() => { setCalcDay(dk); setCalcOpen(true); }}
                      title="Abrir calculadora de calorías"
                    >
                      Calculadora de calorías
                    </button>

                    <button className="btn green inline-flex items-center gap-2 whitespace-nowrap" onClick={() => addMealForDay(dk)}>
                      <Plus className="w-4 h-4" /> Registrar
                    </button>
                  </div>

                  {/* Lista */}
                  <ul className="list" style={{ marginTop: 8 }}>
                    {arr.length === 0 && <li className="muted" style={{ padding:'6px 0' }}>Sin comidas registradas.</li>}
                    {arr.map(e => {
                      const isEditing = editingEntry?.id === e.id && editingEntry.day === dk;
                      return (
                        <li key={e.id} style={{ padding:'8px 0' }}>
                          {!isEditing ? (
                            <div className="flex items-start justify-between gap-3 flex-wrap">
                              <div style={{ minWidth:0, flex:'1 1 320px' }}>
                                <div className="muted" style={{ fontSize:12 }}>{fmtTime(e.ts)}</div>
                                <div className="inline-flex items-center gap-2">
                                  <span className="inline-block rounded-full border px-2 py-0.5">{e.type}</span>
                                  <span><b>{e.title}</b></span>
                                  <span className="muted">{typeof e.calories === 'number' ? `· ${e.calories} kcal` : '· kcal —'}</span>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button className="btn secondary inline-flex items-center gap-2 whitespace-nowrap" onClick={() => startEditMeal(dk, e)}>
                                  <Pencil className="w-4 h-4" /> Editar
                                </button>
                                <button className="btn red inline-flex items-center gap-2 whitespace-nowrap" onClick={() => deleteMeal(dk, e.id)}>
                                  <Trash2 className="w-4 h-4" /> Borrar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="rows">
                              <div className="row" style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
                                <select className="input" value={editForm.type} onChange={e => setEditForm(f => ({ ...f, type: e.target.value as MealType }))}>
                                  {(['Desayuno', 'Almuerzo', 'Comida', 'Merienda', 'Cena', 'Picoteo'] as MealType[]).map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                                <textarea className="textarea" rows={2} value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />
                                <input className="input" inputMode="numeric" placeholder="kcal" value={editForm.calStr} onChange={e => setEditForm(f => ({ ...f, calStr: e.target.value }))} />
                                <input className="input" type="time" value={editForm.time} onChange={e => setEditForm(f => ({ ...f, time: e.target.value }))} />
                              </div>
                              <div className="flex gap-2 justify-end mt-2">
                                <button className="btn inline-flex items-center gap-2 whitespace-nowrap" onClick={saveEditMeal}>
                                  <Save className="w-4 h-4" /> Guardar
                                </button>
                                <button className="btn ghost" onClick={() => setEditingEntry(null)}>Cancelar</button>
                              </div>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* Modal calculadora */}
      <CalorieCalculatorModal
        isOpen={calcOpen}
        onClose={() => setCalcOpen(false)}
        initialName={calcDay ? (getForm(calcDay).title) : ""}
        onSave={(meal: MealResult) => {
          if (calcDay) setForm(calcDay, { title: meal.name, calStr: String(meal.totalKcal) });
          setCalcOpen(false);
        }}
      />
    </div>
  );
}
