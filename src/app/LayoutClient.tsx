// src/app/LayoutClient.tsx
'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  loadUser,
  isUserComplete,
  LS_FIRST_RUN,
  LS_USER,
  LS_USER_KEY,
  pullProfile,
  syncLocalToRemoteIfMissing,
} from '@/lib/user';
import { supabase } from '@/lib/supabaseClient';
import RegistrationModal from '@/components/RegistrationModal';

const LS_SEEN_AUTH = 'akira_seen_auth_v1';

// Permite entrar si el perfil es completo O si el usuario marcó onboardingDone
function canEnter(): boolean {
  try {
    const u = loadUser();
    return isUserComplete(u) || !!u.onboardingDone;
  } catch {
    return false;
  }
}

export default function LayoutClient({
  children,
  bottomNav,
}: {
  children: React.ReactNode;
  bottomNav: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAuthRoute = pathname === '/login' || pathname.startsWith('/auth');

  // Estado de gating
  const [userOk, setUserOk] = useState<boolean | null>(null);

  // Estado de auth (sesión Supabase)
  const [hasSession, setHasSession] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  // Modales
  const [showAuthModal, setShowAuthModal] = useState(false); // paso 1 (elige login/registro)
  const [showRegistration, setShowRegistration] = useState(false); // pasos 2–5
  const [registrationStartStep, setRegistrationStartStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Estado inicial de perfil local
  useEffect(() => {
    setUserOk(canEnter());
  }, []);

  // Reaccionar a cambios del perfil local
  useEffect(() => {
    const onUserUpdated = () => setUserOk(canEnter());
    window.addEventListener('akira:user-updated', onUserUpdated);
    window.addEventListener('storage', onUserUpdated);
    return () => {
      window.removeEventListener('akira:user-updated', onUserUpdated);
      window.removeEventListener('storage', onUserUpdated);
    };
  }, []);

  // Sincroniza perfil remoto <-> local
  async function syncProfile() {
    try {
      const remote = await pullProfile();
      if (!remote) {
        await syncLocalToRemoteIfMissing();
      }
    } catch (e) {
      console.warn('[LayoutClient] syncProfile error', e);
    } finally {
      if (canEnter()) setUserOk(true);
    }
  }

  // Cargar sesión + suscripción a cambios de auth
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      const has = !!data.session;
      setHasSession(has);
      setAuthReady(true);
      if (has) await syncProfile();
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async (evt, session) => {
      setHasSession(!!session);

      if (evt === 'SIGNED_IN') {
        try { localStorage.setItem(LS_SEEN_AUTH, '1'); } catch {}
        setShowAuthModal(false);
      }

      if (session && (evt === 'SIGNED_IN' || evt === 'TOKEN_REFRESHED' || evt === 'USER_UPDATED')) {
        await syncProfile();
      } else {
        if (canEnter()) setUserOk(true);
      }

      // Si hay sesión pero aún no cumple requisitos, abrir personalización
      const okNow = canEnter();
      if (session && !okNow) {
        type AppMeta = { provider?: string };
        const provider = (session.user?.app_metadata as AppMeta | undefined)?.provider;
        const isOAuth = provider && provider !== 'email' && provider !== 'phone';
        setShowAuthModal(false);
        setRegistrationStartStep(isOAuth ? 2 : 4);
        setShowRegistration(true);
      } else if (!session) {
        setShowRegistration(false);
      }
    });

    return () => {
      cancelled = true;
      // Limpieza defensiva (según versión puede variar la API)
      try { (sub as any)?.subscription?.unsubscribe?.(); } catch {}
      try { (sub as any)?.unsubscribe?.(); } catch {}
    };
  }, []);

  // Lógica de qué modal mostrar
  useEffect(() => {
    if (!authReady || userOk === null) return;

    // En rutas de auth, no mostramos modales
    if (isAuthRoute) {
      setShowAuthModal(false);
      setShowRegistration(false);
      return;
    }

    // Si ya puede entrar, no mostrar nada
    if (userOk) {
      setShowAuthModal(false);
      setShowRegistration(false);
      return;
    }

    // Si no hay sesión → modal paso 1
    if (!hasSession) {
      setShowAuthModal(true);
      setShowRegistration(false);
      return;
    }

    // Con sesión y sin poder entrar → ir a personalización (paso 4 por defecto)
    setShowAuthModal(false);
    setRegistrationStartStep(4);
    setShowRegistration(true);
  }, [authReady, userOk, hasSession, isAuthRoute]);

  const gating = userOk === false && !isAuthRoute;
  const hideNav = pathname === '/bienvenida' || isAuthRoute;

  // Cierres de modales
  function handleCloseRegistration() {
    setShowRegistration(false);
    if (canEnter()) setUserOk(true);
  }
  function handleCloseAuthModal() {
    setShowAuthModal(false);
    try { localStorage.setItem(LS_SEEN_AUTH, '1'); } catch {}
    if (canEnter()) setUserOk(true);
  }

  // Botón de reset SOLO dev
  const isDev = process.env.NODE_ENV === 'development';
  function handleDevReset() {
    try {
      localStorage.removeItem(LS_FIRST_RUN);
      localStorage.removeItem(LS_USER);
      localStorage.removeItem(LS_USER_KEY);
      localStorage.removeItem(LS_SEEN_AUTH);
    } catch {}
    location.reload();
  }

  return (
    <>
      {/* Overlay de gating */}
      {gating && (
        <>
          {/* Splash de fondo */}
          <div
            className="fixed inset-0 z-40"
            style={{
              backgroundImage: 'url(/splash.jpg)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
            }}
          />
          {/* Paso 1 (elige método) */}
          {!hasSession && showAuthModal && (
            <div className="fixed inset-0 z-50">
              <RegistrationModal initialStep={1} onClose={handleCloseAuthModal} redirectTo="/mizona" />
            </div>
          )}
          {/* Pasos 2–5 (registro/personalización) */}
          {showRegistration && (
            <div className="fixed inset-0 z-50">
              <RegistrationModal
                onClose={handleCloseRegistration}
                initialStep={registrationStartStep as any}
                redirectTo="/mizona"
              />
            </div>
          )}
          {/* Botón reset (dev) */}
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
      )}

      {/* App normal */}
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

      {/* Botón reset (dev) siempre visible */}
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
