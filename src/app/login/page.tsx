// src/app/login/page.tsx
'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase, isSupabaseEnvReady } from '@/lib/supabaseClient';
import RegistrationModal from '@/components/RegistrationModal';

export const dynamic = 'force-dynamic';

function LoginContent() {
  const router = useRouter();
  const params = useSearchParams();

  const redirect = params.get('redirect') || '/mizona';
  const emailQS = params.get('email') || undefined;
  const resetOk = params.get('reset') === 'ok';

  const [authChecked, setAuthChecked] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [fatalMsg, setFatalMsg] = useState<string | null>(null);

  const SUPA_READY = isSupabaseEnvReady();
  const prefillEmail = useMemo(() => emailQS, [emailQS]);

  // Chequeo de sesión robusto (con timeout y try/catch)
  useEffect(() => {
    let alive = true;
    let timer: any;

    async function run() {
      if (!SUPA_READY) {
        // Sin env → no se puede iniciar sesión aquí
        setHasSession(false);
        setAuthChecked(true);
        setFatalMsg(
          'Esta build no tiene las variables públicas de Supabase. No es posible iniciar sesión en este entorno.'
        );
        return;
      }

      try {
        // timeout de seguridad para no quedarse en "Cargando…"
        timer = setTimeout(() => {
          if (!alive) return;
          setHasSession(false);
          setAuthChecked(true);
        }, 4000);

        const { data } = await supabase.auth.getSession();
        if (!alive) return;
        const authed = !!data.session;

        setHasSession(authed);
        setAuthChecked(true);

        if (authed) {
          // redirige fuera del login si ya hay sesión
          router.replace(redirect);
        }
      } catch (e) {
        if (!alive) return;
        setHasSession(false);
        setAuthChecked(true);
        // no ponemos fatalMsg salvo que quieras verlo; el modal de login saldrá igual
        console.warn('[login] getSession error', e);
      } finally {
        clearTimeout(timer);
      }
    }

    run();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [router, redirect, SUPA_READY]);

  // UI
  return (
    <main className="min-h-[100svh]">
      {/* Fondo splash */}
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

      {/* Mensaje de entorno sin Supabase */}
      {fatalMsg && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50">
          <div className="rounded-full bg-white/95 border border-amber-500/30 px-4 py-2 text-xs shadow text-amber-800">
            {fatalMsg}
          </div>
        </div>
      )}

      {/* Modal en modo login (si NO hay sesión) */}
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
          // Pequeño fallback mientras comprobamos o redirigimos
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
