// src/components/ProgramDetail.tsx
'use client';

import type { FC } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  RotateCcw,
  CheckCircle2,
  Circle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Lock,
  X,
  Play,
} from 'lucide-react';

type JsonTask = { id?: string; label: string; detail?: string; tags?: string[] };
type JsonDay = { day: number; tasks: JsonTask[] };
type ProgramJson = {
  slug: string;
  title: string;
  shortDescription?: string;
  howItWorks?: string;
  durationDays?: number;
  accordions?: {
    whatYouWillDo?: string[];
    whatYouWillGet?: string[];
    howToUse?: string[];
  };
  days: JsonDay[];
};

type DayProgressV2 = Record<number, Record<string, boolean>>;
type ActiveProgram = { startedAt: string; progress: DayProgressV2 };

const LS_ACTIVE = 'akira_programs_active_v1';
const LS_ACTIVE_COMPAT = 'akira_program_active';

const DATA_LOADERS: Record<string, () => Promise<ProgramJson>> = {
  'lectura-30': async () => {
    const m = await import('@/data/programs/lectura-30.json');
    return (m as any).default ?? (m as any);
  },
  'detox-tecnologico-30': async () => {
    const m = await import('@/data/programs/detox-tecnologico-30.json');
    return (m as any).default ?? (m as any);
  },
};

function todayKey() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}
function daysBetween(aISO: string, bISO: string) {
  const a = new Date(aISO + 'T00:00:00');
  const b = new Date(bISO + 'T00:00:00');
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000);
}
function loadActive(): Record<string, ActiveProgram> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(LS_ACTIVE);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
function saveActive(obj: Record<string, ActiveProgram>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LS_ACTIVE, JSON.stringify(obj));
}

/* ---------- Mini-render Markdown seguro (negrita/cursiva/line breaks) ---------- */
function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function renderLightMarkdown(input: string) {
  let html = escapeHtml(input ?? '');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'); // **bold**
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');            // *italic*
  html = html.replace(/\n/g, '<br/>');                          // line breaks
  return html;
}
const MD: FC<{ children: string; className?: string }> = ({ children, className }) => (
  <span className={className} dangerouslySetInnerHTML={{ __html: renderLightMarkdown(children) }} />
);
/* ------------------------------------------------------------------------------ */

type Props = {
  slug: string;
  imageSrc?: string;
  title: string;
  shortDescription: string; // oculto en esta vista
  howItWorks: string;
};

