import { addDays, dateKey, diffDays, todayKey } from './date';

/* ============================= */
/* Tipos y definición de programa */
/* ============================= */
export type DayTasks = { tasks: string[] };
export type ProgramDef = {
  key: string;
  name: string;
  image: string;
  benefits: string[];
  howItWorks: string[];
  days: DayTasks[]; // 21
};

/* ============================= */
/* Programa Lectura (21 días)    */
/* ============================= */
export const READING_PROGRAM: ProgramDef = {
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
    'Registra cada día en “Mi Zona” marcando los checks.',
  ],
  days: [
    { tasks: ['Ve a una librería y elige un libro ≤ 200–300 páginas.', 'Colócalo en un lugar visible.', 'Define hora/lugar y pon una alarma diaria.'] }, // 1
    { tasks: ['Lee 1 página.', 'Escribe por qué elegiste ese libro.', 'Haz una foto de tu rincón de lectura.'] }, // 2
    { tasks: ['Lee 1–5 páginas (si lees más, genial).', 'Prepara tu ritual (café, té, luz).', 'Marca una frase que te inspire.'] }, // 3
    { tasks: ['Lee 1–5 páginas.', 'Lee en voz alta un párrafo.', 'Escribe una frase sobre lo que sentiste.'] }, // 4
    { tasks: ['Lee 1–5 páginas en un lugar distinto.', 'Apunta una idea clave.', 'Cuéntaselo a alguien.'] }, // 5
    { tasks: ['Lee 1–5 páginas.', 'Evalúa tu concentración (1–5).', 'Ajusta la hora si no encaja.'] }, // 6
    { tasks: ['Lee 1–5 páginas.', 'Relee tus notas o frases marcadas.', 'Celebra la primera semana.'] }, // 7
    { tasks: ['Lee 5 páginas.', 'Apunta 1 frase aplicable hoy.', 'Compártela con alguien.'] }, // 8
    { tasks: ['Lee 6 páginas.', 'Asocia lectura a otro hábito (después de desayunar).', 'Escribe lo más útil del día.'] }, // 9
    { tasks: ['Lee 6–7 páginas.', 'Marca 2 aprendizajes clave.', 'Recompénsate con algo sencillo.'] }, // 10
    { tasks: ['Lee 7 páginas.', 'Comparte lo más interesante con un amigo.', 'Haz check en tu racha.'] }, // 11
    { tasks: ['Lee 8 páginas.', 'Marca una idea aplicable hoy.', 'Ponla en práctica.'] }, // 12
    { tasks: ['Lee 8–9 páginas.', 'Escribe una reflexión de 2 frases.', 'Haz una foto del libro y compártela.'] }, // 13
    { tasks: ['Lee 10 páginas en tu lugar favorito.', 'Balance de semana: ¿qué aprendiste?', 'Recompénsate.'] }, // 14
    { tasks: ['Escribe: “Soy el tipo de persona que lee cada día”.', 'Lee 10 páginas.', 'Habla con alguien de tu hábito.'] }, // 15
    { tasks: ['Elige tu próxima lectura.', 'Lee 11 páginas.', 'Haz una story con tu frase favorita.'] }, // 16
    { tasks: ['Lee 12 páginas.', 'Mini-resumen (3–4 frases).', 'Meta: terminar libro en X días.'] }, // 17
    { tasks: ['Lee 12–13 páginas.', 'Marca 2 ideas prácticas.', 'Aplica 1 hoy mismo.'] }, // 18
    { tasks: ['Lee 13 páginas.', 'Cuenta a alguien qué estás aprendiendo.', 'Refuerza tu identidad lectora.'] }, // 19
    { tasks: ['Lee 14 páginas.', 'Repasa todas tus notas.', 'Elige la idea más transformadora.'] }, // 20
    { tasks: ['Lee 15 páginas o termina el libro.', 'Balance final del reto.', 'Comparte tu logro y planifica el siguiente libro.'] }, // 21
  ],
};

export const PROGRAMS: Record<string, ProgramDef> = {
  [READING_PROGRAM.key]: READING_PROGRAM,
};

/* ============================= */
/* Estado en localStorage        */
/* ============================= */
export type ProgramState = {
  startDate: string;                         // YYYY-MM-DD
  completedDates?: string[];                 // LEGADO
  completedByDate?: Record<string, number[]>;// nuevo: por fecha, índices de tareas
};
export type ProgramsStore = Record<string, ProgramState>;

