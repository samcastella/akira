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
  LS_USER_KEY,
} from '@/lib/user';
import { supabase } from '@/lib/supabaseClient';
import RegistrationModal from '@/components/RegistrationModal';

const LS_SEEN_AUTH = 'akira_seen_auth_v1';

// ✅ Nuevo: permite entrar si el perfil es completo O si el usuario marcó onboardingDone
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

  async function syncProfile() {
    try {
      const remote = await pullProfile();
      if (!remote) await syncLocalToRemoteIfMissing();
    } catch (e) {
      console.warn('[LayoutClient] syncProfile error', e);
    } finally {
      if (canEnter()) setUserOk(true);
    }
  }

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
      cancelled = false;
      try { (sub as any)?.subscription?.unsubscribe?.(); } catch {}
      try { (sub as any)?.unsubscribe?.(); } catch {}
    };
  }, []);

  useEffect(() => {
    if (!authReady || userOk === null) return;

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
  }, [authReady, userOk, hasSession, isAuthRoute]);

  const gating = userOk === false && !isAuthRoute;
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
