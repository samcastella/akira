// lib/user.ts

export type Sex = 'masculino' | 'femenino' | 'prefiero_no_decirlo';

export type UserProfile = {
  nombre: string;
  apellido: string;
  email: string;
  telefono?: string;

  sexo?: Sex;
  edad?: number;        // años
  estatura?: number;    // cm
  peso?: number;        // kg
  caloriasDiarias?: number;
  actividad?: 'sedentario' | 'ligero' | 'moderado' | 'intenso';
};

export const LS_USER = 'akira_user_v1';
export const LS_FIRST_RUN = 'akira_first_run_done';

/** Carga el usuario desde localStorage (o null si no existe / está corrupto). */
export function loadUser(): UserProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LS_USER);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserProfile;
    // sanity check mínima
    if (parsed && typeof parsed === 'object') return parsed;
    return null;
  } catch {
    // Si el JSON está roto, lo limpiamos para evitar errores encadenados
    try { localStorage.removeItem(LS_USER); } catch {}
    return null;
  }
}

/** Guarda el usuario COMPLETO, sobreescribiendo lo anterior. */
export function saveUser(u: UserProfile) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LS_USER, JSON.stringify(u));
}

/** Mezcla y guarda solo los campos que lleguen (no borra lo demás). */
export function saveUserMerge(partial: Partial<UserProfile>) {
  if (typeof window === 'undefined') return;
  const prev = loadUser() ?? ({} as UserProfile);
  const merged = { ...prev, ...partial } as UserProfile;
  localStorage.setItem(LS_USER, JSON.stringify(merged));
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
  return true;
}

// ===== Calorías (Mifflin-St Jeor) con factor de actividad =====
function activityFactor(a: UserProfile['actividad']) {
  switch (a) {
    case 'ligero': return 1.375;
    case 'moderado': return 1.55;
    case 'intenso': return 1.725;
    default: return 1.2; // sedentario
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
