// ¡client-safe! Devuelve la URL absoluta al callback correcto del entorno actual
export function authRedirectTo(): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/auth/callback`;
  }
  // Fallback para server-side (por si alguna vez lo usas desde un Client Component que se renderiza en SSR)
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.NEXT_PUBLIC_VERCEL_URL
      ? (process.env.NEXT_PUBLIC_VERCEL_URL.startsWith('http')
          ? process.env.NEXT_PUBLIC_VERCEL_URL
          : `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`)
      : '');
  return `${base}/auth/callback`;
}
