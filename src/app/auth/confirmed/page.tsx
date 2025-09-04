'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export const dynamic = 'force-dynamic';

export default function ConfirmedPage() {
  const router = useRouter();
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    // Marca el onboarding como visto para evitar que reaparezca el splash al volver
    try { localStorage.setItem('akira_seen_auth_v1', '1'); } catch {}

    // Comprueba si tenemos sesión activa (por si venimos de exchangeCodeForSession)
    (async () => {
      const { data } = await supabase.auth.getSession();
      setHasSession(!!data.session);
    })();

    // Auto-redirect suave a la app pasados 2.5s (el botón permite hacerlo antes)
    const t = setTimeout(() => router.replace('/'), 2500);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <main className="min-h-[100svh]">
      {/* Fondo splash */}
      <div
        className="fixed inset-0 z-10"
        style={{
          backgroundImage: 'url(/splash.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />

      {/* Card */}
      <div className="relative z-20 min-h-[100svh] flex items-center justify-center px-4">
        <div className="bg-white w-full max-w-md rounded-2xl shadow p-6 text-center">
          <h1 className="text-lg font-bold mb-2">¡Mail confirmado con éxito!</h1>
          <p className="text-xs text-gray-600 mb-4">
            {hasSession === false
              ? 'Tu email ha sido verificado. Inicia sesión para continuar.'
              : 'Tu email ha sido verificado. Te llevamos a la app…'}
          </p>

          <div className="flex items-center justify-center gap-2">
            {hasSession === false ? (
              <button onClick={() => router.replace('/login')} className="btn">Ir a Iniciar sesión</button>
            ) : (
              <button onClick={() => router.replace('/')} className="btn">Entrar ahora</button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
