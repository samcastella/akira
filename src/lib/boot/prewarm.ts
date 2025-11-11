// src/lib/boot/prewarm.ts
'use client';

import { supabase } from '@/lib/supabaseClient';
import { loadActive } from '@/lib/programsLocal';
import {
  fetchGlobalProgramPoints,
  fetchMyMonthlyRank,
  fetchUserStreakDays,
  writePointsCache,
  writeRankCache,
} from '@/lib/programService';
import { pullProfile } from '@/lib/user'; // ⬅️ quitamos writeLocalProfile

/**
 * Tipo de callback para reportar pasos al preload.
 */
export type BootStep =
  | 'auth'
  | 'profile'
  | 'localPrograms'
  | 'localPoints'
  | 'rpcPoints'
  | 'rpcRank'
  | 'rpcStreak'
  | 'preloadImages'
  | 'done';

export interface BootOptions {
  onStep?: (s: BootStep) => void;
  onError?: (e: unknown) => void;
  signal?: AbortSignal;
}

/**
 * Precalienta datos clave de la app para que /mizona/resumen entre "caliente".
 * - Autenticación
 * - Perfil y programas locales
 * - Puntos, ranking y racha (RPC)
 * - Precache de imágenes
 */
export async function prewarmAll(opts: BootOptions = {}): Promise<void> {
  const { onStep, onError, signal } = opts;

  const safeStep = (s: BootStep) => {
    if (signal?.aborted) throw new Error('aborted');
    onStep?.(s);
  };

  const safeTry = async <T>(fn: () => Promise<T> | T, step: BootStep) => {
    try {
      safeStep(step);
      return await fn();
    } catch (e) {
      onError?.(e);
      console.warn(`[prewarm] ${step} failed`, e);
      return null as any;
    }
  };

  /* 1️⃣ AUTH */
  await safeTry(async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data;
  }, 'auth');

  /* 2️⃣ PERFIL (pull; si tu helper ya escribe en local, perfecto) */
  await safeTry(async () => {
    await pullProfile();
    // Si quisieras cachear aquí manualmente:
    // const p = await pullProfile();
    // if (p) localStorage.setItem('akira_user_profile_v2', JSON.stringify(p));
  }, 'profile');

  /* 3️⃣ PROGRAMAS LOCALES */
  await safeTry(async () => {
    loadActive(); // calienta localStorage
  }, 'localPrograms');

  /* 4️⃣ PUNTOS LOCALES (optimistas) */
  await safeTry(async () => {
    const actives = loadActive();
    let total = 0;
    for (const prog of Object.values(actives)) {
      const p: any = prog;
      const progress = p?.progress ?? {};
      Object.values(progress).forEach((day: any) => {
        if (day && typeof day === 'object') {
          total += Object.values(day).filter(Boolean).length;
        }
      });
    }
    writePointsCache({ total_points: total, _ts: Date.now() } as any);
  }, 'localPoints');

  /* 5️⃣ PUNTOS (RPC) */
  await safeTry(async () => {
    const now = new Date();
    const to = now.toISOString().slice(0, 10);
    const past = new Date(now);
    past.setDate(past.getDate() - 365);
    const from = past.toISOString().slice(0, 10);

    const res = await fetchGlobalProgramPoints(from, to);
    if (res) writePointsCache({ ...res, _ts: Date.now() } as any);
  }, 'rpcPoints');

  /* 6️⃣ RANKING (RPC) */
  await safeTry(async () => {
    const rank = await fetchMyMonthlyRank();
    if (rank && typeof rank.rank_month === 'number') {
      writeRankCache(rank.rank_month);
    }
  }, 'rpcRank');

  /* 7️⃣ RACHA (RPC) */
  await safeTry(async () => {
    const s = await fetchUserStreakDays();
    if (typeof window !== 'undefined') {
      localStorage.setItem('akira_streak_cache_v1', JSON.stringify({ v: s, _ts: Date.now() }));
    }
  }, 'rpcStreak');

  /* 8️⃣ PRELOAD IMÁGENES */
  await safeTry(async () => {
    const urls = [
      '/images/badges/superlector.png',
      '/images/badges/detox-tecnologico.png',
      '/images/programs/lectura-hero.jpg',
      '/images/programs/detox-hero.jpg',
    ];
    await Promise.all(
      urls.map(
        (u) =>
          new Promise((res) => {
            const img = new Image();
            img.onload = img.onerror = () => res(true);
            img.src = u;
          })
      )
    );
  }, 'preloadImages');

  /* 9️⃣ DONE */
  safeStep('done');
}
