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

  // Nuevos estados para auth
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  function handleChange<K extends keyof FormUser>(key: K, value: FormUser[K]) {
    setUser((prev) => ({ ...prev, [key]: value }));
  }

  const canNext1 = useMemo(() => {
    const okBasics = !!user.nombre?.trim() && !!user.apellido?.trim() && !!user.email?.trim();
    const passLen = password.length >= 6; // puedes subirlo a 8 si quieres
    const match = password === confirm;
    return okBasics && passLen && match;
  }, [user.nombre, user.apellido, user.email, password, confirm]);

  const passError = useMemo(() => {
    if (!password && !confirm) return '';
    if (password.length < 6) return 'La contraseña debe tener al menos 6 caracteres.';
    if (password !== confirm) return 'Las contraseñas no coinciden.';
    return '';
  }, [password, confirm]);

  function handleAutoCalories() {
    try {
      const est = estimateCalories?.(user as UserProfile);
      if (est) return setUser((p) => ({ ...p, caloriasDiarias: est }));
    } catch {}
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

  async function nextFromStep1(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setInfo(null);
    if (!canNext1) return;

    setLoading(true);
    try {
      // 1) Registro con Supabase (email + password)
      const { data, error } = await supabase.auth.signUp({
        email: user.email!,
        password,
        options: { emailRedirectTo: window.location.origin }
      });
      if (error) throw error;

      // 2) Guardar datos básicos en local para el resto de la app
      saveUserMerge({
        nombre: user.nombre,
        apellido: user.apellido,
        email: user.email,
        telefono: user.telefono,
      });

      // 3) Si hay sesión inmediata (confirmación desactivada) → upsert perfil y pasar al paso 2
      if (data.session?.user) {
        const uid = data.session.user.id;
        await supabase.from('public_profiles').upsert({
          user_id: uid,
          nombre: user.nombre || null,
          apellido: user.apellido || null,
          sexo: user.sexo || null,
          instagram: null,
          tiktok: null,
        }, { onConflict: 'user_id' });

        setStep(2);
        return;
      }

      // 4) Si la confirmación por email está activada
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
          {/* PASO 1 */}
          {step === 1 && (
            <form onSubmit={nextFromStep1} className="space-y-4">
              <div>
                <p className="text-base font-extrabold mb-1">¡Bienvenid@!</p>
                <p className="text-xs text-gray-600">Completa el formulario de registro para empezar.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="block text-xs">
                  <span className="font-medium">Nombre</span>
                  <input
                    type="text"
                    value={user.nombre ?? ''}
                    onChange={(e) => handleChange('nombre', e.target.value)}
                    className="mt-1 input text-[16px]"
                    required
                  />
                </label>
                <label className="block text-xs">
                  <span className="font-medium">Apellido</span>
                  <input
                    type="text"
                    value={user.apellido ?? ''}
                    onChange={(e) => handleChange('apellido', e.target.value)}
                    className="mt-1 input text-[16px]"
                    required
                  />
                </label>
              </div>

              <label className="block text-xs">
                <span className="font-medium">Email</span>
                <input
                  type="email"
                  value={user.email ?? ''}
                  onChange={(e) => handleChange('email', e.target.value)}
                  className="mt-1 input text-[16px]"
                  required
                />
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="block text-xs">
                  <span className="font-medium">Contraseña</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1 input text-[16px]"
                    required
                  />
                </label>
                <label className="block text-xs">
                  <span className="font-medium">Repetir contraseña</span>
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="mt-1 input text-[16px]"
                    required
                  />
                </label>
              </div>
              {passError && <p className="text-[11px] text-red-600">{passError}</p>}

              <label className="block text-xs">
                <span className="font-medium">Teléfono (opcional)</span>
                <input
                  type="tel"
                  value={user.telefono ?? ''}
                  onChange={(e) => handleChange('telefono', e.target.value)}
                  className="mt-1 input text-[16px]"
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
                    value={user.edad ?? ''}
                    onChange={(e) => handleChange('edad', e.target.value ? Number(e.target.value) : undefined)}
                    className="mt-1 input text-[16px]"
                  />
                </label>

                <label className="block text-xs">
                  <span className="font-medium">Estatura (cm)</span>
                  <input
                    type="number"
                    min={80}
                    value={user.estatura ?? ''}
                    onChange={(e) => handleChange('estatura', e.target.value ? Number(e.target.value) : undefined)}
                    className="mt-1 input text-[16px]"
                  />
                </label>

                <label className="block text-xs">
                  <span className="font-medium">Peso (kg)</span>
                  <input
                    type="number"
                    min={20}
                    step="0.1"
                    value={user.peso ?? ''}
                    onChange={(e) => handleChange('peso', e.target.value ? Number(e.target.value) : undefined)}
                    className="mt-1 input text-[16px]"
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
                      value={user.caloriasDiarias ?? ''}
                      onChange={(e) =>
                        handleChange('caloriasDiarias', e.target.value ? Number(e.target.value) : undefined)
                      }
                      className="input text-[16px]"
                    />
                    <button
                      type="button"
                      onClick={handleAutoCalories}
                      className="btn secondary whitespace-nowrap"
                    >
                      Calcular
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">Puedes calcular automáticamente o introducirlo manualmente.</p>
                </label>
              </div>

              {/* Enlace para omitir el paso */}
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

              {/* Botonera */}
              <div className="flex gap-2 justify-between flex-nowrap">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="btn secondary whitespace-nowrap inline-flex items-center"
                >
                  <ArrowLeft size={16} className="mr-1" />
                  Atrás
                </button>
                <div className="flex gap-2 flex-nowrap">
                  <button
                    type="submit"
                    className="btn whitespace-nowrap"
                  >
                    Guardar
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* PASO 3 */}
          {step === 3 && (
            <div className="space-y-3 text-xs leading-snug">
              <div>
                <p className="text-sm font-bold mb-2 text-center">Bienvenid@ a Build your Habits</p>
                <p className="text-gray-700">
                  Nuestra app está diseñada para ayudarte a construir hábitos saludables que mejoren tu bienestar desde
                  cero, y para dejar atrás los malos hábitos de la forma más sencilla y amable posible.
                </p>
                <p className="text-gray-700">Pero tenemos algunas reglas que nos guiarán en el camino:</p>
                <ol className="list-decimal ml-6 space-y-1.5 text-gray-800">
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
                <p className="mt-2 italic text-gray-700">✨ Recuerda: eres la suma de tus acciones.</p>
              </div>

              <div className="flex justify-center">
                <button
                  onClick={finish}
                  className="btn inline-flex items-center gap-2"
                >
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
