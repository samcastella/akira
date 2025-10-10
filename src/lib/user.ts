// src/lib/user.ts
import { supabase, isSupabaseEnvReady } from '@/lib/supabaseClient';
import { useEffect, useState } from 'react';

// ===== Tipos =====
export type Activity = 'sedentario' | 'ligero' | 'moderado' | 'intenso';
export type Sex = 'masculino' | 'femenino' | 'prefiero_no_decirlo';

export type UserProfile = {
  userId?: string;
  nombre?: string;
  apellido?: string;
  email?: string;
  username?: string;
  telefono?: string;
  sexo?: Sex;
  fechaNacimiento?: string;
  edad?: number;
  estatura?: number;
  peso?: number;
  actividad?: Activity;
  caloriasDiarias?: number;
  updatedAt?: string | null; // ISO UTC de DB
  onboardingDone?: boolean;

  /** Redes sociales */
  instagram?: string;
  tiktok?: string;

  /** URL o dataURL de la foto de perfil (local o Supabase Storage) */
  foto?: string;
};

// ---- helpers num/fecha
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

// ===== LS keys =====
export const LS_USER_KEY = 'akira_user_profile_v2';
export const LS_USER = 'akira_user_v1';
export const LS_FIRST_RUN = 'akira_first_run_done';
const LS_LAST_UID = 'akira_last_uid';

// ===== Normalizadores / utilidades =====
export function normalizeEmail(email: string | undefined | null): string {
  return (email || '').trim().toLowerCase();
}
export function normalizeUsername(u: string | undefined | null): string {
  return (u ?? '').trim().replace(/^@+/, '').toLowerCase().replace(/\s+/g, '');
}
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
  // out.foto puede ser URL o dataURL; no tocar para no romper base64
  return out;
}
function keepDefined<T extends Record<string, any>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null) (out as any)[k] = v;
  }
  return out;
}

// ===== Persistencia local =====
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

/** Perfil “completo” mínimo */
export function isUserComplete(u: UserProfile | null | undefined): boolean {
  if (!u) return false;
  if (u.updatedAt) return true;
  const heightOk = typeof u.estatura === 'number' && u.estatura >= 80 && u.estatura <= 250;
  const weightOk = typeof u.peso === 'number' && u.peso >= 20 && u.peso <= 400;
  if (heightOk && weightOk) return true;
  const hasBasics = !!u.nombre?.trim() || !!u.apellido?.trim() || !!u.email?.trim() || !!u.username?.trim();
  return !!hasBasics;
}

// ===== Calorías =====
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
  const base = 10 * u.peso + 6.25 * u.estatura - 5 * edad + (u.sexo === 'masculino' ? 5 : u.sexo === 'femenino' ? -161 : 0);
  return Math.round(base * activityFactor(u.actividad));
}

// ===== Mapas DB <-> App =====
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
    // Nuevos campos
    instagram: row.instagram ?? undefined,
    tiktok: row.tiktok ?? undefined,
    foto: row.foto ?? row.avatar_url ?? undefined,
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
    // Nuevos mapeos
    email: p.email ?? null,
    instagram: p.instagram ?? null,
    tiktok: p.tiktok ?? null,
    // Guardamos siempre en 'avatar_url' para consistencia
    avatar_url: p.foto ?? null,
  };
}

/* ===========================================================
   === SINCRONIZACIÓN CON SUPABASE: upsert / pull / bootstrap ===
   =========================================================== */

/**
 * Hidrata la sesión del cliente desde la cookie httpOnly del servidor
 * llamando a /auth/set (tu endpoint devuelve access/refresh si hay cookie).
 */
async function ensureClientSessionFromServer(): Promise<boolean> {
  try {
    const resp = await fetch('/auth/set', {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers: { 'content-type': 'application/json' },
    });
    if (!resp.ok) return false;
    const j = await resp.json().catch(() => ({} as any));
    const at = j?.access_token as string | undefined;
    const rt = j?.refresh_token as string | undefined;
    if (!at || !rt) return false;

    await supabase.auth.setSession({ access_token: at, refresh_token: rt });
    await supabase.auth.getSession().catch(() => {});
    return true;
  } catch {
    return false;
  }
}

