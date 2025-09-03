'use client';

import { useMemo, useState } from 'react';
import { UserProfile, estimateCalories, saveUserMerge } from '@/lib/user';
import { Rocket, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

type Step = 1 | 2 | 3;
type Sex = 'masculino' | 'femenino' | 'prefiero_no_decirlo';
type Act = 'sedentario' | 'ligero' | 'moderado' | 'intenso';

type FormUser = UserProfile & {
  sexo?: Sex;
  edad?: number;
  estatura?: number;
  peso?: number;
  actividad?: Act;
  caloriasDiarias?: number;
};

type Props = {
  onClose?: () => void;
  initialStep?: Step;          // ⬅️ permite arrancar en el paso 2 tras OAuth
  prefill?: Partial<FormUser>; // ⬅️ datos previos (p. ej. nombre/email de Google)
};

export default function RegistrationModal({ onClose, initialStep = 1, prefill }: Props) {
  const [step, setStep] = useState<Step>(initialStep);
  const [user, setUser] = useState<FormUser>({
    nombre: prefill?.nombre ?? '',
    apellido: prefill?.apellido ?? '',
    email: prefill?.email ?? '',
    telefono: prefill?.telefono ?? '',
    sexo: prefill?.sexo ?? 'prefiero_no_decirlo',
    actividad: prefill?.actividad ?? 'sedentario',
  });

  // Contraseña (solo si initialStep === 1)
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  function handleChange<K extends keyof FormUser>(key: K, value: FormUser[K]) {
    setUser((prev) => ({ ...prev, [key]: value }));
  }

  const canNext1 = useMemo(() => {
    if (initialStep === 2) return true; // OAuth: no pedimos pass
    const okBasics = !!user.nombre?.trim() && !!user.apellido?.trim() && !!user.email?.trim();
    const passLen = password.length >= 6;
    const match = password === confirm;
    return okBasics && passLen && match;
  }, [user.nombre, user.apellido, user.email, password, confirm, initialStep]);

  const passError = useMemo(() => {
    if (initialStep === 2) return '';
    if (!password && !confirm) return '';
    if (password.length < 6) return 'La contraseña debe tener al menos 6 caracteres.';
    if (password !== confirm) return 'Las contraseñas no coinciden.';
    return '';
  }, [password, confirm, initialStep]);

  function handleAutoCalories() {
    try {
      const est = estimateCalories?.(user as UserProfile);
      if (est) return setUser((p) => ({ ...p, caloriasDiarias: est }));
    } catch {}
    const { sexo, edad, estatura, peso, actividad } = user;
    if (!edad || !estatura || !peso) return;
    const base =
      10 * (peso ?? 0) +
      6.25 * (estatura ?? 0) -
      5 * (edad ?? 0) +
      (sexo === 'masculino' ? 5 : sexo === 'femenino' ? -161 : 0);
    const factor =
      actividad === 'ligero' ? 1.375 :
      actividad === 'moderado' ? 1.55 :
      actividad === 'intenso' ? 1.725 : 1.2;
    const tdee = Math.round(base * factor);
    setUser((p) => ({ ...p, caloriasDiarias: tdee }));
  }

  async function nextFromStep1(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setInfo(null);
    if (!canNext1) return;

    // Si venimos de OAuth (initialStep === 2) no deberíamos pasar por aquí,
    // pero por seguridad dejamos paso 2.
    if (initialStep === 2) {
      setStep(2);
      return;
    }

    setLoading(true);
    try {
      const redirect = typeof window !== 'undefined'
        ? `${window.location.origin}/auth/callback`
        : undefined;

      const { data, error } = await supabase.auth.signUp({
        email: user.email!,
        password,
        options: { emailRedirectTo: redirect }
      });

      if (error) {
        // Mensaje claro cuando la API key/URL es inválida o de otro proyecto.
        const msg = /invalid api key/i.test(error.message)
          ? 'Error de configuración: la API key pública de Supabase es inválida o no corresponde con la URL del proyecto.'
          : error.message;
        throw new Error(msg);
      }

      // Persistimos básicos en local
      saveUserMerge({
        nombre: user.nombre,
        apellido: user.apellido,
        email: user.email,
        telefono: user.telefono,
      });

      // Si tu proyecto no exige confirmación por email, habrá sesión inmediata
      if (data.session?.user) {
        const uid = data.session.user.id;
        await supabase.from('public_profiles').upsert(
          {
            user_id: uid,
            nombre: user.nombre || null,
            apellido: user.apellido || null,
            sexo: user.sexo || null,
            instagram: null,
            tiktok: null,
          },
          { onConflict: 'user_id' }
        );
        setStep(2);
        return;
      }

      // Si exige confirmación
      setInfo('Te hemos enviado un correo para confirmar tu cuenta. Abre el enlace y vuelve a la app para continuar.');
    } catch (e: any) {
      setErr(e?.message || 'No se pudo completar el registro.');
    } finally {
      setLoading(false);
    }
  }

  function nextFromStep2(e: React.FormEvent) {
    e.preventDefault();
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
    saveUserMerge(user);
    onClose?.();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60">
      <div
        className="bg-white w-[70vw] max-w-2xl mx-4 rounded-2xl shadow-xl text-sm flex flex-col max-h-[85svh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reg-title"
      >
        <div className="p-6 pb-3 flex items-center justify-between">
          <h2 id="reg-title" className="text-base font-bold">Registro</h2>
          <div className="flex items-center gap-2 text-[10px]">
            <StepDot active={step >= 1} />
            <StepDot active={step >= 2} />
            <StepDot active={step >= 3} />
          </div>
        </div>

        <div className="px-6 pb-6 overflow-y-auto">
          {/* PASO 1 — solo cuando initialStep === 1 */}
          {step === 1 && initialStep === 1 && (
            <form onSubmit={nextFromStep1} className="space-y-4">
              <div>
                <p className="text-base font-extrabold mb-1">¡Bienvenid@!</p>
                <p className="text-xs text-gray-600">Completa el formulario de registro para empezar.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="block text-xs">
                  <span className="font-medium">Nombre</span>
                  <input
                    className="mt-1 input text-[16px]"
                    value={user.nombre ?? ''}
                    onChange={(e) => handleChange('nombre', e.target.value)}
                    required
                  />
                </label>
                <label className="block text-xs">
                  <span className="font-medium">Apellido</span>
                  <input
                    className="mt-1 input text-[16px]"
                    value={user.apellido ?? ''}
                    onChange={(e) => handleChange('apellido', e.target.value)}
                    required
                  />
                </label>
              </div>

              <label className="block text-xs">
                <span className="font-medium">Email</span>
                <input
                  type="email"
                  className="mt-1 input text-[16px]"
                  value={user.email ?? ''}
                  onChange={(e) => handleChange('email', e.target.value)}
                  required
                />
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="block text-xs">
                  <span className="font-medium">Contraseña</span>
                  <input
                    type="password"
                    className="mt-1 input text-[16px]"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </label>
                <label className="block text-xs">
                  <span className="font-medium">Repetir contraseña</span>
                  <input
                    type="password"
                    className="mt-1 input text-[16px]"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                  />
                </label>
              </div>
              {passError && <p className="text-[11px] text-red-600">{passError}</p>}

              <label className="block text-xs">
                <span className="font-medium">Teléfono (opcional)</span>
                <input
                  className="mt-1 input text-[16px]"
                  value={user.telefono ?? ''}
                  onChange={(e) => handleChange('telefono', e.target.value)}
                />
              </label>

              {err && <p className="text-[11px] text-red-600">{err}</p>}
              {info && <p className="text-[11px] text-amber-700">{info}</p>}

              <div className="flex gap-2 justify-end">
                <button
                  type="submit"
                  disabled={!canNext1 || !!passError || loading}
                  className="btn disabled:opacity-50 whitespace-nowrap"
                >
                  {loading ? 'Creando cuenta…' : 'Continuar'}
                </button>
              </div>
            </form>
          )}

          {/* PASO 2 */}
          {step === 2 && (
            <form onSubmit={nextFromStep2} className="space-y-4">
              <div>
                <p className="text-sm font-semibold">Datos para personalizar tu experiencia</p>
                <p className="text-xs text-gray-600">
                  Usaremos estos datos en funciones como registro de ejercicios y cálculo de calorías.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="block text-xs">
                  <span className="font-medium">Sexo</span>
                  <select
                    className="mt-1 input text-[16px]"
                    value={user.sexo ?? 'prefiero_no_decirlo'}
                    onChange={(e) => handleChange('sexo', e.target.value as Sex)}
                  >
                    <option value="masculino">Masculino</option>
                    <option value="femenino">Femenino</option>
                    <option value="prefiero_no_decirlo">Prefiero no decirlo</option>
                  </select>
                </label>

                <label className="block text-xs">
                  <span className="font-medium">Edad (años)</span>
                  <input
                    type="number"
                    min={5}
                    className="mt-1 input text-[16px]"
                    value={user.edad ?? ''}
                    onChange={(e) => handleChange('edad', e.target.value ? Number(e.target.value) : undefined)}
                  />
                </label>

                <label className="block text-xs">
                  <span className="font-medium">Estatura (cm)</span>
                  <input
                    type="number"
                    min={80}
                    className="mt-1 input text-[16px]"
                    value={user.estatura ?? ''}
                    onChange={(e) => handleChange('estatura', e.target.value ? Number(e.target.value) : undefined)}
                  />
                </label>

                <label className="block text-xs">
                  <span className="font-medium">Peso (kg)</span>
                  <input
                    type="number"
                    min={20}
                    step="0.1"
                    className="mt-1 input text-[16px]"
                    value={user.peso ?? ''}
                    onChange={(e) => handleChange('peso', e.target.value ? Number(e.target.value) : undefined)}
                  />
                </label>

                <label className="block text-xs">
                  <span className="font-medium">Actividad</span>
                  <select
                    className="mt-1 input text-[16px]"
                    value={user.actividad ?? 'sedentario'}
                    onChange={(e) => handleChange('actividad', e.target.value as Act)}
                  >
                    <option value="sedentario">Sedentario</option>
                    <option value="ligero">Ligero (1–3 días/sem)</option>
                    <option value="moderado">Moderado (3–5 días/sem)</option>
                    <option value="intenso">Intenso (6–7 días/sem)</option>
                  </select>
                </label>

                <label className="block text-xs md:col-span-2">
                  <span className="font-medium">Calorías diarias</span>
                  <div className="mt-1 flex gap-2">
                    <input
                      type="number"
                      min={800}
                      className="input text-[16px]"
                      value={user.caloriasDiarias ?? ''}
                      onChange={(e) =>
                        handleChange('caloriasDiarias', e.target.value ? Number(e.target.value) : undefined)
                      }
                    />
                    <button
                      type="button"
                      onClick={handleAutoCalories}
                      className="btn secondary whitespace-nowrap"
                    >
                      Calcular
                    </button>
                  </div>
                </label>
              </div>

              <p className="text-xs text-gray-600 text-center mt-2">
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
                  className="underline underline-offset-2"
                >
                  Omitir este paso
                </button>
              </p>

              <div className="flex gap-2 justify-between flex-nowrap">
                {initialStep === 1 && (
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="btn secondary whitespace-nowrap inline-flex items-center"
                  >
                    <ArrowLeft size={16} className="mr-1" />
                    Atrás
                  </button>
                )}
                <div className="flex-1" />
                <button type="submit" className="btn whitespace-nowrap">Guardar</button>
              </div>
            </form>
          )}

          {/* PASO 3 */}
          {step === 3 && (
            <div className="space-y-3 text-xs leading-snug">
              <div>
                <p className="text-sm font-bold mb-2 text-center">Bienvenid@ a Build your Habits</p>
                <p className="text-gray-700">
                  Nuestra app está diseñada para ayudarte a construir hábitos saludables que mejoren tu bienestar desde cero,
                  y para dejar atrás los malos hábitos de la forma más sencilla y amable posible.
                </p>
              </div>
              <div className="flex justify-center">
                <button onClick={finish} className="btn inline-flex items-center gap-2">
                  <Rocket size={18} />
                  Vamos a por ello
                </button>
              </div>
            </div>
          )}
        </div>
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
