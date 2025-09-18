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
  email?: string;
  username?: string;
  telefono?: string;

  // Personalización / métricas
  sexo?: Sex;
  fechaNacimiento?: string;
  edad?: number;
  estatura?: number;
  peso?: number;
  actividad?: Activity;
  caloriasDiarias?: number;

  /** ISO UTC de DB; usado para resolver conflictos */
  updatedAt?: string | null;

  onboardingDone?: boolean;
};

// 👇 NUEVO: normalizador numérico y comparador de fechas
function parseNumOrNull(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function newer(a?: string | null, b?: string | null) {
  if (!a && !b) return 0;
  if (a && !b) return 1;
  if (!a && b) return -1;
  return new Date(a!).getTime() - new Date(b!).getTime();
}


// ===== Claves de LS (retro-compat) =====
export const LS_USER_KEY = 'akira_user_profile_v2';
export const LS_USER = 'akira_user_v1';
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
    const rawV2 = localStorage.getItem(LS_USER_KEY);
    if (rawV2) {
      const data = JSON.parse(rawV2);
      return (data && typeof data === 'object') ? (data as UserProfile) : {};
    }
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
  try { window.dispatchEvent(new CustomEvent('akira:user-updated')); } catch {}
  return merged;
}

export function clearUser() {
  if (typeof window === 'undefined') return;
  try { localStorage.removeItem(LS_USER_KEY); } catch {}
  try { localStorage.removeItem(LS_USER); } catch {}
}

/** Reglas mínimas para considerar “completo” */
export function isUserComplete(u: UserProfile | null | undefined): boolean {
  if (!u) return false;

  // Si viene de DB (tiene updatedAt) asumimos perfil base creado
  if (u.updatedAt) return true;

  // O si al menos tiene métricas físicas razonables
  const heightOk = typeof u.estatura === 'number' && u.estatura >= 80 && u.estatura <= 250;
  const weightOk = typeof u.peso === 'number' && u.peso >= 20 && u.peso <= 400;

  if (heightOk && weightOk) return true;

  // Si quieres seguir pidiendo datos básicos, mantenlo como "soft"
  const hasBasics =
    !!u.nombre?.trim() ||
    !!u.apellido?.trim() ||
    !!u.email?.trim() ||
    !!u.username?.trim();

  return !!hasBasics;
}

// ===== Calorías (Mifflin-St Jeor) =====
function activityFactor(a: Activity | undefined): number {
  switch (a) {
    case 'ligero': return 1.375;
    case 'moderado': return 1.55;
    case 'intenso': return 1.725;
    default: return 1.2;
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

export function profileFromDbRow(row: any): Partial<UserProfile> {
  if (!row || typeof row !== 'object') return {};
  return {
    userId: row.user_id ?? undefined,
    username: row.username ?? undefined,
    nombre: row.nombre ?? undefined,
    apellido: row.apellido ?? undefined,
    email: row.email ?? undefined,
    telefono: row.telefono ?? undefined,
    sexo: row.sexo ?? undefined,
    fechaNacimiento: row.fecha_nacimiento ?? undefined,
    edad: row.edad ?? undefined,
    estatura: parseNumOrNull(row.estatura) ?? undefined,
    peso: parseNumOrNull(row.peso) ?? undefined,
    actividad: row.actividad ?? undefined,
    caloriasDiarias: parseNumOrNull(row.calorias_diarias) ?? undefined,
    updatedAt: row.updated_at ?? null,
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
    estatura: parseNumOrNull(p.estatura),
    peso: parseNumOrNull(p.peso),
    actividad: p.actividad ?? null,
    calorias_diarias: parseNumOrNull(p.caloriasDiarias),
    // updated_at lo gestiona el trigger en DB
  };
}


/* ===========================================================
   === SINCRONIZACIÓN CON SUPABASE: upsert / pull / bootstrap ===
   =========================================================== */
export async function getAuthUserId(): Promise<string | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.warn('[auth.getSession] error', error);
    return null;
  }
  return data.session?.user?.id ?? null;
}

export async function upsertProfile(partial: Partial<UserProfile>): Promise<UserProfile> {
  const uid = await getAuthUserId();
  if (!uid) throw new Error('No hay sesión activa para upsertProfile');

  const normalized: Partial<UserProfile> = {
  ...partial,
  estatura: parseNumOrNull(partial.estatura) ?? undefined,
  peso: parseNumOrNull(partial.peso) ?? undefined,
  caloriasDiarias: parseNumOrNull(partial.caloriasDiarias) ?? undefined,
  userId: uid,
};


  const row = dbRowFromProfile(normalized);

  const { error } = await supabase
    .from('public_profiles')
    .upsert(row, { onConflict: 'user_id' });

  if (error) {
    console.error('[upsertProfile] error', error);
    throw error;
  }

  const { data: fresh, error: selErr } = await supabase
    .from('public_profiles')
    .select('*')
    .eq('user_id', uid)
    .single();

  if (selErr) {
    console.error('[upsertProfile] select fresh error', selErr);
    throw selErr;
  }

  const profile = profileFromDbRow(fresh) as UserProfile;
  saveUser(profile);
  return profile;
}


