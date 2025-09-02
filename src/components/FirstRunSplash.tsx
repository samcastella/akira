// components/FirstRunSplash.tsx
'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { LS_FIRST_RUN } from '@/lib/user';
import { useRouter } from 'next/navigation';

export default function FirstRunSplash() {
  const router = useRouter();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const seen = localStorage.getItem(LS_FIRST_RUN);
    if (!seen) {
      setShow(true);
      localStorage.setItem(LS_FIRST_RUN, '1');
      // Pequeña pausa y a registro
      const t = setTimeout(() => router.replace('/registro'), 1200);
      return () => clearTimeout(t);
    }
  }, [router]);

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
