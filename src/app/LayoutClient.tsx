// src/app/LayoutClient.tsx
'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { loadUser, isUserComplete, LS_FIRST_RUN, LS_USER } from '@/lib/user';
import { supabase } from '@/lib/supabaseClient';
import RegistrationModal from '@/components/RegistrationModal';

const LS_SEEN_AUTH = 'akira_seen_auth_v1';

export default function LayoutClient({
  children,
  bottomNav,
}: {
  children: React.ReactNode;
  bottomNav: React.ReactNode;
}) {
  const pathname = usePathname();

  // === Estado de perfil local (gating por completar datos) ===
  const [userOk, setUserOk] = useState<boolean | null>(null);

  // === Estado de auth (sesión Supabase) ===
  const [hasSession, setHasSession] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  // === Modales ===
  // showAuthModal ahora abre directamente el RegistrationModal (paso 1)
  const [showAuthModal, setShowAuthModal] = useState(false);
  // showRegistration se usa para abrir el RegistrationModal en paso 2 tras OAuth
  const [showRegistration, setShowRegistration] = useState(false);
  const [registrationStartStep, setRegistrationStartStep] = useState<1 | 2 | 3>(1);

  // Cargar perfil local
  useEffect(() => {
    const u = loadUser();
    const ok = isUserComplete(u);
    setUserOk(ok);
  }, []);

  // Cargar sesión + suscripción a cambios de auth
  useEffect(() => {
    let cancelled = false;

    async function initAuth() {
      const { data } = await supabase.auth.getSession();
      if (!cancelled) {
        setHasSession(!!data.session);
        setAuthReady(true);
      }
    }
    initAuth();

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setHasSession(!!session);

      // Si el usuario acaba de iniciar sesión por Google,
      // abrimos el registro para completar datos (paso 2).
      if (session) {
        localStorage.setItem(LS_SEEN_AUTH, '1');
        setShowAuthModal(false);
        setRegistrationStartStep(2);
        setShowRegistration(true);
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Decidir si enseñamos el pop-up de onboarding (ahora: RegistrationModal paso 1)
  useEffect(() => {
    if (!authReady || userOk === null) return;

    // Si ya tiene sesión o su perfil ya está completo, no mostramos el pop-up.
    if (hasSession || userOk) {
      setShowAuthModal(false);
      return;
    }

    const seen = typeof window !== 'undefined' ? localStorage.getItem(LS_SEEN_AUTH) : '1';
    if (!seen) setShowAuthModal(true);
  }, [authReady, hasSession, userOk]);

  // Mientras el perfil NO esté listo, ocultamos app y mostramos gating (splash + modal)
  const gating = userOk === false;
  const hideNav = gating || pathname === '/bienvenida';

  function handleCloseRegistration() {
    setShowRegistration(false);
    // Si ya completó datos, desbloqueamos la app:
    const ok = isUserComplete(loadUser());
    if (ok) setUserOk(true);
  }

  // === Botón de reset SOLO en desarrollo (útil para probar en móvil) ===
  const isDev = process.env.NODE_ENV === 'development';
  function handleDevReset() {
    try {
      localStorage.removeItem(LS_FIRST_RUN);
      localStorage.removeItem(LS_USER);
      localStorage.removeItem(LS_SEEN_AUTH);
    } catch {}
    location.reload();
  }

  if (gating) {
    return (
      <>
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

        {/* Pop-up de onboarding → AHORA usa directamente RegistrationModal (paso 1) */}
        {!hasSession && showAuthModal && (
          <div className="relative z-50">
            <RegistrationModal
              initialStep={1}
              onClose={() => {
                setShowAuthModal(false);
                localStorage.setItem(LS_SEEN_AUTH, '1');
              }}
            />
          </div>
        )}

        {/* Modal de registro (manual o tras Google en paso 2) */}
        {showRegistration && (
          <div className="relative z-50">
            <RegistrationModal
              onClose={handleCloseRegistration}
              initialStep={registrationStartStep as any}
            />
          </div>
        )}

        {/* Botón dev reset */}
        {isDev && (
          <button
            onClick={handleDevReset}
            title="Reset onboarding (solo dev)"
            className="fixed bottom-4 right-4 z-[70] rounded-full px-3 py-1.5 text-xs font-semibold border border-black bg-white/90 backdrop-blur"
          >
            Reset onboarding
          </button>
        )}
      </>
    );
  }

  // App normal cuando el perfil está completo
  return (
    <>
      <div
        className="bg-[#FAFAFA]"
        style={{
          minHeight: '100svh',
          paddingBottom: hideNav ? 0 : 'calc(88px + env(safe-area-inset-bottom))',
        }}
      >
        <div className="mx-auto w-full max-w-md">{children}</div>
      </div>

      {!hideNav && bottomNav}

      {isDev && (
        <button
          onClick={handleDevReset}
          title="Reset onboarding (solo dev)"
          className="fixed bottom-4 right-4 z-[70] rounded-full px-3 py-1.5 text-xs font-semibold border border-black bg-white/90 backdrop-blur"
        >
          Reset onboarding
        </button>
      )}
    </>
  );
}
