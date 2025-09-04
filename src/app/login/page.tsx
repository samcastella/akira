// src/app/login/page.tsx
'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import RegistrationModal from '@/components/RegistrationModal';

// Evita prerender
export const dynamic = 'force-dynamic';

function LoginContent() {
  const params = useSearchParams();
  const redirect = params.get('redirect') || '/';
  const email = params.get('email') || undefined;

  return (
    <main className="min-h-[100svh]">
      {/* Fondo splash, mismo look que el onboarding */}
      <div
        className="fixed inset-0 z-40"
        style={{
          backgroundImage: 'url(/splash.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />

      {/* Modal en modo login */}
      <div className="relative z-50">
        <RegistrationModal
          initialMode="login"
          prefill={{ email }}
          redirectTo={redirect}
          onClose={() => {
            // Si cierra sin iniciar sesión, volvemos atrás
            if (typeof window !== 'undefined') window.history.back();
          }}
        />
      </div>
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
