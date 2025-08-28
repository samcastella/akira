'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

export default function ThoughtModal({
  open, onClose, title, text,
}: { open: boolean; onClose: () => void; title: string; text: string; }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="flex h-full items-center justify-center p-6">
            <motion.div className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}>
              <button onClick={onClose}
                      className="absolute right-3 top-3 rounded-full p-1 text-black/70 hover:bg-black/5"
                      aria-label="Cerrar">
                <X className="h-5 w-5" />
              </button>
              <h3 className="mb-2 text-xl font-semibold">{title}</h3>
              <p className="whitespace-pre-line text-sm text-black/70">{text}</p>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
