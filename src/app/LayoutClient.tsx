// src/app/LayoutClient.tsx
'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  loadUser,
  isUserComplete,
  LS_FIRST_RUN,
  LS_USER,
  pullProfile,
  syncLocalToRemoteIfMissing,
  // ★ añadimos esta clave para reset dev
  LS_USER_KEY,
} from '@/lib/user';
import { supabase } from '@/lib/supabaseClient';
import RegistrationModal from '@/components/RegistrationModal';

const LS_SEEN_AUTH = 'akira_seen_auth_v1';

// Decide si ya podemos dejar pasar al usuario (perfil completo O ha terminado onboarding)
function canEnter(): boolean {
  try {
    const u = loadUser();
    return isUserComplete(u);
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

  // Rutas de autenticación donde no debe aplicarse el gating/splash
  const isAuthRoute =
    pathname === '/login' ||
    pathname.startsWith('/auth'); // /auth/callback, /auth/confirmed, etc.

  // === Estado de perfil local (gating por completar datos / onboarding) ===
  const [userOk, setUserOk] = useState<boolean | null>(null);

  // === Estado de auth (sesión Supabase) ===
  const [hasSession, setHasSession] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  // === Modales ===
  const [showAuthModal, setShowAuthModal] = useState(false);            // paso 1
  const [showRegistration, setShowRegistration] = useState(false);      // pasos 2–5
  const [registrationStartStep, setRegistrationStartStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Cargar perfil local
  useEffect(() => {
    setUserOk(canEnter());
  }, []);

  // ★ Reaccionar a cambios del perfil local (pullProfile / ediciones en Perfil / onboardingDone)
  useEffect(() => {
    const onUserUpdated = () => setUserOk(canEnter());
    window.addEventListener('akira:user-updated', onUserUpdated);
    window.addEventListener('storage', onUserUpdated);
    return () => {
      window.removeEventListener('akira:user-updated', onUserUpdated);
      window.removeEventListener('storage', onUserUpdated);
    };
  }, []);

  // Helper: sincroniza perfil remoto <-> local si hay sesión
  async function syncProfile() {
    try {
      // 1) Intenta hidratar desde DB
      const remote = await pullProfile();
      if (!remote) {
        // 2) Si no existe fila en DB, intenta crearla desde LS (si hay datos mínimos)
        await syncLocalToRemoteIfMissing();
      }
    } catch (e) {
      // No bloqueamos la UI por errores de sync; sólo registramos
      console.warn('[LayoutClient] syncProfile error', e);
    } finally {
      // Re-evalúa si el perfil ya cumple requisitos o si onboarding ya se marcó
      if (canEnter()) setUserOk(true);
    }
  }

  // Cargar sesión + suscripción a cambios de auth
  useEffect(() => {
    let cancelled = false;

    async function initAuth() {
      const { data } = await supabase.auth.getSession();
      if (!cancelled) {
        const has = !!data.session;
        setHasSession(has);
        setAuthReady(true);

        // Si ya hay sesión activa al montar, sincroniza perfil
        if (has) {
          await syncProfile();
        }
      }
    }
    initAuth();

    const { data: sub } = supabase.auth.onAuthStateChange(async (evt, session) => {
      setHasSession(!!session);

      // Solo en SIGNED_IN marcamos "visto" y cerramos el modal inicial (step 1)
      if (evt === 'SIGNED_IN') {
        try { localStorage.setItem(LS_SEEN_AUTH, '1'); } catch {}
        setShowAuthModal(false);
      }

      // Sincroniza perfil en eventos relevantes
      if (session && (evt === 'SIGNED_IN' || evt === 'TOKEN_REFRESHED' || evt === 'USER_UPDATED')) {
        await syncProfile();
      } else {
        if (canEnter()) setUserOk(true);
      }

      // Si hay sesión pero aún no podemos entrar, abre el modal adecuado
      const okNow = canEnter();
      if (session && !okNow /* && !isAuthRoute */) {
        type AppMeta = { provider?: string };
        const provider = (session.user?.app_metadata as AppMeta | undefined)?.provider;
        const isOAuth = provider && provider !== 'email' && provider !== 'phone';
        setShowAuthModal(false);
        setRegistrationStartStep(isOAuth ? 2 : 4); // OAuth → step 2 | email/pass → step 4
        setShowRegistration(true);
      } else if (!session) {
        // Sin sesión, no mostrar registro forzado
        setShowRegistration(false);
      }
    });

    return () => {
      cancelled = true;
      // ★ defensivo por si cambia la forma de desuscribir
      try { sub?.subscription?.unsubscribe?.(); } catch {}
    };
  }, []);

  // Decidir si enseñamos el pop-up de onboarding (RegistrationModal paso 1)
  useEffect(() => {
    if (!authReady || userOk === null) return;

    // En rutas de auth no mostramos modales
    if (isAuthRoute) {
      setShowAuthModal(false);
      setShowRegistration(false);
      return;
    }

    // Ya puede entrar → no mostrar nada
    if (userOk) {
      setShowAuthModal(false);
      setShowRegistration(false);
      return;
    }

    // Aún no puede entrar
    if (!hasSession) {
      // Sin sesión → onboarding paso 1
      setShowAuthModal(true);
      setShowRegistration(false);
      return;
    }

    // Con sesión → ir directo a personalización (paso 4)
    setShowAuthModal(false);
    setRegistrationStartStep(4);
    setShowRegistration(true);
  }, [authReady, userOk, hasSession, isAuthRoute]);

  // Mientras NO pueda entrar, ocultamos app y mostramos gating (splash + modal),
  // excepto en /login y /auth/*
  const gating = userOk === false && !isAuthRoute;

  // Ocultamos la BottomNav también en rutas de auth
  const hideNav = gating || pathname === '/bienvenida' || isAuthRoute;

  function handleCloseRegistration() {
    setShowRegistration(false);
    if (canEnter()) setUserOk(true);
  }

  // Al cerrar el primer modal (paso 1), marcamos visto y re-evaluamos perfil
  function handleCloseAuthModal() {
    setShowAuthModal(false);
    try { localStorage.setItem(LS_SEEN_AUTH, '1'); } catch {}
    if (canEnter()) setUserOk(true);
  }

  // === Botón de reset SOLO en desarrollo (útil para probar en móvil) ===
  const isDev = process.env.NODE_ENV === 'development';
  function handleDevReset() {
    try {
      localStorage.removeItem(LS_FIRST_RUN);
      localStorage.removeItem(LS_USER);
      localStorage.removeItem(LS_USER_KEY); // ★ borra también el perfil actual (incluye onboardingDone)
      localStorage.removeItem(LS_SEEN_AUTH);
    } catch {}
    location.reload();
  }

{/* === OVERLAY DE GATING: se muestra encima de la app cuando userOk === false === */}
{gating && (
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

    {/* Pop-up de onboarding → RegistrationModal (paso 1) */}
    {!hasSession && showAuthModal && (
      <div className="fixed inset-0 z-50">
        <RegistrationModal
          initialStep={1}
          onClose={handleCloseAuthModal}
          redirectTo="/mizona"
        />
      </div>
    )}

    {/* Modal de registro / personalización */}
    {showRegistration && (
      <div className="fixed inset-0 z-50">
        <RegistrationModal
          onClose={handleCloseRegistration}
          initialStep={registrationStartStep as any}
          redirectTo="/mizona"
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
)}


  // App normal cuando ya puede entrar (perfil completo o onboardingDone) o estamos en rutas de auth
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
