// src/app/programas/detox-tecnologico-30/configurar/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { useAuthUserId } from '@/lib/user';
import {
  DetoxConfig,
  DetoxAppLimit,
  DetoxCategoryLimit,
  DetoxWindow,
  PRESET_WINDOWS,
  SUGGESTED_APPS,
  SUGGESTED_CATEGORIES,
  newConfig,
  loadDetoxConfig,
  saveDetoxConfig,
  validateConfig,
  uid as mkId,
} from '@/lib/detoxConfig';

const SLUG = 'detox-tecnologico-30';

type Step = 1|2|3|4; // 1 seleccionar apps/categorías, 2 tiempos, 3 ventanas, 4 resumen

export default function ConfigurarDetoxPage() {
  const router = useRouter();
  const uid = useAuthUserId();

  // Cargar existente o crear uno nuevo
  const [cfg, setCfg] = useState<DetoxConfig>(() => loadDetoxConfig(SLUG, uid) ?? newConfig(SLUG, uid));
  const [step, setStep] = useState<Step>(1);
  const [msg, setMsg] = useState<string | null>(null);

  // formularios de alta rápida
  const [newAppName, setNewAppName] = useState('');
  const [newAppMins, setNewAppMins] = useState<number | ''>('');
  const [newCatName, setNewCatName] = useState('');
  const [newCatMins, setNewCatMins] = useState<number | ''>('');

  useEffect(() => {
    // hidratar cambios de uid si entramos logueados luego
    const existing = loadDetoxConfig(SLUG, uid);
    if (existing) setCfg(existing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  function addApp(a: DetoxAppLimit) {
    setCfg(prev => ({ ...prev, apps: dedupById([...prev.apps, a], 'appId') }));
  }
  function addCategory(c: DetoxCategoryLimit) {
    setCfg(prev => ({ ...prev, categories: dedupById([...prev.categories, c], 'categoryId') }));
  }
  function removeApp(appId: string) {
    setCfg(prev => ({ ...prev, apps: prev.apps.filter(a => a.appId !== appId) }));
  }
  function removeCategory(categoryId: string) {
    setCfg(prev => ({ ...prev, categories: prev.categories.filter(c => c.categoryId !== categoryId) }));
  }
  function setAppMinutes(appId: string, m: number) {
    setCfg(prev => ({ ...prev, apps: prev.apps.map(a => a.appId === appId ? { ...a, minutesPerDay: m } : a) }));
  }
  function setCatMinutes(categoryId: string, m: number) {
    setCfg(prev => ({ ...prev, categories: prev.categories.map(c => c.categoryId === categoryId ? { ...c, minutesPerDay: m } : c) }));
  }

  function addWindow(w: DetoxWindow) {
    setCfg(prev => ({ ...prev, windows: dedupById([...prev.windows, w], 'id') }));
  }
  function removeWindow(id: string) {
    setCfg(prev => ({ ...prev, windows: prev.windows.filter(w => w.id !== id) }));
  }
  function updateWindow(id: string, patch: Partial<DetoxWindow>) {
    setCfg(prev => ({ ...prev, windows: prev.windows.map(w => w.id === id ? { ...w, ...patch } : w) }));
  }

  function goBack() {
    if (step === 1) {
      router.push('/programas/detox-tecnologico-30');
    } else {
      setStep((s) => (Math.max(1, (s as number) - 1) as Step));
    }
  }
  function goNext() {
    setStep((s) => (Math.min(4, (s as number) + 1) as Step));
  }

  function handleSave() {
    setMsg(null);
    const res = validateConfig(cfg);
    if (!res.ok) {
      setMsg(`Revísalo: ${res.reason}`);
      return;
    }
    const saved = saveDetoxConfig(cfg, uid);
    setCfg(saved);
    setMsg('✅ Configuración guardada localmente.');
    // Opcional: volver a ProgramDetail tras unos ms
    setTimeout(() => router.push('/programas/detox-tecnologico-30'), 400);
  }

  return (
    <div className="px-4 pb-24 bg-white">
      {/* Header */}
      <div className="sticky top-0 z-10 -mx-4 px-4 py-3 bg-white/90 backdrop-blur border-b">
        <div className="flex items-center justify-between">
          <button
            onClick={goBack}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium px-3.5 py-2 rounded-full border border-neutral-300 bg-white hover:bg-neutral-50 active:scale-[0.98]"
          >
            <ChevronLeft className="w-4 h-4" />
            Volver
          </button>
          <div className="text-[13px] font-semibold">Configurar límites</div>
          <div className="w-[92px]" />
        </div>
      </div>

      {/* Steps */}
      <div className="mt-4 flex items-center justify-center gap-2">
        {[1,2,3,4].map(n => (
          <span key={n} className={`h-1.5 w-10 rounded-full ${n <= step ? 'bg-black' : 'bg-neutral-200'}`} />
        ))}
      </div>

      {msg && (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 text-amber-800 px-3 py-2 text-sm">
          {msg}
        </div>
      )}

      {/* Content */}
      <div className="mt-6 space-y-6">
        {step === 1 && (
          <StepSelectBases
            cfg={cfg}
            onAddApp={addApp}
            onAddCategory={addCategory}
            onRemoveApp={removeApp}
            onRemoveCategory={removeCategory}
            newAppName={newAppName}
            setNewAppName={setNewAppName}
            newAppMins={newAppMins}
            setNewAppMins={setNewAppMins}
            newCatName={newCatName}
            setNewCatName={setNewCatName}
            newCatMins={newCatMins}
            setNewCatMins={setNewCatMins}
          />
        )}

        {step === 2 && (
          <StepTimes
            cfg={cfg}
            setAppMinutes={setAppMinutes}
            setCatMinutes={setCatMinutes}
          />
        )}

        {step === 3 && (
          <StepWindows
            cfg={cfg}
            onAddWindow={addWindow}
            onRemoveWindow={removeWindow}
            onUpdateWindow={updateWindow}
          />
        )}

        {step === 4 && (
          <StepSummary cfg={cfg} />
        )}
      </div>

      {/* Footer nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-3">
        <div className="flex items-center justify-between">
          <button
            onClick={goBack}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-neutral-300 hover:bg-neutral-50 active:scale-[0.98]"
          >
            <ChevronLeft className="w-4 h-4" />
            Atrás
          </button>

            {step < 4 ? (
              <button
                onClick={goNext}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-2xl bg-black text-white hover:opacity-90 active:scale-[0.98]"
              >
                Siguiente
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSave}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-2xl bg-black text-white hover:opacity-90 active:scale-[0.98]"
              >
                Guardar configuración
              </button>
            )}
        </div>
      </div>
    </div>
  );
}

/* ====== Sub-steps ====== */

function StepSelectBases(props: {
  cfg: DetoxConfig;
  onAddApp: (a: DetoxAppLimit) => void;
  onAddCategory: (c: DetoxCategoryLimit) => void;
  onRemoveApp: (id: string) => void;
  onRemoveCategory: (id: string) => void;
  newAppName: string; setNewAppName: (s: string) => void;
  newAppMins: number | ''; setNewAppMins: (n: number | '') => void;
  newCatName: string; setNewCatName: (s: string) => void;
  newCatMins: number | ''; setNewCatMins: (n: number | '') => void;
}) {
  const {
    cfg, onAddApp, onAddCategory, onRemoveApp, onRemoveCategory,
    newAppName, setNewAppName, newAppMins, setNewAppMins,
    newCatName, setNewCatName, newCatMins, setNewCatMins
  } = props;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[15px] font-semibold">Apps (límites diarios)</h2>
        <p className="text-sm text-neutral-600">Añade las apps que más te roban atención. Puedes partir de nuestras sugerencias.</p>

        <div className="mt-3 flex flex-wrap gap-2">
          {SUGGESTED_APPS.map(a => (
            <button
              key={a.appId}
              onClick={() => onAddApp({ ...a })}
              className="text-xs px-2.5 py-1.5 rounded-full border border-neutral-300 hover:bg-neutral-50"
            >
              + {a.name} · {a.minutesPerDay}m
            </button>
          ))}
        </div>

        {/* apps elegidas */}
        <ul className="mt-3 divide-y divide-neutral-200 rounded-2xl border">
          {cfg.apps.length === 0 && (
            <li className="p-3 text-sm text-neutral-500">Aún no has añadido apps.</li>
          )}
          {cfg.apps.map(a => (
            <li key={a.appId} className="p-3 flex items-center justify-between">
              <span className="text-sm">{a.name} · {a.minutesPerDay}m/día</span>
              <button onClick={() => onRemoveApp(a.appId)} className="p-1 rounded hover:bg-neutral-100" aria-label="Quitar">
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>

        {/* añadir app custom */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <input
            value={newAppName}
            onChange={e => setNewAppName(e.target.value)}
            placeholder="Nombre app"
            className="col-span-2 px-3 py-2 rounded-xl border text-sm"
          />
          <input
            value={newAppMins}
            onChange={e => setNewAppMins(parseNumberOrBlank(e.target.value))}
            placeholder="Min/día"
            inputMode="numeric"
            className="px-3 py-2 rounded-xl border text-sm"
          />
          <button
            onClick={() => {
              if (!newAppName.trim() || newAppMins === '') return;
              onAddApp({ appId: slugify(newAppName), name: newAppName.trim(), minutesPerDay: Number(newAppMins) });
              setNewAppName(''); setNewAppMins('');
            }}
            className="col-span-3 mt-1 inline-flex items-center gap-2 px-3 py-2 rounded-xl border bg-neutral-50 hover:bg-neutral-100 text-sm"
          >
            <Plus className="w-4 h-4" /> Añadir app
          </button>
        </div>
      </div>

      <div>
        <h2 className="text-[15px] font-semibold">Categorías (límites diarios)</h2>
        <p className="text-sm text-neutral-600">Si no quieres especificar apps, limita por categoría.</p>

        <div className="mt-3 flex flex-wrap gap-2">
          {SUGGESTED_CATEGORIES.map(c => (
            <button
              key={c.categoryId}
              onClick={() => onAddCategory({ ...c })}
              className="text-xs px-2.5 py-1.5 rounded-full border border-neutral-300 hover:bg-neutral-50"
            >
              + {c.name} · {c.minutesPerDay}m
            </button>
          ))}
        </div>

        {/* categorías elegidas */}
        <ul className="mt-3 divide-y divide-neutral-200 rounded-2xl border">
          {cfg.categories.length === 0 && (
            <li className="p-3 text-sm text-neutral-500">Aún no has añadido categorías.</li>
          )}
          {cfg.categories.map(c => (
            <li key={c.categoryId} className="p-3 flex items-center justify-between">
              <span className="text-sm">{c.name} · {c.minutesPerDay}m/día</span>
              <button onClick={() => onRemoveCategory(c.categoryId)} className="p-1 rounded hover:bg-neutral-100" aria-label="Quitar">
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>

        {/* añadir categoría custom */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <input
            value={newCatName}
            onChange={e => setNewCatName(e.target.value)}
            placeholder="Nombre categoría"
            className="col-span-2 px-3 py-2 rounded-xl border text-sm"
          />
          <input
            value={newCatMins}
            onChange={e => setNewCatMins(parseNumberOrBlank(e.target.value))}
            placeholder="Min/día"
            inputMode="numeric"
            className="px-3 py-2 rounded-xl border text-sm"
          />
          <button
            onClick={() => {
              if (!newCatName.trim() || newCatMins === '') return;
              onAddCategory({ categoryId: slugify(newCatName), name: newCatName.trim(), minutesPerDay: Number(newCatMins) });
              setNewCatName(''); setNewCatMins('');
            }}
            className="col-span-3 mt-1 inline-flex items-center gap-2 px-3 py-2 rounded-xl border bg-neutral-50 hover:bg-neutral-100 text-sm"
          >
            <Plus className="w-4 h-4" /> Añadir categoría
          </button>
        </div>
      </div>
    </div>
  );
}

function StepTimes(props: {
  cfg: DetoxConfig;
  setAppMinutes: (id: string, m: number) => void;
  setCatMinutes: (id: string, m: number) => void;
}) {
  const { cfg, setAppMinutes, setCatMinutes } = props;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[15px] font-semibold">Ajusta los minutos diarios</h2>
        <p className="text-sm text-neutral-600">Fija objetivos amables. Siempre puedes cambiarlos más adelante.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-2xl border">
          <div className="px-4 py-2 text-sm font-semibold bg-neutral-50 border-b">Apps</div>
          <div className="p-3 space-y-2">
            {cfg.apps.length === 0 && <p className="text-sm text-neutral-500">No has añadido apps.</p>}
            {cfg.apps.map(a => (
              <div key={a.appId} className="flex items-center justify-between gap-3">
                <span className="text-sm">{a.name}</span>
                <MinutesInput value={a.minutesPerDay} onChange={(m) => setAppMinutes(a.appId, m)} />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border">
          <div className="px-4 py-2 text-sm font-semibold bg-neutral-50 border-b">Categorías</div>
          <div className="p-3 space-y-2">
            {cfg.categories.length === 0 && <p className="text-sm text-neutral-500">No has añadido categorías.</p>}
            {cfg.categories.map(c => (
              <div key={c.categoryId} className="flex items-center justify-between gap-3">
                <span className="text-sm">{c.name}</span>
                <MinutesInput value={c.minutesPerDay} onChange={(m) => setCatMinutes(c.categoryId, m)} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StepWindows(props: {
  cfg: DetoxConfig;
  onAddWindow: (w: DetoxWindow) => void;
  onRemoveWindow: (id: string) => void;
  onUpdateWindow: (id: string, patch: Partial<DetoxWindow>) => void;
}) {
  const { cfg, onAddWindow, onRemoveWindow, onUpdateWindow } = props;

  function addPreset(w: DetoxWindow) {
    onAddWindow({ ...w, id: `${w.id}-${mkId('w')}` });
  }

  function addBlank() {
    onAddWindow({
      id: mkId('w'),
      label: 'Nueva ventana',
      from: '09:00',
      to: '10:00',
      days: [1,2,3,4,5],
    });
  }

  function toggleDay(id: string, day: number) {
    const target = cfg.windows.find(w => w.id === id);
    if (!target) return;
    const set = new Set(target.days);
    if (set.has(day)) set.delete(day); else set.add(day);
    onUpdateWindow(id, { days: Array.from(set).sort((a,b)=>a-b) });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[15px] font-semibold">Ventanas de desconexión</h2>
        <p className="text-sm text-neutral-600">
          Define tramos horarios “sin móvil” (modo No Molestar, silencio, etc.). En iOS/Android podrás aplicarlos nativamente.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {PRESET_WINDOWS.map(p => (
          <button key={p.id} onClick={() => addPreset(p)} className="text-xs px-2.5 py-1.5 rounded-full border border-neutral-300 hover:bg-neutral-50">
            + {p.label} ({p.from}-{p.to})
          </button>
        ))}
        <button onClick={addBlank} className="text-xs px-2.5 py-1.5 rounded-full border border-neutral-300 hover:bg-neutral-50">
          + Añadir ventana
        </button>
      </div>

      <ul className="space-y-3">
        {cfg.windows.length === 0 && <li className="text-sm text-neutral-500">Aún no hay ventanas.</li>}
        {cfg.windows.map(w => (
          <li key={w.id} className="rounded-2xl border p-3">
            <div className="flex items-center justify-between gap-3">
              <input
                value={w.label}
                onChange={e => onUpdateWindow(w.id, { label: e.target.value })}
                className="px-2 py-1 rounded-lg border text-sm flex-1"
              />
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={w.from}
                  onChange={e => onUpdateWindow(w.id, { from: e.target.value })}
                  className="px-2 py-1 rounded-lg border text-sm"
                />
                <span className="text-neutral-400 text-sm">—</span>
                <input
                  type="time"
                  value={w.to}
                  onChange={e => onUpdateWindow(w.id, { to: e.target.value })}
                  className="px-2 py-1 rounded-lg border text-sm"
                />
              </div>
              <button onClick={() => onRemoveWindow(w.id)} className="p-1 rounded hover:bg-neutral-100" aria-label="Eliminar">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-2 flex flex-wrap gap-1">
              {(['L','M','X','J','V','S','D'] as const).map((lbl, idx) => {
                const d = idx + 1; // 1..7
                const active = w.days.includes(d);
                return (
                  <button
                    key={lbl}
                    onClick={() => toggleDay(w.id, d)}
                    className={`text-xs px-2 py-1 rounded-full border ${active ? 'bg-black text-white border-black' : 'border-neutral-300 hover:bg-neutral-50'}`}
                  >
                    {lbl}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StepSummary({ cfg }: { cfg: DetoxConfig }) {
  const totalApps = cfg.apps.length;
  const totalCats = cfg.categories.length;
  const totalWin = cfg.windows.length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[15px] font-semibold">Resumen</h2>
        <p className="text-sm text-neutral-600">Así queda tu configuración. Puedes volver atrás y ajustar lo que quieras.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-2xl border overflow-hidden">
          <div className="px-4 py-2 text-sm font-semibold bg-neutral-50 border-b">Apps ({totalApps})</div>
          <ul className="p-3 text-sm divide-y">
            {totalApps === 0 && <li className="py-1 text-neutral-500">Ninguna app limitada.</li>}
            {cfg.apps.map(a => (
              <li key={a.appId} className="py-1 flex justify-between gap-2">
                <span>{a.name}</span>
                <span className="text-neutral-500">{a.minutesPerDay}m/día</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border overflow-hidden">
          <div className="px-4 py-2 text-sm font-semibold bg-neutral-50 border-b">Categorías ({totalCats})</div>
          <ul className="p-3 text-sm divide-y">
            {totalCats === 0 && <li className="py-1 text-neutral-500">Ninguna categoría limitada.</li>}
            {cfg.categories.map(c => (
              <li key={c.categoryId} className="py-1 flex justify-between gap-2">
                <span>{c.name}</span>
                <span className="text-neutral-500">{c.minutesPerDay}m/día</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="md:col-span-2 rounded-2xl border overflow-hidden">
          <div className="px-4 py-2 text-sm font-semibold bg-neutral-50 border-b">Ventanas ({totalWin})</div>
          <ul className="p-3 text-sm divide-y">
            {totalWin === 0 && <li className="py-1 text-neutral-500">Ninguna ventana configurada.</li>}
            {cfg.windows.map(w => (
              <li key={w.id} className="py-1 grid grid-cols-1 md:grid-cols-3 gap-2">
                <span className="font-medium">{w.label}</span>
                <span>{w.from} — {w.to}</span>
                <span className="text-neutral-500">{
                  w.days.map(n => 'LMXJVSD'[n-1]).join('')
                }</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="text-xs text-neutral-500">
        * En el paso 6 guardaremos esto en Supabase y sincronizaremos entre dispositivos.  
        * En el paso 7 mostraremos una tarjeta con **código de integración nativa** (Shortcuts/Intents).
      </p>
    </div>
  );
}

/* ====== UI pequeños helpers ====== */

function MinutesInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input
        value={value}
        onChange={e => onChange(Math.max(0, Math.min(1440, Number(e.target.value) || 0)))}
        inputMode="numeric"
        className="w-24 px-3 py-1.5 rounded-xl border text-sm"
      />
      <span className="text-xs text-neutral-500">min/día</span>
    </div>
  );
}

function parseNumberOrBlank(s: string): number | '' {
  if (s.trim() === '') return '';
  const n = Number(s.replace(/[^\d]/g, ''));
  return Number.isFinite(n) ? n : '';
}

function slugify(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function dedupById<T extends Record<string, any>>(arr: T[], key: keyof T) {
  const map = new Map<any, T>();
  for (const item of arr) map.set(item[key], item);
  return Array.from(map.values());
}
