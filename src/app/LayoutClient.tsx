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

  // === Estado de perfil local (gating por completar datos) ===
  const [userOk, setUserOk] = useState<boolean | null>(null);

  // === Estado de auth (sesión Supabase) ===
  const [hasSession, setHasSession] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  // === Modales ===
  const [showAuthModal, setShowAuthModal] = useState(false);            // paso 1
  const [showRegistration, setShowRegistration] = useState(false);      // paso 2 tras OAuth
  const [registrationStartStep, setRegistrationStartStep] = useState<1 | 2 | 3>(1);

  // Cargar perfil local
  useEffect(() => {
    const u = loadUser();
    const ok = isUserComplete(u);
    setUserOk(ok);
  }, []);

  // ★ Reaccionar a cambios del perfil local (pullProfile / ediciones en Perfil)
  useEffect(() => {
    const onUserUpdated = () => {
      const okNow = isUserComplete(loadUser());
      setUserOk(okNow);
    };
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
      // Re-evalúa si el perfil ya cumple requisitos
      const okNow = isUserComplete(loadUser());
      if (okNow) setUserOk(true);
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

      // Marcar splash visto y cerrar pop-up de onboarding
      try { localStorage.setItem(LS_SEEN_AUTH, '1'); } catch {}
      setShowAuthModal(false);

      // Solo abrir completar datos si el proveedor es OAuth (no email/pass)
      const provider = (session?.user?.app_metadata as any)?.provider as string | undefined;
      const isOAuth = provider && provider !== 'email' && provider !== 'phone';

      if (session && isOAuth) {
        setRegistrationStartStep(2);
        setShowRegistration(true);
      } else {
        setShowRegistration(false);
      }

      // Tras cualquier login/refresco de token, sincroniza perfil
      if (session && (evt === 'SIGNED_IN' || evt === 'TOKEN_REFRESHED' || evt === 'USER_UPDATED')) {
        await syncProfile();
      } else {
        // Re-evaluamos el perfil local igualmente
        const ok = isUserComplete(loadUser());
        if (ok) setUserOk(true);
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

    // En rutas de auth no mostramos el modal nunca
    if (isAuthRoute) {
      setShowAuthModal(false);
      setShowRegistration(false);
      return;
    }

    // Si el perfil ya está completo, no mostramos nada
    if (userOk) {
      setShowAuthModal(false);
      setShowRegistration(false);
      return;
    }

    // PERFIL INCOMPLETO:
    // - Sin sesión: mostrar SIEMPRE el modal de onboarding (ignoramos LS_SEEN_AUTH)
    // - Con sesión: no gateamos la app ni abrimos modal (salvo OAuth en onAuthStateChange)
    if (!hasSession) {
      setShowAuthModal(true);
      return;
    }

    // hasSession && !userOk: no abrir nada aquí (syncProfile se ejecuta en init/auth change)
    setShowAuthModal(false);
  }, [authReady, userOk, hasSession, isAuthRoute]);

  // Mientras el perfil NO esté listo, ocultamos app y mostramos gating (splash + modal),
  // excepto en /login y /auth/* — y también si YA hay sesión (no gatear con sesión)
  const gating = userOk === false && !isAuthRoute && !hasSession;

  // Ocultamos la BottomNav también en rutas de auth
  const hideNav = gating || pathname === '/bienvenida' || isAuthRoute;

  function handleCloseRegistration() {
    setShowRegistration(false);
    const ok = isUserComplete(loadUser());
    if (ok) setUserOk(true);
  }

  // Al cerrar el primer modal (paso 1), marcamos visto y re-evaluamos perfil
  function handleCloseAuthModal() {
    setShowAuthModal(false);
    try { localStorage.setItem(LS_SEEN_AUTH, '1'); } catch {}
    const ok = isUserComplete(loadUser());
    if (ok) setUserOk(true);
  }

  // === Botón de reset SOLO en desarrollo (útil para probar en móvil) ===
  const isDev = process.env.NODE_ENV === 'development';
  function handleDevReset() {
    try {
      localStorage.removeItem(LS_FIRST_RUN);
      localStorage.removeItem(LS_USER);
      localStorage.removeItem(LS_USER_KEY); // ★ borra también el perfil actual
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

        {/* Pop-up de onboarding → RegistrationModal (paso 1) */}
        {!hasSession && showAuthModal && (
          <div className="relative z-50">
            <RegistrationModal
              initialStep={1}
              onClose={handleCloseAuthModal}
            />
          </div>
        )}

        {/* Modal de registro (solo tras OAuth) */}
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

  // App normal cuando el perfil está completo (o estamos en rutas de auth)
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
