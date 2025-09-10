'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Bookmark, BookmarkCheck, ChevronRight } from 'lucide-react';

/* ===========================
   Tipos y constantes
   =========================== */
type ProgramType = 'good' | 'bad';
type Category = 'salud' | 'bienestar' | 'productividad' | 'malos-habitos';

type Program = {
  id: string;
  slug: string;
  title: string;
  description: string;
  days: number;
  type: ProgramType;
  category: Category;
  thumbnail?: string; // opcional
};

const LS_SAVED = 'akira_saved_programs_v1';
const LS_ACTIVE = 'akira_programs_active_v1'; // ya lo usas en la app

// Datos demo (puedes moverlos a src/data más adelante)
const ALL_PROGRAMS: Program[] = [
  {
    id: 'read-30',
    slug: 'conviertete-en-lector',
    title: 'Conviértete en lector',
    description:
      'Programa basado en neurociencia con tareas diarias para que disfrutes del proceso de convertirte en lector',
    days: 30,
    type: 'good',
    category: 'productividad',
    thumbnail: '/images/programs/reading.jpg', // si no existe, renderizamos un color neutro
  },
  {
    id: 'morning-21',
    slug: 'mananas-activas',
    title: 'Mañanas activas',
    description:
      'Rutina guiada para construir mañanas con enfoque y energía desde el primer minuto',
    days: 21,
    type: 'good',
    category: 'bienestar',
    thumbnail: '/images/programs/morning.jpg',
  },
  {
    id: 'quit-smoking-90',
    slug: 'deja-de-ser-fumador',
    title: 'Deja de ser fumador',
    description:
      'Programa basado en neurociencia con tareas diarias para que elimines el tabaco de tu vida',
    days: 90,
    type: 'bad',
    category: 'malos-habitos',
    thumbnail: '/images/programs/quit.jpg',
  },
  {
    id: 'sugar-30',
    slug: 'desafio-azucar',
    title: 'Menos azúcar en 30 días',
    description:
      'Plan amable y progresivo para reducir el azúcar y estabilizar energía y antojos',
    days: 30,
    type: 'bad',
    category: 'salud',
    thumbnail: '/images/programs/sugar.jpg',
  },
];

/* ===========================
   Utils localStorage
   =========================== */
function loadSaved(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(LS_SAVED);
    const arr = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(arr);
  } catch {
    return new Set();
  }
}
function saveSaved(setIds: Set<string>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LS_SAVED, JSON.stringify(Array.from(setIds)));
}
function loadActiveCount(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(LS_ACTIVE);
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.length;
    if (typeof parsed === 'object' && parsed) return Object.keys(parsed).length;
    return 0;
  } catch {
    return 0;
  }
}

/* ===========================
   Componentes UI
   =========================== */
function SectionTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-3">
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      {subtitle && (
        <p className="text-sm text-neutral-500 mt-1">{subtitle}</p>
      )}
    </div>
  );
}

function SoonModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl p-5 w-[90%] max-w-md shadow-lg">
        <h3 className="text-lg font-semibold">Próximamente</h3>
        <p className="text-sm text-neutral-600 mt-2">
          Estamos terminando esta sección. Muy pronto podrás explorar todos los
          programas aquí.
        </p>
        <button
          onClick={onClose}
          className="mt-4 w-full rounded-xl border border-neutral-200 py-2 text-sm font-medium hover:bg-neutral-50 active:scale-[0.99] transition"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}

function ProgramCard({
  program,
  saved,
  onToggleSave,
}: {
  program: Program;
  saved: boolean;
  onToggleSave: (id: string) => void;
}) {
  return (
    <div className="w-full flex items-start gap-3 py-3">
      {/* Thumb */}
      <div className="w-24 h-24 shrink-0 rounded-xl overflow-hidden bg-neutral-100">
        {program.thumbnail ? (
          <Image
            src={program.thumbnail}
            alt={program.title}
            width={128}
            height={128}
            className="w-full h-full object-cover"
            priority={false}
          />
        ) : (
          <div className="w-full h-full" />
        )}
      </div>

      {/* Texto */}
      <div className="flex-1 min-w-0">
        <h4 className="text-[15px] font-semibold leading-snug">
          {program.title}
        </h4>
        <p className="text-[13px] text-neutral-500 mt-1 leading-snug">
          {program.description}
        </p>
        <p className="text-[12px] text-neutral-400 mt-2">{program.days} días</p>
      </div>

      {/* Guardar */}
      <button
        aria-label={saved ? 'Quitar de guardados' : 'Guardar programa'}
        onClick={() => onToggleSave(program.id)}
        className="p-2 rounded-full hover:bg-neutral-100 active:scale-95 transition"
      >
        {saved ? (
          <BookmarkCheck className="w-5 h-5" />
        ) : (
          <Bookmark className="w-5 h-5" />
        )}
      </button>
    </div>
  );
}

/* ===========================
   Página
   =========================== */
