// src/lib/user.ts

// ===== Tipos =====
export type Activity = 'sedentario' | 'ligero' | 'moderado' | 'intenso';
export type Sex = 'masculino' | 'femenino' | 'prefiero_no_decirlo';

export type UserProfile = {
  // Identidad básica
  userId?: string;
  nombre?: string;
  apellido?: string;
  email?: string;       // normalizado en minúsculas
  username?: string;    // minúsculas, sin @, sin espacios
  telefono?: string;

  // Personalización / métricas
  sexo?: Sex;
  /** ISO yyyy-mm-dd (sustituye a pedir edad en el UI) */
  fechaNacimiento?: string;
  /** Sólo compatibilidad interna/DB; en UI NO se pide */
  edad?: number;
  estatura?: number;      // cm
  peso?: number;          // kg
  actividad?: Activity;
  caloriasDiarias?: number;
};

// ===== Claves de LS (retro-compat) =====
export const LS_USER_KEY = 'akira_user_profile_v2';
export const LS_USER = 'akira_user_v1';          // alias legacy (por si hay import en otra parte)
export const LS_FIRST_RUN = 'akira_first_run_done';

// ===== Normalizadores / utilidades =====
export function normalizeEmail(email: string | undefined | null): string {
  return (email || '').trim().toLowerCase();
}

export function normalizeUsername(u: string | undefined | null): string {
  return (u ?? '').trim().replace(/^@+/, '').toLowerCase().replace(/\s+/g, '');
}

/** Calcula edad (años) a partir de yyyy-mm-dd */
export function ageFromDOB(dob?: string): number | undefined {
  if (!dob) return undefined;
  const d = new Date(dob);
  if (isNaN(+d)) return undefined;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age >= 0 ? age : undefined;
}

function sanitizeUser(u: Partial<UserProfile>): Partial<UserProfile> {
  const out: Partial<UserProfile> = { ...u };
  if (typeof out.nombre === 'string') out.nombre = out.nombre.trim();
  if (typeof out.apellido === 'string') out.apellido = out.apellido.trim();
  if (typeof out.email === 'string') out.email = normalizeEmail(out.email);
  if (typeof out.username === 'string') out.username = normalizeUsername(out.username);
  if (typeof out.telefono === 'string') out.telefono = out.telefono.trim();
  return out;
}

// ===== Persistencia local (con migración automática v1 -> v2) =====
export function loadUser(): UserProfile {
  if (typeof window === 'undefined') return {};
  try {
    // 1) intenta v2
    const rawV2 = localStorage.getItem(LS_USER_KEY);
    if (rawV2) {
      const data = JSON.parse(rawV2);
      return (data && typeof data === 'object') ? data as UserProfile : {};
    }

    // 2) migra desde v1 si existía
    const rawV1 = localStorage.getItem(LS_USER);
    if (rawV1) {
      const parsed = JSON.parse(rawV1) as UserProfile;
      const fixed: UserProfile = {
        ...parsed,
        email: normalizeEmail(parsed.email),
        username: normalizeUsername(parsed.username),
      };
      localStorage.setItem(LS_USER_KEY, JSON.stringify(fixed));
      return fixed;
    }

    return {};
  } catch {
    try { localStorage.removeItem(LS_USER_KEY); } catch {}
    return {};
  }
}

export function saveUser(u: UserProfile): UserProfile {
  if (typeof window === 'undefined') return { ...u, ...sanitizeUser(u) } as UserProfile;
  const normalized = { ...u, ...sanitizeUser(u) } as UserProfile;
  localStorage.setItem(LS_USER_KEY, JSON.stringify(normalized));
  return normalized;
}

export function saveUserMerge(partial: Partial<UserProfile>): UserProfile {
  if (typeof window === 'undefined') {
    const prev = {} as UserProfile;
    const norm = sanitizeUser(partial);
    return { ...prev, ...norm } as UserProfile;
  }
  const prev = loadUser();
  const norm = sanitizeUser(partial);
  const merged = { ...prev, ...norm } as UserProfile;
  localStorage.setItem(LS_USER_KEY, JSON.stringify(merged));
  return merged;
}

export function clearUser() {
  if (typeof window === 'undefined') return;
  try { localStorage.removeItem(LS_USER_KEY); } catch {}
  try { localStorage.removeItem(LS_USER); } catch {}
}

/** Reglas mínimas para considerar “completo” (se mantiene la exigencia de username) */
export function isUserComplete(u: UserProfile | null | undefined): boolean {
  if (!u) return false;
  if (!u.nombre?.trim() || !u.apellido?.trim() || !u.email?.trim()) return false;
  if (!u.username || !u.username.trim()) return false;
  return true;
}

// ===== Calorías (Mifflin-St Jeor) =====
function activityFactor(a: Activity | undefined): number {
  switch (a) {
    case 'ligero': return 1.375;
    case 'moderado': return 1.55;
    case 'intenso': return 1.725;
    default: return 1.2; // sedentario / undefined
  }
}

/** Soporta edad directa o derivada desde fechaNacimiento */
export function estimateCalories(u: UserProfile): number | undefined {
  const edad = u.edad ?? ageFromDOB(u.fechaNacimiento);
  if (!u.sexo || edad == null || u.estatura == null || u.peso == null) return undefined;

  const base =
    10 * u.peso +
    6.25 * u.estatura -
    5 * edad +
    (u.sexo === 'masculino' ? 5 : u.sexo === 'femenino' ? -161 : 0);

  return Math.round(base * activityFactor(u.actividad));
}

// ===== Helpers DB <-> App (Supabase) =====
export function profileFromDbRow(row: any): Partial<UserProfile> {
  if (!row || typeof row !== 'object') return {};
  return {
    userId: row.user_id ?? undefined,
    username: row.username ?? undefined,
    nombre: row.nombre ?? undefined,
    apellido: row.apellido ?? undefined,
    email: row.email ?? undefined, // si lo guardas en esta tabla (opcional)
    telefono: row.telefono ?? undefined,

    sexo: row.sexo ?? undefined,
    fechaNacimiento: row.fecha_nacimiento ?? undefined,
    edad: row.edad ?? undefined,
    estatura: row.estatura ?? undefined,
    peso: row.peso ?? undefined,
    actividad: row.actividad ?? undefined,
    caloriasDiarias: row.calorias_diarias ?? undefined,
  };
}

export function dbRowFromProfile(p: Partial<UserProfile>): any {
  return {
    user_id: p.userId ?? undefined,
    username: p.username ?? null,
    nombre: p.nombre ?? null,
    apellido: p.apellido ?? null,
    telefono: p.telefono ?? null,
    sexo: p.sexo ?? null,
    fecha_nacimiento: p.fechaNacimiento ?? null,
    edad: p.edad ?? null,
    estatura: p.estatura ?? null,
    peso: p.peso ?? null,
    actividad: p.actividad ?? null,
    calorias_diarias: p.caloriasDiarias ?? null,
  };
}