export async function pullProfile(): Promise<UserProfile | null> {
  const uid = await getAuthUserId();
  if (!uid) return null;

  const { data: remote, error } = await supabase
    .from('public_profiles')
    .select('*')
    .eq('user_id', uid)
    .maybeSingle();

  if (error) {
    console.error('[pullProfile] error', error);
    throw error;
  }

  const local = loadUser();

  // normaliza numéricos
  if (local) {
    local.estatura = parseNumOrNull(local.estatura) ?? undefined;
    local.peso = parseNumOrNull(local.peso) ?? undefined;
    local.caloriasDiarias = parseNumOrNull(local.caloriasDiarias) ?? undefined;
  }

  const r = remote ? (profileFromDbRow(remote) as UserProfile) : null;

  // Estrategia:
  // - Si hay remoto y (no hay local o remoto.updatedAt es más nuevo) → guardar remoto y devolverlo
  // - Si no hay remoto pero sí local “completo” → subir local y devolver su versión
  // - Si ambos existen y local es más nuevo (caso raro) → subimos local y guardamos local
  if (r && (!local || newer(r.updatedAt, local.updatedAt) > 0)) {
    saveUser(r);
    return r;
  }

  if (!r && local && local.userId === uid) {
    // crea remoto a partir de local
    const row = dbRowFromProfile({ ...local, userId: uid });
    const { error: upErr } = await supabase
      .from('public_profiles')
      .upsert(row, { onConflict: 'user_id' });
    if (upErr) console.error('[pullProfile] upsert from local error', upErr);

    // re-leer para obtener updated_at real
    const { data: fresh } = await supabase
      .from('public_profiles')
      .select('*')
      .eq('user_id', uid)
      .single();

    const pf = profileFromDbRow(fresh) as UserProfile;
    saveUser(pf);
    return pf;
  }

  // si ambos existen y local parece más nuevo, subida conservadora
  if (r && local && newer(local.updatedAt, r.updatedAt) > 0) {
    const row = dbRowFromProfile({ ...local, userId: uid });
    const { error: upErr } = await supabase
      .from('public_profiles')
      .upsert(row, { onConflict: 'user_id' });
    if (upErr) console.error('[pullProfile] upsert newer local error', upErr);

    // re-lee y guarda
    const { data: fresh } = await supabase
      .from('public_profiles')
      .select('*')
      .eq('user_id', uid)
      .single();
    const pf = profileFromDbRow(fresh) as UserProfile;
    saveUser(pf);
    return pf;
  }

  // por defecto, conserva local
  return local ?? null;
}


export async function syncLocalToRemoteIfMissing(): Promise<UserProfile | null> {
  const uid = await getAuthUserId();
  if (!uid) return null;

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
    return await pullProfile();
  }

  let local: Partial<UserProfile> | null = null;
  try {
    local = loadUser();
  } catch {}

  if (!local || !(local.nombre && local.apellido && local.email)) {
    return null;
  }

  const created = await upsertProfile(local);
  return created;
}

/* ===== Hooks/Helpers de sesión ===== */
export function useAuthUserId(): string | null {
  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (mounted) setUid(data.user?.id ?? null);
      } catch {
        if (mounted) setUid(null);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUid(session?.user?.id ?? null);
    });

    return () => {
      mounted = false;
      try { (sub as any)?.subscription?.unsubscribe?.(); } catch {}
      try { (sub as any)?.unsubscribe?.(); } catch {}
    };
  }, []);

  return uid;
}

export function onAuthReady(fn: (uid: string) => Promise<void> | void): () => void {
  let called = false;

  const run = (uid: string | null | undefined) => {
    if (called) return;
    if (uid) {
      called = true;
      void fn(uid);
    }
  };

  void supabase.auth.getUser().then(({ data }) => run(data.user?.id));

  const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
    run(session?.user?.id);
  });

  return () => {
    try { (sub as any)?.subscription?.unsubscribe?.(); } catch {}
    try { (sub as any)?.unsubscribe?.(); } catch {}
  };
}

/* ===== Hook para componentes cliente ===== */
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
