'use client';

import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';

export default function OnboardingAuthModal({
  onClose,
  onOpenRegistration,
}: {
  onClose: () => void;
  onOpenRegistration: () => void;
}) {
  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined },
    });
  }

  function appleSoon() {
    alert('Opción disponible próximamente');
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
            src="/meditacion.jpg" /* usa cualquier imagen que tengas en /public */
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

          <div className="space-y-2 mt-2">
            <button
              className="w-full btn text-[16px]"
              onClick={signInWithGoogle}
            >
              Continuar con Google
            </button>

            <button
              className="w-full btn secondary text-[16px]"
              onClick={appleSoon}
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
              onClick={() => { window.location.href = '/login'; }}
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
