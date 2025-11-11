'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Bookmark, BookmarkCheck, ChevronRight } from 'lucide-react';
import SubHeaderTabs from '@/components/nav/SubHeaderTabs';

// Registro central de programas
import {
  PROGRAMS,
  AVAILABLE_PROGRAM_SLUGS,
  toIndexCard,
  type ThematicCategory,
} from '@/data/programs';

// ✅ Fuente única de verdad para programas activos en local
import { loadActive } from '@/lib/programsLocal';

/* ===========================
   Tipos y constantes
   =========================== */
type ProgramType = 'good' | 'bad';
type Category = ThematicCategory;

type Program = {
  id: string;
  slug: string; // ruta: /programas/{slug}
  title: string;
  description: string;
  days: number;
  type: ProgramType; // bloque principal: good/bad
  categories: Category[]; // temáticas (pueden ser varias)
  thumbnail?: string;
};

const LS_SAVED = 'akira_saved_programs_v1';

/* Construimos ALL_PROGRAMS desde el registro central */
const ALL_PROGRAMS: Program[] = PROGRAMS.map(toIndexCard) as Program[];

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
  const store = loadActive(); // { [slug]: LocalProgram }
  return store && typeof store === 'object' ? Object.keys(store).length : 0;
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
      {subtitle && <p className="text-sm text-neutral-500 mt-1">{subtitle}</p>}
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
  const isAvailable = AVAILABLE_PROGRAM_SLUGS.has(program.slug);
  const href = isAvailable ? `/programas/${program.slug}` : '/404';

  return (
    <Link href={href} className="w-full flex items-start gap-3 py-3">
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
        type="button"
        aria-label={saved ? 'Quitar de guardados' : 'Guardar programa'}
        onClick={(e) => {
          e.preventDefault();
          onToggleSave(program.id);
        }}
        className="p-2 rounded-full hover:bg-neutral-100 active:scale-95 transition"
      >
        {saved ? <BookmarkCheck className="w-5 h-5" /> : <Bookmark className="w-5 h-5" />}
      </button>
    </Link>
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

  // Solo “existen” los programas cuyo slug está marcado como available en el registro
  const existingPrograms = useMemo(
    () => ALL_PROGRAMS.filter((p) => AVAILABLE_PROGRAM_SLUGS.has(p.slug)),
    []
  );

  const filtered = useMemo(() => {
    const base = existingPrograms; // solo los ya hechos
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter((p) => {
      const inText =
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q);
      const inCats = p.categories.some((c) => c.toLowerCase().includes(q));
      return inText || inCats;
    });
  }, [query, existingPrograms]);

  const good = filtered.filter((p) => p.type === 'good');
  const bad = filtered.filter((p) => p.type === 'bad');

  const toggleSave = (id: string) => {
    const next = new Set(saved);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSaved(next);
    saveSaved(next);
  };

  const allCount = existingPrograms.length;
  const savedCount = saved.size;

  return (
    <div className="bg-white">
      {/* ✅ Submenú NUEVO */}
      <SubHeaderTabs
        tabs={[
          { href: '/habitos', label: 'Hábitos' },
          { href: '/habitos/herramientas', label: 'Herramientas' },
          { href: '/habitos/crear', label: 'Crear programa' },
        ]}
      />

      {/* ⬇️ Tu contenido original SIN cambios */}
      <div className="px-4 pb-28 pt-4">
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
            className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-[16px] outline-none focus:ring-2 focus:ring-black/10"
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
          {bad.length === 0 ? (
            <p className="text-sm text-neutral-500 py-2">Próximamente</p>
          ) : (
            bad.map((p) => (
              <ProgramCard
                key={p.id}
                program={p}
                saved={saved.has(p.id)}
                onToggleSave={toggleSave}
              />
            ))
          )}
        </div>
        <button
          onClick={() => setSoonOpen(true)}
          className="mt-2 mb-8 inline-flex items-center gap-1 text-sm font-medium text-neutral-600 hover:text-black"
        >
          Ver todo <ChevronRight className="w-4 h-4" />
        </button>

        {/* Sección 3: Por categoría */}
        <SectionTitle title="Por categoría" />
        <div className="grid grid-cols-1 gap-3 mb-10">
          {[
            { label: 'Salud', cat: 'salud' as const, img: '/images/cat/health.jpg' },
            { label: 'Bienestar', cat: 'bienestar' as const, img: '/images/cat/wellbeing.jpg' },
            { label: 'Productividad', cat: 'productividad' as const, img: '/images/cat/productivity.jpg' },
            { label: 'Malos hábitos', cat: 'malos-habitos' as const, img: '/images/cat/badhabits.jpg' },
          ].map((c) => (
            <Link
              key={c.cat}
              href="/404"
              className="relative overflow-hidden h-28 w-full text-left active:scale-[0.99] transition"
            >
              <Image
                src={c.img}
                alt={c.label}
                width={1920}
                height={640}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/25" />
              <div className="absolute left-3 bottom-2 text-white text-lg font-semibold drop-shadow">
                {c.label}
              </div>
            </Link>
          ))}
        </div>

        {/* Sección 4: Tus programas */}
        <SectionTitle title="Tus programas" />
        <div className="grid grid-cols-3 gap-3 items-start">
          {/* Guardado */}
          <button
            onClick={() => setSoonOpen(true)}
            className="block rounded-2xl p-2 text-left active:scale-[0.99] transition"
          >
            <div className="w-full aspect-square rounded-xl overflow-hidden mb-2">
              <Image
                src="/images/ui/programs-saved.jpg"
                alt="Programas guardados"
                width={1000}
                height={1000}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="text-[13px] font-medium">Guardado</div>
            <div className="text-neutral-500 text-[12px] mt-1">
              {savedCount} programas
            </div>
          </button>

          {/* Activos */}
          <button
            onClick={() => setSoonOpen(true)}
            className="block rounded-2xl p-2 text-left active:scale-[0.99] transition"
          >
            <div className="w-full aspect-square rounded-xl overflow-hidden mb-2">
              <Image
                src="/images/ui/programs-active.jpg"
                alt="Programas activos"
                width={1000}
                height={1000}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="text-[13px] font-medium">Programas activos</div>
            <div className="text-neutral-500 text-[12px] mt-1">
              {activeCount} activos
            </div>
          </button>

          {/* Todos */}
          <Link
            href="/404"
            className="block rounded-2xl p-2 text-left active:scale-[0.99] transition"
          >
            <div className="w-full aspect-square rounded-xl overflow-hidden mb-2">
              <Image
                src="/images/ui/programs-all.jpg"
                alt="Todos los programas"
                width={1000}
                height={1000}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="text-[13px] font-medium">Todos los programas</div>
            <div className="text-neutral-500 text-[12px] mt-1">
              {allCount} en total
            </div>
          </Link>
        </div>
      </div>

      <SoonModal open={soonOpen} onClose={() => setSoonOpen(false)} />
    </div>
  );
}
