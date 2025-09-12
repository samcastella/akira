'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { COLORS } from '@/lib/constants';
import {
  getProgress,
  startProgram,
  type ProgramDef,
} from '@/lib/programService';
import { supabase } from '@/lib/supabaseClient';

export default function HabitDetail({
  program,
  onBack,
  onStarted,
}: {
  program: ProgramDef; // viene del service: meta + howItWorks + daysDef
  onBack: () => void;
  onStarted: () => void;
}) {
  const [openedHow, setOpenedHow] = useState(false);
  const [justStarted, setJustStarted] = useState(false);
  const [progressPct, setProgressPct] = useState<number>(0);
  const [currentDay, setCurrentDay] = useState<number>(1);

  // Helpers UI
  const heroSrc =
    (program as any).image ||
    (program as any).imageSrc ||
    program.thumbnail ||
    '/images/programs/reading.jpg';
  const title = (program as any).name || program.title || 'Programa';
  const totalDays = program.days ?? program.daysDef?.length ?? 30;

  // Nota: algunos contenidos antiguos tienen arrays de beneficios/howItWorks.
  // Este componente es tolerante: si hay array lo pinta; si hay string, también.
  const benefits: string[] | undefined = (program as any).benefits;
  const howItWorksStr: string | undefined =
    typeof (program as any).howItWorks === 'string'
      ? (program as any).howItWorks
      : undefined;
  const howItWorksArr: string[] | undefined = Array.isArray(
    (program as any).howItWorks,
  )
    ? (program as any).howItWorks
    : undefined;

  // Carga de progreso inicial
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const userId = data.user?.id;
        if (!userId) return;

        const { daysCompleted, totalDays, currentDay } = await getProgress(
          supabase,
          userId,
          program.slug,
        );
        if (!alive) return;

        const pct = Math.round(
          (daysCompleted / Math.max(1, totalDays)) * 100,
        );
        setProgressPct(pct);
        setCurrentDay(currentDay || 1);
      } catch {
        // silencioso
      }
    })();
    return () => {
      alive = false;
    };
  }, [program.slug]);

  async function handleStart() {
    try {
      const { data } = await supabase.auth.getUser();
      const userId = data.user?.id;
      if (!userId) return;

      await startProgram(supabase, userId, program.slug);
      setJustStarted(true);

      // refrescar progreso tras iniciar
      const { daysCompleted, totalDays, currentDay } = await getProgress(
        supabase,
        userId,
        program.slug,
      );
      const pct = Math.round((daysCompleted / Math.max(1, totalDays)) * 100);
      setProgressPct(pct);
      setCurrentDay(currentDay || 1);

      onStarted();
    } catch {
      // opcional: toast de error
    }
  }

  return (
    <div className="pb-6">
      {/* Hero */}
      <div
        className="relative w-full overflow-hidden rounded-b-2xl"
        style={{ height: 0, paddingBottom: '56.25%', backgroundColor: '#111' }}
      >
        <Image
          src={heroSrc}
          alt={title}
          fill
          className="object-cover"
          priority
        />
        <div className="absolute left-3 top-3">
          <button
            onClick={onBack}
            className="rounded-full bg-black/60 p-2 text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Título + beneficios */}
      <div className="mt-4">
        <h1 className="text-3xl font-black leading-tight">{title}</h1>

        {Array.isArray(benefits) && benefits.length > 0 && (
          <>
            <p className="mt-2 text-sm text-black/70">Beneficios:</p>
            <ul className="mt-2 list-disc pl-5 text-sm text-black/80">
              {benefits.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* ¿Cómo funciona? */}
      {(howItWorksStr || (howItWorksArr && howItWorksArr.length > 0)) && (
        <div
          className="mt-4 rounded-2xl border"
          style={{ borderColor: COLORS.line }}
        >
          <button
            onClick={() => setOpenedHow(!openedHow)}
            className="flex w-full items-center justify-between px-4 py-3"
          >
            <span className="text-base font-medium">¿Cómo funciona?</span>
            {openedHow ? (
              <ChevronUp className="h-5 w-5" />
            ) : (
              <ChevronDown className="h-5 w-5" />
            )}
          </button>

          <AnimatePresence>
            {openedHow && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
              >
                {howItWorksArr ? (
                  <ul className="space-y-2 px-4 pb-4 text-sm text-black/70">
                    {howItWorksArr.map((it, i) => (
                      <li key={i}>• {it}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="space-y-2 px-4 pb-4 text-sm text-black/70">
                    {howItWorksStr?.split('\n').map((p, i) => (
                      <p key={i}>{p}</p>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* CTA + Progreso */}
      <div
        className="mt-5 rounded-2xl border p-4"
        style={{ borderColor: COLORS.line }}
      >
        <div className="flex items-center justify-between">
          <button
            onClick={handleStart}
            className="rounded-full bg-black px-5 py-3 text-sm font-medium text-white active:scale-[0.99]"
          >
            Empieza ahora
          </button>
          <div className="text-sm text-black/60">
            Día {currentDay} / {totalDays}
          </div>
        </div>

        {justStarted && (
          <div className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
            ¡Enhorabuena por tu primer día del reto!
          </div>
        )}

        <div className="mt-4">
          <div className="h-3 w-full rounded-full bg-gray-200">
            <div
              className="h-3 rounded-full bg-black transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="mt-1 text-right text-xs text-black/60">
            {progressPct}%
          </div>
        </div>
      </div>
    </div>
  );
}
