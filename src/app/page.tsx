'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import {
  Home, ListChecks, User, GraduationCap, Users, X, ChevronRight, ChevronDown, ChevronUp, ArrowLeft,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Archivo_Black } from 'next/font/google';

/* ===== Tipografía títulos ===== */
const archivoBlack = Archivo_Black({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-archivo-black',
});

/* ===== Colores ===== */
const COLORS = {
  bg: '#ffffff',
  text: '#111111',
  accent: '#FFD54F', // barra inferior
  black: '#000000',
  line: '#eaeaea',
};

/* ===== Navegación ===== */
type TabKey = 'inicio' | 'habitos' | 'mizona' | 'formacion' | 'amigos';

/* ===== Pensamiento del día ===== */
type Thought = { title: string; text: string };

const THOUGHTS_BY_DAY: Record<number, Thought> = {
  1: { title: 'Visualízate', text: 'Imagina por un momento que ya lo lograste. Si tu reto es empezar a correr, mírate dentro de unos meses cruzando la meta... Hoy dedica 2–3 minutos a cerrar los ojos y verte consiguiendo tus objetivos.' },
  2: { title: 'Un paso más', text: 'No importa lo lejos que esté tu meta. Hoy comprométete a dar un paso pequeño: 5 páginas de lectura o 10 minutos de entreno.' },
  3: { title: 'Eres constante', text: 'La disciplina es volver incluso en los días que pesan. Elige una acción mínima para no romper la cadena.' },
  4: { title: 'Confía en ti', text: 'Piensa en un reto que ya superaste. Escribe tres cualidades tuyas que te ayudarán a conseguir tu meta.' },
  5: { title: 'El presente cuenta', text: 'Empieza con algo sencillo hoy: guarda 1€ o elige una comida sana. El cambio comienza ahora.' },
  6: { title: 'Pequeñas victorias', text: 'Camina 10 minutos, bebe un vaso de agua extra o envía ese mensaje pendiente. Suma victorias.' },
  0: { title: 'Reflexiona y agradece', text: 'Reconoce lo logrado esta semana. Respira y agradece una acción que te hizo avanzar.' },
};

const todayThought = () => THOUGHTS_BY_DAY[new Date().getDay()];

/* ===== Programa Lectura 21 días ===== */
type DayTasks = { tasks: string[] };
type ProgramDef = {
  key: string;
  name: string;
  image: string;
  benefits: string[];
  howItWorks: string[];
  days: DayTasks[]; // 21
};

const READING_PROGRAM: ProgramDef = {
  key: 'lectura',
  name: 'Conviértete en una máquina lectora',
  image: '/reading.jpg',
  benefits: [
    'Mejora tu concentración y claridad mental',
    'Aumenta tu creatividad y vocabulario',
    'Reduce el estrés y mejora el sueño',
  ],
  howItWorks: [
    '21 días con 2–3 micro-retos diarios.',
    'Semana 1: 1–5 páginas (súper fácil). Semana 2: 5–10. Semana 3: 10–15.',
    'Registra cada día en “Mi Zona” marcando el check.',
  ],
  days: [
    // Semana 1
    { tasks: ['Ve a una librería y elige un libro ≤ 200–300 páginas.', 'Colócalo en un lugar visible.', 'Define hora/lugar y pon una alarma diaria.'] }, // 1
    { tasks: ['Lee 1 página.', 'Escribe por qué elegiste ese libro.', 'Haz una foto de tu rincón de lectura.'] }, // 2
    { tasks: ['Lee 1–5 páginas (si lees más, genial).', 'Prepara tu ritual (café, té, luz).', 'Marca una frase que te inspire.'] }, // 3
    { tasks: ['Lee 1–5 páginas.', 'Lee en voz alta un párrafo.', 'Escribe una frase sobre lo que sentiste.'] }, // 4
    { tasks: ['Lee 1–5 páginas en un lugar distinto.', 'Apunta una idea clave.', 'Cuéntaselo a alguien.'] }, // 5
    { tasks: ['Lee 1–5 páginas.', 'Evalúa tu concentración (1–5).', 'Ajusta la hora si no encaja.'] }, // 6
    { tasks: ['Lee 1–5 páginas.', 'Relee tus notas o frases marcadas.', 'Celebra la primera semana.'] }, // 7
    // Semana 2
    { tasks: ['Lee 5 páginas.', 'Apunta 1 frase aplicable hoy.', 'Compártela con alguien.'] }, // 8
    { tasks: ['Lee 6 páginas.', 'Asocia lectura a otro hábito (después de desayunar).', 'Escribe lo más útil del día.'] }, // 9
    { tasks: ['Lee 6–7 páginas.', 'Marca 2 aprendizajes clave.', 'Recompénsate con algo sencillo.'] }, // 10
    { tasks: ['Lee 7 páginas.', 'Comparte lo más interesante con un amigo.', 'Haz check en tu racha.'] }, // 11
    { tasks: ['Lee 8 páginas.', 'Marca una idea aplicable hoy.', 'Ponla en práctica.'] }, // 12
    { tasks: ['Lee 8–9 páginas.', 'Escribe una reflexión de 2 frases.', 'Haz una foto del libro y compártela.'] }, // 13
    { tasks: ['Lee 10 páginas en tu lugar favorito.', 'Balance de semana: ¿qué aprendiste?', 'Recompénsate.'] }, // 14
    // Semana 3
    { tasks: ['Escribe: “Soy el tipo de persona que lee cada día”.', 'Lee 10 páginas.', 'Habla con alguien de tu hábito.'] }, // 15
    { tasks: ['Elige tu próxima lectura.', 'Lee 11 páginas.', 'Haz una story con tu frase favorita.'] }, // 16
    { tasks: ['Lee 12 páginas.', 'Mini-resumen (3–4 frases).', 'Meta: terminar libro en X días.'] }, // 17
    { tasks: ['Lee 12–13 páginas.', 'Marca 2 ideas prácticas.', 'Aplica 1 hoy mismo.'] }, // 18
    { tasks: ['Lee 13 páginas.', 'Cuenta a alguien qué estás aprendiendo.', 'Refuerza tu identidad lectora.'] }, // 19
    { tasks: ['Lee 14 páginas.', 'Repasa todas tus notas.', 'Elige la idea más transformadora.'] }, // 20
    { tasks: ['Lee 15 páginas o termina el libro.', 'Balance final del reto.', 'Comparte tu logro y planifica el siguiente libro.'] }, // 21
  ],
};

