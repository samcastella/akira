'use client';

import { useEffect } from 'react';

export default function SplashClient() {
  useEffect(() => {
    const el = document.getElementById('__splash_ssr');
    if (!el) return;

    try {
      el.style.transition = 'opacity 320ms ease';
      el.style.opacity = '0';
    } catch {}

    const t = setTimeout(() => {
      try {
        // solo si sigue en el DOM (evita NotFound con StrictMode)
        if (el.isConnected) el.remove();
      } catch {}
    }, 340);

    return () => clearTimeout(t);
  }, []);

  return null;
}
