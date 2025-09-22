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

  const c = await cookies();
  const all = c.getAll();

  // Nuevo esquema: una cookie sb-<project-ref>-auth-token
  const authCookie = all.find((ck) => ck.name.endsWith('-auth-token') && ck.name.startsWith('sb-'));
  const hasNewAuthCookie = Boolean(authCookie);

  // Legacy (pueden no existir en versiones nuevas)
  const access = all.find((ck) => ck.name === 'sb-access-token')?.value ?? null;
  const refresh = all.find((ck) => ck.name === 'sb-refresh-token')?.value ?? null;

  const serverOut = {
    userId: u.user?.id ?? null,
    email: u.user?.email ?? null,
    expiresAt: s.session?.expires_at
      ? new Date(s.session.expires_at * 1000).toISOString()
      : null,
    hasAnySbCookie: all.some((x) => x.name.startsWith('sb-')),
    hasSbAuthTokenCookie: hasNewAuthCookie,            // ✅ cookie nueva
    hasSbAccessCookie_LEGACY: Boolean(access),         // ⬅️ legacy
    hasSbRefreshCookie_LEGACY: Boolean(refresh),       // ⬅️ legacy
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '(no NEXT_PUBLIC_SUPABASE_URL)',
    cookieNames: all.map((x) => x.name),
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
          Desde Supabase SSR reciente se usa <code>sb-&lt;ref&gt;-auth-token</code> (httpOnly) en vez de
          <code> sb-access-token</code>/<code>sb-refresh-token</code>.
        </p>
      </section>

      <WhoamiClient />
    </main>
  );
}
