'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Eye, EyeOff } from 'lucide-react';

export const dynamic = 'force-dynamic';

type Phase = 'checking' | 'reset' | 'done' | 'error';

function getHashParams() {
  if (typeof window === 'undefined') return new URLSearchParams();
  const raw = window.location.hash?.replace(/^#/, '') || '';
  return new URLSearchParams(raw);
}

function CallbackInner() {
  const router = useRouter();
  const params = useSearchParams();

  const [phase, setPhase] = useState<Phase>('checking');
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  // type en query (?type=) o en el hash (#type=)
  const linkType = useMemo(() => {
    let t = params.get('type') || undefined;
    if (typeof window !== 'undefined' && !t && window.location.hash) {
      const hp = getHashParams();
      t = hp.get('type') || undefined;
    }
    return t;
  }, [params]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        // 0) ¿el hash trae error?
        const hp = getHashParams();
        const hashErr = hp.get('error');
        const hashErrDesc = hp.get('error_description');
        if (hashErr) {
          if (!alive) return;
          setErr(decodeURIComponent(hashErrDesc || hashErr));
          setPhase('error');
          return;
        }

        // 1) ¿venimos de OAuth/PKCE con ?code=...?
        const code = params.get('code');
        if (code && typeof window !== 'undefined') {
          try {
            await supabase.auth.exchangeCodeForSession(window.location.href);
            if (!alive) return;
            setPhase('done');
            router.replace('/auth/confirmed');
            return;
          } catch (e: any) {
            // si no funciona, seguimos probando tokens del hash
          }
        }

        // 2) ¿trae tokens en el hash? (signup / magic link / recovery)
        const access_token = hp.get('access_token');
        const refresh_token = hp.get('refresh_token');
        const typeHash = hp.get('type') || linkType || undefined;

        if (access_token && refresh_token) {
          // Establece sesión directamente
          const { error: setErrSes } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          if (setErrSes) throw setErrSes;

          if (!alive) return;

          // Si es recovery → mostrar formulario
          if (typeHash === 'recovery') {
            setPhase('reset');
            setInfo('Introduce tu nueva contraseña.');
            return;
          }

          // Resto de tipos válidos → confirmado
          setPhase('done');
          router.replace('/auth/confirmed');
          return;
        }

        // 3) Como último recurso, ¿ya hay sesión activa?
        let { data: sdata } = await supabase.auth.getSession();
        if (sdata.session) {
          if (!alive) return;
          setPhase('done');
          router.replace('/auth/confirmed');
          return;
        }

        // Nada de lo anterior → error
        if (!alive) return;
        setPhase('error');
        setErr('No se pudo validar el enlace (faltan parámetros o ha expirado).');
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || 'No se pudo procesar el enlace.');
        setPhase('error');
      }
    })();

    return () => { alive = false; };
  }, [linkType, params, router]);

  const passError = useMemo(() => {
    if (!password && !confirm) return '';
    if (password.length < 6) return 'La contraseña debe tener al menos 6 caracteres.';
    if (password !== confirm) return 'Las contraseñas no coinciden.';
    return '';
  }, [password, confirm]);

  async function submitNewPassword(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setInfo(null);
    if (passError) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      const { data } = await supabase.auth.getUser();
      const email = data.user?.email || '';
      await supabase.auth.signOut();

      setPhase('done');
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
              <p className="text-xs text-gray-600 mb-4">Estás autenticad@ temporalmente para cambiar tu contraseña.</p>

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
                {info && <p className="text-[11px] text-amber-700">{info}</p>}

                <div className="flex items-center justify-end gap-2">
                  <button type="submit" disabled={!!passError || loading} className="btn disabled:opacity-50">
                    {loading ? 'Actualizando…' : 'Guardar nueva contraseña'}
                  </button>
                </div>
              </form>
            </>
          )}

          {phase === 'done' && <div className="text-sm">Redirigiendo…</div>}

          {phase === 'error' && (
            <>
              <h1 className="text-lg font-bold mb-2">Enlace inválido</h1>
              <p className="text-xs text-gray-600 mb-2">
                No hemos podido validar tu enlace.
              </p>
              {err && <p className="text-[11px] text-red-600">{err}</p>}
              <div className="mt-3">
                <button onClick={() => router.replace('/login')} className="btn">Ir a Iniciar sesión</button>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-[100svh] flex items-center justify-center">Cargando…</div>}>
      <CallbackInner />
    </Suspense>
  );
}
