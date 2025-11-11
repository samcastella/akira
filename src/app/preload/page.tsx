// src/app/preload/page.tsx
'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/* ================== Wrapper con Suspense ================== */
export default function PreloadPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-[100svh] grid place-items-center bg-white px-6">
          <div className="w-full max-w-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-9 h-9 rounded-full bg-black/90 text-white grid place-items-center font-bold">A</div>
              <div>
                <h1 className="text-base font-semibold">Akira</h1>
                <p className="text-xs text-neutral-500">Preparando…</p>
              </div>
            </div>
            <div className="w-full h-2 rounded-full bg-neutral-200 overflow-hidden">
              <div className="h-full bg-black w-2/5 animate-pulse" />
            </div>
          </div>
        </main>
      }
    >
      <PreloadClient />
    </Suspense>
  );
}

/* ================== Client component real ================== */

type Step =
  | 'auth'
  | 'profile'
  | 'localPrograms'
  | 'localPoints'
  | 'rpcPoints'
  | 'rpcRank'
  | 'rpcStreak'
  | 'preloadImages'
  | 'done';

const STEP_LABEL: Record<Step, string> = {
  auth: 'Iniciando sesión…',
  profile: 'Cargando tu perfil…',
  localPrograms: 'Leyendo tus programas…',
  localPoints: 'Calculando puntos locales…',
  rpcPoints: 'Consultando puntuación global…',
  rpcRank: 'Consultando ranking…',
  rpcStreak: 'Calculando racha…',
  preloadImages: 'Preparando imágenes…',
  done: '¡Listo!',
};

const STEPS_ORDER: Step[] = [
  'auth',
  'profile',
  'localPrograms',
  'localPoints',
  'rpcPoints',
  'rpcRank',
  'rpcStreak',
  'preloadImages',
  'done',
];

const MIN_MS = 800;
const MAX_MS = 2500;

function PreloadClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const redirect = useMemo(
    () => sp.get('redirect') || '/mizona/resumen',
    [sp]
  );

  const flagEnabled = useMemo(() => {
    const v = process.env.NEXT_PUBLIC_BOOT_PRELOAD;
    return v === undefined || v === null ? true : v !== '0';
  }, []);

  const [step, setStep] = useState<Step>('auth');
  const [pct, setPct] = useState<number>(3);
  const startedRef = useRef<number>(Date.now());
  const finishedRef = useRef<boolean>(false);

  useEffect(() => {
    const idx = Math.max(0, STEPS_ORDER.indexOf(step));
    const p = Math.min(99, Math.round(((idx + 1) / STEPS_ORDER.length) * 100));
    setPct((prev) => (p > prev ? p : prev));
  }, [step]);

  useEffect(() => {
    let cancelled = false;

    const goNext = async () => {
      if (!flagEnabled) {
        router.replace(redirect);
        return;
      }

      startedRef.current = Date.now();

      let prewarmAll:
        | null
        | ((opt: {
            onStep: (s: Step) => void;
            onError?: (e: unknown) => void;
            signal?: AbortSignal;
          }) => Promise<void>) = null;

      try {
        const mod = await import('@/lib/boot/prewarm').catch(() => null as any);
        prewarmAll = mod?.prewarmAll ?? null;
      } catch {
        prewarmAll = null;
      }

      const advance = (s: Step) => {
        if (cancelled) return;
        setStep(s);
      };

      const finish = () => {
        if (cancelled || finishedRef.current) return;
        finishedRef.current = true;
        const elapsed = Date.now() - startedRef.current;
        const wait = Math.max(0, MIN_MS - elapsed);
        const capped = Math.min(wait, Math.max(0, MAX_MS - elapsed));
        setPct(100);
        setTimeout(() => {
          if (!cancelled) router.replace(redirect);
        }, capped);
      };

      if (prewarmAll) {
        try {
          await prewarmAll({
            onStep: (s) => advance(s as Step),
            onError: () => {},
          });
          finish();
        } catch {
          finish();
        }
      } else {
        // Fallback: simular pasos
        for (const s of STEPS_ORDER) {
          if (cancelled) return;
          advance(s);
          await new Promise((r) => setTimeout(r, 120));
        }
        finish();
      }
    };

    goNext();
    return () => {
      cancelled = true;
    };
  }, [flagEnabled, redirect, router]);

  return (
    <main className="min-h-[100svh] flex items-center justify-center bg-white px-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-full bg-black/90 text-white grid place-items-center font-bold">A</div>
          <div>
            <h1 className="text-base font-semibold">Akira</h1>
            <p className="text-xs text-neutral-500">Preparando tu experiencia…</p>
          </div>
        </div>

        <div className="w-full h-2 rounded-full bg-neutral-200 overflow-hidden">
          <div
            className="h-full bg-black transition-[width] duration-300 ease-out"
            style={{ width: `${pct}%` }}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            role="progressbar"
          />
        </div>

        <p className="mt-3 text-sm text-neutral-700">
          {STEP_LABEL[step] ?? 'Cargando…'}
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          Destino: <span className="font-medium">{redirect}</span>
        </p>

        <div className="mt-8 flex items-center justify-center">
          <div className="w-9 h-9 rounded-full border-2 border-neutral-300 border-t-black animate-spin" />
        </div>

        <div className="mt-8 text-[11px] text-neutral-400 text-center">
          Precarga habilitada ·{' '}
          <code>NEXT_PUBLIC_BOOT_PRELOAD={String(process.env.NEXT_PUBLIC_BOOT_PRELOAD ?? '1')}</code>
        </div>
      </div>
    </main>
  );
}
