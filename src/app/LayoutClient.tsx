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
  // ⬇️ orquestación de listeners de user.ts
  startUserLibRealtime,
  stopUserLibRealtime,
} from '@/lib/user';
import { supabase, isSupabaseEnvReady } from '@/lib/supabaseClient';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import RegistrationModal from '@/components/RegistrationModal';
import { pullUserPrograms } from '@/lib/programSync';

const LS_SEEN_AUTH = 'akira_seen_auth_v1';
const LS_LAST_UID = 'akira_last_uid';
const PROFILE_TIMEOUT_MS = 15000; // antes 5000

/** ✅ Permite entrar si perfil completo O si marcó onboardingDone */
function canEnter(): boolean {
  try {
    const u = loadUser();
    return isUserComplete(u) || !!(u as any)?.onboardingDone;
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
  const isAuthRoute =
    pathname === '/login' ||
    pathname?.startsWith('/auth'); // incluye /auth/callback y /auth/confirmed

  const [userOk, setUserOk] = useState<boolean | null>(null);
  const [hasSession, setHasSession] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  /* 👇 Bandera: primera sincronización terminada */
  const [bootSynced, setBootSynced] = useState(false);

  /* 👇 Suprime el modal de registro justo tras SIGNED_IN para evitar parpadeo */
  const [justSignedIn, setJustSignedIn] = useState(false);

  /* 👇 Evita flicker SSR: no renderizar modales hasta estar montado en cliente */
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showRegistration, setShowRegistration] = useState(false);
  const [registrationStartStep, setRegistrationStartStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // ⚠️ ¿tenemos envs de Supabase en esta build/preview?
  const SUPA_READY = isSupabaseEnvReady();

  useEffect(() => {
    setUserOk(canEnter());
  }, []);

  useEffect(() => {
    const onUserUpdated = () => setUserOk(canEnter());
    if (typeof window !== 'undefined') {
      window.addEventListener('akira:user-updated', onUserUpdated);
      window.addEventListener('storage', onUserUpdated);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('akira:user-updated', onUserUpdated);
        window.removeEventListener('storage', onUserUpdated);
      }
    };
  }, []);

  /** util: timeout con etiqueta para no colgarnos en la primera carga */
  function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const to = setTimeout(() => {
        console.warn(`[syncAll] ${label} timed out after ${ms}ms`);
        reject(new Error(`${label} timeout`)); // lo manejamos como no-fatal más abajo
      }, ms);
      p.then(
        (v) => {
          clearTimeout(to);
          resolve(v);
        },
        (e) => {
          clearTimeout(to);
          reject(e);
        }
      );
    });
  }

  /** Sincroniza perfil remoto->local y programaciones (progreso tareas) de forma robusta */
  async function syncAll() {
    try {
      // Bloque 1: perfil (pull y, si falta, seed desde local)
      await withTimeout(
        (async () => {
          try {
            const remote = await pullProfile();
            if (!remote) {
              await syncLocalToRemoteIfMissing();
            }
          } catch (e) {
            console.warn('[syncAll] pullProfile/syncLocalToRemoteIfMissing error:', e);
          }
        })(),
        PROFILE_TIMEOUT_MS,
        'profile'
      );

      // Bloque 2: programaciones
      await withTimeout(
        (async () => {
          try {
            await pullUserPrograms();
          } catch (e) {
            console.warn('[syncAll] pullUserPrograms error:', e);
          }
        })(),
        PROFILE_TIMEOUT_MS,
        'programs'
      );
    } catch (e) {
      // ✅ No bloqueamos la app si perfil/programas fallan o expiran
      console.warn('[LayoutClient] syncAll wrapper warn (non-fatal):', e);
    } finally {
      if (canEnter()) setUserOk(true);
      setBootSynced(true); // ✅ siempre dejamos de “pensar”
    }
  }

  // Cargar sesión + suscripción a cambios de auth (solo si hay Supabase)
  useEffect(() => {
    if (!SUPA_READY) {
      console.warn('[auth] Supabase env no disponible en esta build/preview. Se omite initAuth.');
      setHasSession(false);
      setAuthReady(true);
      setBootSynced(true);
      return;
    }

    let cancelled = false;

    async function initAuth() {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      const has = !!data.session;
      // 🔐 persistimos/eliminamos UID desde la sesión inicial
      try {
        const uid = data.session?.user?.id ?? null;
        if (uid) localStorage.setItem(LS_LAST_UID, uid);
        else localStorage.removeItem(LS_LAST_UID);
      } catch {}
      setHasSession(has);
      setAuthReady(true);
      try {
        window.dispatchEvent(new CustomEvent('akira:auth-changed', { detail: { initial: true, has } }));
      } catch {}
      if (has) {
        await syncAll();
      } else {
        setBootSynced(true);
      }
    }
    void initAuth();

    // ⬇️ arranca los listeners de user.ts (perfil/realtime) una vez sabemos que hay ENV
    startUserLibRealtime();

    const { data: sub } = supabase.auth.onAuthStateChange(
      async (evt: AuthChangeEvent, session: Session | null) => {
        setHasSession(!!session);
        try {
          window.dispatchEvent(new CustomEvent('akira:auth-changed', { detail: { evt } }));
        } catch {}

        // 🔐 persistimos/eliminamos UID en cada cambio de auth
        try {
          const uid = session?.user?.id ?? null;
          if (uid) localStorage.setItem(LS_LAST_UID, uid);
          else localStorage.removeItem(LS_LAST_UID);
        } catch {}

        if (evt === 'SIGNED_IN') {
          // ✅ No navegamos aquí: la navegación la hace /auth/callback (server) tras fijar cookies
          // Marca onboardingDone y “visto”
          try {
            localStorage.setItem(LS_SEEN_AUTH, '1');
            const raw = localStorage.getItem(LS_USER_KEY);
            const prev = raw ? JSON.parse(raw) : {};
            localStorage.setItem(LS_USER_KEY, JSON.stringify({ ...prev, onboardingDone: true }));
            window.dispatchEvent(new CustomEvent('akira:user-updated'));
          } catch {}
          // Cierra modales inmediatamente y evita flicker
          setUserOk(true);
          setShowAuthModal(false);
          setShowRegistration(false);
          setJustSignedIn(true);
        }

        if (session && (evt === 'SIGNED_IN' || evt === 'TOKEN_REFRESHED' || evt === 'USER_UPDATED')) {
          await syncAll();
          if (evt === 'SIGNED_IN') setJustSignedIn(false);
        } else if (evt === 'SIGNED_OUT') {
          setShowAuthModal(false);
          setShowRegistration(false);
          setUserOk(false);
          setBootSynced(true);
          try {
            localStorage.removeItem(LS_SEEN_AUTH);
            localStorage.removeItem(LS_LAST_UID);
          } catch {}
        } else {
          if (canEnter()) setUserOk(true);
        }

        // Si hay sesión pero el perfil aún no permite entrar, mostramos personalización
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
      }
    );

    return () => {
      try {
        (sub as any)?.subscription?.unsubscribe?.();
      } catch {}
      try {
        (sub as any)?.unsubscribe?.();
      } catch {}
      // ⬇️ detenemos listeners de user.ts
      stopUserLibRealtime();
      cancelled = true;
    };
  }, [SUPA_READY]);

  /** Rehidratamos PERFIL + PROGRAMAS al volver a foco/online (solo si hay Supabase) */
  useEffect(() => {
    if (!SUPA_READY) return;
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
  }, [SUPA_READY, hasSession]);

  useEffect(() => {
    if (!authReady || userOk === null || !bootSynced) return;

    if (isAuthRoute) {
      setShowAuthModal(false);
      setShowRegistration(false);
      return;
    }

    // Si no hay Supabase env, no podemos autenticar; evita mostrar modales de login infinitos.
    if (!SUPA_READY) {
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

    // Hay sesión pero falta completar perfil → abrir registro en paso 4
    setShowAuthModal(false);
    setRegistrationStartStep(4);
    setShowRegistration(true);
  }, [authReady, userOk, hasSession, isAuthRoute, bootSynced, SUPA_READY]);

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
    try {
      localStorage.setItem(LS_SEEN_AUTH, '1');
    } catch {}
    if (canEnter()) setUserOk(true);
  }

  const isDev = process.env.NODE_ENV === 'development';
  function handleDevReset() {
    try {
      localStorage.removeItem(LS_FIRST_RUN);
      localStorage.removeItem(LS_USER);
      localStorage.removeItem(LS_USER_KEY);
      localStorage.removeItem(LS_SEEN_AUTH);
      localStorage.removeItem(LS_LAST_UID);
    } catch {}
    location.reload();
  }

  // 🚫 Bloqueo total si faltan ENV (no se puede acceder sin registro/login)
  if (!SUPA_READY) {
    return (
      <main
        className="min-h-[100svh] grid place-items-center p-6 text-center"
        style={{ background: '#FAFAFA' }}
      >
        <div className="mx-auto w-full max-w-md space-y-4">
          <h1 className="text-xl font-semibold">Configuración incompleta</h1>
          <p>
            Esta build no tiene las variables públicas de Supabase. El registro e inicio de sesión
            están deshabilitados, por lo que no se puede entrar a la app.
          </p>
          <p className="text-sm opacity-70">
            Añade <code>NEXT_PUBLIC_SUPABASE_URL</code> y{' '}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> en el entorno de esta Preview y vuelve a
            desplegar.
          </p>
        </div>
      </main>
    );
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