export async function getAuthUserId(): Promise<string | null> {
  if (!isSupabaseEnvReady()) return null;

  // 1) Intento directo con getUser (rápido)
  try {
    const { data } = await supabase.auth.getUser();
    if (data.user?.id) {
      try { localStorage.setItem(LS_LAST_UID, data.user.id); } catch {}
      return data.user.id;
    }
  } catch {}

  // 2) Intento con getSession
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user?.id) {
      try { localStorage.setItem(LS_LAST_UID, data.session.user.id); } catch {}
      return data.session.user.id;
    }
  } catch {}

  // 3) Plan B: hidratar desde cookie del servidor y reintentar
  const hydrated = await ensureClientSessionFromServer();
  if (hydrated) {
    try {
      const { data } = await supabase.auth.getUser();
      const id = data.user?.id ?? null;
      try {
        if (id) localStorage.setItem(LS_LAST_UID, id);
        else localStorage.removeItem(LS_LAST_UID);
      } catch {}
      return id;
    } catch {
      return null;
    }
  }
  return null;
}

export async function upsertProfile(partial: Partial<UserProfile>): Promise<UserProfile> {
  if (!isSupabaseEnvReady()) throw new Error('Supabase deshabilitado (ENV faltan)');
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

  const { error } = await supabase.from('public_profiles').upsert(row, { onConflict: 'user_id' });
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

/**
 * Trae el perfil remoto si existe. No lanza: en caso de error devuelve local o null.
 */
export async function pullProfile(): Promise<UserProfile | null> {
  if (!isSupabaseEnvReady()) return loadUser() ?? null;

  const uid = await getAuthUserId();
  if (!uid) return loadUser() ?? null;

  try {
    const { data: remote, error } = await supabase
      .from('public_profiles')
      .select('*')
      .eq('user_id', uid)
      .maybeSingle();

    if (error) {
      console.warn('[pullProfile] select error:', error);
      return loadUser() ?? null;
    }

    const local = loadUser();
    if (local) {
      local.estatura = parseNumOrNull(local.estatura) ?? undefined;
      local.peso = parseNumOrNull(local.peso) ?? undefined;
      local.caloriasDiarias = parseNumOrNull(local.caloriasDiarias) ?? undefined;
    }

    const r = remote ? (profileFromDbRow(remote) as UserProfile) : null;

    if (r && (!local || newer(r.updatedAt, local.updatedAt) > 0)) {
      saveUser(r);
      return r;
    }

    if (!r && local && (local.userId === uid || !local.userId)) {
      const row = dbRowFromProfile({ ...local, userId: uid });
      const { error: upErr } = await supabase
        .from('public_profiles')
        .upsert(row, { onConflict: 'user_id' });
      if (upErr) {
        console.warn('[pullProfile] upsert from local error', upErr);
        return local;
      }

      const { data: fresh, error: sel2 } = await supabase
        .from('public_profiles')
        .select('*')
        .eq('user_id', uid)
        .single();

      if (sel2) {
        console.warn('[pullProfile] reselect error after upsert', sel2);
        return local;
      }

      const pf = profileFromDbRow(fresh) as UserProfile;
      saveUser(pf);
      return pf;
    }

    if (r && local && newer(local.updatedAt, r.updatedAt) > 0) {
      const row = dbRowFromProfile({ ...local, userId: uid });
      const { error: upErr } = await supabase
        .from('public_profiles')
        .upsert(row, { onConflict: 'user_id' });
      if (upErr) {
        console.warn('[pullProfile] upsert newer local error', upErr);
        return local;
      }

      const { data: fresh, error: sel3 } = await supabase
        .from('public_profiles')
        .select('*')
        .eq('user_id', uid)
        .single();
      if (sel3) {
        console.warn('[pullProfile] reselect error after pushing newer local', sel3);
        return local;
      }

      const pf = profileFromDbRow(fresh) as UserProfile;
      saveUser(pf);
      return pf;
    }

    return (r ?? local ?? null) as UserProfile | null;
  } catch (e) {
    console.warn('[pullProfile] unexpected error:', e);
    return loadUser() ?? null;
  }
}

/**
 * Si no hay fila remota, intenta crearla desde el local. No lanza.
 */
export async function syncLocalToRemoteIfMissing(): Promise<UserProfile | null> {
  if (!isSupabaseEnvReady()) return loadUser() ?? null;

  const uid = await getAuthUserId();
  if (!uid) return loadUser() ?? null;

  try {
    const { data, error } = await supabase
      .from('public_profiles')
      .select('user_id')
      .eq('user_id', uid)
      .maybeSingle();

    if (error) {
      console.warn('[syncLocalToRemoteIfMissing] SELECT error:', error);
      return loadUser() ?? null;
    }
    if (data) {
      return await pullProfile();
    }

    let local: Partial<UserProfile> | null = null;
    try {
      local = loadUser();
    } catch {
      local = null;
    }

    if (!local || !(local.nombre && local.apellido && (local.email || local.username))) {
      return loadUser() ?? null;
    }

    try {
      const created = await upsertProfile({ ...local, userId: uid });
      return created;
    } catch (e) {
      console.warn('[syncLocalToRemoteIfMissing] upsert error:', e);
      return loadUser() ?? null;
    }
  } catch (e) {
    console.warn('[syncLocalToRemoteIfMissing] unexpected error:', e);
    return loadUser() ?? null;
  }
}

/* ===== Hooks/Helpers de sesión ===== */
export function useAuthUserId(): string | null {
  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseEnvReady()) {
      setUid(null);
      try { localStorage.removeItem(LS_LAST_UID); } catch {}
      return;
    }
    let mounted = true;

    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const id = data.user?.id ?? null;
        if (mounted) setUid(id);
        try {
          if (id) localStorage.setItem(LS_LAST_UID, id);
          else localStorage.removeItem(LS_LAST_UID);
        } catch {}
      } catch {
        if (mounted) setUid(null);
        try { localStorage.removeItem(LS_LAST_UID); } catch {}
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      const id = session?.user?.id ?? null;
      setUid(id);
      try {
        if (id) localStorage.setItem(LS_LAST_UID, id);
        else localStorage.removeItem(LS_LAST_UID);
      } catch {}
    });

    return () => {
      mounted = false;
      try { (sub as any)?.subscription?.unsubscribe?.(); } catch {}
      try { (sub as any)?.unsubscribe?.(); } catch {}
    };
  }, []);

  return uid;
}

