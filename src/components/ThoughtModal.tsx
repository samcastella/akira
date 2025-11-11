// components/ThoughtModal.tsx
'use client';

import { useEffect, useId } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  text: string;
};

export default function ThoughtModal({ open, onClose, title, text }: Props) {
  const titleId = useId();

  // Cerrar con ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Bloquear scroll de la página cuando el modal está abierto
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-60 bg-black/40 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          // cerrar al clicar el fondo
          onClick={onClose}
        >
          <div className="flex h-full items-center justify-center p-6">
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              // evita que un click dentro cierre el modal
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={onClose}
                className="absolute right-3 top-3 rounded-full p-1 text-black/70 hover:bg-black/5"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>

              <h3 id={titleId} className="mb-2 text-xl font-semibold">
                {title}
              </h3>
              <p className="whitespace-pre-line text-sm text-black/70">
                {text}
              </p>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
