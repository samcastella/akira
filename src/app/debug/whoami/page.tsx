// src/app/debug/whoami/page.tsx
import { cookies } from 'next/headers';
import { getSupabaseServer } from '@/lib/supabaseServer';
import WhoamiClient from './WhoamiClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default async function WhoAmI() {
  const supabase = await getSupabaseServer();

  const [{ data: u }, { data: s }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getSession(),
  ]);

  // En tu entorno, cookies() es async
  const c = await cookies();
  const all = c.getAll();
  const hasSb = all.some((ck) => ck.name.startsWith('sb-')); // robusto a cambios de nombre
  const access = all.find((ck) => ck.name === 'sb-access-token')?.value ?? null;
  const refresh = all.find((ck) => ck.name === 'sb-refresh-token')?.value ?? null;

  const serverOut = {
    userId: u.user?.id ?? null,
    email: u.user?.email ?? null,
    expiresAt: s.session?.expires_at
      ? new Date(s.session.expires_at * 1000).toISOString()
      : null,
    hasAnySbCookie: hasSb,
    hasSbAccessCookie: Boolean(access),
    hasSbRefreshCookie: Boolean(refresh),
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '(no NEXT_PUBLIC_SUPABASE_URL)',
    cookieNames: all.map((x) => x.name), // útil para debug (no mostramos valores)
  };

  return (
    <main className="p-4 space-y-6">
      <h1 className="text-lg font-semibold">Debug · WhoAmI</h1>

      <section>
        <h2 className="font-mono text-sm mb-1">server</h2>
        <pre className="text-xs bg-black/5 p-3 rounded">
          {JSON.stringify(serverOut, null, 2)}
        </pre>
        <p className="text-xs opacity-70">
          (Esto es lo que Next.js ve en el servidor. Comprueba <code>cookieNames</code> para ver si
          llegan cookies <code>sb-*</code>. Si no, revisa el flujo de login password → <code>/auth/set</code>.)
        </p>
      </section>

      <WhoamiClient />
    </main>
  );
}
