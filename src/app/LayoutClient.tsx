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
  startUserLibRealtime,
  stopUserLibRealtime,
} from '@/lib/user';
import { supabase, isSupabaseEnvReady } from '@/lib/supabaseClient';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import RegistrationModal from '@/components/RegistrationModal';
import { pullUserPrograms } from '@/lib/programSync';

const LS_SEEN_AUTH = 'akira_seen_auth_v1';
const LS_LAST_UID = 'akira_last_uid';
const PROFILE_TIMEOUT_MS = 15000;

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
  const isAuthRoute = pathname === '/login' || pathname?.startsWith('/auth');

  const [userOk, setUserOk] = useState<boolean | null>(null);
  const [hasSession, setHasSession] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [bootSynced, setBootSynced] = useState(false);
  const [justSignedIn, setJustSignedIn] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showRegistration, setShowRegistration] = useState(false);
  const [registrationStartStep, setRegistrationStartStep] =
    useState<1 | 2 | 3 | 4 | 5>(1);

  const SUPA_READY = isSupabaseEnvReady();

  useEffect(() => { setUserOk(canEnter()); }, []);
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

  function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const to = setTimeout(() => {
        console.warn(`[syncAll] ${label} timed out after ${ms}ms`);
        reject(new Error(`${label} timeout`));
      }, ms);
      p.then(
        (v) => { clearTimeout(to); resolve(v); },
        (e) => { clearTimeout(to); reject(e); }
      );
    });
  }

  async function syncAll() {
    try {
      await withTimeout((async () => {
        try {
          const remote = await pullProfile();
          if (!remote) await syncLocalToRemoteIfMissing();
        } catch (e) { console.warn('[syncAll] profile err:', e); }
      })(), PROFILE_TIMEOUT_MS, 'profile');

      await withTimeout((async () => {
        try { await pullUserPrograms(); }
        catch (e) { console.warn('[syncAll] pullUserPrograms err:', e); }
      })(), PROFILE_TIMEOUT_MS, 'programs');
    } catch (e) {
      console.warn('[LayoutClient] syncAll wrapper warn:', e);
    } finally {
      if (canEnter()) setUserOk(true);
      setBootSynced(true);
    }
  }

  useEffect(() => {
    if (!SUPA_READY) {
      console.warn('[auth] Supabase env no disponible. Se omite initAuth.');
      setHasSession(false); setAuthReady(true); setBootSynced(true);
      return;
    }
    let cancelled = false;
    async function initAuth() {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      const has = !!data.session;
      try {
        const uid = data.session?.user?.id ?? null;
        if (uid) localStorage.setItem(LS_LAST_UID, uid);
        else localStorage.removeItem(LS_LAST_UID);
      } catch {}
      setHasSession(has); setAuthReady(true);
      try {
        window.dispatchEvent(new CustomEvent('akira:auth-changed', {
          detail: { initial: true, has }
        }));
      } catch {}
      if (has) await syncAll(); else setBootSynced(true);
    }
    void initAuth();

    startUserLibRealtime();

    const { data: sub } = supabase.auth.onAuthStateChange(
      async (evt: AuthChangeEvent, session: Session | null) => {
        setHasSession(!!session);
        try {
          window.dispatchEvent(new CustomEvent('akira:auth-changed', { detail: { evt } }));
        } catch {}
        try {
          const uid = session?.user?.id ?? null;
          if (uid) localStorage.setItem(LS_LAST_UID, uid);
          else localStorage.removeItem(LS_LAST_UID);
        } catch {}

        if (evt === 'SIGNED_IN') {
          try {
            localStorage.setItem(LS_SEEN_AUTH, '1');
            const raw = localStorage.getItem(LS_USER_KEY);
            const prev = raw ? JSON.parse(raw) : {};
            localStorage.setItem(LS_USER_KEY, JSON.stringify({ ...prev, onboardingDone: true }));
            window.dispatchEvent(new CustomEvent('akira:user-updated'));
          } catch {}
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
      try { (sub as any)?.subscription?.unsubscribe?.(); } catch {}
      try { (sub as any)?.unsubscribe?.(); } catch {}
      stopUserLibRealtime();
      cancelled = true;
    };
  }, [SUPA_READY]);

  useEffect(() => {
    if (!SUPA_READY) return;
    const refetch = () => {
      if (!hasSession) return;
      void pullProfile().catch(() => {});
      void pullUserPrograms().catch(() => {});
    };
    const onVisibility = () => { if (document.visibilityState === 'visible') refetch(); };
    window.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', refetch);
    return () => {
      window.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', refetch);
    };
  }, [SUPA_READY, hasSession]);

  useEffect(() => {
    if (!authReady || userOk === null || !bootSynced) return;
    const isAuth = isAuthRoute;
    if (isAuth) { setShowAuthModal(false); setShowRegistration(false); return; }
    if (!SUPA_READY) { setShowAuthModal(false); setShowRegistration(false); return; }
    if (userOk) { setShowAuthModal(false); setShowRegistration(false); return; }
    if (!hasSession) { setShowAuthModal(true); setShowRegistration(false); return; }
    setShowAuthModal(false); setRegistrationStartStep(4); setShowRegistration(true);
  }, [authReady, userOk, hasSession, isAuthRoute, bootSynced, SUPA_READY]);

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
      localStorage.removeItem(LS_LAST_UID);
    } catch {}
    location.reload();
  }

  return (
    <>
      {/* Overlays de gating */}
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
        className="bg-[#FAFAFA] overflow-x-hidden"
        style={{
          minHeight: '100svh',
          // El BottomNav es fijo y maneja el safe-area internamente
          paddingBottom: '0px',
        }}
      >
        <div className="w-full">{children}</div>
      </div>

      {/* 🔻 Bottom nav fijo abajo (sin wrapper extra) */}
      {!hideNav && bottomNav}
    </>
  );
}