export default function ProgramDetail({
  slug,
  imageSrc,
  title,
  shortDescription: _shortDescription,
  howItWorks,
}: Props) {
  const router = useRouter();

  const [data, setData] = useState<ProgramJson | null>(null);
  const [activeMap, setActiveMap] = useState<Record<string, ActiveProgram>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  const [openAcc, setOpenAcc] = useState<{ do: boolean; get: boolean; use: boolean }>({
    do: false,
    get: false,
    use: false,
  });
  const [openTasks, setOpenTasks] = useState<Record<string, boolean>>({});

  // cargar JSON
  useEffect(() => {
    const loader = DATA_LOADERS[slug];
    if (!loader) return;
    loader()
      .then((payload) => {
        setData(payload);
        setOpenAcc({ do: false, get: false, use: false });
        setOpenTasks({});
      })
      .catch(() => setData(null));
  }, [slug]);

  // cargar progreso
  useEffect(() => {
    setActiveMap(loadActive());
  }, []);

  const active = activeMap[slug] ?? null;
  const started = Boolean(active?.startedAt);

  const totalDays = useMemo(
    () => data?.durationDays ?? data?.days?.length ?? 0,
    [data]
  );

  const currentDay = useMemo(() => {
    if (!active?.startedAt || totalDays <= 0) return 1;
    const delta = daysBetween(active.startedAt, todayKey());
    return Math.min(totalDays, Math.max(1, delta + 1));
  }, [active?.startedAt, totalDays]);

  const [viewedDay, setViewedDay] = useState<number>(1);
  useEffect(() => {
    setViewedDay(currentDay || 1);
  }, [currentDay]);

  const dayData = useMemo(() => {
    if (!data || totalDays === 0) return null;
    return data.days.find((d) => d.day === viewedDay) ?? data.days[viewedDay - 1] ?? null;
  }, [data, viewedDay, totalDays]);

  const tasks: JsonTask[] = dayData?.tasks ?? [];

  function getDayProgressMap(dayNum: number): Record<string, boolean> {
    const entry = activeMap[slug];
    if (!entry) return {};
    const raw = entry.progress?.[dayNum] as any;
    if (!raw) return {};
    if (Array.isArray(raw)) {
      const migrated: Record<string, boolean> = {};
      const dayTasks =
        data?.days.find((d) => d.day === dayNum)?.tasks ?? data?.days[dayNum - 1]?.tasks ?? [];
      dayTasks.forEach((t, i) => {
        const id = t.id ?? `task_${i}`;
        migrated[id] = Boolean(raw[i]);
      });
      const next = { ...activeMap };
      next[slug] = { ...entry, progress: { ...entry.progress, [dayNum]: migrated } };
      saveActive(next);
      setActiveMap(next);
      return migrated;
    }
    return raw as Record<string, boolean>;
  }
  const dayProgressMap = getDayProgressMap(viewedDay);

  const progressPct = useMemo(() => {
    if (!active?.startedAt || totalDays === 0) return 0;
    const passed = Math.min(totalDays, Math.max(0, daysBetween(active.startedAt, todayKey()) + 1));
    return Math.round((passed / totalDays) * 100);
  }, [active?.startedAt, totalDays]);

  function startProgram() {
    setActiveMap((prev) => {
      const next = { ...prev, [slug]: { startedAt: todayKey(), progress: {} } };
      saveActive(next);
      try { localStorage.removeItem(LS_ACTIVE_COMPAT); } catch {}
      return next;
    });
  }

  function requestReset() {
    setConfirmOpen(true);
  }
  function confirmReset() {
    setActiveMap((prev) => {
      const next = { ...prev };
      delete next[slug];
      saveActive(next);
      try { localStorage.removeItem(LS_ACTIVE_COMPAT); } catch {}
      return next;
    });
    setOpenTasks({});
    setViewedDay(1);
    setConfirmOpen(false);
  }
  function cancelReset() {
    setConfirmOpen(false);
  }

  function toggleTaskOpen(task: JsonTask, index: number) {
    const taskId = task.id ?? `task_${index}`;
    setOpenTasks((p) => ({ ...p, [taskId]: !p[taskId] }));
  }

  // Row de acordeón (usa colores por tokens)
  const ARow: FC<{ label: string; open: boolean; onClick: () => void }> = ({
    label,
    open,
    onClick,
  }) => (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between py-3"
      aria-expanded={open}
    >
      <span className="text-[15px] font-semibold text-[color:var(--foreground)]">{label}</span>
      {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
    </button>
  );

  return (
    <div className="px-4 pb-24 bg-[var(--background)] text-[color:var(--foreground)]">
      {/* Hero 16:9 full-bleed con botón Volver sobre la imagen */}
      {imageSrc && (
        <div className="-mx-4 mb-5 relative">
          <div className="relative w-full aspect-[16/9]">
            <Image src={imageSrc} alt={title} fill className="object-cover" priority />
          </div>

          {/* Botón Volver overlay con tokens (contraste en ambos modos) */}
          <div className="absolute top-3 right-3">
            <button
              onClick={() => { try { router.back(); } catch { location.href = '/habitos'; } }}
              className="inline-flex items-center gap-1.5 text-[13px] font-medium px-3.5 py-2 rounded-full border border-[color:var(--line)] shadow-md active:scale-[0.98]"
              style={{
                background: 'color-mix(in oklab, var(--background) 85%, transparent)',
                backdropFilter: 'blur(6px)',
              }}
            >
              <ChevronLeft className="w-4 h-4" />
              Volver
            </button>
          </div>
        </div>
      )}

      {/* Título y chip */}
      <h1 className="text-2xl font-semibold">{title}</h1>
      {data?.durationDays ? (
        <div className="mt-1 inline-flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 rounded-full border border-[color:var(--line)] text-[color:var(--foreground)]/80">
            Duración: {data.durationDays} días
          </span>
        </div>
      ) : null}

      {/* Introducción */}
      <div className="mt-4">
        <MD className="text-[13px] text-[color:var(--foreground)]/90 leading-relaxed">{howItWorks}</MD>

        {(data?.accordions?.whatYouWillDo?.length ||
          data?.accordions?.whatYouWillGet?.length ||
          data?.accordions?.howToUse?.length) && (
          <div className="mt-4 divide-y divide-[color:var(--line)]">
            {data?.accordions?.whatYouWillDo?.length ? (
              <div className="py-2">
                <ARow
                  label="¿Qué vas a hacer?"
                  open={openAcc.do}
                  onClick={() => setOpenAcc((s) => ({ ...s, do: !s.do }))}
                />
                {openAcc.do && (
                  <ul className="pl-4 list-disc text-[13px] text-[color:var(--foreground)]/90 space-y-1">
                    {data!.accordions!.whatYouWillDo!.map((li, i) => (
                      <li key={`do_${i}`}>
                        <MD className="text-[13px] leading-relaxed">{li}</MD>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}

            {data?.accordions?.whatYouWillGet?.length ? (
              <div className="py-2">
                <ARow
                  label="¿Qué vas a conseguir?"
                  open={openAcc.get}
                  onClick={() => setOpenAcc((s) => ({ ...s, get: !s.get }))}
                />
                {openAcc.get && (
                  <ul className="pl-4 list-disc text-[14px] text-[color:var(--foreground)] space-y-1">
                    {data!.accordions!.whatYouWillGet!.map((li, i) => (
                      <li key={`get_${i}`}>
                        <MD className="text-[14px] leading-relaxed">{li}</MD>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}

            {data?.accordions?.howToUse?.length ? (
              <div className="py-2">
                <ARow
                  label="¿Cómo se usa?"
                  open={openAcc.use}
                  onClick={() => setOpenAcc((s) => ({ ...s, use: !s.use }))}
                />
                {openAcc.use && (
                  <ul className="pl-4 list-disc text-[13px] text-[color:var(--foreground)]/90 space-y-1">
                    {data!.accordions!.howToUse!.map((li, i) => (
                      <li key={`use_${i}`}>
                        <MD className="text-[13px] leading-relaxed">{li}</MD>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* CTA — usa tokens para tema */}
      <div className="mt-6 flex items-center gap-2">
        {!started ? (
          <button
            onClick={startProgram}
            className="inline-flex items-center gap-2 rounded-2xl px-5 py-3.5 text-[15px] font-semibold shadow-md active:scale-[0.98] border border-[color:var(--accent)]"
            style={{ background: 'var(--accent)', color: 'var(--background)' }}
          >
            <Play className="w-4 h-4" />
            Empezar programa
          </button>
        ) : (
          <button
            onClick={requestReset}
            className="inline-flex items-center gap-2 justify-center rounded-xl px-3.5 py-2.5 text-xs font-medium transition border border-[color:var(--line)]"
            style={{ background: 'color-mix(in oklab, var(--background) 96%, transparent)' }}
            title="Reiniciar programa"
          >
            <RotateCcw className="w-4 h-4" />
            Reiniciar
          </button>
        )}
      </div>

      {/* Modal confirmación reinicio */}
      {confirmOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40">
          <div className="rounded-2xl p-5 w-[90%] max-w-md shadow-lg border border-[color:var(--line)]"
               style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
            <h3 className="text-lg font-semibold">¿Estás seguro?</h3>
            <p className="text-sm mt-2 text-[color:var(--foreground)]/80">
              Esto dejará el programa como no iniciado.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={cancelReset}
                className="rounded-xl py-2 text-sm font-medium border border-[color:var(--line)]"
                style={{ background: 'var(--background)', color: 'var(--foreground)' }}
              >
                Cancelar
              </button>
              <button
                onClick={confirmReset}
                className="rounded-xl py-2 text-sm font-semibold"
                style={{ background: '#d92c2c', color: '#fff' }}
              >
                Reiniciar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Progreso + Navegación: solo si iniciado */}
      {started && data && totalDays > 0 && (
        <>
          <div className="mt-8">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium">
                Progreso: Día {Math.min(currentDay, totalDays)} / {totalDays}
              </div>
              <div className="text-sm text-[color:var(--foreground)]/70">{progressPct}%</div>
            </div>
            <div className="h-2 w-full rounded-full bg-[color:var(--line)]/50 overflow-hidden">
              <div
                className="h-full transition-all"
                style={{
                  width: `${progressPct}%`,
                  background: 'var(--accent)',
                }}
              />
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <button
              onClick={() => setViewedDay((d) => Math.max(1, d - 1))}
              disabled={viewedDay <= 1}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border"
              style={{
                borderColor: 'var(--line)',
                color: viewedDay <= 1 ? 'color-mix(in oklab, var(--foreground) 40%, transparent)' : 'var(--foreground)',
                opacity: viewedDay <= 1 ? 0.6 : 1,
                background: 'var(--background)',
              }}
              aria-label="Día anterior"
            >
              <ChevronLeft className="w-4 h-4" /> Anterior
            </button>

            <div className="text-[15px] font-semibold">Día {viewedDay}</div>

            <button
              onClick={() => setViewedDay((d) => Math.min(currentDay, d + 1))}
              disabled={viewedDay >= currentDay}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border"
              style={{
                borderColor: 'var(--line)',
                color: viewedDay >= currentDay ? 'color-mix(in oklab, var(--foreground) 40%, transparent)' : 'var(--foreground)',
                opacity: viewedDay >= currentDay ? 0.6 : 1,
                background: 'var(--background)',
              }}
              aria-label="Día siguiente"
              title={
                viewedDay >= currentDay
                  ? 'El plan se revela día a día. Se desbloquea mañana.'
                  : 'Ir al siguiente día'
              }
            >
              {viewedDay >= currentDay ? (
                <>Bloqueado <Lock className="w-4 h-4" /></>
              ) : (
                <>Siguiente <ChevronRight className="w-4 h-4" /></>
              )}
            </button>
          </div>
        </>
      )}

      {/* Lista de tareas: solo si iniciado */}
      {started && data && totalDays > 0 && (
        <div className="mt-4">
          {tasks.length === 0 ? (
            <div className="text-sm border border-dashed rounded-2xl p-4"
                 style={{ color: 'color-mix(in oklab, var(--foreground) 80%, transparent)', borderColor: 'var(--line)' }}>
              Hoy desconectas de la app. Disfruta tu día sin móvil.
            </div>
          ) : (
            <div className="rounded-2xl border overflow-hidden divide-y"
                 style={{ borderColor: 'var(--line)', background: 'var(--background)' }}>
              {tasks.map((t, i) => {
                const id = t.id ?? `task_${i}`;
                const done = Boolean(dayProgressMap[id]);
                const isOpen = Boolean(openTasks[id]);
                return (
                  <div key={id}>
                    <div className="w-full text-left px-4 py-3 flex items-start gap-3"
                         style={{ color: 'var(--foreground)' }}>
                      <button
                        type="button"
                        onClick={() => setInfoOpen(true)}
                        className="shrink-0 mt-0.5"
                        aria-label="Los checks se hacen en Mi Zona"
                        title="Los checks se hacen en Mi Zona"
                      >
                        {done ? (
                          <CheckCircle2 className="w-5 h-5" style={{ color: '#16a34a' }} />
                        ) : (
                          <Circle className="w-5 h-5" style={{ color: 'color-mix(in oklab, var(--foreground) 35%, transparent)' }} />
                        )}
                      </button>

                      <div className="flex-1">
                        {/* Label con Markdown ligero */}
                        <div className="text-[15px]">
                          <MD className="text-[15px]">{t.label}</MD>
                        </div>
                        {/* toggle detalle */}
                        {t.detail && (
                          <button
                            onClick={() => toggleTaskOpen(t, i)}
                            className="mt-1 inline-flex items-center gap-1 text-[13px] hover:underline"
                            style={{ color: 'color-mix(in oklab, var(--foreground) 80%, transparent)' }}
                          >
                            {isOpen ? (
                              <>Ocultar <ChevronUp className="w-3 h-3" /></>
                            ) : (
                              <>Ver detalle <ChevronDown className="w-3 h-3" /></>
                            )}
                          </button>
                        )}
                        {t.detail && isOpen && (
                          <MD className="text-[13px] mt-1"
                              // texto secundario en ambos modos
                              className="text-[13px] mt-1"
                          >
                            {t.detail}
                          </MD>
                        )}
                      </div>
                    </div>
                    <div className="h-px" style={{ background: 'var(--line)' }} />
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-xs mt-2" style={{ color: 'color-mix(in oklab, var(--foreground) 65%, transparent)' }}>
            * Los checks se hacen en <strong>Mi Zona</strong>. Aquí puedes revisar tu progreso. El plan se revela día a día.
          </p>
        </div>
      )}

      {/* Pop-up informativo */}
      {infoOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40">
          <div
            className="rounded-2xl p-5 w-[90%] max-w-md shadow-lg relative border"
            style={{ background: 'var(--background)', color: 'var(--foreground)', borderColor: 'var(--line)' }}
          >
            <button
              onClick={() => setInfoOpen(false)}
              className="absolute top-3 right-3 p-1 rounded-full"
              style={{ background: 'color-mix(in oklab, var(--background) 94%, transparent)' }}
              aria-label="Cerrar"
              title="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
            <p className="text-[15px]">
              Los checks se hacen en <strong>Mi Zona</strong>. Aquí puedes revisar tu progreso. El plan se revela día a día.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
