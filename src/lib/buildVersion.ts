// src/lib/buildVersion.ts
export const BUILD_V =
  process.env.NEXT_PUBLIC_BUILD_VERSION ?? "dev";

const LS_BUILD_KEY = "akira_build_v";

/** Claves que se deben reinicializar cuando cambia la build */
const LS_KEYS_TO_PURGE = [
  "akira_programs_active_v1",
  "programsLocal_v1",
  "akira_points_cache_v1",
  "akira_rank_cache_v1",
  "akira_program_defs_cache_v1",
];

export function detectAndHandleBuildChange() {
  try {
    const prev = localStorage.getItem(LS_BUILD_KEY);
    if (prev !== BUILD_V) {
      // Purga selectiva (no tocamos sesión, perfil, ni hábitos personalizados)
      for (const k of LS_KEYS_TO_PURGE) {
        localStorage.removeItem(k);
      }
      // Notifica por evento (por si algún módulo quiere reaccionar)
      window.dispatchEvent(
        new CustomEvent("akira:build:changed", { detail: { from: prev, to: BUILD_V } })
      );
      localStorage.setItem(LS_BUILD_KEY, BUILD_V);
    }
  } catch {
    // noop en SSR o si localStorage no está disponible
  }
}
