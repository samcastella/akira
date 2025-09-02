'use client';

import { useMemo, useState } from 'react';
import { UserProfile, estimateCalories, saveUserMerge } from '@/lib/user';

type Step = 1 | 2 | 3;
type Sex = 'masculino' | 'femenino' | 'prefiero_no_decirlo';
type Act = 'sedentario' | 'ligero' | 'moderado' | 'intenso';

// Extendemos por si el tipo UserProfile aún no tuviera todos los campos
type FormUser = UserProfile & {
  sexo?: Sex;
  edad?: number;
  estatura?: number;  // cm
  peso?: number;      // kg
  actividad?: Act;
  caloriasDiarias?: number;
};

export default function RegistrationModal({ onClose }: { onClose?: () => void }) {
  const [step, setStep] = useState<Step>(1);
  const [user, setUser] = useState<FormUser>({
    nombre: '',
    apellido: '',
    email: '',
    telefono: '',
    sexo: 'prefiero_no_decirlo',
    actividad: 'sedentario',
  });

  function handleChange<K extends keyof FormUser>(key: K, value: FormUser[K]) {
    setUser((prev) => ({ ...prev, [key]: value }));
  }

  const canNext1 = useMemo(
    () => !!user.nombre?.trim() && !!user.apellido?.trim() && !!user.email?.trim(),
    [user.nombre, user.apellido, user.email]
  );

  function handleAutoCalories() {
    try {
      const est = estimateCalories?.(user as UserProfile);
      if (est) return setUser((p) => ({ ...p, caloriasDiarias: est }));
    } catch {}
    // Fallback rápido por si estimateCalories no está disponible
    const { sexo, edad, estatura, peso, actividad } = user;
    if (!edad || !estatura || !peso) return;
    const base = 10 * peso + 6.25 * estatura - 5 * edad + (sexo === 'masculino' ? 5 : sexo === 'femenino' ? -161 : 0);
    const factor =
      actividad === 'ligero' ? 1.375 :
      actividad === 'moderado' ? 1.55 :
      actividad === 'intenso' ? 1.725 : 1.2;
    const tdee = Math.round(base * factor);
    setUser((p) => ({ ...p, caloriasDiarias: tdee }));
  }

  function nextFromStep1(e: React.FormEvent) {
    e.preventDefault();
    if (!canNext1) return;
    // Guardado incremental
    saveUserMerge({
      nombre: user.nombre,
      apellido: user.apellido,
      email: user.email,
      telefono: user.telefono,
    });
    setStep(2);
  }

  function nextFromStep2(e: React.FormEvent) {
    e.preventDefault();
    // Guardado incremental de salud
    saveUserMerge({
      sexo: user.sexo,
      edad: user.edad,
      estatura: user.estatura,
      peso: user.peso,
      actividad: user.actividad,
      caloriasDiarias: user.caloriasDiarias,
    });
    setStep(3);
  }

  function finish() {
    // Último merge por si algo cambió
    saveUserMerge(user);
    onClose?.(); // El layout desbloquea la app
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60">
      <div
        className="bg-white w-[70vw] max-w-2xl mx-4 rounded-2xl p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reg-title"
      >
        {/* Cabecera con pasos */}
        <div className="flex items-center justify-between mb-4">
          <h2 id="reg-title" className="text-lg font-bold">Registro</h2>
          <div className="flex items-center gap-2 text-xs">
            <StepDot active={step >= 1} />
            <StepDot active={step >= 2} />
            <StepDot active={step >= 3} />
          </div>
        </div>

        {/* PASO 1 — Datos básicos */}
        {step === 1 && (
          <form onSubmit={nextFromStep1} className="space-y-4">
            <div>
              <p className="text-xl font-extrabold mb-1">¡Bienvenid@!</p>
              <p className="text-sm text-gray-600">Completa el formulario de registro para empezar.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="font-medium">Nombre</span>
                <input
                  type="text"
                  value={user.nombre ?? ''}
                  onChange={(e) => handleChange('nombre', e.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded-xl px-3 py-2"
                  required
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">Apellido</span>
                <input
                  type="text"
                  value={user.apellido ?? ''}
                  onChange={(e) => handleChange('apellido', e.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded-xl px-3 py-2"
                  required
                />
              </label>
            </div>

            <label className="block text-sm">
              <span className="font-medium">Email</span>
              <input
                type="email"
                value={user.email ?? ''}
                onChange={(e) => handleChange('email', e.target.value)}
                className="mt-1 w-full border border-gray-300 rounded-xl px-3 py-2"
                required
              />
            </label>

            <label className="block text-sm">
              <span className="font-medium">Teléfono (opcional)</span>
              <input
                type="tel"
                value={user.telefono ?? ''}
                onChange={(e) => handleChange('telefono', e.target.value)}
                className="mt-1 w-full border border-gray-300 rounded-xl px-3 py-2"
              />
            </label>

            <div className="flex gap-2 justify-end">
              <button
                type="submit"
                disabled={!canNext1}
                className="rounded-full border border-black px-4 py-1.5 text-sm font-semibold disabled:opacity-50"
              >
                Continuar
              </button>
            </div>
          </form>
        )}

        {/* PASO 2 — Perfil salud */}
        {step === 2 && (
          <form onSubmit={nextFromStep2} className="space-y-4">
            <div>
              <p className="text-base font-semibold">Datos para personalizar tu experiencia</p>
              <p className="text-xs text-gray-600">
                Usaremos estos datos en funciones como registro de ejercicios y cálculo de calorías.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="font-medium">Sexo</span>
                <select
                  className="mt-1 w-full border border-gray-300 rounded-xl px-3 py-2"
                  value={user.sexo ?? 'prefiero_no_decirlo'}
                  onChange={(e) => handleChange('sexo', e.target.value as Sex)}
                >
                  <option value="masculino">Masculino</option>
                  <option value="femenino">Femenino</option>
                  <option value="prefiero_no_decirlo">Prefiero no decirlo</option>
                </select>
              </label>

              <label className="block text-sm">
                <span className="font-medium">Edad (años)</span>
                <input
                  type="number"
                  min={5}
                  value={user.edad ?? ''}
                  onChange={(e) => handleChange('edad', e.target.value ? Number(e.target.value) : undefined)}
                  className="mt-1 w-full border border-gray-300 rounded-xl px-3 py-2"
                />
              </label>

              <label className="block text-sm">
                <span className="font-medium">Estatura (cm)</span>
                <input
                  type="number"
                  min={80}
                  value={user.estatura ?? ''}
                  onChange={(e) => handleChange('estatura', e.target.value ? Number(e.target.value) : undefined)}
                  className="mt-1 w-full border border-gray-300 rounded-xl px-3 py-2"
                />
              </label>

              <label className="block text-sm">
                <span className="font-medium">Peso (kg)</span>
                <input
                  type="number"
                  min={20}
                  step="0.1"
                  value={user.peso ?? ''}
                  onChange={(e) => handleChange('peso', e.target.value ? Number(e.target.value) : undefined)}
                  className="mt-1 w-full border border-gray-300 rounded-xl px-3 py-2"
                />
              </label>

              <label className="block text-sm">
                <span className="font-medium">Actividad</span>
                <select
                  className="mt-1 w-full border border-gray-300 rounded-xl px-3 py-2"
                  value={user.actividad ?? 'sedentario'}
                  onChange={(e) => handleChange('actividad', e.target.value as Act)}
                >
                  <option value="sedentario">Sedentario</option>
                  <option value="ligero">Ligero (1–3 días/sem)</option>
                  <option value="moderado">Moderado (3–5 días/sem)</option>
                  <option value="intenso">Intenso (6–7 días/sem)</option>
                </select>
              </label>

              <label className="block text-sm md:col-span-2">
                <span className="font-medium">Calorías diarias</span>
                <div className="mt-1 flex gap-2">
                  <input
                    type="number"
                    min={800}
                    value={user.caloriasDiarias ?? ''}
                    onChange={(e) =>
                      handleChange('caloriasDiarias', e.target.value ? Number(e.target.value) : undefined)
                    }
                    className="w-full border border-gray-300 rounded-xl px-3 py-2"
                  />
                  <button
                    type="button"
                    onClick={handleAutoCalories}
                    className="rounded-full border border-black px-3 py-1.5 text-sm font-semibold"
                  >
                    Calcular
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">Puedes calcular automáticamente o introducirlo manualmente.</p>
              </label>
            </div>

            <div className="flex gap-2 justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-full border border-gray-300 px-4 py-1.5 text-sm font-semibold"
              >
                Atrás
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    saveUserMerge({
                      sexo: user.sexo,
                      edad: user.edad,
                      estatura: user.estatura,
                      peso: user.peso,
                      actividad: user.actividad,
                      caloriasDiarias: user.caloriasDiarias,
                    });
                    setStep(3);
                  }}
                  className="rounded-full border border-gray-300 px-4 py-1.5 text-sm font-semibold"
                >
                  Saltar
                </button>
                <button
                  type="submit"
                  className="rounded-full border border-black px-4 py-1.5 text-sm font-semibold"
                >
                  Guardar y continuar
                </button>
              </div>
            </div>
          </form>
        )}

        {/* PASO 3 — Bienvenida + reglas */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <p className="text-2xl font-bold mb-2">Bienvenid@ a Build your Habits</p>
              <p className="text-gray-700">
                Nuestra app está diseñada para ayudarte a construir hábitos saludables que mejoren tu bienestar desde
                cero, y para dejar atrás los malos hábitos de la forma más sencilla y amable posible.
              </p>
              <p className="text-gray-700">Pero tenemos algunas reglas que nos guiarán en el camino:</p>
              <ol className="list-decimal ml-6 space-y-2 text-gray-800">
                <li>
                  <strong>Decir siempre la verdad.</strong> Si marcas un hábito como realizado sin haberlo hecho, al único
                  que engañas es a ti mism@.
                </li>
                <li>
                  <strong>Está permitido fallar, pero nunca rendirse.</strong> Si un día no consigues un reto, tendrás
                  otra oportunidad al día siguiente.
                </li>
                <li>
                  <strong>Disfruta del proceso y celebra cada paso.</strong> La constancia es la clave, y cada avance
                  merece orgullo.
                </li>
              </ol>
              <p className="mt-4 italic">✨ Recuerda: eres la suma de tus acciones.</p>
            </div>

            <div className="flex justify-end">
              <button
                onClick={finish}
                className="rounded-full border border-black px-4 py-1.5 text-sm font-semibold"
              >
                Vamos a por ello
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StepDot({ active }: { active: boolean }) {
  return (
    <span
      className="inline-block h-2.5 w-2.5 rounded-full"
      style={{ background: active ? '#000' : '#D1D5DB' }}
      aria-hidden="true"
    />
  );
}
