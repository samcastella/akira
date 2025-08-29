/* Catálogo de programas (metadatos) */

export type ProgramSlug = 'lectura-21d' | 'burpees-30d' | 'finanzas-30d' | 'meditacion-21d';
export type DailyUnit = 'minutes' | 'pages' | 'reps';

export type ProgramMeta = {
  slug: ProgramSlug;
  title: string;
  subtitle?: string;
  durationDays: number;
  unit: DailyUnit;
  /** plan[i] = objetivo del día (i+1) */
  plan: number[];
  cover?: string;
  cta?: string;
};

/* ---------- planes ---------- */
function lectura21Plan(): number[] {
  const plan: number[] = [];
  for (let d = 1; d <= 21; d++) {
    if (d <= 3) plan.push(10);
    else if (d <= 7) plan.push(15);
    else if (d <= 14) plan.push(20);
    else plan.push(25);
  }
  return plan;
}

function burpees30Plan(): number[] {
  // Reps suaves → medias → firmes → sólidas
  const plan: number[] = [];
  for (let d = 1; d <= 30; d++) {
    if (d <= 7) plan.push(10);
    else if (d <= 14) plan.push(15);
    else if (d <= 21) plan.push(20);
    else plan.push(25);
  }
  return plan;
}

function finanzas30Plan(): number[] {
  // Minutos de “higiene financiera” diaria
  const plan: number[] = [];
  for (let d = 1; d <= 30; d++) {
    if (d <= 7) plan.push(10);
    else if (d <= 14) plan.push(15);
    else if (d <= 21) plan.push(20);
    else plan.push(25);
  }
  return plan;
}

function meditacion21Plan(): number[] {
  // Minutos: 5 → 10 → 15
  const plan: number[] = [];
  for (let d = 1; d <= 21; d++) {
    if (d <= 7) plan.push(5);
    else if (d <= 14) plan.push(10);
    else plan.push(15);
  }
  return plan;
}

/* ---------- registry ---------- */
const PROGRAMS_REGISTRY: Record<ProgramSlug, ProgramMeta> = {
  'lectura-21d': {
    slug: 'lectura-21d',
    title: 'La máquina lectora',
    subtitle: 'Conviértete en un superlector (21 días)',
    durationDays: 21,
    unit: 'minutes',
    plan: lectura21Plan(),
    cover: '/reading.jpg',
    cta: 'Empieza ahora',
  },
  'burpees-30d': {
    slug: 'burpees-30d',
    title: 'Unos f*kn burpees',
    subtitle: '30 días subiendo el nivel',
    durationDays: 30,
    unit: 'reps',
    plan: burpees30Plan(),
    cover: '/burpees.jpg',
    cta: 'Empieza ahora',
  },
  'finanzas-30d': {
    slug: 'finanzas-30d',
    title: 'Finanzas en orden',
    subtitle: '30 días para tu dinero',
    durationDays: 30,
    unit: 'minutes',
    plan: finanzas30Plan(),
    cover: '/finanzas.jpg',
    cta: 'Empieza ahora',
  },
  'meditacion-21d': {
    slug: 'meditacion-21d',
    title: 'Meditación esencial',
    subtitle: 'Respira. 10–15 min diarios',
    durationDays: 21,
    unit: 'minutes',
    plan: meditacion21Plan(),
    cover: '/meditacion.jpg',
    cta: 'Empieza ahora',
  },
};

export function getProgram(slug: ProgramSlug): ProgramMeta {
  return PROGRAMS_REGISTRY[slug];
}
export function listPrograms(): ProgramMeta[] {
  return Object.values(PROGRAMS_REGISTRY);
}
