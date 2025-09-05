// src/lib/user.ts
import { supabase } from '@/lib/supabaseClient';
import { useEffect, useState } from 'react';

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
/** Evita sobreescribir con undefined/null al hacer merge en LS */
function keepDefined<T extends Record<string, any>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null) (out as any)[k] = v;
  }
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
      return (data && typeof data === 'object') ? (data as UserProfile) : {};
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
  // 🔔 notificar a la UI
  try { window.dispatchEvent(new CustomEvent('akira:user-updated')); } catch {}
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
  // 🔔 notificar a la UI
  try { window.dispatchEvent(new CustomEvent('akira:user-updated')); } catch {}
  return merged;
}

export function clearUser() {
  if (typeof window === 'undefined') return;
  try { localStorage.removeItem(LS_USER_KEY); } catch {}
  try { localStorage.removeItem(LS_USER); } catch {}
}

/** Reglas mínimas para considerar “completo”:
 *  - identidad: nombre, apellido, email y username
 *  - métricas: fechaNacimiento válida (edad >= 5 y <= 120), estatura y peso en rangos razonables
 */
export function isUserComplete(u: UserProfile | null | undefined): boolean {
  if (!u) return false;

  const hasBasics =
    !!u.nombre?.trim() &&
    !!u.apellido?.trim() &&
    !!u.email?.trim() &&
    !!u.username?.trim();

  if (!hasBasics) return false;

  // Validar fecha de nacimiento con edad derivada
  const age = ageFromDOB(u.fechaNacimiento);
  const dobOk = !!u.fechaNacimiento && age !== undefined && age >= 5 && age <= 120;

  // Rangos razonables
  const heightOk = typeof u.estatura === 'number' && u.estatura >= 80 && u.estatura <= 250;
  const weightOk = typeof u.peso === 'number' && u.peso >= 20 && u.peso <= 400;

  return dobOk && heightOk && weightOk;
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

/* ===========================================================
   === SINCRONIZACIÓN CON SUPABASE: upsert / pull / bootstrap ===
   =========================================================== */

/** Obtiene el user_id del usuario autenticado */
export async function getAuthUserId(): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    console.warn('[auth.getUser] error', error);
    return null;
  }
  return data.user?.id ?? null;
}

/**
 * Crea/actualiza la fila del perfil en public_profiles (onConflict: user_id)
 * y devuelve el perfil normalizado (tipo local). También mergea a LocalStorage.
 */
export async function upsertProfile(partial: Partial<UserProfile>): Promise<UserProfile> {
  const uid = await getAuthUserId();
  if (!uid) throw new Error('No hay sesión activa para upsertProfile');

  // construimos fila DB (forzando user_id)
  const row = dbRowFromProfile({ ...partial, userId: uid });

  const { data, error } = await supabase
    .from('public_profiles')
    .upsert(row, { onConflict: 'user_id' })
    .select('*')
    .single(); // <- sin .eq()

  if (error) {
    console.error('[upsertProfile] error', error);
    throw error;
  }

  const profile = profileFromDbRow(data) as UserProfile;

  // reflejamos localmente sin pisar con undefined/null
  try {
    saveUserMerge(keepDefined(profile));
  } catch (e) {
    console.warn('[upsertProfile] saveUserMerge fallo (ignorable)', e);
  }

  return profile;
}

/**
 * Lee el perfil remoto; si existe, lo mergea en LocalStorage.
 * Devuelve el perfil (local) o null si no hay fila.
 */
export async function pullProfile(): Promise<UserProfile | null> {
  const uid = await getAuthUserId();
  if (!uid) return null;

  const { data, error } = await supabase
    .from('public_profiles')
    .select('*')
    .eq('user_id', uid)
    .maybeSingle();

  if (error) {
    console.error('[pullProfile] error', error);
    throw error;
  }
  if (!data) return null;

  const profile = profileFromDbRow(data) as UserProfile;

  try {
    saveUserMerge(keepDefined(profile));
  } catch (e) {
    console.warn('[pullProfile] saveUserMerge fallo (ignorable)', e);
  }

  return profile;
}

/**
 * Si no existe fila remota pero hay datos mínimos en LocalStorage,
 * crea la fila en DB y la deja sincronizada localmente.
 */
export async function syncLocalToRemoteIfMissing(): Promise<UserProfile | null> {
  const uid = await getAuthUserId();
  if (!uid) return null;

  // ¿ya existe fila?
  const { data, error } = await supabase
    .from('public_profiles')
    .select('user_id')
    .eq('user_id', uid)
    .maybeSingle();

  if (error) {
    console.error('[syncLocalToRemoteIfMissing] error SELECT', error);
    throw error;
  }
  if (data) {
    // ya existe; hidratamos LS por si acaso
    return await pullProfile();
  }

  // No existe fila: intentamos crearla desde LS si hay datos mínimos
  let local: Partial<UserProfile> | null = null;
  try {
    local = loadUser();
  } catch {
    /* noop */
  }

  if (!local || !(local.nombre && local.apellido && local.email)) {
    // no hay datos locales suficientes
    return null;
  }

  const created = await upsertProfile(local);
  return created;
}

/* ===== Hook para componentes cliente (reactiva la UI al sincronizar) ===== */
export function useUserProfile(): UserProfile {
  const [u, setU] = useState<UserProfile>(() => (typeof window === 'undefined' ? {} : loadUser()));
  useEffect(() => {
    const onUpdate = () => setU(loadUser());
    window.addEventListener('akira:user-updated', onUpdate);
    window.addEventListener('storage', onUpdate);
    return () => {
      window.removeEventListener('akira:user-updated', onUpdate);
      window.removeEventListener('storage', onUpdate);
    };
  }, []);
  return u;
}
