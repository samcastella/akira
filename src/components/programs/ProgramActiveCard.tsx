"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Check, Plus, RotateCcw, Info, Loader2 } from "lucide-react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import {
  getActiveProgram,
  getDayTasks,
  getProgress,
  resetProgram,
  toggleTask,
  type TaskWithStatus,
} from "../../lib/programService";

type Props = {
  /** Si lo pasas, lo usa directamente. Si no, intenta resolverlo desde Supabase auth */
  userId?: string;
  /** Programa a mostrar; por ahora "lectura-30" */
  programSlug?: string;
  /** Callback opcional tras reiniciar (para que el padre refresque) */
  onReset?: () => void;
};

export default function ProgramActiveCard({
  userId: userIdProp,
  programSlug = "lectura-30",
  onReset,
}: Props) {
  const supabase = useMemo(() => createClientComponentClient(), []);
;

  const [userId, setUserId] = useState<string | null>(userIdProp ?? null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [currentDay, setCurrentDay] = useState<number>(1);
  const [daysCompleted, setDaysCompleted] = useState<number>(0);
  const [totalDays, setTotalDays] = useState<number>(30);
  const [tasks, setTasks] = useState<TaskWithStatus[]>([]);
  const [detailTask, setDetailTask] = useState<TaskWithStatus | null>(null);

  // 1) Resolver userId si no viene por props
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (userIdProp) {
          setUserId(userIdProp);
          return;
        }
        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;
        if (!mounted) return;
        setUserId(data.user?.id ?? null);
      } catch (e: any) {
        console.error(e);
        setError("No se pudo obtener el usuario.");
      }
    })();
    return () => {
      mounted = false;
    };
  }, [supabase, userIdProp]);

  // 2) Cargar estado del programa + progreso + tareas del día
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!userId) return;
      setLoading(true);
      setError(null);
      try {
        const active = await getActiveProgram(supabase, userId, programSlug);
        if (!active || !active.is_active) {
          // No hay programa activo → no renderizamos nada (que el padre decida el estado vacío)
          if (!mounted) return;
          setTasks([]);
          setDaysCompleted(0);
          setTotalDays(30);
          setCurrentDay(1);
          setLoading(false);
          return;
        }

        const { daysCompleted, totalDays, currentDay } = await getProgress(
          supabase,
          userId,
          programSlug
        );
        if (!mounted) return;

        setDaysCompleted(daysCompleted);
        setTotalDays(totalDays);
        setCurrentDay(currentDay);

        const dayTasks = await getDayTasks(
          supabase,
          userId,
          programSlug,
          currentDay
        );
        if (!mounted) return;
        setTasks(dayTasks);
      } catch (e: any) {
        console.error(e);
        if (!mounted) return;
        setError(e.message ?? "Error cargando el programa.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [supabase, userId, programSlug]);

  const percent =
    totalDays > 0 ? Math.min(100, Math.round((daysCompleted / totalDays) * 100)) : 0;

  async function handleToggle(taskId: string, next: boolean) {
    if (!userId) return;
    setBusy(true);
    setError(null);
    try {
      const { advanced, nextDay } = await toggleTask(
        supabase,
        userId,
        programSlug,
        currentDay,
        taskId,
        next
      );

      // Optimismo local para la UI
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, completed: next } : t))
      );

      if (advanced && nextDay) {
        // Refrescar progreso + nuevas tareas del día siguiente
        const prog = await getProgress(supabase, userId, programSlug);
        setDaysCompleted(prog.daysCompleted);
        setTotalDays(prog.totalDays);
        setCurrentDay(prog.currentDay);

        const nextTasks = await getDayTasks(
          supabase,
          userId,
          programSlug,
          prog.currentDay
        );
        setTasks(nextTasks);

        // Mini-toast
        // (Si tienes sistema de toasts, reemplaza por tu helper)
        console.info(`Día ${currentDay} completado. ¡A por el día ${nextDay}!`);
      }
    } catch (e: any) {
      console.error(e);
      setError(e.message ?? "No se pudo actualizar la tarea.");
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    if (!userId) return;
    const ok = confirm(
      "¿Reiniciar el programa? Se borrarán los checks y volverás al Día 1."
    );
    if (!ok) return;

    setBusy(true);
    setError(null);
    try {
      await resetProgram(supabase, userId, programSlug);
      // Estado base
      setCurrentDay(1);
      setDaysCompleted(0);
      const freshTasks = await getDayTasks(supabase, userId, programSlug, 1);
      setTasks(freshTasks);
      onReset?.();
    } catch (e: any) {
      console.error(e);
      setError(e.message ?? "No se pudo reiniciar el programa.");
    } finally {
      setBusy(false);
    }
  }

  // Si no hay usuario o no hay programa activo, no mostramos la card (el padre enseña estado vacío)
  if (!userId) {
    return null;
  }

  if (loading) {
    return (
      <div className="card">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Cargando programa activo…</span>
        </div>
      </div>
    );
  }

  if (!tasks.length && !error) {
    // No hay programa activo
    return null;
  }

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide muted">
            Programa activo
          </div>
          <h2 className="text-lg font-extrabold leading-tight">
            Conviértete en lector
          </h2>
          <p className="mt-1 text-sm muted">
            Vas por el <strong>Día {currentDay}</strong>
          </p>
        </div>

        <button
          onClick={handleReset}
          className="btn secondary"
          disabled={busy}
          aria-label="Reiniciar programa"
          title="Reiniciar programa"
        >
          <RotateCcw className="h-4 w-4" />
          <span className="ml-2">Reiniciar</span>
        </button>
      </div>

      {/* Progress */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-sm">
          <span>Progreso</span>
          <span>
            {daysCompleted}/{totalDays} ({percent}%)
          </span>
        </div>
        <div
          className="mt-2 h-3 w-full overflow-hidden rounded-full border"
          style={{ borderColor: "var(--line)" }}
          aria-label="Barra de progreso"
        >
          <div
            className="h-full"
            style={{
              width: `${percent}%`,
              background:
                "linear-gradient(90deg, var(--accent) 0%, var(--accent) 100%)",
            }}
          />
        </div>
      </div>

      {/* Checklist del día */}
      <div className="mt-6">
        <div className="mb-2 flex items-center gap-2">
          <Info className="h-4 w-4 muted" />
          <span className="text-sm muted">
            Marca cada mini-hábito. Toca <strong>+</strong> para ver el detalle.
          </span>
        </div>

        <ul className="list">
          {tasks.map((t, idx) => {
            const checked = t.completed;
            return (
              <li key={t.id} className="py-2">
                <div className="flex items-start gap-3">
                  {/* Checkbox / toggle */}
                  <button
                    className="h-6 w-6 rounded-md border flex items-center justify-center"
                    style={{
                      borderColor: "var(--line)",
                      background: checked ? "var(--accent)" : "var(--background)",
                      color: checked ? "#fff" : "var(--foreground)",
                    }}
                    aria-pressed={checked}
                    aria-label={checked ? "Desmarcar" : "Marcar"}
                    onClick={() => handleToggle(t.id, !checked)}
                    disabled={busy}
                  >
                    {checked ? <Check className="h-4 w-4" /> : <span />}
                  </button>

                  {/* Label + actions */}
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold leading-tight">
                        {t.label}
                      </span>
                      <button
                        className="btn ghost"
                        onClick={() => setDetailTask(t)}
                        aria-label="Ver detalle"
                        title="Ver detalle"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Error */}
      {error && (
        <div
          className="mt-3 rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: "#fca5a5", background: "rgba(252,165,165,.12)" }}
        >
          {error}
        </div>
      )}

      {/* Modal de detalle (interno al componente para no depender de otro archivo todavía) */}
      {detailTask && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="task-modal-title"
          className="modal-backdrop"
          onClick={() => setDetailTask(null)}
        >
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxHeight: "85vh", overflowY: "auto" }}
          >
            <h3 id="task-modal-title" className="text-base font-extrabold">
              {detailTask.label}
            </h3>
            <p className="mt-2 text-sm leading-6">{detailTask.detail}</p>

            <div className="actions">
              <button className="btn" onClick={() => setDetailTask(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
