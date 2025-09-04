// src/app/auth/callback/page.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Eye, EyeOff } from 'lucide-react';

// Evita prerender
export const dynamic = 'force-dynamic';

type Phase = 'checking' | 'reset' | 'done' | 'error';

export default function AuthCallbackPage() {
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

  // Leer "type" de hash (#type=recovery) o query (?type=recovery)
  const linkType = useMemo(() => {
    let t = params.get('type') || undefined;
    if (typeof window !== 'undefined' && !t && window.location.hash) {
      const hp = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      t = hp.get('type') || undefined;
    }
    return t;
  }, [params]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        // 1) ¿ya hay sesión?
        let { data: sdata } = await supabase.auth.getSession();

        // 2) Si no, intentar intercambio de código (para enlaces con ?code=)
        if (!sdata.session && typeof window !== 'undefined') {
          try {
            await supabase.auth.exchangeCodeForSession(window.location.href);
            ({ data: sdata } = await supabase.auth.getSession());
          } catch {
            // ignoramos: algunos enlaces usan tokens en hash y ya inician sesión
          }
        }

        if (!alive) return;

        if (linkType === 'recovery' || sdata.session) {
          setPhase('reset'); // mostramos el formulario de nueva contraseña
          setInfo('Introduce tu nueva contraseña.');
        } else {
          // Enlace de verificación/login: puedes redirigir a inicio o login
          setPhase('done');
          router.replace('/');
        }
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || 'No se pudo procesar el enlace.');
        setPhase('error');
      }
    })();

    return () => {
      alive = false;
    };
  }, [linkType, router]);

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

      // Cerramos sesión para que vuelva a entrar con la nueva contraseña
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
      {/* Fondo splash para coherencia visual */}
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
          {phase === 'checking' && (
            <div className="text-sm">Comprobando enlace…</div>
          )}

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
                {info && <p className="text-[11px] text-amber-700">{info}</p>}

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

          {phase === 'done' && (
            <div className="text-sm">
              Redirigiendo…
            </div>
          )}

          {phase === 'error' && (
            <>
              <h1 className="text-lg font-bold mb-2">Enlace inválido</h1>
              <p className="text-xs text-gray-600 mb-4">
                No hemos podido validar tu enlace. Vuelve a solicitar la recuperación desde la pantalla de inicio de sesión.
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
