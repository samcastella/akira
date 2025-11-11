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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#FFD54F" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Akira" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="preload" as="image" href="/splash.jpg" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function(){
  var mark = function(){
    try {
      var b = document.body;
      if (!b) return;
      if (b.classList.contains('preload')) b.classList.remove('preload');
      b.classList.add('hydrated');
    } catch(_) {}
  };
  if (document.readyState === 'interactive' || document.readyState === 'complete') {
    requestAnimationFrame(mark);
  } else {
    document.addEventListener('DOMContentLoaded', function(){ requestAnimationFrame(mark); }, { once:true });
  }
  window.addEventListener('load', mark, { once:true });
})();
            `,
          }}
        />
      </head>

      <body
        className="antialiased preload"
        data-orientation-lock="portrait"
        style={{
          ["--font-geist-sans" as any]:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji"',
          ["--font-geist-mono" as any]:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
          fontFamily: "var(--font-geist-sans)",
          background: "var(--background)",
          color: "var(--foreground)",
          height: "100%",
          WebkitTextSizeAdjust: "100%",
          WebkitOverflowScrolling: "touch" as any,
          overscrollBehaviorY: "none" as any,
        }}
      >
        <ProgramsBootstrap />

        <SupabaseSessionProvider>
          {/* El BottomNav se monta SIEMPRE desde aquí, pero lo pinta LayoutClient */}
          <LayoutClient bottomNav={<BottomNav />}>
            <main
              id="app-main"
              className="app-main px-0"
              style={{
                paddingLeft: 0,
                paddingRight: 0,
                // ✅ ÚNICO sitio que reserva el hueco del nav (altura fija + safe area)
                paddingBottom: `calc(${NAV_HEIGHT}px + env(safe-area-inset-bottom, 0px))`,
                minHeight: "100dvh",
                background: "var(--background)",
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
