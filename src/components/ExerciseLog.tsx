"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Save, Pencil, Trash2, X, ChevronDown, ChevronUp } from "lucide-react";

/* ===========================
   Tipos y helpers
   =========================== */
type Intensity = "V1" | "V2" | "V3" | "V4" | "V5";

type ExerciseEntry = {
  id: string;
  title: string;        // "Pádel", "Entrenamiento de fuerza", etc.
  intensity: Intensity; // V1..V5
  minutes: number;      // duración
  calories: number;     // editable; por defecto autocalculado
  date: string;         // YYYY-MM-DD
  createdAt: number;
  updatedAt?: number;
};

const LS_EXERCISE = "akira_exercise_v1";

// Tasas de kcal/min por intensidad (referencia ~70 kg)
const KCAL_PER_MIN: Record<Intensity, number> = {
  V1: 2.0,   // muy suave / recuperación
  V2: 3.5,   // suave
  V3: 6.0,   // moderado
  V4: 9.5,   // intenso
  V5: 13.5,  // muy intenso
};

function loadLS<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
function saveLS<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function uuid(): string {
  // Usa crypto si está disponible
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return (crypto as any).randomUUID();
  }
  // Fallback simple
  return "id-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/* ===========================
   Componente principal
   =========================== */
export default function ExerciseLog() {
  const [entries, setEntries] = useState<ExerciseEntry[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [intensity, setIntensity] = useState<Intensity>("V3");
  const [minutes, setMinutes] = useState<number>(30);
  const [date, setDate] = useState<string>(todayISO());

  // Calorías: autocalculadas pero editables
  const [calories, setCalories] = useState<number>(() => Math.round(KCAL_PER_MIN["V3"] * 30));
  const [manualCalories, setManualCalories] = useState<boolean>(false); // si el usuario tocó el campo

  // Info panel (plegado/desplegado)
  const [infoOpen, setInfoOpen] = useState(false);

  // Cargar / Guardar LS
  useEffect(() => {
    setEntries(loadLS<ExerciseEntry[]>(LS_EXERCISE, []));
  }, []);
  useEffect(() => {
    saveLS(LS_EXERCISE, entries);
  }, [entries]);

  // Recalcular calorías si cambia intensidad/minutos y NO está en modo manual
  useEffect(() => {
    if (!manualCalories) {
      const est = Math.max(0, Math.round((KCAL_PER_MIN[intensity] || 0) * (minutes || 0)));
      setCalories(est);
    }
  }, [intensity, minutes, manualCalories]);

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setIntensity("V3");
    setMinutes(30);
    setDate(todayISO());
    setManualCalories(false);
    setCalories(Math.round(KCAL_PER_MIN["V3"] * 30));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const mins = Number(minutes);
    const cals = Number(calories);

    if (!title.trim()) {
      alert("Pon un nombre al ejercicio (p. ej., Pádel, Fuerza, Correr…).");
      return;
    }
    if (!mins || mins <= 0) {
      alert("Los minutos deben ser mayores que 0.");
      return;
    }
    if (isNaN(cals) || cals < 0) {
      alert("Las calorías deben ser un número válido (0 o más).");
      return;
    }
    if (!date) {
      alert("Selecciona una fecha.");
      return;
    }

    if (editingId) {
      setEntries((prev) =>
        prev
          .map((it) =>
            it.id === editingId
              ? {
                  ...it,
                  title: title.trim(),
                  intensity,
                  minutes: mins,
                  calories: cals,
                  date,
                  updatedAt: Date.now(),
                }
              : it
          )
          .sort(sortEntries)
      );
    } else {
      const newEntry: ExerciseEntry = {
        id: uuid(),
        title: title.trim(),
        intensity,
        minutes: mins,
        calories: cals,
        date,
        createdAt: Date.now(),
      };
      setEntries((prev) => [...prev, newEntry].sort(sortEntries));
    }

    resetForm();
  }

  function handleEdit(id: string) {
    const item = entries.find((e) => e.id === id);
    if (!item) return;
    setEditingId(item.id);
    setTitle(item.title);
    setIntensity(item.intensity);
    setMinutes(item.minutes);
    setCalories(item.calories);
    setManualCalories(true); // al entrar a editar, respetamos su valor guardado
    setDate(item.date);
  }

  function handleDelete(id: string) {
    const item = entries.find((e) => e.id === id);
    const label = item ? `${item.title} (${item.date})` : "este registro";
    if (!confirm(`¿Borrar ${label}?`)) return;
    setEntries((prev) => prev.filter((e) => e.id !== id));
    if (editingId === id) resetForm();
  }

  function sortEntries(a: ExerciseEntry, b: ExerciseEntry) {
    // Orden: fecha descendente, luego creado desc
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return (b.createdAt || 0) - (a.createdAt || 0);
  }

  const totalToday = useMemo(() => {
    const today = todayISO();
    return entries.filter((e) => e.date === today).reduce((acc, e) => acc + (e.calories || 0), 0);
  }, [entries]);

  return (
    <section className="mt-6">
      <h2 className="text-xl font-semibold mb-3">Registro de ejercicio</h2>

      {/* Resumen del día */}
      <div className="mb-4 text-sm">
        <span className="inline-block rounded-full border px-3 py-1">
          Total de hoy: <span className="font-semibold">{totalToday}</span> kcal
        </span>
      </div>

      {/* Formulario */}
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-[var(--line)] bg-white p-4 space-y-4"
      >
        {/* Nombre */}
        <div className="grid gap-2">
          <label className="text-sm font-medium">Nombre del ejercicio</label>
          <input
            type="text"
            placeholder="Ej.: Pádel, Entrenamiento de fuerza, Correr…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-full border px-4 py-2 outline-none focus:ring-2"
          />
        </div>

        {/* Intensidad + Minutos */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="grid gap-2">
            <label className="text-sm font-medium">Intensidad de ejercicio</label>
            <select
              value={intensity}
              onChange={(e) => {
                setIntensity(e.target.value as Intensity);
              }}
              className="w-full rounded-full border px-4 py-2 outline-none focus:ring-2"
            >
              <option value="V1">V1 — Muy suave / Recuperación</option>
              <option value="V2">V2 — Suave</option>
              <option value="V3">V3 — Moderado</option>
              <option value="V4">V4 — Intenso</option>
              <option value="V5">V5 — Muy intenso</option>
            </select>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">Minutos</label>
            <input
              type="number"
              min={1}
              step={1}
              value={minutes}
              onChange={(e) => setMinutes(Math.max(0, Number(e.target.value)))}
              className="w-full rounded-full border px-4 py-2 outline-none focus:ring-2"
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">
              Calorías (editable)
              {!manualCalories && (
                <span className="ml-2 text-xs text-[var(--muted)]">(estimado)</span>
              )}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                step={1}
                value={calories}
                onChange={(e) => {
                  setManualCalories(true);
                  setCalories(Math.max(0, Number(e.target.value)));
                }}
                className="w-full rounded-full border px-4 py-2 outline-none focus:ring-2"
              />
              {manualCalories && (
                <button
                  type="button"
                  onClick={() => {
                    setManualCalories(false);
                    // disparará el recalculo por useEffect
                  }}
                  className="shrink-0 rounded-full border px-3 py-2 text-sm"
                  title="Volver a estimación automática"
                >
                  Auto
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Fecha */}
        <div className="grid gap-2 sm:max-w-xs">
          <label className="text-sm font-medium">Fecha</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-full border px-4 py-2 outline-none focus:ring-2"
          />
        </div>

        {/* Acciones */}
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium hover:opacity-90 active:scale-[0.99]"
          >
            <Save className="h-4 w-4" />
            {editingId ? "Guardar cambios" : "Guardar registro"}
          </button>

          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm hover:opacity-90"
            >
              <X className="h-4 w-4" />
              Cancelar
            </button>
          )}
        </div>
      </form>

      {/* Texto informativo con acordeón */}
      <div className="mt-6 rounded-2xl border border-[var(--line)] bg-white">
        <button
          type="button"
          className="w-full flex items-center justify-between gap-2 px-4 py-3"
          aria-expanded={infoOpen}
          onClick={() => setInfoOpen((v) => !v)}
        >
          <h3 className="text-base font-semibold m-0">
            ¿Cómo puedo calcular las calorías que gasto haciendo ejercicio?
          </h3>
          {infoOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </button>

        {infoOpen && (
          <div className="px-4 pb-4">
            <p className="text-sm leading-relaxed">
              Lo ideal es usar un dispositivo específico (reloj inteligente, banda de pecho) para una
              medición precisa. Si no lo tienes, en esta app podrás <strong>elegir la intensidad (V1–V5)</strong> y
              <strong> poner los minutos</strong>: generaremos una estimación automática, pero el <strong>resultado es editable</strong> para
              que, si conoces el dato exacto (por ejemplo, el que te da tu reloj), puedas modificarlo y guardarlo.
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <strong>V1 — Muy suave / Recuperación</strong>: paseo muy tranquilo, movilidad,
                respiración, estiramientos suaves, <em>pilates terapéutico</em> o rehabilitación.
              </li>
              <li>
                <strong>V2 — Ejercicio suave</strong>: andar tranquilo, estiramientos, <em>pilates básico</em>, yoga suave.
              </li>
              <li>
                <strong>V3 — Ejercicio moderado</strong>: andar rápido, bici urbana, nadar suave, bailar,
                <em> pádel recreativo</em>, <em>entrenamiento de fuerza tradicional</em> (series con descansos).
              </li>
              <li>
                <strong>V4 — Ejercicio intenso</strong>: correr continuo, bici deportiva, natación continua,
                <em> pádel competitivo</em>, <em>entrenamiento de fuerza</em> con superseries o circuitos.
              </li>
              <li>
                <strong>V5 — Ejercicio muy intenso</strong>: HIIT, sprints, fútbol/baloncesto competitivo, crossfit/intervalos.
              </li>
            </ul>
          </div>
        )}
      </div>

      {/* Lista de registros */}
      <div className="mt-6">
        <h3 className="text-base font-semibold mb-2">Tus registros</h3>
        {entries.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            Aún no tienes registros. Añade tu primer entrenamiento arriba.
          </p>
        ) : (
          <ul className="space-y-3">
            {entries.map((e) => (
              <li
                key={e.id}
                className="rounded-2xl border border-[var(--line)] bg-white p-3 sm:p-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="text-sm">
                      <span className="font-medium">{e.title}</span>{" "}
                      <span className="text-[var(--muted)]">• {e.intensity}</span>
                    </div>
                    <div className="text-xs text-[var(--muted)]">
                      {e.minutes} min · {e.calories} kcal · {e.date}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(e.id)}
                      className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm hover:opacity-90"
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(e.id)}
                      className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm hover:opacity-90"
                      title="Borrar"
                    >
                      <Trash2 className="h-4 w-4" />
                      Borrar
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
