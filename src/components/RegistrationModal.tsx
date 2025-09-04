'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { UserProfile, estimateCalories, saveUserMerge } from '@/lib/user';
import { Rocket, ArrowLeft, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { getCopy } from '@/lib/copy';
import { detectLocale } from '@/lib/locale';

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

type Mode = 'register' | 'login';

type Props = {
  onClose?: () => void;
  initialStep?: Step;
  prefill?: Partial<FormUser>;
  initialMode?: Mode;
  redirectTo?: string;
};

const LS_SEEN_AUTH = 'akira_seen_auth_v1';

export default function RegistrationModal({
  onClose,
  initialStep = 1,
  prefill,
  initialMode = 'register',
  redirectTo = '/',
}: Props) {
  const router = useRouter();

  // i18n
  const locale = detectLocale();
  const copy = getCopy(locale);

  const [mode, setMode] = useState<Mode>(initialMode);
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
  const [showPass, setShowPass] = useState(false);
  const [showPassConfirm, setShowPassConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Limpia mensajes al cambiar de modo o paso
  useEffect(() => {
    setErr(null);
    setInfo(null);
  }, [mode, step]);

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
    setErr(null);
    setInfo('Opción todavía no disponible');
    try { alert('Opción todavía no disponible'); } catch {}
    // Autocierra el aviso
    window.setTimeout(() => setInfo(null), 2500);
  }

  // Helpers
  const normalizedEmail = (user.email || '').trim().toLowerCase();

  // ——— Registro por email ———
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
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: appBase ? `${appBase}/auth/callback` : undefined,
          data: { nombre: user.nombre ?? '', apellido: user.apellido ?? '' },
        },
      });

      // Caso especial Supabase: user ya existe → identities = []
      const alreadyExists =
        !error && data?.user && Array.isArray((data.user as any).identities) && (data.user as any).identities.length === 0;

      if (error || alreadyExists) {
        const msg = error?.message || 'Este email ya está registrado. Inicia sesión con tu contraseña.';
        setErr(msg);
        // Cambiamos a modo login con el email puesto
        setMode('login');
        setUser((u) => ({ ...u, email: normalizedEmail }));
        setPassword('');
        setConfirm('');
        return;
      }

      // Guardar datos básicos locales
      saveUserMerge({
        nombre: user.nombre,
        apellido: user.apellido,
        email: normalizedEmail,
        telefono: (user.telefono || '').trim() || undefined,
      });

      // Perfil público (best-effort)
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

  // ——— Login por email ———
  const canLogin = useMemo(() => !!normalizedEmail && password.length >= 6, [normalizedEmail, password]);

  async function submitLogin(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setInfo(null);
    if (!canLogin) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (error) {
        // Mensaje amigable para credenciales inválidas
        const friendly = /invalid login/i.test(error.message)
          ? 'Email o contraseña incorrectos.'
          : error.message;
        throw new Error(friendly);
      }
      try { localStorage.setItem(LS_SEEN_AUTH, '1'); } catch {}
      router.replace(redirectTo || '/');
      onClose?.();
    } catch (e: any) {
      setErr(e?.message || 'No se pudo iniciar sesión.');
    } finally {
      setLoading(false);
    }
  }

  async function sendRecovery() {
    setErr(null);
    setInfo(null);
    if (!normalizedEmail) {
      setErr('Introduce tu email para enviarte el enlace de recuperación.');
      return;
    }
    setLoading(true);
    try {
      const appBase =
        process.env.NEXT_PUBLIC_SITE_URL ||
        (typeof window !== 'undefined' ? window.location.origin : undefined);

      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: appBase ? `${appBase}/auth/callback` : undefined,
      });
      if (error) throw error;
      setInfo('Te hemos enviado un correo con el enlace para recuperar tu contraseña.');
    } catch (e: any) {
      setErr(e?.message || 'No se pudo enviar el enlace de recuperación.');
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
    try { localStorage.setItem(LS_SEEN_AUTH, '1'); } catch {}
    router.replace(redirectTo || '/');
    onClose?.();
  }

  // Cambia a modo Login SIN navegar fuera (misma estética)
  function goLogin() {
    setMode('login');
    setErr(null);
    setInfo(null);
    setPassword('');
    setConfirm('');
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
          <h2 id="reg-title" className="text-base font-bold">
            {mode === 'login' ? 'Iniciar sesión' : 'Registro'}
          </h2>

          {/* Puntos de paso solo en registro */}
          {mode === 'register' && (
            <div className="flex items-center gap-2 text-[10px]">
              <StepDot active={step >= 1} />
              <StepDot active={step >= 2} />
              <StepDot active={step >= 3} />
              <StepDot active={step >= 4} />
              <StepDot active={step >= 5} />
            </div>
          )}
        </div>

        <div className="px-6 pb-6 overflow-y-auto">
          {/* ======== LOGIN MODE ======== */}
          {mode === 'login' && (
            <div className="space-y-4">
              <div>
                <p className="text-base font-extrabold mb-1">¡Bienvenid@ de nuevo!</p>
                <p className="text-xs text-gray-600">Entra con tu cuenta para continuar.</p>
              </div>

              {/* OAuth → pop-up "no disponible" */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <button
                  type="button"
                  onClick={oauthSoon}
                  className="w-full btn secondary !bg-white !text-black !border !border-gray-300 inline-flex items-center justify-center gap-2"
                >
                  <Image src="/google.png" alt="" width={16} height={16} className="shrink-0" />
                  Entrar con Google
                </button>

                <button
                  type="button"
                  onClick={oauthSoon}
                  className="w-full btn secondary !bg-black !text-white inline-flex items-center justify-center gap-2"
                >
                  <Image src="/apple.png" alt="" width={16} height={16} className="shrink-0" />
                  Entrar con Apple
                </button>
              </div>

              <form onSubmit={submitLogin} className="space-y-3 pt-1">
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

                <label className="block text-xs">
                  <span className="font-medium">Contraseña</span>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'}
                      className="mt-1 input text-[16px] w-full pr-10"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 opacity-70 hover:opacity-100"
                      aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={sendRecovery}
                    className="mt-1 text-[11px] underline underline-offset-2"
                  >
                    He olvidado mi contraseña
                  </button>
                </label>

                {err && <p className="text-[11px] text-red-600">{err}</p>}
                {info && <p className="text-[11px] text-amber-700">{info}</p>}

                <div className="flex items-center justify-between gap-2">
                  <button type="button" onClick={() => setMode('register')} className="btn secondary">
                    <ArrowLeft size={16} className="mr-1" />
                    Atrás
                  </button>
                  <button type="submit" disabled={!canLogin || loading} className="btn disabled:opacity-50">
                    {loading ? 'Entrando…' : 'Entrar'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ======== REGISTRATION MODE ======== */}
          {mode === 'register' && (
            <>
              {step === 1 && (
                <div className="space-y-4">
                  <div>
                    <p className="text-base font-extrabold mb-1">¡Bienvenid@ a Build your Habits!</p>
                    <p className="text-xs text-gray-600">Elige cómo quieres registrarte.</p>
                  </div>

                  {/* Botones OAuth → aviso */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <button
                      type="button"
                      onClick={oauthSoon}
                      className="w-full btn secondary !bg-white !text-black !border !border-gray-300 inline-flex items-center justify-center gap-2"
                    >
                      <Image src="/google.png" alt="" width={16} height={16} className="shrink-0" />
                      Continuar con Google
                    </button>

                    <button
                      type="button"
                      onClick={oauthSoon}
                      className="w-full btn secondary !bg-black !text-white inline-flex items-center justify-center gap-2"
                    >
                      <Image src="/apple.png" alt="" width={16} height={16} className="shrink-0" />
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
                      <div className="relative">
                        <input
                          type={showPass ? 'text' : 'password'}
                          className="mt-1 input text-[16px] w-full pr-10"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPass((v) => !v)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 opacity-70 hover:opacity-100"
                          aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        >
                          {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </label>
                    <label className="block text-xs">
                      <span className="font-medium">Repetir contraseña</span>
                      <div className="relative">
                        <input
                          type={showPassConfirm ? 'text' : 'password'}
                          className="mt-1 input text-[16px] w-full pr-10"
                          value={confirm}
                          onChange={(e) => setConfirm(e.target.value)}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassConfirm((v) => !v)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 opacity-70 hover:opacity-100"
                          aria-label={showPassConfirm ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        >
                          {showPassConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
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
                    {copy.auth.welcomeIntro}
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
            </>
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
