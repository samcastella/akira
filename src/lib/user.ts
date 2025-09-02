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

export function loadUser(): UserProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LS_USER);
    if (!raw) return null;
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

export function saveUser(u: UserProfile) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LS_USER, JSON.stringify(u));
}

export function isUserComplete(u: UserProfile | null): boolean {
  if (!u) return false;
  // Requisitos mínimos: nombre, apellido, email
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

export function estimateCalories(u: UserProfile): number | undefined {
  const { sexo, edad, estatura, peso, actividad } = u;
  if (!sexo || !edad || !estatura || !peso) return undefined;

  // Mifflin-St Jeor (cm, kg, años)
  const base = 10 * peso + 6.25 * estatura - 5 * edad + (sexo === 'masculino' ? 5 : sexo === 'femenino' ? -161 : 0);
  const tdee = Math.round(base * activityFactor(actividad));
  return tdee;
}
