// components/RegistrationForm.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  estimateCalories,
  isUserComplete,
  loadUser,
  saveUserMerge,
  Sex,
  UserProfile,
  upsertProfile,
} from '@/lib/user';

type Step = 1 | 2;

export default function RegistrationForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [saving, setSaving] = useState(false);

  const [user, setUser] = useState<UserProfile>({
    nombre: '',
    apellido: '',
    email: '',
    telefono: '',
    sexo: 'prefiero_no_decirlo',
    edad: undefined,
    estatura: undefined,
    peso: undefined,
    caloriasDiarias: undefined,
    actividad: 'sedentario',
  });

  useEffect(() => {
    const existing = loadUser();
    if (isUserComplete(existing)) {
      router.replace('/');
    }
  }, [router]);

  const canContinueStep1 = useMemo(() => {
    const nombre   = (user.nombre   ?? '').trim();
    const apellido = (user.apellido ?? '').trim();
    const email    = (user.email    ?? '').trim();
    return nombre.length > 0 && apellido.length > 0 && email.length > 4;
  }, [user]);

  function handleChange<K extends keyof UserProfile>(key: K, value: UserProfile[K]) {
    setUser((prev) => ({ ...prev, [key]: value }));
  }

  function goNext() {
    if (step === 1) {
      if (!canContinueStep1) return;
      setStep(2);
    }
  }

  async function persistAndContinue() {
    setSaving(true);
    try {
      // 1) Escribe/actualiza el perfil en Supabase
      const serverProfile = await upsertProfile(user);
      // 2) Refleja en LocalStorage (mergea sin pisar campos más nuevos)
      saveUserMerge(serverProfile);
      // 3) Navega
      router.push('/bienvenida');
    } catch (err) {
      console.warn('[RegistrationForm] upsertProfile fallo, guardo local y continuo', err);
      // Fallback: al menos guarda local para no bloquear el flujo
      saveUserMerge(user);
      router.push('/bienvenida');
    } finally {
      setSaving(false);
    }
  }

  async function skipStep2() {
    await persistAndContinue();
  }

  function autoCalories() {
    const est = estimateCalories(user);
    if (est) {
      setUser((p) => ({ ...p, caloriasDiarias: est }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await persistAndContinue();
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      {step === 1 && (
        <form onSubmit={(e) => { e.preventDefault(); goNext(); }} className="space-y-5">
          <h1 className="text-2xl font-bold">Crear cuenta</h1>
          <p className="text-sm text-gray-600">
            Estos datos nos ayudan a personalizar tu experiencia.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm font-medium">Nombre</span>
              <input
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:ring-2"
                value={user.nombre ?? ''}
                onChange={(e) => handleChange('nombre', e.target.value)}
                required
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium">Apellido</span>
              <input
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:ring-2"
                value={user.apellido ?? ''}
                onChange={(e) => handleChange('apellido', e.target.value)}
                required
              />
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-medium">Email</span>
            <input
              type="email"
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:ring-2"
              value={user.email ?? ''}
              onChange={(e) => handleChange('email', e.target.value)}
              required
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">Teléfono (opcional)</span>
            <input
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:ring-2"
              value={user.telefono ?? ''}
              onChange={(e) => handleChange('telefono', e.target.value)}
            />
          </label>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={!canContinueStep1 || saving}
              className="rounded-full px-5 py-2 border border-black disabled:opacity-50"
            >
              {saving ? 'Guardando…' : 'Continuar'}
            </button>
          </div>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={handleSubmit} className="space-y-5">
          <h2 className="text-xl font-semibold">Datos para personalizar tu experiencia</h2>
          <p className="text-sm text-gray-600">
            Estos datos nos ayudarán a algunas de las funciones de la app (registro de ejercicios, cálculo de calorías, etc.). Puedes saltar este paso.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm font-medium">Sexo</span>
              <select
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2"
                value={user.sexo ?? 'prefiero_no_decirlo'}
                onChange={(e) => handleChange('sexo', e.target.value as Sex)}
              >
                <option value="masculino">Masculino</option>
                <option value="femenino">Femenino</option>
                <option value="prefiero_no_decirlo">Prefiero no decirlo</option>
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium">Edad (años)</span>
              <input
                type="number"
                min={5}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2"
                value={user.edad ?? ''}
                onChange={(e) => handleChange('edad', e.target.value ? Number(e.target.value) : undefined)}
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium">Estatura (cm)</span>
              <input
                type="number"
                min={80}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2"
                value={user.estatura ?? ''}
                onChange={(e) => handleChange('estatura', e.target.value ? Number(e.target.value) : undefined)}
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium">Peso (kg)</span>
              <input
                type="number"
                min={20}
                step="0.1"
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2"
                value={user.peso ?? ''}
                onChange={(e) => handleChange('peso', e.target.value ? Number(e.target.value) : undefined)}
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium">Actividad</span>
              <select
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2"
                value={user.actividad ?? 'sedentario'}
                onChange={(e) => handleChange('actividad', e.target.value as UserProfile['actividad'])}
              >
                <option value="sedentario">Sedentario</option>
                <option value="ligero">Ligero (1–3 días/sem)</option>
                <option value="moderado">Moderado (3–5 días/sem)</option>
                <option value="intenso">Intenso (6–7 días/sem)</option>
              </select>
            </label>

            <label className="block md:col-span-2">
              <span className="text-sm font-medium">Requerimiento de calorías diario</span>
              <div className="mt-1 flex gap-2">
                <input
                  type="number"
                  min={800}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2"
                  value={user.caloriasDiarias ?? ''}
                  onChange={(e) => handleChange('caloriasDiarias', e.target.value ? Number(e.target.value) : undefined)}
                />
                <button
                  type="button"
                  onClick={autoCalories}
                  className="rounded-full px-4 border border-black"
                >
                  Calcular
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Puedes calcular automáticamente (Mifflin-St Jeor) o introducirlo manualmente.
              </p>
            </label>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={skipStep2}
              disabled={saving}
              className="rounded-full px-5 py-2 border border-gray-300 disabled:opacity-50"
            >
              {saving ? 'Guardando…' : 'Saltar'}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-full px-5 py-2 border border-black disabled:opacity-50"
            >
              {saving ? 'Guardando…' : 'Guardar y continuar'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