const PROGRAMS: Record<string, ProgramDef> = {
  [READING_PROGRAM.key]: READING_PROGRAM,
};

/* ===== Estado en localStorage ===== */
type ProgramState = { startDate: string; completedDates: string[] };
type ProgramsStore = Record<string, ProgramState>;
const STORAGE_KEY = 'akira_programs_v1';
const todayKey = () => new Date().toISOString().slice(0, 10);

function loadStore(): ProgramsStore {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}
function saveStore(store: ProgramsStore) { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); }
function startProgram(key: string) {
  const store = loadStore();
  if (!store[key]) { store[key] = { startDate: todayKey(), completedDates: [] }; saveStore(store); }
}
function toggleTodayComplete(key: string) {
  const store = loadStore(); if (!store[key]) return;
  const t = todayKey(); const set = new Set(store[key].completedDates);
  set.has(t) ? set.delete(t) : set.add(t);
  store[key].completedDates = [...set].sort(); saveStore(store);
}
function isTodayCompleted(key: string) {
  const store = loadStore(); return !!store[key]?.completedDates.includes(todayKey());
}
function getProgramDayIndex(key: string) {
  const start = loadStore()[key]?.startDate; if (!start) return 1;
  const day = Math.floor((Date.now() - new Date(start + 'T00:00:00').getTime()) / 86400000) + 1;
  return Math.min(Math.max(day, 1), 21);
}
function getProgressPercent(key: string) {
  const total = PROGRAMS[key]?.days.length ?? 21;
  const done = loadStore()[key]?.completedDates.length ?? 0;
  return Math.min(100, Math.round((done / total) * 100));
}

/* ===== Cards portada ===== */
interface HabitCardData {
  key: string; title: string; subtitle: string; image: string;
}
const FEATURED_HABITS: HabitCardData[] = [
  { key: 'lectura',    title: 'La máquina lectora',      subtitle: 'Conviértete en un superlector',                      image: '/reading.jpg' },
  { key: 'burpees',    title: 'Unos f*kn burpees',       subtitle: 'Comienza hoy y no pares',                            image: '/burpees.jpg' },
  { key: 'ahorro',     title: 'Ahorra sin darte cuenta', subtitle: 'Un hábito pequeño que cambia tu futuro',            image: '/savings.jpg' },
  { key: 'meditacion', title: 'Medita 5 minutos',        subtitle: 'Encuentra calma en tu día',                         image: '/meditation.jpg' },
];

