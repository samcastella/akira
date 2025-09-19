'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { supabase, isSupabaseEnvReady } from '@/lib/supabaseClient';

function authRedirectTo(): string | undefined {
  if (typeof window !== 'undefined') return `${window.location.origin}/auth/callback`;
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.NEXT_PUBLIC_VERCEL_URL
      ? (process.env.NEXT_PUBLIC_VERCEL_URL.startsWith('http')
          ? process.env.NEXT_PUBLIC_VERCEL_URL
          : `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`)
      : undefined);
  return base ? `${base}/auth/callback` : undefined;
}

export default function OnboardingAuthModal({
  onClose,
  onOpenRegistration,
}: {
  onClose: () => void;
  onOpenRegistration: () => void;
}) {
  const router = useRouter();
  const SUPA_READY = isSupabaseEnvReady();

  async function signInWithGoogle() {
    if (!SUPA_READY) return;
    try {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: authRedirectTo(),
          queryParams: {
            // forzamos consent si ya estaba logueado con otra cuenta en el navegador
            prompt: 'select_account',
          },
        },
      });
    } catch (e: any) {
      console.error('[oauth/google] error', e);
      try { alert(e?.message || 'No se pudo iniciar con Google.'); } catch {}
    }
  }

  function appleSoon() {
    try { alert('Opción disponible próximamente'); } catch {}
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60">
      <div
        className="bg-white w-[92vw] max-w-[420px] rounded-2xl overflow-hidden shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
      >
        {/* Imagen superior */}
        <div className="relative h-40 w-full">
          <Image
            src="/meditacion.jpg"
            alt="Bienvenida"
            fill
            className="object-cover"
            priority
          />
        </div>

        {/* Contenido */}
        <div className="p-5 space-y-3 text-sm">
          <h2 id="auth-title" className="text-lg font-bold">¡Bienvenid@ a Build your Habits!</h2>
          <p className="text-gray-600">
            Elige cómo quieres crear tu cuenta. Siempre podrás cambiar tus datos más tarde.
          </p>

          {!SUPA_READY && (
            <p className="text-[11px] text-amber-700">
              ⚠️ Esta build no tiene las variables públicas de Supabase configuradas.
              El inicio con Google/Apple está deshabilitado.
            </p>
          )}

          <div className="space-y-2 mt-2">
            <button
              className="w-full btn text-[16px] disabled:opacity-50"
              onClick={signInWithGoogle}
              disabled={!SUPA_READY}
            >
              Continuar con Google
            </button>

            <button
              className="w-full btn secondary text-[16px]"
              onClick={appleSoon}
              disabled={!SUPA_READY}
            >
              Continuar con Apple
            </button>

            <div className="flex items-center gap-3 my-2">
              <span className="h-px flex-1 bg-gray-200" />
              <span className="text-[11px] text-gray-500">o</span>
              <span className="h-px flex-1 bg-gray-200" />
            </div>

            <button
              className="w-full btn text-[16px]"
              onClick={onOpenRegistration}
            >
              Regístrate ahora
            </button>

            <button
              className="w-full btn secondary text-[14px]"
              onClick={() => router.push('/login')}
            >
              Ya tengo cuenta
            </button>
          </div>

          <div className="flex justify-end pt-2">
            <button className="text-xs underline" onClick={onClose}>Cerrar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
