// src/app/login/page.tsx
'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import RegistrationModal from '@/components/RegistrationModal';

// Evita prerender
export const dynamic = 'force-dynamic';

function LoginContent() {
  const router = useRouter();
  const params = useSearchParams();

  const redirect = params.get('redirect') || '/mizona';
  const emailQS = params.get('email') || undefined;
  const resetOk = params.get('reset') === 'ok';

  const [authChecked, setAuthChecked] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  // Si ya hay sesión, redirige fuera del login
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!alive) return;
      const authed = !!data.session;
      setHasSession(authed);
      setAuthChecked(true);
      if (authed) router.replace(redirect);
    })();
    return () => {
      alive = false;
    };
  }, [router, redirect]);

  // Prefill email (del reset tiene prioridad si existe)
  const prefillEmail = useMemo(() => emailQS, [emailQS]);

  return (
    <main className="min-h-[100svh]">
      {/* Fondo splash, mismo look que el onboarding */}
      <div
        className="fixed inset-0 z-40"
        style={{
          backgroundImage: 'url(/splash.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />

      {/* Aviso tras reset correcto */}
      {resetOk && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50">
          <div className="rounded-full bg-white/95 border border-black/10 px-4 py-2 text-xs shadow">
            Contraseña actualizada con éxito. Inicia sesión de nuevo.
          </div>
        </div>
      )}

      {/* Modal en modo login (solo si no hay sesión) */}
      <div className="relative z-50">
        {authChecked && !hasSession ? (
          <RegistrationModal
            initialMode="login"
            prefill={{ email: prefillEmail }}
            redirectTo={redirect}
            onClose={() => {
              // Si cierra sin iniciar sesión, volvemos atrás
              if (typeof window !== 'undefined') window.history.back();
            }}
          />
        ) : (
          // pequeño fallback mientras comprobamos sesión o redirigimos
          <div className="container p-4 text-sm">Cargando…</div>
        )}
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="container p-4 text-sm">Cargando…</div>}>
      <LoginContent />
    </Suspense>
  );
}
