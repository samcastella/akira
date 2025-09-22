// src/app/debug/whoami/page.tsx
import { cookies } from 'next/headers';
import { getSupabaseServer } from '@/lib/supabaseServer';
import WhoamiClient from './WhoamiClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default async function WhoAmI() {
  // Cliente server-side de Supabase (usa @supabase/ssr con cookies getAll/setAll)
  const supabase = await getSupabaseServer();

  // Pedimos user + session en paralelo (sin cache)
  const [{ data: u }, { data: s }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getSession(),
  ]);

// Cookies HTTP-only visibles en el request del servidor (API async en tu runtime)
const c = await cookies();
const sbAccess = c.get('sb-access-token')?.value ?? null;
const sbRefresh = c.get('sb-refresh-token')?.value ?? null;

  const serverOut = {
    userId: u.user?.id ?? null,
    email: u.user?.email ?? null,
    expiresAt: s.session?.expires_at
      ? new Date(s.session.expires_at * 1000).toISOString()
      : null,
    hasSbAccessCookie: Boolean(sbAccess),
    hasSbRefreshCookie: Boolean(sbRefresh),
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '(no NEXT_PUBLIC_SUPABASE_URL)',
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
          (Esto es lo que Next.js ve en el servidor. Si aquí sale <code>null</code>,
          revisa el <code>middleware</code>, los Redirect URLs de Supabase y que el
          login por contraseña esté llamando a <code>/auth/set</code>).
        </p>
      </section>

      <WhoamiClient />
    </main>
  );
}
