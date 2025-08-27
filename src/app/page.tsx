'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import {
  Home, ListChecks, User, GraduationCap, Users, X, ChevronRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Archivo_Black } from 'next/font/google';

/* ===== Tipografía para títulos de cards ===== */
const archivoBlack = Archivo_Black({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-archivo-black',
});

/* ===== Colores ===== */
const COLORS = {
  bg: '#ffffff',
  text: '#111111',
  accent: '#FFD54F', // amarillo barra
  black: '#000000',
};

type TabKey = 'inicio' | 'habitos' | 'mizona' | 'formacion' | 'amigos';

/* ===== Pensamientos (L→D) ===== */
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

/* ===== Hábitos destacados ===== */
interface HabitCardData {
  key: string;
  title: string;
  subtitle: string;
  image: string; // ruta pública en /public
}

const FEATURED_HABITS: HabitCardData[] = [
  { key: 'lectura',    title: 'La máquina lectora',      subtitle: 'Conviértete en un superlector',                      image: '/reading.jpg' },
  { key: 'burpees',    title: 'Unos f*kn burpees',       subtitle: 'Comienza hoy y no pares',                            image: '/burpees.jpg' },
  { key: 'ahorro',     title: 'Ahorra sin darte cuenta', subtitle: 'Un hábito pequeño que cambia tu futuro',            image: '/savings.jpg' },
  { key: 'meditacion', title: 'Medita 5 minutos',        subtitle: 'Encuentra calma en tu día',                         image: '/meditation.jpg' },
];

/* ===== Layout helpers ===== */
const NAV_HEIGHT = 84; // px (≈ +30 %)

function SafeContainer({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mx-auto w-full max-w-md px-4"
      style={{ paddingBottom: `calc(${NAV_HEIGHT}px + env(safe-area-inset-bottom, 0px))` }}
    >
      {children}
    </div>
  );
}

