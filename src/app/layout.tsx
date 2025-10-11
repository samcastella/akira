// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import LayoutClient from "./LayoutClient";
import SupabaseSessionProvider from "@/components/providers/SupabaseSessionProvider";
import ProgramsBootstrap from "./ProgramsBootstrap";
import { NAV_HEIGHT } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Akira - Build Your Habits",
  description: "Mejora tu vida paso a paso construyendo hábitos duraderos.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* Viewport + safe areas iOS */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        {/* PWA */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#FFD54F" />
        {/* iOS */}
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Akira" />
        {/* Favicon */}
        <link rel="icon" href="/favicon.ico" />
        {/* Preload del splash para aparición inmediata */}
        <link rel="preload" as="image" href="/splash.jpg" />
      </head>

      <body
        className="antialiased"
        data-orientation-lock="portrait"
        style={{
          ["--font-geist-sans" as any]:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji"',
          ["--font-geist-mono" as any]:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
          fontFamily: "var(--font-geist-sans)",
          background: "var(--background)",
          color: "var(--foreground)",
        }}
      >
        {/* Splash SSR instantáneo (se quita al 'load') */}
        <div
          id="__splash_ssr"
          style={{
            position: "fixed",
            inset: 0 as unknown as number, // TSX quirk: permite "inset:0"
            zIndex: 9999,
            backgroundColor: "#000",
            backgroundImage: "url(/splash.jpg)",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function(){
                var remove = function(){
                  var el = document.getElementById('__splash_ssr');
                  if (!el) return;
                  el.style.transition = 'opacity 400ms ease';
                  el.style.opacity = '0';
                  setTimeout(function(){
                    if (el && el.parentNode) el.parentNode.removeChild(el);
                  }, 420);
                };
                if (document.readyState === 'complete') { remove(); }
                else window.addEventListener('load', remove, { once: true });
              })();
            `,
          }}
        />

        {/* ⬇️ Inyecta window.__PROGRAMS antes de hidratar el cliente */}
        <ProgramsBootstrap />

        <SupabaseSessionProvider>
          <LayoutClient bottomNav={<BottomNav />}>
            <main
              id="app-main"
              className="app-main px-0"
              // ⬇️ Reserva altura del bottom-nav + safe area inferior
              style={{
                paddingLeft: 0,
                paddingRight: 0,
                paddingBottom: `calc(${NAV_HEIGHT}px + env(safe-area-inset-bottom, 0px))`,
              }}
            >
              {children}
            </main>
          </LayoutClient>
        </SupabaseSessionProvider>
      </body>
    </html>
  );
}