const STORAGE_KEY = 'akira_programs_v2';

export function loadStore(): ProgramsStore {
  // En SSR/no navegador devolvemos vacío para evitar "window is not defined"
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data: ProgramsStore = raw ? JSON.parse(raw) : {};
    // Migración: completedDates -> completedByDate
    Object.keys(data).forEach((k) => {
      const st = data[k];
      if (!st.completedByDate) st.completedByDate = {};
      if (st.completedDates && st.completedDates.length) {
        const prog = PROGRAMS[k];
        st.completedDates.forEach((d) => {
          const dayIdx = getRelativeDayIndexForDate(k, d);
          const n = prog?.days[dayIdx - 1]?.tasks.length ?? 0;
          st.completedByDate![d] = Array.from({ length: n }, (_, i) => i);
        });
        delete st.completedDates;
      }
    });
    return data;
  } catch {
    return {};
  }
}

export function saveStore(store: ProgramsStore) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function ensureProgram(key: string) {
  const store = loadStore();
  if (!store[key]) {
    store[key] = { startDate: todayKey(), completedByDate: {} };
    saveStore(store);
  }
}

export function startProgram(key: string) {
  const store = loadStore();
  if (!store[key]) {
    store[key] = { startDate: todayKey(), completedByDate: {} };
    saveStore(store);
  }
}

export function toggleTaskToday(key: string, taskIndex: number) {
  const store = loadStore();
  if (!store[key]) return;
  const t = todayKey();
  const list = new Set(store[key].completedByDate?.[t] ?? []);
  list.has(taskIndex) ? list.delete(taskIndex) : list.add(taskIndex);
  if (!store[key].completedByDate) store[key].completedByDate = {};
  store[key].completedByDate[t] = Array.from(list).sort((a, b) => a - b);
  saveStore(store);
}

export function isTaskTodayCompleted(key: string, taskIndex: number) {
  const store = loadStore();
  return !!store[key]?.completedByDate?.[todayKey()]?.includes(taskIndex);
}

/** Día relativo de un programa para una fecha concreta (1..21) o 0 si no aplica */
export function getRelativeDayIndexForDate(key: string, dateStr: string): number {
  const store = loadStore();
  const start = store[key]?.startDate;
  if (!start) return 0;
  const idx = diffDays(new Date(dateStr + 'T00:00:00'), new Date(start + 'T00:00:00')) + 1;
  return idx >= 1 && idx <= (PROGRAMS[key]?.days.length ?? 21) ? idx : 0;
}

/** Progreso: días con TODAS las tareas del día completadas */
export function getProgressPercent(key: string) {
  const store = loadStore();
  const st = store[key];
  const prog = PROGRAMS[key];
  if (!st || !prog) return 0;
  let completedDays = 0;
  const start = new Date(st.startDate + 'T00:00:00');
  const end = new Date(); // hasta hoy
  const totalDays = Math.min(diffDays(end, start) + 1, prog.days.length);
  for (let i = 0; i < totalDays; i++) {
    const dKey = dateKey(addDays(start, i));
    const n = prog.days[i]?.tasks.length ?? 0;
    const done = st.completedByDate?.[dKey]?.length ?? 0;
    if (n > 0 && done >= n) completedDays++;
  }
  return Math.min(100, Math.round((completedDays / prog.days.length) * 100));
}

/* ============================= */
/* Agregados útiles para MiZona  */
/* ============================= */
export function totalsForDate(dateStr: string) {
  const store = loadStore();
  let total = 0; let done = 0;
  for (const k of Object.keys(store)) {
    const prog = PROGRAMS[k]; if (!prog) continue;
    const idx = getRelativeDayIndexForDate(k, dateStr);
    if (idx < 1) continue;
    const n = prog.days[idx - 1]?.tasks.length ?? 0;
    total += n;
    const arr = store[k].completedByDate?.[dateStr] ?? [];
    done += Math.min(arr.length, n);
  }
  return { total, done };
}

export type DayColor = 'empty' | 'none' | 'some' | 'all';
export function dayColorStatus(dateStr: string): DayColor {
  const { total, done } = totalsForDate(dateStr);
  if (total === 0) return 'empty';
  if (done === 0) {
    const d = new Date(dateStr + 'T00:00:00');
    const today = new Date(todayKey() + 'T00:00:00');
    return d < today ? 'none' : 'empty';
  }
  if (done < total) return 'some';
  return 'all';
}
