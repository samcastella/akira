'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Heart, Activity, UtensilsCrossed, Brain, GraduationCap,
  CheckCircle2, ChevronLeft, Play, Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ===== Paleta + tipografía
const theme = { bg: '#ffffff', text: '#111111', line: '#ececec', accent: '#ffd54f' };

function FontLoader() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
      * { font-family: 'Poppins', sans-serif; }
      body { background:${theme.bg}; color:${theme.text}; }
    `}</style>
  );
}

// ===== Programas (demo)
const PROGRAMS = {
  smoke_quit_21: {
    id: 'smoke_quit_21',
    pillar: 'Hábitos',
    title: 'Dejar de fumar (21 días)',
    cover: 'https://images.unsplash.com/photo-1517260917478-4524462bca31?q=80&w=1200&auto=format&fit=crop',
    duration: 21,
    intro:
      'Plan guiado paso a paso para sustituir el hábito, gestionar ansiedad y construir identidad libre de tabaco.',
    days: Array.from({ length: 21 }).map((_, i) => {
      const d = i + 1;
      const stepsByDay: Record<number, string[]> = {
        1: ['Define tu porqué (2 líneas).', 'Registra los cigarrillos de hoy sin cambiar nada.'],
        2: ['Elige sustituto (chicle/agua/respiración 4-7-8).', 'Retrasa el primer cigarro 10 min.'],
        3: ['Identifica disparadores (café/estrés).', 'Cambia 1 disparador por paseo 3’.'],
        7: ['Mini-meta: mañana 25% menos.', 'Prepara snacks saludables.'],
        14: ['Escribe 3 beneficios notados.', 'Doble hidratación hoy.'],
        21: ['Día sin fumar.', 'Plan de mantenimiento para recaídas.'],
      };
      const steps = stepsByDay[d] || [
        'Repite sustituto cuando aparezca el impulso.',
        'Registro breve: hora + situación + emoción.',
      ];
      const tipPool = [
        'Respiración 4-7-8: 4s inhala, 7s sostén, 8s exhala.',
        'Agua fría reduce el ansia en ~2 min.',
        'Muévete 60–120s: cambia el estado del cuerpo.',
      ];
      return { day: d, steps, tip: tipPool[i % tipPool.length] };
    }),
  },
  train_from_zero_14: {
    id: 'train_from_zero_14',
    pillar: 'Training',
    title: 'Entreno desde 0 (14 días)',
    cover:
      'https://images.unsplash.com/photo-1517963628607-235ccdd5476b?q=80&w=1200&auto=format&fit=crop',
    duration: 14,
    intro: 'Rutinas de 10–15 min: movilidad + fuerza básica en casa.',
  },
};

const sections = [
  {
    title: 'Hábitos',
    items: [
      {
        title: 'Constancia de corredor',
        img: 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?q=80&w=800&auto=format&fit=crop',
      },
      { title: 'Dejar de fumar', img: PROGRAMS.smoke_quit_21.cover, programId: 'smoke_quit_21' },
      {
        title: 'Go Vegan',
        img: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?q=80&w=800&auto=format&fit=crop',
      },
    ],
  },
  {
    title: 'Training',
    items: [
      {
        title: 'Entreno desde 0',
        img: PROGRAMS.train_from_zero_14.cover,
        programId: 'train_from_zero_14',
      },
      {
        title: 'Plan mensual',
        img: 'https://images.unsplash.com/photo-1576678927484-cc907957088c?q=80&w=800&auto=format&fit=crop',
      },
      {
        title: 'Elige extraordinario',
        img: 'https://images.unsplash.com/photo-1534367610401-9f51f0b2dd0e?q=80&w=800&auto=format&fit=crop',
      },
    ],
  },
  {
    title: 'Alimentación',
    items: [
      {
        title: 'Menú semanal',
        img: 'https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?q=80&w=800&auto=format&fit=crop',
      },
      {
        title: 'Recetas',
        img: 'https://images.unsplash.com/photo-1482049016688-2d3e1b311543?q=80&w=800&auto=format&fit=crop',
      },
      {
        title: 'Planifica tu menú',
        img: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=800&auto=format&fit=crop',
      },
    ],
  },
];

const tabs = [
  { key: 'inicio', label: 'Hábitos', icon: Heart },
  { key: 'training', label: 'Training', icon: Activity },
  { key: 'food', label: 'Alimentación', icon: UtensilsCrossed },
  { key: 'mind', label: 'Desarrollo', icon: Brain },
  { key: 'academy', label: 'Formación', icon: GraduationCap },
];

const loadProgress = (id: string) => {
  try {
    return JSON.parse(localStorage.getItem(`prog_${id}`) || 'null');
  } catch {
    return null;
  }
};
const saveProgress = (id: string, data: any) => {
  try {
    localStorage.setItem(`prog_${id}`, JSON.stringify(data));
  } catch {}
};

function BottomTab({
  active,
  onChange,
}: {
  active: string;
  onChange: (k: string) => void;
}) {
  return (
    <div
      className="fixed bottom-0 inset-x-0 z-20 border-t"
      style={{ background: theme.accent, borderColor: '#0000001a' }}
    >
      <div className="mx-auto max-w-md grid grid-cols-5">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={`flex flex-col items-center justify-center py-2 text-[11px] ${
              active === key ? 'opacity-100' : 'opacity-80'
            }`}
          >
            <div
              className={`h-8 w-8 rounded-xl flex items-center justify-center ${
                active === key ? 'bg-black text-white' : 'text-black'
              }`}
            >
              <Icon className="h-5 w-5" />
            </div>
            <span className="mt-1 leading-none text-black">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ProgressStreak({ days = 5, goal = 21 }: { days?: number; goal?: number }) {
  const pct = Math.min(100, Math.round((days / goal) * 100));
  return (
    <div
      className="w-full rounded-2xl border p-3 bg-white/80"
      style={{ borderColor: theme.line }}
    >
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 font-medium">
          <CheckCircle2 className="h-4 w-4" />
          <span>Racha: {days} días</span>
        </div>
        <span className="text-black/60">Objetivo: {goal} días</span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full" style={{ background: '#0000001a' }}>
        <div className="h-full transition-all" style={{ width: `${pct}%`, background: theme.text }} />
      </div>
    </div>
  );
}

function Section({
  title,
  items,
  onOpenProgram,
}: {
  title: string;
  items: any[];
  onOpenProgram: (id: string) => void;
}) {
  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold text-black/80 mb-3">{title}</h3>
      <div className="grid grid-cols-3 gap-3">
        {items.map((it, i) => (
          <motion.button
            key={i}
            whileTap={{ scale: 0.98 }}
            whileHover={{ y: -2 }}
            className="group overflow-hidden rounded-xl border bg-white shadow-sm"
            style={{ borderColor: theme.line }}
            onClick={() =>
              it.programId ? onOpenProgram(it.programId) : alert(`${title} → ${it.title}`)
            }
          >
            <div className="aspect-square w-full overflow-hidden">
              <img
                src={it.img}
                alt={it.title}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            </div>
            <div className="px-2 py-2 text-[11px] text-black/80 text-left truncate">{it.title}</div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

function ProgramHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <button className="h-9 w-9 rounded-xl bg-black text-white flex items-center justify-center" onClick={onBack}>
        <ChevronLeft className="h-5 w-5" />
      </button>
      <h2 className="text-xl font-semibold">{title}</h2>
    </div>
  );
}

function TodayCard({
  day,
  total,
  tip,
  steps,
  done,
  onToggleStep,
  onCompleteDay,
}: {
  day: number;
  total: number;
  tip: string;
  steps: string[];
  done: boolean[];
  onToggleStep: (i: number) => void;
  onCompleteDay: () => void;
}) {
  return (
    <div className="mt-4 p-4 rounded-2xl bg-white border" style={{ borderColor: theme.line }}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-black/60">Hoy</div>
          <div className="text-lg font-semibold">
            Día {day} / {total}
          </div>
        </div>
        <div className="text-xs bg-black text-white rounded-full px-2 py-1">Consejo</div>
      </div>
      <p className="mt-2 text-sm text-black/70">{tip}</p>

      <div className="mt-3 space-y-2">
        {steps.map((s, i) => (
          <button
            key={i}
            onClick={() => onToggleStep(i)}
            className={`w-full flex items-center gap-3 p-3 rounded-xl border transition ${
              done[i] ? 'bg-green-50 border-green-200' : 'bg-white hover:bg-neutral-50'
            }`}
            style={{ borderColor: done[i] ? '#a7f3d0' : theme.line }}
          >
            <div
              className={`h-6 w-6 rounded-md flex items-center justify-center ${
                done[i] ? 'bg-green-500 text-white' : 'bg-black/5'
              }`}
            >
              {done[i] ? <Check className="h-4 w-4" /> : null}
            </div>
            <span className="text-sm text-left">{s}</span>
          </button>
        ))}
      </div>

      <button
        onClick={onCompleteDay}
        className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl py-3 text-white font-medium"
        style={{ background: done.every(Boolean) ? '#16a34a' : theme.text, opacity: done.every(Boolean) ? 1 : 0.9 }}
      >
        <Play className="h-4 w-4" /> Marcar día como completado
      </button>
    </div>
  );
}

function ProgramView({ program, onBack }: { program: any; onBack: () => void }) {
  const stored = loadProgress(program.id);
  const [day, setDay] = useState<number>(stored?.day || 1);
  const today = useMemo(() => program.days?.[day - 1], [program, day]);
  const [done, setDone] = useState<boolean[]>(
    stored?.done || (today ? today.steps.map(() => false) : [])
  );

  useEffect(() => {
    if (today) setDone(today.steps.map(() => false));
  }, [day]);

  useEffect(() => {
    saveProgress(program.id, { day, done });
  }, [program.id, day, done]);

  if (!today) {
    return (
      <div className="pt-6">
        <ProgramHeader title={program.title} onBack={onBack} />
        <div className="mt-6 p-4 rounded-2xl bg-white border text-center" style={{ borderColor: theme.line }}>
          <div className="text-xl font-semibold">¡Programa completado! 🎉</div>
          <p className="text-sm text-black/70 mt-2">
            Has terminado los {program.duration} días. Define un plan de mantenimiento semanal.
          </p>
          <button onClick={onBack} className="mt-4 rounded-xl px-4 py-2 bg-black text-white">
            Volver
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-6">
      <ProgramHeader title={program.title} onBack={onBack} />
      <div className="mt-4 rounded-2xl overflow-hidden border" style={{ borderColor: theme.line }}>
        <img src={program.cover} alt={program.title} className="h-40 w-full object-cover" />
      </div>
      <p className="mt-3 text-sm text-black/70">{program.intro}</p>

      <TodayCard
        day={day}
        total={program.duration}
        tip={today.tip}
        steps={today.steps}
        done={done}
        onToggleStep={(i) => setDone((d) => d.map((v, idx) => (idx === i ? !v : v)))}
        onCompleteDay={() => setDay((d) => Math.min(program.duration + 1, d + 1))}
      />
      <div className="mt-3 text-center text-xs text-black/50">
        Progreso guardado en este navegador.
      </div>
    </div>
  );
}

export default function Page() {
  const [active, setActive] = useState('inicio');
  const [openProgramId, setOpenProgramId] = useState<string | null>(null);
  const program = openProgramId ? (PROGRAMS as any)[openProgramId] : null;

  return (
    <div className="min-h-screen" style={{ background: theme.bg, color: theme.text }}>
      <FontLoader />
      <div className="mx-auto max-w-md pb-24 px-4 pt-10">
        {!program && (
          <>
            <div className="text-center">
              <h1 className="text-lg font-semibold">Pensamiento del día</h1>
              <p className="mt-1 text-sm text-black/70">
                ¿Qué diferencia hay entre una persona proactiva y reactiva?
              </p>
            </div>
            <div className="mt-5">
              <ProgressStreak days={5} goal={21} />
            </div>
          </>
        )}

        <AnimatePresence mode="wait">
          {!program && active === 'inicio' && (
            <motion.div
              key="inicio"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {sections.map((s) => (
                <Section
                  key={s.title}
                  title={s.title}
                  items={s.items}
                  onOpenProgram={setOpenProgramId}
                />
              ))}
            </motion.div>
          )}

          {!program && active === 'training' && (
            <motion.div
              key="training"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pt-6"
            >
              <h2 className="text-xl font-semibold">Training</h2>
              <p className="text-black/70 mt-2 text-sm">Elige un programa.</p>
              <Section
                title="Recomendados"
                items={sections[1].items}
                onOpenProgram={setOpenProgramId}
              />
            </motion.div>
          )}

          {!program && active === 'food' && (
            <motion.div
              key="food"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pt-6"
            >
              <h2 className="text-xl font-semibold">Alimentación</h2>
              <p className="text-black/70 mt-2 text-sm">Planifica tus menús y recetas.</p>
              <Section
                title="Empieza aquí"
                items={sections[2].items}
                onOpenProgram={setOpenProgramId}
              />
            </motion.div>
          )}

          {!program && active === 'mind' && (
            <motion.div
              key="mind"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pt-6"
            >
              <h2 className="text-xl font-semibold">Desarrollo personal</h2>
              <ul className="mt-3 space-y-2 text-sm text-black/80">
                <li className="p-3 rounded-xl bg-white border" style={{ borderColor: theme.line }}>
                  21 días de meditación guiada
                </li>
                <li className="p-3 rounded-xl bg-white border" style={{ borderColor: theme.line }}>
                  Diario de gratitud
                </li>
                <li className="p-3 rounded-xl bg-white border" style={{ borderColor: theme.line }}>
                  Detox de redes
                </li>
              </ul>
            </motion.div>
          )}

          {!program && active === 'academy' && (
            <motion.div
              key="academy"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pt-6"
            >
              <h2 className="text-xl font-semibold">Formación</h2>
              <p className="text-black/70 mt-2 text-sm">
                Cursos cortos por pilares: Salud, Bienestar emocional, Finanzas.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {[
                  'Hábitos atómicos: resumen práctico',
                  'Finanzas personales: 0 → 1',
                  'Sueño: guía express',
                  'Nutrición sin líos',
                ].map((t) => (
                  <button
                    key={t}
                    className="p-3 text-left rounded-xl bg-white border shadow-sm hover:-translate-y-0.5 transition"
                    style={{ borderColor: theme.line }}
                  >
                    <div className="text-sm font-medium">{t}</div>
                    <div className="text-[11px] text-black/60 mt-1">Lección 5–8 min</div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {program && (
            <motion.div key={program.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ProgramView program={program} onBack={() => setOpenProgramId(null)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <BottomTab active={active} onChange={setActive} />
    </div>
  );
}
