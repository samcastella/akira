// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import LayoutClient from "./LayoutClient";
import { SupabaseSessionProvider } from "@/components/providers/SupabaseSessionProvider";

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
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
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
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          fontFamily: "var(--font-geist-sans)",
          background: "#FAFAFA",
          color: "#111",
          minHeight: "100svh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <SupabaseSessionProvider>
          <LayoutClient bottomNav={<BottomNav />}>
            {/* 👇 Esto garantiza que el contenido de cualquier subpágina (ej. /mizona/amigos) se renderice */}
            <div className="flex-1">{children}</div>
          </LayoutClient>
        </SupabaseSessionProvider>
      </body>
    </html>
  );
}
