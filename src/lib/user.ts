// lib/user.ts

export type Sex = 'masculino' | 'femenino' | 'prefiero_no_decirlo';

export type UserProfile = {
  // Identidad básica
  nombre: string;
  apellido: string;
  email: string;      // se guardará normalizado en minúsculas
  username?: string;  // NUEVO: nombre de usuario (minúsculas, sin espacios)
  telefono?: string;

  // Datos opcionales para métricas
  sexo?: Sex;
  edad?: number;        // años
  estatura?: number;    // cm
  peso?: number;        // kg
  caloriasDiarias?: number;
  actividad?: 'sedentario' | 'ligero' | 'moderado' | 'intenso';
};

export const LS_USER = 'akira_user_v1';
export const LS_FIRST_RUN = 'akira_first_run_done';

/* ===========================
   Normalizadores
   =========================== */
export function normalizeEmail(email: string | undefined | null): string {
  return (email || '').trim().toLowerCase();
}

/** Normaliza username: minúsculas, sin espacios, sin @ inicial. */
export function normalizeUsername(u?: string | null): string | undefined {
  if (!u) return undefined;
  const cleaned = u.trim().replace(/^@+/, '').toLowerCase();
  return cleaned.replace(/\s+/g, '');
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

/* ===========================
   Persistencia local
   =========================== */
/** Carga el usuario desde localStorage (o null si no existe / está corrupto). */
export function loadUser(): UserProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LS_USER);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserProfile;

    // Backward compatibility: normaliza campos claves si faltan/están sucios
    const fixed = {
      ...parsed,
      email: normalizeEmail(parsed.email),
      username: normalizeUsername(parsed.username),
    } as UserProfile;

    if (fixed && typeof fixed === 'object') return fixed;
    return null;
  } catch {
    try { localStorage.removeItem(LS_USER); } catch {}
    return null;
  }
}

/** Guarda el usuario COMPLETO, sobreescribiendo lo anterior. Devuelve el usuario normalizado. */
export function saveUser(u: UserProfile): UserProfile {
  if (typeof window === 'undefined') return { ...u, ...sanitizeUser(u) } as UserProfile;
  const normalized = { ...u, ...sanitizeUser(u) } as UserProfile;
  localStorage.setItem(LS_USER, JSON.stringify(normalized));
  return normalized;
}

/** Mezcla y guarda solo los campos que lleguen (no borra lo demás). Devuelve el usuario resultante. */
export function saveUserMerge(partial: Partial<UserProfile>): UserProfile {
  if (typeof window === 'undefined') {
    // En SSR devolvemos el merge teórico sin tocar storage
    const prev = {} as UserProfile;
    const norm = sanitizeUser(partial);
    return { ...prev, ...norm } as UserProfile;
  }
  const prev = loadUser() ?? ({} as UserProfile);
  const norm = sanitizeUser(partial);
  const merged = { ...prev, ...norm } as UserProfile;
  localStorage.setItem(LS_USER, JSON.stringify(merged));
  return merged;
}

/** Elimina el usuario (útil en pruebas). */
export function clearUser() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(LS_USER);
}

/** ¿Cumple los mínimos para “dejar pasar” a la app? */
export function isUserComplete(u: UserProfile | null): boolean {
  if (!u) return false;
  if (!u.nombre?.trim() || !u.apellido?.trim() || !u.email?.trim()) return false;
  // NUEVO: username requerido
  if (!u.username || !u.username.trim()) return false;
  return true;
}

/* ===========================
   Calorías (Mifflin-St Jeor)
   =========================== */
function activityFactor(a: UserProfile['actividad']): number {
  switch (a) {
    case 'ligero': return 1.375;
    case 'moderado': return 1.55;
    case 'intenso': return 1.725;
    default: return 1.2; // sedentario o undefined
  }
}

/** Estima TDEE (calorías/día) si hay datos suficientes. */
export function estimateCalories(u: UserProfile): number | undefined {
  const { sexo, edad, estatura, peso, actividad } = u;
  if (!sexo || !edad || !estatura || !peso) return undefined;

  // Mifflin-St Jeor (cm, kg, años)
  const base =
    10 * peso +
    6.25 * estatura -
    5 * edad +
    (sexo === 'masculino' ? 5 : sexo === 'femenino' ? -161 : 0);

  const tdee = Math.round(base * activityFactor(actividad));
  return tdee;
}
