'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { loadUser, isUserComplete, LS_FIRST_RUN, LS_USER } from '@/lib/user';
import RegistrationModal from '@/components/RegistrationModal';

export default function LayoutClient({
  children,
  bottomNav,
}: {
  children: React.ReactNode;
  bottomNav: React.ReactNode;
}) {
  const pathname = usePathname();

  // null = todavía no sabemos; true/false = estado real
  const [userOk, setUserOk] = useState<boolean | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const u = loadUser();
    const ok = isUserComplete(u);
    setUserOk(ok);
    setShowModal(!ok);
  }, []);

  // Mientras el usuario NO esté listo, mostramos splash+modal y ocultamos todo lo demás
  const gating = userOk === false;
  const hideNav = gating || pathname === '/bienvenida';

  // Cuando el modal se cierra (después de guardar y navegar a /bienvenida),
  // permitimos ya renderizar children.
  function handleCloseModal() {
    setShowModal(false);
    setUserOk(true);
  }

  // === Botón de reset SOLO en desarrollo (útil para probar en móvil) ===
  const isDev = process.env.NODE_ENV === 'development';
  function handleDevReset() {
    try {
      localStorage.removeItem(LS_FIRST_RUN);
      localStorage.removeItem(LS_USER);
    } catch {}
    location.reload();
  }

  if (gating) {
    return (
      <>
        {/* Fondo splash a pantalla completa */}
        <div
          className="fixed inset-0 z-40"
          style={{
            backgroundImage: 'url(/splash.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        />

        {/* Modal de registro encima del splash */}
        {showModal && (
          <div className="relative z-50">
            <RegistrationModal onClose={handleCloseModal} />
          </div>
        )}

        {/* Botón dev reset (visible también durante el gating) */}
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

  // Estado conocido y usuario OK → render normal de la app
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

      {/* Botón dev reset (solo en desarrollo) */}
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
