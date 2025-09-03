'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { UserProfile, estimateCalories, saveUserMerge } from '@/lib/user';
import { Rocket, ArrowLeft, CheckCircle2 } from 'lucide-react';

type Step = 1 | 2 | 3 | 4 | 5;
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
  initialStep?: Step;
  prefill?: Partial<FormUser>;
};

export default function RegistrationModal({ onClose, initialStep = 1, prefill }: Props) {
  const router = useRouter();

  const [step, setStep] = useState<Step>(initialStep);
  const [user, setUser] = useState<FormUser>({
    nombre: prefill?.nombre ?? '',
    apellido: prefill?.apellido ?? '',
    email: prefill?.email ?? '',
    telefono: prefill?.telefono ?? '',
    sexo: prefill?.sexo ?? 'prefiero_no_decirlo',
    actividad: prefill?.actividad ?? 'sedentario',
  });

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  function handleChange<K extends keyof FormUser>(key: K, value: FormUser[K]) {
    setUser((prev) => ({ ...prev, [key]: value }));
  }

  const canNextForm = useMemo(() => {
    const okBasics = !!user.nombre?.trim() && !!user.apellido?.trim() && !!user.email?.trim();
    const passLen = password.length >= 6;
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
    const base =
      10 * (peso ?? 0) + 6.25 * (estatura ?? 0) - 5 * (edad ?? 0) +
      (sexo === 'masculino' ? 5 : sexo === 'femenino' ? -161 : 0);
    const factor =
      actividad === 'ligero' ? 1.375 :
      actividad === 'moderado' ? 1.55 :
      actividad === 'intenso' ? 1.725 : 1.2;
    const tdee = Math.round(base * factor);
    setUser((p) => ({ ...p, caloriasDiarias: tdee }));
  }

  // ——— OAuth desactivado temporalmente ———
  function oauthSoon() {
    setInfo('Opción todavía no disponible');
    try { alert('Opción todavía no disponible'); } catch {}
  }

  async function submitEmailForm(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setInfo(null);
    if (!canNextForm) return;
    setLoading(true);
    try {
      const appBase =
        process.env.NEXT_PUBLIC_SITE_URL ||
        (typeof window !== 'undefined' ? window.location.origin : undefined);

      const { data, error } = await supabase.auth.signUp({
        email: user.email!,
        password,
        options: {
          emailRedirectTo: appBase ? `${appBase}/auth/callback` : undefined,
          data: { nombre: user.nombre ?? '', apellido: user.apellido ?? '' },
        },
      });
      if (error) {
        const msg = /invalid api key/i.test(error.message)
          ? 'Error de configuración: la API key pública de Supabase es inválida o no corresponde con la URL del proyecto.'
          : error.message;
        throw new Error(msg);
      }

      saveUserMerge({
        nombre: user.nombre,
        apellido: user.apellido,
        email: user.email,
        telefono: user.telefono,
      });

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
      }

      setInfo('Te hemos enviado un correo para confirmar tu email. Puedes verificarlo cuando quieras; no es necesario para continuar ahora.');
      setStep(3);
    } catch (e: any) {
      setErr(e?.message || 'No se pudo completar el registro.');
    } finally {
      setLoading(false);
    }
  }

  function goToPersonalize() {
    setStep(4);
  }

  function savePersonalizeAndNext(e: React.FormEvent) {
    e.preventDefault();
    saveUserMerge({
      sexo: user.sexo,
      edad: user.edad,
      estatura: user.estatura,
      peso: user.peso,
      actividad: user.actividad,
      caloriasDiarias: user.caloriasDiarias,
    });
    setStep(5);
  }

  function finish() {
    saveUserMerge(user);
    onClose?.();
  }

  function goLogin() {
    onClose?.();
    router.push('/login');
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60">
      <div
        className="bg-white w-[70vw] max-w-2xl mx-4 rounded-2xl shadow-xl text-sm flex flex-col max-h-[85svh] overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reg-title"
      >
        {/* Cabecera con imagen a sangre */}
        <div className="relative w-full h-[160px] sm:h-[200px]">
          <Image
            src="/Intro.png"
            alt=""
            fill
            priority
            sizes="(max-width: 768px) 100vw, 640px"
            className="object-cover"
          />
        </div>

        <div className="p-6 pb-3 flex items-center justify-between">
          <h2 id="reg-title" className="text-base font-bold">Registro</h2>
          <div className="flex items-center gap-2 text-[10px]">
            <StepDot active={step >= 1} />
            <StepDot active={step >= 2} />
            <StepDot active={step >= 3} />
            <StepDot active={step >= 4} />
            <StepDot active={step >= 5} />
          </div>
        </div>

        <div className="px-6 pb-6 overflow-y-auto">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <p className="text-base font-extrabold mb-1">¡Bienvenid@ a Build your Habits!</p>
                <p className="text-xs text-gray-600">Elige cómo quieres registrarte.</p>
              </div>

              {/* Botones OAuth → muestran aviso */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <button
                  type="button"
                  onClick={oauthSoon}
                  className="w-full btn secondary !bg-white !text-black !border !border-gray-300 inline-flex items-center justify-center gap-2"
                >
                  <GoogleLogo className="h-4 w-4" />
                  Continuar con Google
                </button>

                <button
                  type="button"
                  onClick={oauthSoon}
                  className="w-full btn secondary !bg-black !text-white inline-flex items-center justify-center gap-2"
                >
                  <AppleLogo className="h-4 w-4" />
                  Continuar con Apple
                </button>
              </div>

              {/* CTA email + Ya tengo cuenta */}
              <div className="pt-2 grid gap-2 sm:grid-cols-2">
                <button type="button" onClick={() => setStep(2)} className="btn w-full">
                  Regístrate ahora
                </button>

                <button type="button" onClick={goLogin} className="btn secondary w-full">
                  Ya tengo cuenta
                </button>
              </div>

              {err && <p className="text-[11px] text-red-600">{err}</p>}
              {info && <p className="text-[11px] text-amber-700">{info}</p>}
            </div>
          )}

          {step === 2 && (
            <form onSubmit={submitEmailForm} className="space-y-4">
              <div>
                <p className="text-base font-extrabold mb-1">Regístrate con tu email</p>
                <p className="text-xs text-gray-600">Completa el formulario para crear tu cuenta.</p>
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

              <div className="flex gap-2 justify-between flex-nowrap">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="btn secondary whitespace-nowrap inline-flex items-center"
                >
                  <ArrowLeft size={16} className="mr-1" />
                  Atrás
                </button>

                <div className="flex-1" />
                <button
                  type="submit"
                  disabled={!canNextForm || !!passError || loading}
                  className="btn disabled:opacity-50 whitespace-nowrap"
                >
                  {loading ? 'Creando cuenta…' : 'Continuar'}
                </button>
              </div>
            </form>
          )}

          {step === 3 && (
            <div className="py-6 space-y-4 text-center">
              <div className="flex justify-center">
                <CheckCircle2 size={56} />
              </div>
              <h3 className="text-lg font-bold">Tu registro ha sido creado con éxito</h3>
              <p className="text-xs text-gray-600 max-w-sm mx-auto">
                Te hemos enviado un correo para confirmar tu email.
                Puedes verificarlo cuando quieras; <strong>no es necesario para continuar ahora</strong>.
              </p>
              <div className="flex justify-center">
                <button onClick={goToPersonalize} className="btn whitespace-nowrap">Continuar</button>
              </div>
            </div>
          )}

          {step === 4 && (
            <form onSubmit={savePersonalizeAndNext} className="space-y-4">
              <div>
                <p className="text-sm font-semibold">Vamos a personalizar tu experiencia</p>
                <p className="text-xs text-gray-600">
                  Estos datos pueden ayudarte a medir los progresos en algunos de nuestros programas.
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
                    <button type="button" onClick={handleAutoCalories} className="btn secondary whitespace-nowrap">
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
                    setStep(5);
                  }}
                  className="underline underline-offset-2"
                >
                  Omitir este paso
                </button>
              </p>

              <div className="flex justify-end">
                <button type="submit" className="btn whitespace-nowrap">Guardar</button>
              </div>
            </form>
          )}

          {step === 5 && (
            <div className="space-y-4 text-sm leading-snug">
              <p className="font-bold text-center">Bienvenid@ a Build your Habits</p>
              <p className="text-gray-700">
                Nuestra app está diseñada para ayudarte a construir hábitos saludables que mejoren tu bienestar desde cero,
                y para dejar atrás los malos hábitos de la forma más sencilla y amable posible.
              </p>
              <p className="font-medium">Pero tenemos algunas reglas que nos guiarán en el camino:</p>
              <ol className="list-decimal pl-5 space-y-2 text-gray-700">
                <li><strong>Decir siempre la verdad.</strong> Si marcas un hábito como realizado sin haberlo hecho, al único que engañas es a ti mism@.</li>
                <li><strong>Está permitido fallar, pero nunca rendirse.</strong> Si un día no consigues un reto, tendrás otra oportunidad al día siguiente.</li>
                <li><strong>Disfruta del proceso y celebra cada paso.</strong> La constancia es la clave, y cada avance merece orgullo.</li>
              </ol>
              <p className="text-gray-800">✨ <strong>Recuerda: eres la suma de tus acciones</strong></p>

              <div className="flex justify-center pt-2">
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

/* Logos */
function GoogleLogo({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.6 31.9 29.2 35 24 35c-6.6 0-12-5.4-12-12S17.4 11 24 11c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34 5.1 29.3 3 24 3 12.9 3 4 11.9 4 23s8.9 20 20 20 19-8.9 19-20c0-1.3-.1-2.2-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16.5 18.9 14 24 14c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34 7.1 29.3 5 24 5c-7.8 0-14.4 4.5-17.7 11z"/>
      <path fill="#4CAF50" d="M24 43c5.1 0 9.9-1.9 13.5-5.1l-6.2-5.1C29.1 34.3 26.7 35 24 35c-5.2 0-9.6-3.1-11.3-7.5l-6.5 5C9.6 39.2 16.2 43 24 43z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1 3-3.7 5-7.3 5-4.4 0-8.1-3.6-8.1-8s3.7-8 8.1-8c2.1 0 4 .8 5.5 2.1l5.5-5.5C35.7 10.1 31.2 8 26 8c-8.8 0-16 7.2-16 16s7.2 16 16 16c8.8 0 16-7.2 16-16 0-1.3-.1-2.2-.4-3.5z"/>
    </svg>
  );
}

function AppleLogo({ className = '' }: { className?: string }) {
  // Path simplificado (evita trazos raros)
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M19.665 13.872c-.044-3.65 2.982-5.402 3.124-5.482-1.707-2.494-4.361-2.838-5.299-2.872-2.256-.231-4.403 1.317-5.546 1.317-1.162 0-2.921-1.287-4.8-1.25-2.462.036-4.748 1.431-6.009 3.632-2.565 4.446-.655 11.01 1.84 14.61 1.217 1.747 2.66 3.7 4.57 3.63 1.845-.07 2.54-1.175 4.776-1.175 2.218 0 2.86 1.175 4.8 1.136 1.98-.033 3.24-1.786 4.45-3.54 1.4-2.048 1.98-4.02 2.02-4.127-.044-.02-3.89-1.488-3.93-5.88zM16.9 4.33c.97-1.18 1.62-2.83 1.44-4.48-1.39.06-3.06.93-4.06 2.1-.89 1.02-1.66 2.68-1.45 4.28 1.52.12 3.09-.77 4.07-1.9z"/>
    </svg>
  );
}
