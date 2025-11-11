'use client';

import Image from 'next/image';
import { ArrowRight, Mail, LogIn } from 'lucide-react';

type Props = {
  onGoogle: () => void;
  onApple: () => void;
  onEmail: () => void;
  onClose?: () => void;
};

export default function AuthStartModal({ onGoogle, onApple, onEmail }: Props) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60">
      <div
        className="bg-white w-[92vw] max-w-md mx-4 rounded-3xl shadow-xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-start-title"
      >
        {/* Hero / imagen */}
        <div className="relative h-40 w-full">
          <Image
            src="/meditacion.jpg" // usa cualquier imagen que ya tengas en /public
            alt="Bienvenid@ a Akira"
            fill
            className="object-cover"
            priority
          />
        </div>

        {/* Acciones */}
        <div className="p-5 space-y-3">
          <h2 id="auth-start-title" className="text-lg font-bold">
            Empecemos
          </h2>
          <p className="text-xs text-gray-600">Regístrate o accede con tu cuenta favorita.</p>

          <button
            onClick={onGoogle}
            className="w-full rounded-full px-4 py-3 border font-medium flex items-center justify-center gap-2"
            style={{ borderColor: 'var(--line)' }}
          >
            <LogIn size={16} />
            Continuar con Google
          </button>

          <button
            onClick={onApple}
            className="w-full rounded-full px-4 py-3 border font-medium flex items-center justify-center gap-2"
            style={{ borderColor: 'var(--line)' }}
          >
            <LogIn size={16} />
            Continuar con Apple
          </button>

          <button
            onClick={onEmail}
            className="w-full rounded-full px-4 py-3 bg-black text-white font-semibold flex items-center justify-center gap-2"
          >
            <Mail size={16} />
            Regístrate ahora
          </button>

          <p className="text-[11px] text-gray-500 flex items-center gap-1 mt-1">
            <ArrowRight size={12} /> Podrás completar tus datos en el siguiente paso.
          </p>
        </div>
      </div>
    </div>
  );
}
