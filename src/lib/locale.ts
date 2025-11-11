// src/lib/locale.ts
import { type Locale, normalizeLocale } from './copy';

export const LS_LOCALE = 'akira_locale_v1';

/** Lee el locale guardado en localStorage (si existe y es válido). */
function readStoredLocale(): Locale | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = localStorage.getItem(LS_LOCALE);
    if (!v) return null;
    return normalizeLocale(v);
  } catch {
    return null;
  }
}

/** Devuelve el locale actual. Si no hay guardado, detecta y persiste uno. */
export function getLocale(): Locale {
  // 1) preferimos el guardado
  const stored = readStoredLocale();
  if (stored) return stored;

  // 2) detectamos por navegador
  let detected: string | undefined = undefined;
  if (typeof navigator !== 'undefined') {
    detected = navigator.language || (navigator.languages && navigator.languages[0]);
  }
  const norm = normalizeLocale(detected);

  // 3) persistimos para siguientes veces
  setLocale(norm);
  return norm;
}

/** Guarda el locale elegido por el usuario. */
export function setLocale(locale: Locale) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LS_LOCALE, locale);
    // Disparamos un evento por si otros componentes quieren reaccionar
    window.dispatchEvent(new Event('akira:locale-changed'));
  } catch {}
}

/** Detecta (sin persistir) el locale basado en navigator.* */
export function detectLocale(): Locale {
  let detected: string | undefined = undefined;
  if (typeof navigator !== 'undefined') {
    detected = navigator.language || (navigator.languages && navigator.languages[0]);
  }
  return normalizeLocale(detected);
}

/** Hook opcional para reaccionar a cambios de idioma en tiempo real. */
import { useEffect, useState } from 'react';
export function useLocale(): [Locale, (l: Locale) => void] {
  const [locale, setLocaleState] = useState<Locale>(() => getLocale());

  useEffect(() => {
    const onChange = () => setLocaleState(getLocale());
    window.addEventListener('akira:locale-changed', onChange);
    window.addEventListener('storage', onChange); // sincroniza entre pestañas
    return () => {
      window.removeEventListener('akira:locale-changed', onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);

  const update = (l: Locale) => {
    setLocale(l);
    setLocaleState(l);
  };

  return [locale, update];
}