/**
 * Llama a `fn(uid)` la primera vez que hay usuario (y sólo una vez).
 * No suscribe nada si no hay ENV.
 */
export function onAuthReady(fn: (uid: string) => Promise<void> | void): () => void {
  if (!isSupabaseEnvReady()) {
    return () => {};
  }

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

/* ===== Orquestación de listeners (solicitada por LayoutClient) ===== */
let __userRealtimeStarted = false;
let __userRealtimeSub: { unsubscribe?: () => void } | null = null;

/** Arranca listeners internos de user.ts. Idempotente. */
export function startUserLibRealtime() {
  if (__userRealtimeStarted) return;
  if (!isSupabaseEnvReady()) return;
  __userRealtimeStarted = true;

  // Primer “ping” con usuario actual (para que otros escuchadores reaccionen)
  supabase.auth.getUser().then(({ data }) => {
    try {
      const id = data.user?.id ?? null;
      if (id) localStorage.setItem(LS_LAST_UID, id);
      else localStorage.removeItem(LS_LAST_UID);
    } catch {}
    try { window.dispatchEvent(new CustomEvent('akira:user-updated')); } catch {}
    try { window.dispatchEvent(new CustomEvent('akira:auth-changed', { detail: { initial: true } })); } catch {}
  });

  // Suscripción a cambios de auth
  const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
    try {
      const id = session?.user?.id ?? null;
      if (id) localStorage.setItem(LS_LAST_UID, id);
      else localStorage.removeItem(LS_LAST_UID);
    } catch {}
    try { window.dispatchEvent(new CustomEvent('akira:user-updated')); } catch {}
    try { window.dispatchEvent(new CustomEvent('akira:auth-changed', { detail: { evt: _event } })); } catch {}
  });

  __userRealtimeSub = (sub as any)?.subscription ?? (sub as any) ?? null;
}

/** Detiene los listeners internos. */
export function stopUserLibRealtime() {
  try { (__userRealtimeSub as any)?.unsubscribe?.(); } catch {}
  __userRealtimeSub = null;
  __userRealtimeStarted = false;
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
