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
  LS_USER_KEY,
} from '@/lib/user';
import { supabase } from '@/lib/supabaseClient';
import RegistrationModal from '@/components/RegistrationModal';

/* ⬇️ importa el pull de programas del server */
import { pullUserPrograms } from '@/lib/programSync';

const LS_SEEN_AUTH = 'akira_seen_auth_v1';

/** ✅ Permite entrar si perfil completo O si marcó onboardingDone */
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

  const [userOk, setUserOk] = useState<boolean | null>(null);
  const [hasSession, setHasSession] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  /* 👇 Bandera: primera sincronización terminada */
  const [bootSynced, setBootSynced] = useState(false);

  /* 👇 Nueva bandera: suprime el modal de registro justo tras SIGNED_IN */
  const [justSignedIn, setJustSignedIn] = useState(false);

  /* 👇 Evita flicker SSR: no renderizar modales hasta estar montado en cliente */
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showRegistration, setShowRegistration] = useState(false);
  const [registrationStartStep, setRegistrationStartStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  useEffect(() => {
    setUserOk(canEnter());
  }, []);

  useEffect(() => {
    const onUserUpdated = () => setUserOk(canEnter());
    window.addEventListener('akira:user-updated', onUserUpdated);
    window.addEventListener('storage', onUserUpdated);
    return () => {
      window.removeEventListener('akira:user-updated', onUserUpdated);
      window.removeEventListener('storage', onUserUpdated);
    };
  }, []);

  /** Sincroniza perfil remoto->local y programaciones (progreso tareas) */
  async function syncAll() {
    try {
      const remote = await pullProfile();
      if (!remote) await syncLocalToRemoteIfMissing();
      // 👇 hidrata programas activos y checks desde server
      await pullUserPrograms();
    } catch (e) {
      console.warn('[LayoutClient] syncAll error', e);
    } finally {
      if (canEnter()) setUserOk(true);
      setBootSynced(true); // ✅ ya podemos decidir UI sin flicker
    }
  }

  // Cargar sesión + suscripción a cambios de auth
  useEffect(() => {
    let cancelled = false;

    async function initAuth() {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      const has = !!data.session;
      setHasSession(has);
      setAuthReady(true);
      // 🔔 Notifica al resto de la app el estado inicial de sesión
      try {
        window.dispatchEvent(new CustomEvent('akira:auth-changed', { detail: { initial: true, has } }));
      } catch {}
      if (has) {
        // Nota: no marcamos justSignedIn aquí; sólo en el evento SIGNED_IN real
        await syncAll();
      } else {
        setBootSynced(true); // sin sesión, no bloqueamos
      }
    }
    void initAuth();

    const { data: sub } = supabase.auth.onAuthStateChange(async (evt, session) => {
      setHasSession(!!session);
      // 🔔 Notifica cambios de auth (login/refresh/update/logout)
      try {
        window.dispatchEvent(new CustomEvent('akira:auth-changed', { detail: { evt } }));
      } catch {}

      if (evt === 'SIGNED_IN') {
        try {
          localStorage.setItem(LS_SEEN_AUTH, '1');

          // ⬇️ Fuerza pase del gating: marca onboardingDone en local
          const raw = localStorage.getItem(LS_USER_KEY);
          const prev = raw ? JSON.parse(raw) : {};
          localStorage.setItem(LS_USER_KEY, JSON.stringify({ ...prev, onboardingDone: true }));
          // notifica a los listeners (LayoutClient, hooks, etc.)
          window.dispatchEvent(new CustomEvent('akira:user-updated'));
        } catch {}

        // Ya consideramos al usuario “OK” para entrar
        setUserOk(true);

        // Cierra cualquier modal de auth/registro y evita flicker mientras sincroniza
        setShowAuthModal(false);
        setShowRegistration(false);
        setJustSignedIn(true);
      }

      if (session && (evt === 'SIGNED_IN' || evt === 'TOKEN_REFRESHED' || evt === 'USER_UPDATED')) {
        await syncAll();
        if (evt === 'SIGNED_IN') {
          setJustSignedIn(false); // 👈 listo: ya podemos decidir mostrar registro si hiciera falta
        }
      } else if (evt === 'SIGNED_OUT') {
        // 🔒 Estado consistente al cerrar sesión
        setShowAuthModal(false);
        setShowRegistration(false);
        setUserOk(false);
        setBootSynced(true);
        try { localStorage.removeItem(LS_SEEN_AUTH); } catch {}
        // no hacemos syncAll sin sesión
      } else {
        if (canEnter()) setUserOk(true);
      }

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
      try { (sub as any)?.subscription?.unsubscribe?.(); } catch {}
      try { (sub as any)?.unsubscribe?.(); } catch {}
      cancelled = true;
    };
  }, []);

  /** Rehidratamos PERFIL + PROGRAMAS al volver a foco/online */
  useEffect(() => {
    const refetch = () => {
      if (!hasSession) return;
      void pullProfile().catch(() => {});
      void pullUserPrograms().catch(() => {});
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refetch();
    };
    window.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', refetch);
    return () => {
      window.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', refetch);
    };
  }, [hasSession]);

  useEffect(() => {
    if (!authReady || userOk === null || !bootSynced) return;

    if (isAuthRoute) {
      setShowAuthModal(false);
      setShowRegistration(false);
      return;
    }

    if (userOk) {
      setShowAuthModal(false);
      setShowRegistration(false);
      return;
    }

    if (!hasSession) {
      setShowAuthModal(true);
      setShowRegistration(false);
      return;
    }

    setShowAuthModal(false);
    setRegistrationStartStep(4);
    setShowRegistration(true);
  }, [authReady, userOk, hasSession, isAuthRoute, bootSynced]);

  /* ✅ Eliminamos el flicker: mientras NO esté authReady o NO esté bootSynced
     o ACABAMOS DE HACER SIGNED_IN, no mostramos el gating (ni el formulario) */
  const gating =
    mounted && authReady && bootSynced && userOk === false && !isAuthRoute && !justSignedIn;

  const hideNav = pathname === '/bienvenida' || isAuthRoute;

  function handleCloseRegistration() {
    setShowRegistration(false);
    if (canEnter()) setUserOk(true);
  }
  function handleCloseAuthModal() {
    setShowAuthModal(false);
    try { localStorage.setItem(LS_SEEN_AUTH, '1'); } catch {}
    if (canEnter()) setUserOk(true);
  }

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
          <div
            className="fixed inset-0 z-40"
            style={{
              backgroundImage: 'url(/splash.jpg)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
            }}
          />
          {!hasSession && showAuthModal && (
            <div className="fixed inset-0 z-50">
              <RegistrationModal initialStep={1} onClose={handleCloseAuthModal} redirectTo="/mizona" />
            </div>
          )}
          {showRegistration && (
            <div className="fixed inset-0 z-50">
              <RegistrationModal
                onClose={handleCloseRegistration}
                initialStep={registrationStartStep as any}
                redirectTo="/mizona"
              />
            </div>
          )}
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

      {/* App */}
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
