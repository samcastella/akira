// app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import { NAV_HEIGHT } from "@/lib/constants"; // usa el mismo alto que la BottomNav

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Akira - Build Your Habits",
  description: "Mejora tu vida paso a paso construyendo hábitos duraderos.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
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
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/* Wrapper con padding inferior sincronizado con NAV_HEIGHT + safe-area */}
        <div
          className="bg-[#FAFAFA]"
          style={{
            minHeight: "100svh",
            paddingBottom: `calc(${NAV_HEIGHT}px + env(safe-area-inset-bottom, 0px))`,
          }}
        >
          {/* Contenedor centrado tipo móvil */}
          <div className="mx-auto w-full max-w-md">{children}</div>
        </div>

        {/* Barra inferior fija en todas las páginas */}
        <BottomNav />
      </body>
    </html>
  );
}
