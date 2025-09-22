// src/app/auth/recovery/page.tsx
'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase, isSupabaseEnvReady } from '@/lib/supabaseClient';
import { Eye, EyeOff } from 'lucide-react';

type Phase = 'checking' | 'reset' | 'error';

function getHashParams() {
  if (typeof window === 'undefined') return new URLSearchParams();
  const raw = window.location.hash?.replace(/^#/, '') || '';
  return new URLSearchParams(raw);
}

function RecoveryInner() {
  const router = useRouter();
  const params = useSearchParams();
  const SUPA_READY = isSupabaseEnvReady();

  const [phase, setPhase] = useState<Phase>('checking');
  const [err, setErr] = useState<string | null>(null);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const passError = useMemo(() => {
    if (!password && !confirm) return '';
    if (password.length < 6) return 'La contraseña debe tener al menos 6 caracteres.';
    if (password !== confirm) return 'Las contraseñas no coinciden.';
    return '';
  }, [password, confirm]);

  useEffect(() => {
    if (!SUPA_READY) {
      setErr('Esta build no tiene Supabase configurado.');
      setPhase('error');
      return;
    }

    let alive = true;
    const safety = setTimeout(() => {
      if (!alive) return;
      setPhase('error');
      setErr('No se pudo validar el enlace (tiempo de espera agotado).');
    }, 8000);

    (async () => {
      try {
        const hp = getHashParams();
        const access_token = hp.get('access_token');
        const refresh_token = hp.get('refresh_token');
        const type = hp.get('type') || params.get('type');

        if (type !== 'recovery' || !access_token || !refresh_token) {
          setPhase('error');
          setErr('Enlace inválido o incompleto.');
          clearTimeout(safety);
          return;
        }

        const { error: setErrSes } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });
        if (setErrSes) {
          setErr(setErrSes.message || 'No se pudo establecer la sesión de recuperación.');
          setPhase('error');
          clearTimeout(safety);
          return;
        }

        setPhase('reset');
        clearTimeout(safety);
      } catch (e: any) {
        setErr(e?.message || 'No se pudo procesar el enlace.');
        setPhase('error');
        clearTimeout(safety);
      }
    })();

    return () => {
      alive = false;
      clearTimeout(safety);
    };
  }, [SUPA_READY, params]);

  async function submitNewPassword(e: React.FormEvent) {
    e.preventDefault();
    if (passError) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      const { data } = await supabase.auth.getUser();
      const email = data.user?.email || '';
      await supabase.auth.signOut();
      router.replace(`/login?reset=ok${email ? `&email=${encodeURIComponent(email)}` : ''}`);
    } catch (e: any) {
      setErr(e?.message || 'No se pudo actualizar la contraseña.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-[100svh]">
      <div
        className="fixed inset-0 z-10"
        style={{
          backgroundImage: 'url(/splash.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />
      <div className="relative z-20 min-h-[100svh] flex items-center justify-center px-4">
        <div className="bg-white w-full max-w-md rounded-2xl shadow p-6">
          {phase === 'checking' && <div className="text-sm">Comprobando enlace…</div>}

          {phase === 'reset' && (
            <>
              <h1 className="text-lg font-bold mb-2">Restablecer contraseña</h1>
              <p className="text-xs text-gray-600 mb-4">
                Estás autenticad@ temporalmente para cambiar tu contraseña.
              </p>

              <form onSubmit={submitNewPassword} className="space-y-3">
                <label className="block text-xs">
                  <span className="font-medium">Nueva contraseña</span>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'}
                      className="mt-1 input text-[16px] w-full pr-10"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 opacity-70 hover:opacity-100"
                      aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </label>

                <label className="block text-xs">
                  <span className="font-medium">Repetir contraseña</span>
                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      className="mt-1 input text-[16px] w-full pr-10"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 opacity-70 hover:opacity-100"
                      aria-label={showConfirm ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </label>

                {passError && <p className="text-[11px] text-red-600">{passError}</p>}
                {err && <p className="text-[11px] text-red-600">{err}</p>}

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="submit"
                    disabled={!!passError || loading}
                    className="btn disabled:opacity-50"
                  >
                    {loading ? 'Actualizando…' : 'Guardar nueva contraseña'}
                  </button>
                </div>
              </form>
            </>
          )}

          {phase === 'error' && (
            <>
              <h1 className="text-lg font-bold mb-2">Enlace inválido</h1>
              <p className="text-xs text-gray-600 mb-2">No hemos podido validar tu enlace.</p>
              {err && <p className="text-[11px] text-red-600">{err}</p>}
              <div className="mt-3">
                <button onClick={() => router.replace('/login')} className="btn">
                  Ir a Iniciar sesión
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

export default function RecoveryPage() {
  return (
    <Suspense fallback={<div className="min-h-[100svh] flex items-center justify-center">Cargando…</div>}>
      <RecoveryInner />
    </Suspense>
  );
}
