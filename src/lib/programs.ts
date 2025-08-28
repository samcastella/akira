cat > lib/programs.ts <<'TS'
import { todayKey, dateKey, addDays, diffDays } from '@/lib/date';

export type DayTasks = { tasks: string[] };
export type ProgramDef = {
  key: string;
  name: string;
  image: string;
  benefits: string[];
  howItWorks: string[];
  days: DayTasks[];
};

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
    'Semana 1: 1–5 páginas. Semana 2: 5–10. Semana 3: 10–15.',
    'Registra cada día en “Mi Zona”.',
  ],
  days: [
    { tasks: ['Ve a una librería y elige un libro ≤ 200–300 páginas.', 'Colócalo en un lugar visible.', 'Define hora/lugar y pon una alarma diaria.'] },
    { tasks: ['Lee 1 página.', 'Escribe por qué elegiste ese libro.', 'Haz una foto de tu rincón de lectura.'] },
    { tasks: ['Lee 1–5 páginas (si lees más, genial).', 'Prepara tu ritual (café, té, luz).', 'Marca una frase que te inspire.'] },
    { tasks: ['Lee 1–5 páginas.', 'Lee en voz alta un párrafo.', 'Escribe una frase sobre lo que sentiste.'] },
    { tasks: ['Lee 1–5 páginas en un lugar distinto.', 'Apunta una idea clave.', 'Cuéntaselo a alguien.'] },
    { tasks: ['Lee 1–5 páginas.', 'Evalúa tu concentración (1–5).', 'Ajusta la hora si no encaja.'] },
    { tasks: ['Lee 1–5 páginas.', 'Relee tus notas o frases marcadas.', 'Celebra la primera semana.'] },
    { tasks: ['Lee 5 páginas.', 'Apunta 1 frase aplicable hoy.', 'Compártela con alguien.'] },
    { tasks: ['Lee 6 páginas.', 'Asocia lectura a otro hábito.', 'Escribe lo más útil del día.'] },
    { tasks: ['Lee 6–7 páginas.', 'Marca 2 aprendizajes clave.', 'Recompénsate con algo sencillo.'] },
    { tasks: ['Lee 7 páginas.', 'Comparte lo más interesante con un amigo.', 'Haz check en tu racha.'] },
    { tasks: ['Lee 8 páginas.', 'Marca una idea aplicable hoy.', 'Ponla en práctica.'] },
    { tasks: ['Lee 8–9 páginas.', 'Escribe una reflexión de 2 frases.', 'Haz una foto del libro y compártela.'] },
    { tasks: ['Lee 10 páginas en tu lugar favorito.', 'Balance de semana.', 'Recompénsate.'] },
    { tasks: ['Escribe: “Leo cada día”.', 'Lee 10 páginas.', 'Habla con alguien de tu hábito.'] },
    { tasks: ['Elige tu próxima lectura.', 'Lee 11 páginas.', 'Haz una story con tu frase favorita.'] },
    { tasks: ['Lee 12 páginas.', 'Mini-resumen (3–4 frases).', 'Meta: terminar libro en X días.'] },
    { tasks: ['Lee 12–13 páginas.', 'Marca 2 ideas prácticas.', 'Aplica 1 hoy mismo.'] },
    { tasks: ['Lee 13 páginas.', 'Cuenta qué estás aprendiendo.', 'Refuerza tu identidad lectora.'] },
    { tasks: ['Lee 14 páginas.', 'Repasa todas tus notas.', 'Elige la idea más transformadora.'] },
    { tasks: ['Lee 15 páginas o termina el libro.', 'Balance final del reto.', 'Comparte tu logro y planifica el siguiente.'] },
  ],
};

export const PROGRAMS: Record<string, ProgramDef> = { [READING_PROGRAM.key]: READING_PROGRAM };

export type ProgramState = {
  startDate: string;
  completedDates?: string[];
  completedByDate?: Record<string, number[]>;
};
export type ProgramsStore = Record<string, ProgramState>;
const STORAGE_KEY = 'akira_programs_v2';

export function loadStore(): ProgramsStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data: ProgramsStore = raw ? JSON.parse(raw) : {};
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
export function saveStore(store: ProgramsStore) { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); }
export function ensureProgram(key: string) {
  const s = loadStore();
  if (!s[key]) { s[key] = { startDate: todayKey(), completedByDate: {} }; saveStore(s); }
}
export function startProgram(key: string) {
  const s = loadStore();
  if (!s[key]) { s[key] = { startDate: todayKey(), completedByDate: {} }; saveStore(s); }
}
export function toggleTaskToday(key: string, taskIndex: number) {
  const s = loadStore(); if (!s[key]) return;
  const t = todayKey();
  const list = new Set(s[key].completedByDate?.[t] ?? []);
  list.has(taskIndex) ? list.delete(taskIndex) : list.add(taskIndex);
  if (!s[key].completedByDate) s[key].completedByDate = {};
  s[key].completedByDate[t] = Array.from(list).sort((a, b) => a - b);
  saveStore(s);
}
export function isTaskTodayCompleted(key: string, taskIndex: number) {
  const s = loadStore();
  return !!s[key]?.completedByDate?.[todayKey()]?.includes(taskIndex);
}
export function getRelativeDayIndexForDate(key: string, dateStr: string): number {
  const s = loadStore();
  const start = s[key]?.startDate;
  if (!start) return 0;
  const idx = diffDays(new Date(dateStr + 'T00:00:00'), new Date(start + 'T00:00:00')) + 1;
  return idx >= 1 && idx <= (PROGRAMS[key]?.days.length ?? 21) ? idx : 0;
}
export function getProgressPercent(key: string) {
  const s = loadStore(); const st = s[key]; const prog = PROGRAMS[key]; if (!st || !prog) return 0;
  let completedDays = 0;
  const start = new Date(st.startDate + 'T00:00:00');
  const end = new Date();
  const totalDays = Math.min(diffDays(end, start) + 1, prog.days.length);
  for (let i = 0; i < totalDays; i++) {
    const dKey = dateKey(addDays(start, i));
    const n = prog.days[i]?.tasks.length ?? 0;
    const done = st.completedByDate?.[dKey]?.length ?? 0;
    if (n > 0 && done >= n) completedDays++;
  }
  return Math.min(100, Math.round((completedDays / prog.days.length) * 100));
}
TS
