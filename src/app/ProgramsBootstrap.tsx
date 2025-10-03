// app/ProgramsBootstrap.tsx
import Script from "next/script";
import { PROGRAMS } from "@/data/programs";

function normalizeSlug(s: string) {
  return String(s || "").replace(/-30$/, "");
}

function buildIndex(src: any) {
  const out: Record<string, any> = {};

  if (Array.isArray(src)) {
    for (const p of src) if (p?.slug) out[normalizeSlug(p.slug)] = p;
  } else if (src && typeof src === "object") {
    // por valores
    for (const v of Object.values(src)) {
      const p: any = v;
      if (p?.slug) out[normalizeSlug(p.slug)] = p;
    }
    // por claves directas { 'detox-tecnologico': {...} }
    for (const [k, v] of Object.entries(src)) {
      const p: any = v;
      if (p?.slug) out[normalizeSlug(k)] = p;
    }
  }
  return out;
}

export default function ProgramsBootstrap() {
  // Serializamos en server; quedará embebido en el HTML inicial
  const payload = JSON.stringify(buildIndex(PROGRAMS));
  return (
    <Script
      id="programs-bootstrap"
      strategy="beforeInteractive"
      dangerouslySetInnerHTML={{
        __html: `
          (function(){
            try {
              window.__PROGRAMS = ${payload};
              // avisa a vistas que escuchen (Mi Zona ya lo hace)
              window.dispatchEvent(new Event('akira:programs-updated'));
            } catch (e) {}
          })();
        `,
      }}
    />
  );
}
