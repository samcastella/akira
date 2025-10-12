'use client';

import { useEffect } from 'react';

export default function SplashClient() {
  useEffect(() => {
    const el = document.getElementById('__splash_ssr');
    if (!el) return;
    el.style.transition = 'opacity 320ms ease';
    el.style.opacity = '0';
    const t = setTimeout(() => el.remove(), 340);
    return () => clearTimeout(t);
  }, []);

  return null;
}