/* ===== Bottom Nav ===== */
function BottomNav({
  active,
  onChange,
}: {
  active: TabKey;
  onChange: (k: TabKey) => void;
}) {
  const items: { key: TabKey; label: string; icon: React.ElementType }[] = [
    { key: 'inicio',    label: 'Inicio',     icon: Home },
    { key: 'habitos',   label: 'Hábitos',    icon: ListChecks },
    { key: 'mizona',    label: 'Mi zona',    icon: User },             // especial
    { key: 'formacion', label: 'Formación',  icon: GraduationCap },
    { key: 'amigos',    label: 'Amigos',     icon: Users },
  ];

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30"
      style={{
        height: `calc(${NAV_HEIGHT}px + env(safe-area-inset-bottom, 0px))`,
        background: COLORS.accent,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="mx-auto grid h-full max-w-md grid-cols-5">
        {items.map(({ key, label, icon: Icon }) => {
          const isActive = key === active;

          // Fondo y color por pestaña
          let bg = COLORS.accent;
          let fg = COLORS.text;

          if (key === 'mizona') {
            bg = isActive ? '#ffffff' : COLORS.black;
            fg = isActive ? COLORS.text : '#ffffff';
          } else {
            bg = isActive ? '#ffffff' : COLORS.accent;
            fg = COLORS.text;
          }

          return (
            <button
              key={key}
              onClick={() => onChange(key)}
              className="flex h-full flex-col items-center justify-center transition-colors"
              style={{ background: bg, color: fg }}
              aria-label={label}
            >
              <Icon className="h-6 w-6" />
              <span className="mt-1 text-[12px] leading-none">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ===== Modal Pensamiento ===== */
function ThoughtModal({
  open,
  onClose,
  thought,
}: {
  open: boolean;
  onClose: () => void;
  thought: Thought;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="flex h-full items-center justify-center p-6">
            <motion.div
              className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
            >
              <button
                onClick={onClose}
                className="absolute right-3 top-3 rounded-full p-1 text-black/70 hover:bg-black/5"
                aria-label="Cerrar"
              >
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

/* ===== Card de hábito (4:5, full-bleed, sin recuadro) ===== */
function HabitCard({
  data,
  onStart,
}: {
  data: HabitCardData;
  onStart: (key: string) => void;
}) {
  return (
    <div className="relative overflow-hidden">
      {/* Contenedor con aspect-ratio 4/5 para que todas midan igual */}
      <div className="relative w-full" style={{ aspectRatio: '4 / 5' }}>
        <Image
          src={data.image}
          alt={data.title}
          fill
          sizes="(max-width: 768px) 100vw, 600px"
          className="object-cover"
          priority={false}
        />
        {/* Overlay para legibilidad */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-black/0" />
      </div>

      {/* Texto dentro de la imagen */}
      <div className="absolute inset-0 flex flex-col justify-end p-5">
        <div className="text-white/85 text-sm">{data.subtitle}</div>
        <div className={`${archivoBlack.className} text-white text-4xl leading-tight`}>
          {data.title}
        </div>
        <button
          onClick={() => onStart(data.key)}
          className="mt-3 inline-flex items-center gap-2 self-start rounded-full bg-white/95 px-4 py-2 text-sm font-medium text-black hover:bg-white"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7L8 5z"/></svg>
          Empezar ahora
        </button>
      </div>
    </div>
  );
}

/* ===== Página ===== */
export default function Page() {
  const [tab, setTab] = useState<TabKey>('inicio');

  // Splash 1.5s
  const [showSplash, setShowSplash] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setShowSplash(false), 1500);
    return () => clearTimeout(t);
  }, []);

  // Pensamiento del día (1 vez/día)
  const thought = useMemo(() => todayThought(), []);
  const [openThought, setOpenThought] = useState(false);
  useEffect(() => {
    if (showSplash) return;
    const key = `thought_${new Date().toDateString()}`;
    const shown = localStorage.getItem(key);
    if (!shown) {
      setOpenThought(true);
      localStorage.setItem(key, 'shown');
    }
  }, [showSplash]);

  if (showSplash) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: COLORS.accent }}>
        <div className="relative h-screen w-screen">
          <Image src="/splash.jpg" alt="Build your habits" fill className="object-cover" priority />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: COLORS.bg, color: COLORS.text }}>
      <SafeContainer>
        {tab === 'inicio' && (
          <div className="py-6">
            {/* Cabecera */}
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h1 className="text-lg font-semibold">Pensamiento del día</h1>
                <p className="text-xs text-black/60">{thought.title}: toca para leerlo de nuevo</p>
              </div>
              <button
                onClick={() => setOpenThought(true)}
                className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white"
              >
                Ver pensamiento
              </button>
            </div>

            {/* Cards a sangre (sin huecos laterales) */}
            <div className="-mx-4">
              {FEATURED_HABITS.map((h) => (
                <div key={h.key}>
                  <HabitCard data={h} onStart={(key) => alert(`Abrir programa: ${key}`)} />
                </div>
              ))}
            </div>

            {/* CTA final */}
            <div className="mt-6 overflow-hidden rounded-2xl bg-white">
              <div className="p-5">
                <div className="mb-3 text-2xl font-bold leading-snug">
                  ¿Listo para más? <br /> Descubre todos los hábitos
                </div>
                <button
                  onClick={() => setTab('habitos')}
                  className="inline-flex items-center gap-2 rounded-full bg-black px-5 py-3 text-white"
                >
                  Ver hábitos <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === 'habitos' && (
          <div className="py-6">
            <h2 className="text-xl font-semibold">Hábitos</h2>
            <p className="mt-1 text-sm text-black/70">Explora programas para instaurar o eliminar hábitos.</p>
            <div className="mt-4 -mx-4">
              {FEATURED_HABITS.map((h) => (
                <div key={h.key}>
                  <HabitCard data={h} onStart={(key) => alert(`Abrir programa: ${key}`)} />
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'mizona' && (
          <div className="py-6">
            <h2 className="text-xl font-semibold">Mi Zona</h2>
            <p className="mt-1 text-sm text-black/70">Tu progreso, rachas y objetivos.</p>
          </div>
        )}

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


