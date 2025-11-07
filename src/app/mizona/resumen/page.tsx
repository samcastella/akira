'use client';

import Link from 'next/link';
import TodayWheel from '@/components/mizona/TodayWheel';
import CalendarLite from '@/components/mizona/CalendarLite';
import { useTodayActivity } from '@/lib/activity/useTodayActivity';
import { useUserProfile } from '@/lib/user';
import { useEffect, useMemo, useRef, useState, startTransition } from 'react';
import { loadActive, type LocalStore, type LocalProgram } from '@/lib/programsLocal';
import { ChevronRight } from 'lucide-react';

/* === Puntuación GLOBAL + Ranking (RPC) === */
import {
  fetchGlobalProgramPoints,
  fetchMyMonthlyRank,
  fetchUserStreakDays,
  readPointsCache, writePointsCache,
  readRankCache, writeRankCache,
  type GlobalPointsTotal,
} from '@/lib/programService';

/* ===== helpers JSON / fechas ===== */
function tryGetProgramJson(slug: string): any | null {
  try {
    // @ts-ignore
    const m = require(`@/data/programs/${slug}.json`);
    return m?.default ?? m ?? null;
  } catch {
    return null;
  }
}
function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function dayIdxSince(startedAt: number, when: Date) {
  const a = startOfDay(new Date(startedAt)).getTime();
  const b = startOfDay(when).getTime();
  return Math.floor((b - a) / 86_400_000) + 1; // 1..N
}
function clampDay(startedAt: number, when: Date, totalDays: number) {
  const idx = dayIdxSince(startedAt, when);
  return Math.min(totalDays, Math.max(1, idx));
}
function routeSlug(slug: string) {
  return slug.replace(/-30$/, '');
}
/* Mini mapa explícito de thumbnails */
const THUMB_MAP: Record<string, string> = {
  lectura: '/images/programs/lectura-hero.jpg',
  'detox-tecnologico': '/images/programs/detox-hero.jpg',
};

/* ====== Cálculo instantáneo local de puntos (optimista; SOLO programas oficiales) ====== */
function computeLocalProgramPoints(): number {
  const active = loadActive();
  let pts = 0;
  for (const [slug, prog] of Object.entries(active)) {
    const lp = prog as LocalProgram;
    if (!lp?.progress || !lp.startedAt) continue;
    const json = tryGetProgramJson(slug); // Solo contamos si existe JSON oficial
    const totalDays: number = json?.days?.length ?? json?.durationDays ?? 0;
    if (!totalDays) continue;
    for (let d = 1; d <= totalDays; d++) {
      const doneMap = (lp.progress?.[d] as Record<string, boolean> | undefined) ?? {};
      pts += Object.values(doneMap).filter(Boolean).length;
    }
  }
  return pts;
}

/* === Helper para refrescar puntos y ranking (RPC + caché) === */
async function refreshTotalsAndRank(setTotals: any, setRank: any) {
  try {
    const to = startOfDay(new Date());
    const from = new Date(to);
    from.setDate(from.getDate() - 365);

    const y = to.getFullYear(), m = String(to.getMonth() + 1).padStart(2, '0'), d = String(to.getDate()).padStart(2, '0');
    const y2 = from.getFullYear(), m2 = String(from.getMonth() + 1).padStart(2, '0'), d2 = String(from.getDate()).padStart(2, '0');
    const toISO = `${y}-${m}-${d}`;
    const fromISO = `${y2}-${m2}-${d2}`;

    const [gTotals, myRank] = await Promise.all([
      fetchGlobalProgramPoints(fromISO, toISO),
      fetchMyMonthlyRank(),
    ]);

    if (gTotals) {
      setTotals((prev: GlobalPointsTotal | null) => {
        const optimistic = prev?.total_points ?? 0;
        return { total_points: Math.max(optimistic, gTotals.total_points) };
      });
      writePointsCache({ ...gTotals, _ts: Date.now() } as any);
    }
    if (typeof myRank?.rank_month === 'number') {
      setRank(myRank.rank_month);
      writeRankCache(myRank.rank_month);
    }
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') console.warn('[MiActividadResumen] refreshTotalsAndRank error', e);
  }
}

