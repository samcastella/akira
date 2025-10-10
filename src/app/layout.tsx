// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import LayoutClient from "./LayoutClient";
import SupabaseSessionProvider from "@/components/providers/SupabaseSessionProvider";
import ProgramsBootstrap from "./ProgramsBootstrap";
import { NAV_HEIGHT } from "@/lib/constants"; // ⬅️ importa la altura

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
      </head>

      <body
        className="antialiased"
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
        {/* ⬇️ Inyecta window.__PROGRAMS antes de hidratar el cliente */}
        <ProgramsBootstrap />

        <SupabaseSessionProvider>
          {/* No pasa nada por seguir pasándolo como bottomNav */}
          <LayoutClient bottomNav={<BottomNav />}>
            <main
              className="app-main"
              id="app-main"
              // ⬇️ Reserva altura de la barra superior + safe area (notch)
              style={{
                paddingTop: `calc(${NAV_HEIGHT}px + env(safe-area-inset-top, 0px))`,
                // Si antes reservabas espacio abajo para el bottom-nav, elimínalo:
                paddingBottom: undefined,
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
