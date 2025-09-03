'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import RegistrationModal from '@/components/RegistrationModal';

// Evita prerender y sustos con searchParams en build
export const dynamic = 'force-dynamic';

function LoginContent() {
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get('redirect') || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Para abrir registro desde la pantalla de login
  const [showReg, setShowReg] = useState(false);

  // Si ya hay sesión, redirige
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!alive) return;
      if (data.session) router.replace(redirect || '/');
    })();
    return () => {
      alive = false;
    };
  }, [router, redirect]);

  const canSubmit = useMemo(() => !!email.trim() && password.length >= 6, [email, password]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setInfo(null);
    if (!canSubmit) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        const msg = /invalid api key/i.test(error.message)
          ? 'Error de configuración: la API key pública de Supabase es inválida o no corresponde con la URL del proyecto.'
          : error.message;
        throw new Error(msg);
      }
      router.replace(redirect || '/');
    } catch (e: any) {
      setErr(e?.message || 'No se pudo iniciar sesión.');
    } finally {
      setLoading(false);
    }
  }

  async function sendRecovery() {
    setErr(null);
    setInfo(null);
    if (!email.trim()) {
      setErr('Introduce tu email para enviarte el enlace de recuperación.');
      return;
    }
    setLoading(true);
    try {
      const appBase =
        process.env.NEXT_PUBLIC_SITE_URL ||
        (typeof window !== 'undefined' ? window.location.origin : undefined);

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: appBase ? `${appBase}/auth/callback` : undefined,
      });
      if (error) throw error;
      setInfo('Te hemos enviado un correo con el enlace para recuperar tu contraseña.');
    } catch (e: any) {
      setErr(e?.message || 'No se pudo enviar el enlace de recuperación.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-[100svh] flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow p-6">
        <h1 className="text-lg font-bold mb-2">Iniciar sesión</h1>
        <p className="text-xs text-gray-600 mb-4">Introduce tus credenciales para entrar.</p>

        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block text-xs">
            <span className="font-medium">Email</span>
            <input
              type="email"
              className="mt-1 input text-[16px] w-full"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label className="block text-xs">
            <span className="font-medium">Contraseña</span>
            <input
              type="password"
              className="mt-1 input text-[16px] w-full"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          {err && <p className="text-[11px] text-red-600">{err}</p>}
          {info && <p className="text-[11px] text-amber-700">{info}</p>}

          <div className="flex items-center justify-between gap-2">
            <button type="button" onClick={() => router.back()} className="btn secondary">
              Atrás
            </button>
            <button type="submit" disabled={!canSubmit || loading} className="btn disabled:opacity-50">
              {loading ? 'Entrando…' : 'Entrar'}
            </button>
          </div>
        </form>

        <div className="mt-3 flex items-center justify-between text-xs">
          <button onClick={sendRecovery} className="underline underline-offset-2">
            He olvidado mi contraseña
          </button>
          <button
            className="underline underline-offset-2"
            onClick={() => setShowReg(true)}
          >
            Crear cuenta
          </button>
        </div>
      </div>

      {/* Registro */}
      {showReg && (
        <RegistrationModal
          initialStep={1}
          prefill={{ email }}          // 👈 prefijamos el email que escribió el usuario
          onClose={() => setShowReg(false)}
        />
      )}
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="container p-4 text-sm">Cargando…</div>}>
      <LoginContent />
    </Suspense>
  );
}
