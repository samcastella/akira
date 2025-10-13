import type { Metadata } from "next";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import LayoutClient from "./LayoutClient";
import SupabaseSessionProvider from "@/components/providers/SupabaseSessionProvider";
import ProgramsBootstrap from "./ProgramsBootstrap";
import { NAV_HEIGHT } from "@/lib/constants";
import SplashClient from "./SplashClient"; // ⬅️ fade del splash tras hidratar

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
        {/* Preload del splash para que pinte ASAP */}
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
        {/* Splash SSR: aparece al instante y existe durante la hidratación */}
        <div
          id="__splash_ssr"
          style={{
            position: "fixed",
            inset: "0",
            zIndex: 9999,
            backgroundColor: "#000",
            backgroundImage: "url(/splash.jpg)",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        />
        {/* Ocultar splash justo DESPUÉS de hidratar: evita el #418 */}
        <SplashClient />

        {/* Datos críticos antes de hidratar */}
        <ProgramsBootstrap />

        <SupabaseSessionProvider>
          <LayoutClient bottomNav={<BottomNav />}>
            <main
              id="app-main"
              className="app-main px-0"
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
