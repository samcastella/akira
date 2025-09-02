// components/FirstRunSplash.tsx
'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { LS_FIRST_RUN } from '@/lib/user';

export default function FirstRunSplash() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const seen = localStorage.getItem(LS_FIRST_RUN);
    if (!seen) {
      setShow(true);
      localStorage.setItem(LS_FIRST_RUN, '1');
      const t = setTimeout(() => setShow(false), 1200); // ⬅️ ya no redirige
      return () => clearTimeout(t);
    }
  }, []);

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-white z-50 flex items-center justify-center">
      <div className="w-[70vw] max-w-md">
        <Image
          src="/splash.jpg"
          alt="Build your Habits"
          width={800}
          height={800}
          className="w-full h-auto rounded-2xl"
          priority
        />
      </div>
    </div>
  );
}