/* ===== Layout ===== */
const NAV_HEIGHT = 84;
function SafeContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-md px-4" style={{ paddingBottom: `calc(${NAV_HEIGHT}px + env(safe-area-inset-bottom, 0px))` }}>
      {children}
    </div>
  );
}

/* ===== Bottom Nav ===== */
function BottomNav({ active, onChange }: { active: TabKey; onChange: (k: TabKey) => void; }) {
  const items: { key: TabKey; label: string; icon: React.ElementType }[] = [
    { key: 'inicio', label: 'Inicio', icon: Home },
    { key: 'habitos', label: 'Hábitos', icon: ListChecks },
    { key: 'mizona', label: 'Mi zona', icon: User },
    { key: 'formacion', label: 'Formación', icon: GraduationCap },
    { key: 'amigos', label: 'Amigos', icon: Users },
  ];
  return (
    <div className="fixed inset-x-0 bottom-0 z-30" style={{ height: `calc(${NAV_HEIGHT}px + env(safe-area-inset-bottom, 0px))`, background: COLORS.accent, paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="mx-auto grid h-full max-w-md grid-cols-5">
        {items.map(({ key, label, icon: Icon }) => {
          const isActive = key === active;
          let bg = COLORS.accent, fg = COLORS.text;
          if (key === 'mizona') { bg = isActive ? '#ffffff' : COLORS.black; fg = isActive ? COLORS.text : '#ffffff'; }
          else { bg = isActive ? '#ffffff' : COLORS.accent; fg = COLORS.text; }
          return (
            <button key={key} onClick={() => onChange(key)} className="flex h-full flex-col items-center justify-center transition-colors" style={{ background: bg, color: fg }} aria-label={label}>
              <Icon className="h-6 w-6" /><span className="mt-1 text-[12px] leading-none">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ===== Modal Pensamiento ===== */
function ThoughtModal({ open, onClose, thought }: { open: boolean; onClose: () => void; thought: Thought; }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="flex h-full items-center justify-center p-6">
            <motion.div className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl" initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 10 }}>
              <button onClick={onClose} className="absolute right-3 top-3 rounded-full p-1 text-black/70 hover:bg-black/5" aria-label="Cerrar">
                <X className="h-5 w-5" />
              </button>
              <h3 className="mb-2 text-xl font-semibold">{thought.title}</h3>
              <p className="whitespace-pre-line text-sm text-black/70">{thought.text}</p>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ===== Card Hábito (4:5 + CTA) ===== */
function HabitCard({ data, onOpen }: { data: HabitCardData; onOpen: (key: string) => void; }) {
  return (
    <div className="relative overflow-hidden" onClick={() => onOpen(data.key)} role="button" tabIndex={0} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onOpen(data.key)} aria-label={data.title}>
      {/* Ratio 4:5 por padding-bottom */}
      <div className="relative w-full" style={{ height: 0, paddingBottom: '125%', backgroundColor: '#111' }}>
        <Image src={data.image} alt={data.title} fill sizes="(max-width: 768px) 100vw, 600px" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
      </div>

      {/* Texto + CTA */}
      <div className="absolute inset-0 flex flex-col justify-end p-5">
        <div className="text-white/85 text-sm">{data.subtitle}</div>
        <div className={`${archivoBlack.className} text-white text-4xl leading-tight`}>{data.title}</div>
        <button
          className="mt-3 inline-flex items-center gap-2 self-start rounded-full bg-white px-4 py-2 text-sm font-medium text-black shadow"
          onClick={(e) => { e.stopPropagation(); onOpen(data.key); }}
        >
          ▶︎ Empezar ahora
        </button>
      </div>
    </div>
  );
}

/* ===== Detalle de Hábito ===== */
function HabitDetail({ program, onBack, onStarted }: { program: ProgramDef; onBack: () => void; onStarted: () => void; }) {
  const [openedHow, setOpenedHow] = useState(false);
  const [justStarted, setJustStarted] = useState(false);
  const [progress, setProgress] = useState(getProgressPercent(program.key));
  const dayIndex = getProgramDayIndex(program.key);

  useEffect(() => {
    const onTick = () => setProgress(getProgressPercent(program.key));
    const id = setInterval(onTick, 800);
    return () => clearInterval(id);
  }, [program.key]);

  const handleStart = () => {
    startProgram(program.key);
    setJustStarted(true);
    setProgress(getProgressPercent(program.key));
    onStarted();
  };

  return (
    <div className="pb-6">
      {/* Header 16:9 con padding-bottom (Safari-safe) */}
      <div className="relative w-full overflow-hidden rounded-b-2xl" style={{ height: 0, paddingBottom: '56.25%', backgroundColor: '#111' }}>
        <Image src={program.image} alt={program.name} fill className="object-cover" priority />
        <div className="absolute left-3 top-3">
          <button onClick={onBack} className="rounded-full bg-black/60 p-2 text-white"><ArrowLeft className="h-5 w-5" /></button>
        </div>
      </div>

      {/* Contenido */}
      <div className="mt-4">
        <h1 className={`${archivoBlack.className} text-3xl leading-tight`}>{program.name}</h1>
        <p className="mt-2 text-sm text-black/70">Beneficios de la lectura:</p>
        <ul className="mt-2 list-disc pl-5 text-sm text-black/80">
          {program.benefits.map((b, i) => (<li key={i}>{b}</li>))}
        </ul>
      </div>

      {/* ¿Cómo funciona? */}
      <div className="mt-4 rounded-2xl border" style={{ borderColor: COLORS.line }}>
        <button onClick={() => setOpenedHow(!openedHow)} className="flex w-full items-center justify-between px-4 py-3">
          <span className="text-base font-medium">¿Cómo funciona?</span>
          {openedHow ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </button>
        <AnimatePresence>
          {openedHow && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
              <ul className="space-y-2 px-4 pb-4 text-sm text-black/70">
                {program.howItWorks.map((it, i) => (<li key={i}>• {it}</li>))}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Empezar + progreso */}
      <div className="mt-5 rounded-2xl border p-4" style={{ borderColor: COLORS.line }}>
        <div className="flex items-center justify-between">
          <button onClick={handleStart} className="rounded-full bg-black px-5 py-3 text-sm font-medium text-white">Empezar ahora</button>
          <div className="text-sm text-black/60">Día {dayIndex} / 21</div>
        </div>

        {justStarted && (
          <div className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
            ¡Enhorabuena por tu primer día del reto!
          </div>
        )}

        <div className="mt-4">
          <div className="h-3 w-full rounded-full bg-gray-200">
            <div className="h-3 rounded-full bg-black transition-all" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-1 text-right text-xs text-black/60">{progress}%</div>
        </div>
      </div>
    </div>
  );
}

/* ===== Mi Zona (habit tracker) ===== */
function MiZona() {
  const [, setTick] = useState(0);
  const store = loadStore();
  const active = Object.keys(store).filter((k) => PROGRAMS[k]);
  const bump = () => setTick((v) => v + 1);

  if (active.length === 0) {
    return (
      <div className="py-6">
        <h2 className="text-xl font-semibold">Mi Zona</h2>
        <p className="mt-1 text-sm text-black/70">Aún no has empezado ningún programa. Ve a “Hábitos” o “Inicio” y toca un hábito para comenzarlo.</p>
      </div>
    );
  }

  return (
    <div className="py-6">
      <h2 className="text-xl font-semibold">Mi Zona</h2>
      <p className="mt-1 text-sm text-black/70">Marca tu progreso diario. Puedes llevar varios programas a la vez.</p>

      <div className="mt-4 space-y-3">
        {active.map((key) => {
          const p = PROGRAMS[key];
          const day = getProgramDayIndex(key);
          const tasks = p.days[day - 1]?.tasks ?? [];
          const done = isTodayCompleted(key);

          return (
            <div key={key} className="overflow-hidden rounded-2xl border" style={{ borderColor: COLORS.line }}>
              {/* Fila 1 (blanca): nombre del programa */}
              <div className="bg-white px-4 py-3">
                <div className="text-sm text-black/60">Programa</div>
                <div className="text-base font-semibold">{p.name}</div>
              </div>

              {/* Fila 2 (gris): tareas del día + check */}
              <div className="bg-[#f7f7f7] px-4 py-3">
                <div className="mb-2 text-sm text-black/60">Hábito del día (Día {day}/21)</div>
                <ul className="mb-3 list-disc pl-5 text-sm text-black/80">
                  {tasks.map((t, i) => (<li key={i}>{t}</li>))}
                </ul>

                <button onClick={() => { toggleTodayComplete(key); bump(); }} className="inline-flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full border"
                        style={{ borderColor: done ? 'transparent' : '#c7c7c7', background: done ? '#22c55e' : 'transparent' }}>
                    {done && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path d="M20 6L9 17l-5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </span>
                  <span className="text-sm font-medium">{done ? '¡Marcado hoy!' : 'Marcar completado hoy'}</span>
                </button>
              </div>

              {/* Pie: progreso */}
              <div className="flex items-center justify-between bg-white px-4 py-3">
                <div className="text-xs text-black/60">Progreso</div>
                <div className="flex-1 px-3">
                  <div className="h-2 w-full rounded-full bg-gray-200">
                    <div className="h-2 rounded-full bg-black" style={{ width: `${getProgressPercent(key)}%` }} />
                  </div>
                </div>
                <div className="text-xs text-black/60">{getProgressPercent(key)}%</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ===== Página principal ===== */
export default function Page() {
  const [tab, setTab] = useState<TabKey>('inicio');
  const [selectedHabit, setSelectedHabit] = useState<string | null>(null);

  // Splash 1.5s
  const [showSplash, setShowSplash] = useState(true);
  useEffect(() => { const t = setTimeout(() => setShowSplash(false), 1500); return () => clearTimeout(t); }, []);

  // Pensamiento del día (1 vez/día)
  const thought = useMemo(() => todayThought(), []);
  const [openThought, setOpenThought] = useState(false);
  useEffect(() => {
    if (showSplash) return;
    const key = `thought_${new Date().toDateString()}`;
    if (!localStorage.getItem(key)) { setOpenThought(true); localStorage.setItem(key, 'shown'); }
  }, [showSplash]);

  if (showSplash) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: COLORS.accent }}>
        <div className="relative w-screen" style={{ height: 0, paddingBottom: '177.78%' }}>
          <Image src="/splash.jpg" alt="Build your habits" fill className="object-cover" priority />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: COLORS.bg, color: COLORS.text }}>
      <SafeContainer>
        {/* INICIO */}
        {tab === 'inicio' && (
          <div className="py-6">
            {!selectedHabit ? (
              <>
                {/* Cabecera */}
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h1 className="text-lg font-semibold">Pensamiento del día</h1>
                    <p className="text-xs text-black/60">{thought.title}: toca para leerlo de nuevo</p>
                  </div>
                  <button onClick={() => setOpenThought(true)} className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white">Ver pensamiento</button>
                </div>

                {/* Cards a sangre */}
                <div className="-mx-4">
                  {FEATURED_HABITS.map((h) => (
                    <div key={h.key}>
                      <HabitCard data={h} onOpen={(key) => setSelectedHabit(key)} />
                    </div>
                  ))}
                </div>

                {/* CTA final */}
                <div className="mt-6 overflow-hidden rounded-2xl bg-white">
                  <div className="p-5">
                    <div className="mb-3 text-2xl font-bold leading-snug">
                      ¿Listo para más? <br /> Descubre todos los hábitos
                    </div>
                    <button onClick={() => setTab('habitos')} className="inline-flex items-center gap-2 rounded-full bg-black px-5 py-3 text-white">
                      Ver hábitos <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <HabitDetail
                program={PROGRAMS[selectedHabit] ?? READING_PROGRAM}
                onBack={() => setSelectedHabit(null)}
                onStarted={() => {}}
              />
            )}
          </div>
        )}

        {/* HÁBITOS */}
        {tab === 'habitos' && (
          <div className="py-6">
            {!selectedHabit ? (
              <>
                <h2 className="text-xl font-semibold">Hábitos</h2>
                <p className="mt-1 text-sm text-black/70">Explora programas para instaurar o eliminar hábitos.</p>
                <div className="mt-4 -mx-4">
                  {FEATURED_HABITS.map((h) => (
                    <div key={h.key}>
                      <HabitCard data={h} onOpen={(key) => setSelectedHabit(key)} />
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <HabitDetail program={PROGRAMS[selectedHabit] ?? READING_PROGRAM} onBack={() => setSelectedHabit(null)} onStarted={() => {}} />
            )}
          </div>
        )}

        {/* MI ZONA */}
        {tab === 'mizona' && <MiZona />}

        {/* Placeholders */}
        {tab === 'formacion' && (
          <div className="py-6">
            <h2 className="text-xl font-semibold">Formación</h2>
            <p className="mt-1 text-sm text-black/70">Cursos cortos por pilares: Salud, Bienestar emocional y Finanzas.</p>
          </div>
        )}
        {tab === 'amigos' && (
          <div className="py-6">
            <h2 className="text-xl font-semibold">Amigos</h2>
            <p className="mt-1 text-sm text-black/70">Comparte retos y rachas con tu gente.</p>
          </div>
        )}
      </SafeContainer>

      <BottomNav active={tab} onChange={setTab} />
      <ThoughtModal open={openThought} onClose={() => setOpenThought(false)} thought={thought} />
    </div>
  );
}