export default function MiActividadResumen() {
  const { totalGoal, totalDone, historicalPoints } = useTodayActivity();
  const pct = totalGoal ? Math.round((totalDone / totalGoal) * 100) : 0;

  const user = useUserProfile();
  const displayName =
    (user?.nombre && user.nombre.trim()) ||
    (user?.username && user.username.trim()) ||
    'Tú';

  /* ===== Avatar ===== */
  const [avatarSrc, setAvatarSrc] = useState<string>(() => {
    const f = (user as any)?.foto;
    const a = (user as any)?.avatar_url;
    return (f && String(f).trim()) || (a && String(a).trim()) || '/images/avatars/default.png';
  });
  useEffect(() => {
    const f = (user as any)?.foto;
    const a = (user as any)?.avatar_url;
    setAvatarSrc((f && String(f).trim()) || (a && String(a).trim()) || '/images/avatars/default.png');
  }, [user]);

  // ====== PUNTOS + RANKING (cache-first + optimista local) ======
  const cachedPts = typeof window !== 'undefined' ? readPointsCache() : null;
  const cachedRank = typeof window !== 'undefined' ? readRankCache() : null;
  const localInstant = computeLocalProgramPoints();

  const [totals, setTotals] = useState<GlobalPointsTotal | null>(() => {
    const seed =
      (cachedPts?.total_points ?? 0) > 0
        ? cachedPts!.total_points
        : (historicalPoints ?? 0);
    return { total_points: Math.max(seed, localInstant) };
  });
  const [rank, setRank] = useState<number | null>(cachedRank ?? null);
  const [streak, setStreak] = useState<number>(0);

  // 🔁 Recalcular puntos optimistas cuando el usuario marca checks (programas oficiales)
  useEffect(() => {
    const nowLocal = computeLocalProgramPoints();
    setTotals((prev) => {
      const prevVal = prev?.total_points ?? 0;
      return { total_points: Math.max(prevVal, nowLocal) };
    });
  }, [totalDone, totalGoal]);

  // 🔁 Refresh en montaje y al dispararse eventos globales
  useEffect(() => {
    let mounted = true;

    // Racha rápida
    startTransition(() => {
      fetchUserStreakDays().then((s) => { if (mounted) setStreak(s || 0); }).catch(() => {});
    });

    const doRefresh = () => {
      const nowLocal = computeLocalProgramPoints();
      setTotals((prev) => ({ total_points: Math.max(prev?.total_points ?? 0, nowLocal) }));
      refreshTotalsAndRank(setTotals, setRank);
    };

    const cachedFresh = cachedPts && (cachedPts as any)._ts && Date.now() - (cachedPts as any)._ts < 5 * 60_000;
    if (cachedFresh) {
      const idle = (cb: () => void) =>
        (typeof (window as any).requestIdleCallback === 'function'
          ? (window as any).requestIdleCallback(cb, { timeout: 800 })
          : setTimeout(cb, 0));
      idle(doRefresh);
    } else {
      doRefresh();
    }

    const handler = () => doRefresh();
    window.addEventListener('akira:points:refresh', handler);
    window.addEventListener('akira:activity:changed', handler);

    return () => {
      mounted = false;
      window.removeEventListener('akira:points:refresh', handler);
      window.removeEventListener('akira:activity:changed', handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalPoints = totals?.total_points ?? historicalPoints ?? 0;
  const rankLabelBig = typeof rank === 'number' ? `${rank}º` : '—';

  return (
    <div className="pt-3 pb-6 space-y-8">
      {/* ===== Rueda ===== */}
      <section className="flex justify-center">
        <TodayWheel
          value={pct}
          title="ACTIVIDADES PARA HOY"
          totalDone={totalDone}
          totalGoal={totalGoal}
          size={260}
        />
      </section>

      {/* ===== Racha ===== */}
      <StreakCardFlash value={streak} />

      {/* ===== Perfil ===== */}
      <section className="rounded-2xl border border-neutral-200 p-4 flex items-center gap-4 bg-white">
        <div className="relative w-16 h-16 rounded-full overflow-hidden bg-neutral-100 ring-1 ring-white/70">
          <img
            src={avatarSrc}
            alt="Tu perfil"
            className="object-cover w-full h-full scale-[2] origin-center"
            onError={() => setAvatarSrc('/images/avatars/default.png')}
            loading="lazy"
            decoding="async"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-semibold text-neutral-900 truncate">{displayName}</div>
          <div className="mt-1 text-sm text-neutral-700">
            Puntuación: <b className="tabular-nums">{totalPoints}</b> pts
          </div>
        </div>
        <div className="text-3xl sm:text-4xl font-extrabold tabular-nums leading-none">{rankLabelBig}</div>
      </section>

      {/* ===== Programas activos ===== */}
      <section>
        <div className="mb-1 flex items-baseline justify-between">
          <h3 className="text-lg font-semibold">Programas activos</h3>
          <Link href="/programas" className="text-sm font-medium text-neutral-700 hover:underline">Ver todos</Link>
        </div>
        <p className="text-sm text-neutral-600 mb-3">Sigue con tus programas activos.</p>
        <ActiveProgramsList />
      </section>

      {/* ===== Estadísticas ===== */}
      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="text-lg font-semibold">Estadísticas</h3>
        <Link href="/mizona/estadisticas" className="text-sm font-medium text-neutral-700 hover:underline">Ver todo</Link>
        </div>
        <p className="text-sm text-neutral-600 mb-3">Descubre tus estadísticas de esta semana</p>
        <MiniWeeklyChartReal />
      </section>

      {/* ===== Calendario + leyenda ===== */}
      <section>
        <h3 className="text-lg font-semibold mb-2">Calendario</h3>
        <div className="
          [&_.ak-calendar-day]:w-9
          [&_.ak-calendar-day]:h-9
          [&_.ak-calendar-day]:rounded-full
          [&_.ak-calendar-day]:flex
          [&_.ak-calendar-day]:items-center
          [&_.ak-calendar-day]:justify-center
          [&_.ak-calendar-day]:p-0
          [&_.ak-calendar-day>*]:w-full
          [&_.ak-calendar-day>*]:h-full
          [&_.ak-calendar-day>*]:rounded-full
          [&_.ak-calendar-day>*]:flex
          [&_.ak-calendar-day>*]:items-center
          [&_.ak-calendar-day>*]:justify-center
        ">
          <CalendarLite dayStatus={getDayStatus} />
        </div>
        <div className="mt-3 flex items-center gap-4 text-xs text-neutral-600">
          <LegendDot cls="bg-neutral-300" label="Sin tareas / sin actividad" />
          <LegendDot cls="bg-orange-300" label="Algunas hechas" />
          <LegendDot cls="bg-green-300" label="Todo hecho" />
          <LegendDot cls="bg-red-300" label="Día sin hacer ningún reto" />
        </div>
      </section>

      {/* ===== Logros ===== */}
      <section>
        <h3 className="text-lg font-semibold mb-3">Logros</h3>
        <AchievementsStrip />
      </section>
    </div>
  );
}

/* ===== Racha ===== */
function StreakCardFlash({ value }: { value: number }) {
  const [n, setN] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const target = Math.max(0, Math.floor(value || 0));
    const duration = 700; // ms
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setN(Math.round(eased * target));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value]);

  const tagline = getStreakTagline(n);
  const confettiBg =
    "radial-gradient(circle at 10% 20%, rgba(255,99,132,0.15) 0 6px, transparent 7px)," +
    "radial-gradient(circle at 80% 30%, rgba(54,162,235,0.15) 0 6px, transparent 7px)," +
    "radial-gradient(circle at 30% 80%, rgba(255,206,86,0.18) 0 6px, transparent 7px)";

  return (
    <div
      className="rounded-2xl p-4 border"
      style={{ background: `linear-gradient(0deg, #FFFBEB, #FFFBEB), ${confettiBg}`, borderColor: '#F5E6A7' }}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-neutral-600">Racha</div>
          <div className="text-3xl font-extrabold leading-none tabular-nums">{n} días</div>
        </div>
        <div className="text-xs text-neutral-700 font-medium">{tagline} 🔥</div>
      </div>
    </div>
  );
}
function getStreakTagline(n: number) {
  if (n <= 0) return 'Empieza hoy';
  if (n < 3) return 'Calentando motores';
  if (n < 7) return '¡En racha!';
  if (n < 21) return '¡Imparable!';
  return 'Leyenda viva';
}

/* ===== Programas activos ===== */
function ActiveProgramsList() {
  const activeMap = useMemo<LocalStore>(() => loadActive(), []);
  const entries = Object.entries(activeMap).filter(([slug, p]) => {
    const lp = p as LocalProgram;
    if (!lp?.startedAt) return false;
    const json = tryGetProgramJson(slug);
    const totalDays: number = json?.days?.length ?? json?.durationDays ?? 0;
    if (!totalDays) return false;
    const rawIdx = dayIdxSince(lp.startedAt, new Date());
    if (rawIdx > totalDays) return false;
    return true;
  });

  if (!entries.length) return <div className="text-sm text-neutral-600">No tienes programas activos.</div>;

  return (
    <div className="space-y-3">
      {entries.map(([slug, p]) => {
        const lp = p as LocalProgram;
        const json = tryGetProgramJson(slug);
        const title: string = json?.title || slug.replaceAll('-', ' ');
        const totalDays: number = json?.days?.length ?? json?.durationDays ?? 0;
        const today = totalDays ? clampDay(lp.startedAt!, new Date(), totalDays) : 0;
        const pct = totalDays ? Math.round((today / totalDays) * 100) : 0;

        const rslug = routeSlug(slug);
        const mapped = THUMB_MAP[rslug];
        const base = `/images/programs/${rslug}-hero`;
        const srcJpg = mapped || `${base}.jpg`;
        const srcPng = mapped || `${base}.png`;

        return (
          <Link key={slug} href={`/programas/${rslug}`} className="block rounded-3xl bg-neutral-100 px-4 py-4">
            <div className="flex items-center gap-3">
              <ThumbCircle alt={title} srcJpg={srcJpg} srcPng={srcPng} />
              <div className="flex-1 min-w-0">
                <div className="text-xs text-neutral-500">Programa</div>
                <div className="text-[15px] font-semibold text-neutral-900 truncate">{title}</div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-2 w-full rounded-full bg-white/60 overflow-hidden">
                    <div className="h-2 bg-yellow-400" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-xs text-neutral-600 whitespace-nowrap">
                    {totalDays ? `${today}/${totalDays}` : '—'}
                  </div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-neutral-400 shrink-0" />
            </div>
          </Link>
        );
      })}
    </div>
  );
}

/* ===== Thumb ===== */
function ThumbCircle({ alt, srcJpg, srcPng }: { alt: string; srcJpg: string; srcPng: string }) {
  const [src, setSrc] = useState(srcJpg);
  return (
    <div className="relative w-14 h-14 rounded-full overflow-hidden ring-1 ring-white/70 bg-white">
      <img
        src={src}
        alt={alt}
        className="object-cover w-full h-full scale-[2] origin-center"
        onError={() => setSrc(srcPng)}
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}

/* ===== Estadísticas semanales (local real) ===== */
function MiniWeeklyChartReal() {
  const activeMap = useMemo<LocalStore>(() => loadActive(), []);
  const series = useMemo(() => buildWeeklySeries(activeMap), [activeMap]);
  return <MiniChart labels={series.labels} goal={series.goal} actual={series.actual} />;
}
function buildWeeklySeries(activeMap: LocalStore) {
  const labels = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const goal = Array(7).fill(0);
  const actual = Array(7).fill(0);

  const today = startOfDay(new Date());
  const days: Date[] = [];
  for (let i = 6; i >= 0; i--) days.push(new Date(today.getTime() - i * 86_400_000));

  for (const [slug, prog] of Object.entries(activeMap)) {
    const lp = prog as LocalProgram;
    if (!lp?.startedAt) continue;
    const json = tryGetProgramJson(slug);
    const totalDays: number = json?.days?.length ?? json?.durationDays ?? 0;
    if (!totalDays) continue;

    days.forEach((d, idx) => {
      const dayNum = dayIdxSince(lp.startedAt, d);
      if (dayNum < 1 || dayNum > totalDays) return;

      const dayDef = json?.days?.find((x: any) => x.day === dayNum) ?? json?.days?.[dayNum - 1];
      const planned = Math.max(0, dayDef?.tasks?.length ?? 0);
      goal[idx] += planned;

      const doneMap = (lp.progress?.[dayNum] as Record<string, boolean> | undefined) ?? {};
      const done = Object.values(doneMap).filter(Boolean).length;
      actual[idx] += done;
    });
  }

  return { labels, goal, actual };
}
function MiniChart({ labels, goal, actual }: { labels: string[]; goal: number[]; actual: number[] }) {
  const width = 640, height = 220, padL = 28, padR = 16, padT = 20, padB = 28;
  const n = 7;
  const xs = (i: number) => padL + (i * (width - padL - padR)) / Math.max(1, n - 1);
  const maxY = Math.max(5, ...goal, ...actual);
  const niceMax = Math.max(5, Math.ceil(maxY / 5) * 5);
  const ys = (v: number) => padT + (height - padT - padB) * (1 - v / (niceMax || 1));
  const pathFor = (arr: number[]) => arr.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xs(i)} ${ys(v)}`).join(' ');

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--line)' }}>
      <div className="px-4 py-3 text-sm font-semibold bg-neutral-50">Estadísticas</div>
      <div className="p-4">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
          <rect x="0" y="0" width={width} height={height} fill="white" />
          {[0,1,2,3,4].map((i) => {
            const y = padT + ((height - padT - padB) * i) / 4;
            return <line key={`g${i}`} x1={padL} x2={width - padR} y1={y} y2={y} stroke="#e5e7eb" strokeWidth="1" />;
          })}
          <path d={pathFor(goal)} fill="none" stroke="#d1d5db" strokeWidth="2" />
          <path d={pathFor(actual)} fill="none" stroke="#3b82f6" strokeWidth="2" />
          {goal.map((v, i) => <circle key={`pg${i}`} cx={xs(i)} cy={ys(v)} r="4" fill="white" stroke="#d1d5db" strokeWidth="2" />)}
          {actual.map((v, i) => <circle key={`pa${i}`} cx={xs(i)} cy={ys(v)} r="4" fill="white" stroke="#3b82f6" strokeWidth="2" />)}
          {labels.map((l, i) => (
            <text key={`lx${i}`} x={xs(i)} y={height - padB + 16} textAnchor="middle" fontSize="11" fill="#6b7280">{l}</text>
          ))}
          <text x={width - 4} y={padT - 6} textAnchor="end" fontSize="12" fill="#6b7280">Retos</text>
        </svg>

        <div className="mt-3 flex items-center gap-4 text-xs text-neutral-600">
          <div className="flex items-center gap-2"><span className="inline-block w-4 h-[2px] bg-neutral-300" /> Objetivo</div>
          <div className="flex items-center gap-2"><span className="inline-block w-4 h-[2px] bg-blue-500" /> Hecho</div>
        </div>
      </div>
    </div>
  );
}

/* ===== Leyenda calendario (círculos perfectos en iOS) ===== */
function LegendDot({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 leading-none">
      <span className={`inline-block w-3 h-3 aspect-square rounded-full ${cls} shrink-0 align-middle`} />
      {label}
    </span>
  );
}

/* ===== Estados por día para calendario ===== */
function getDayStatus(date: Date): 'none'|'some'|'all'|'missed' {
  const map = loadActive();
  let planned = 0, done = 0;

  for (const [slug, prog] of Object.entries(map)) {
    const lp = prog as LocalProgram;
    if (!lp?.startedAt) continue;
    const json = tryGetProgramJson(slug);
    const totalDays: number = json?.days?.length ?? json?.durationDays ?? 0;
    if (!totalDays) continue;

    const dNum = dayIdxSince(lp.startedAt, date);
    if (dNum < 1 || dNum > totalDays) continue;

    const dayDef = json?.days?.find((x: any) => x.day === dNum) ?? json?.days?.[dNum - 1];
    planned += Math.max(0, dayDef?.tasks?.length ?? 0);

    const doneMap = (lp.progress?.[dNum] as Record<string, boolean> | undefined) ?? {};
    done += Object.values(doneMap).filter(Boolean).length;
  }

  if (planned === 0) return 'none';
  if (done === 0) {
    const isPast = startOfDay(date).getTime() < startOfDay(new Date()).getTime();
    return isPast ? 'missed' : 'none';
  }
  if (done < planned) return 'some';
  return 'all';
}

/* ===== Logros (sin borde) ===== */
function AchievementsStrip() {
  const items = [
    { key: 'superlector', title: 'Superlector', src: '/images/badges/superlector.png' },
    { key: 'domador-scroll', title: 'Domador del Scroll', src: '/images/badges/detox-tecnologico.png' },
  ];
  return (
    <div className="grid grid-cols-3 gap-4">
      {items.map((b) => (
        <div key={b.key} className="flex flex-col items-center">
          <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-white">
            <img
              src={b.src}
              alt={b.title}
              className="object-contain w-full h-full"
              loading="lazy"
              decoding="async"
            />
          </div>
          <div className="mt-2 text-xs text-center text-neutral-800">{b.title}</div>
        </div>
      ))}
    </div>
  );
}
