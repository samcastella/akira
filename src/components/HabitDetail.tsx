'use client';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { COLORS } from '@/lib/constants';
import { ProgramDef, getProgressPercent, getRelativeDayIndexForDate, startProgram } from '@/lib/programs';
import { todayKey } from '@/lib/date';

export default function HabitDetail({
  program, onBack, onStarted,
}: { program: ProgramDef; onBack: () => void; onStarted: () => void; }) {
  const [openedHow, setOpenedHow] = useState(false);
  const [justStarted, setJustStarted] = useState(false);
  const [progress, setProgress] = useState(getProgressPercent(program.key));
  const dayIndex = getRelativeDayIndexForDate(program.key, todayKey()) || 1;

  useEffect(() => {
    const id = setInterval(() => setProgress(getProgressPercent(program.key)), 800);
    return () => clearInterval(id);
  }, [program.key]);

  const handleStart = () => { startProgram(program.key); setJustStarted(true); setProgress(getProgressPercent(program.key)); onStarted(); };

  return (
    <div className="pb-6">
      <div className="relative w-full overflow-hidden rounded-b-2xl" style={{ height: 0, paddingBottom: '56.25%', backgroundColor: '#111' }}>
        <Image src={program.image} alt={program.name} fill className="object-cover" priority />
        <div className="absolute left-3 top-3">
          <button onClick={onBack} className="rounded-full bg-black/60 p-2 text-white"><ArrowLeft className="h-5 w-5" /></button>
        </div>
      </div>

      <div className="mt-4">
        <h1 className="text-3xl font-black leading-tight">{program.name}</h1>
        <p className="mt-2 text-sm text-black/70">Beneficios:</p>
        <ul className="mt-2 list-disc pl-5 text-sm text-black/80">{program.benefits.map((b, i) => (<li key={i}>{b}</li>))}</ul>
      </div>

      <div className="mt-4 rounded-2xl border" style={{ borderColor: COLORS.line }}>
        <button onClick={() => setOpenedHow(!openedHow)} className="flex w-full items-center justify-between px-4 py-3">
          <span className="text-base font-medium">¿Cómo funciona?</span>
          {openedHow ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </button>
        <AnimatePresence>
          {openedHow && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
              <ul className="space-y-2 px-4 pb-4 text-sm text-black/70">{program.howItWorks.map((it, i) => (<li key={i}>• {it}</li>))}</ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-5 rounded-2xl border p-4" style={{ borderColor: COLORS.line }}>
        <div className="flex items-center justify-between">
          <button onClick={handleStart} className="rounded-full bg-black px-5 py-3 text-sm font-medium text-white">Empieza ahora</button>
          <div className="text-sm text-black/60">Día {dayIndex} / {program.days.length}</div>
        </div>
        {justStarted && <div className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">¡Enhorabuena por tu primer día del reto!</div>}
        <div className="mt-4">
          <div className="h-3 w-full rounded-full bg-gray-200"><div className="h-3 rounded-full bg-black transition-all" style={{ width: `${progress}%` }} /></div>
          <div className="mt-1 text-right text-xs text-black/60">{progress}%</div>
        </div>
      </div>
    </div>
  );
}
