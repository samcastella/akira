// app/ClientGuard.tsx
'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { isUserComplete, loadUser } from '@/lib/user';

const EXEMPT_PATHS = new Set<string>(['/registro', '/bienvenida']);

export default function ClientGuard() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Solo protegemos rutas que no estén exentas
    if (EXEMPT_PATHS.has(pathname)) return;

    const user = loadUser();
    if (!isUserComplete(user)) {
      router.replace('/registro');
    }
  }, [pathname, router]);

  return null;
}