export default function HabitosPage() {
  const [query, setQuery] = useState('');
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [activeCount, setActiveCount] = useState<number>(0);
  const [soonOpen, setSoonOpen] = useState(false);

  useEffect(() => {
    setSaved(loadSaved());
    setActiveCount(loadActiveCount());
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ALL_PROGRAMS;
    return ALL_PROGRAMS.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
  }, [query]);

  const good = filtered.filter((p) => p.type === 'good');
  const bad = filtered.filter((p) => p.type === 'bad');

  const toggleSave = (id: string) => {
    const next = new Set(saved);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSaved(next);
    saveSaved(next);
  };

  const allCount = ALL_PROGRAMS.length;
  const savedCount = saved.size;

  return (
    <div className="px-4 pb-28 pt-4 bg-white">
      {/* Título + buscador */}
      <h1 className="text-3xl font-semibold tracking-tight mb-3">Programas</h1>
      <div className="mb-6">
        <label className="sr-only" htmlFor="search">
          Buscar programas
        </label>
        <input
          id="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar programas…"
          className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-[15px] outline-none focus:ring-2 focus:ring-black/10"
        />
      </div>

      {/* Sección 1: buenos hábitos */}
      <SectionTitle
        title="Programas para buenos hábitos"
        subtitle="Programas basados en neurociencia para que los buenos hábitos formen parte de ti"
      />
      <div className="divide-y divide-neutral-100">
        {good.map((p) => (
          <ProgramCard
            key={p.id}
            program={p}
            saved={saved.has(p.id)}
            onToggleSave={toggleSave}
          />
        ))}
      </div>
      <button
        onClick={() => setSoonOpen(true)}
        className="mt-2 mb-8 inline-flex items-center gap-1 text-sm font-medium text-neutral-600 hover:text-black"
      >
        Ver todo <ChevronRight className="w-4 h-4" />
      </button>

      {/* Sección 2: malos hábitos */}
      <SectionTitle
        title="Programas para eliminar malos hábitos"
        subtitle="Programas amables basados en neurociencia para eliminar los malos hábitos de una vez por todas"
      />
      <div className="divide-y divide-neutral-100">
        {bad.map((p) => (
          <ProgramCard
            key={p.id}
            program={p}
            saved={saved.has(p.id)}
            onToggleSave={toggleSave}
          />
        ))}
      </div>
      <button
        onClick={() => setSoonOpen(true)}
        className="mt-2 mb-8 inline-flex items-center gap-1 text-sm font-medium text-neutral-600 hover:text-black"
      >
        Ver todo <ChevronRight className="w-4 h-4" />
      </button>

      {/* Sección 3: Por categoría */}
      <SectionTitle title="Por categoría" />
      <div className="grid grid-cols-2 gap-3 mb-10">
        {[
          { label: 'Salud', cat: 'salud' as const, img: '/images/cat/health.jpg' },
          { label: 'Bienestar', cat: 'bienestar' as const, img: '/images/cat/wellbeing.jpg' },
          { label: 'Productividad', cat: 'productividad' as const, img: '/images/cat/productivity.jpg' },
          { label: 'Malos hábitos', cat: 'malos-habitos' as const, img: '/images/cat/badhabits.jpg' },
        ].map((c) => (
          <button
            key={c.cat}
            onClick={() => setSoonOpen(true)}
            className="relative rounded-2xl overflow-hidden h-28 w-full text-left active:scale-[0.99] transition"
          >
            {c.img ? (
              <Image
                src={c.img}
                alt={c.label}
                width={640}
                height={320}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-neutral-100" />
            )}
            <div className="absolute inset-0 bg-black/25" />
            <div className="absolute left-3 bottom-2 text-white text-lg font-semibold drop-shadow">
              {c.label}
            </div>
          </button>
        ))}
      </div>

      {/* Sección 4: Tus programas */}
      <SectionTitle title="Tus programas" />
      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={() => setSoonOpen(true)}
          className="rounded-2xl border border-neutral-200 p-3 text-left hover:bg-neutral-50 active:scale-[0.99] transition"
        >
          <div className="text-[13px] font-medium">Guardado</div>
          <div className="text-neutral-500 text-[12px] mt-1">
            {savedCount} programas
          </div>
        </button>

        <button
          onClick={() => setSoonOpen(true)}
          className="rounded-2xl border border-neutral-200 p-3 text-left hover:bg-neutral-50 active:scale-[0.99] transition"
        >
          <div className="text-[13px] font-medium">Programas activos</div>
          <div className="text-neutral-500 text-[12px] mt-1">
            {activeCount} activos
          </div>
        </button>

        <Link
          href="/404"
          className="rounded-2xl border border-neutral-200 p-3 text-left hover:bg-neutral-50 active:scale-[0.99] transition"
        >
          <div className="text-[13px] font-medium">Todos los programas</div>
          <div className="text-neutral-500 text-[12px] mt-1">
            {allCount} en total
          </div>
        </Link>
      </div>

      <SoonModal open={soonOpen} onClose={() => setSoonOpen(false)} />
    </div>
  );
}
