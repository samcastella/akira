// src/lib/copy.ts

// Idiomas soportados
export type Locale = 'es' | 'en';

// Estructura del diccionario (extensible por secciones)
export type Copy = {
  auth: {
    /** Texto de bienvenida del paso 5 (antes de “Vamos a por ello”) */
    welcomeIntro: string;
  };
  // Ejemplo de futuras secciones:
  // home: { ... }
  // tools: { ... }
};

// Diccionario principal
export const COPY: Record<Locale, Copy> = {
  es: {
    auth: {
      welcomeIntro:
        'Nuestra app está diseñada para ayudarte a construir hábitos saludables que mejoren tu bienestar desde cero, y para dejar atrás los malos hábitos de la forma más sencilla y amable posible.',
    },
  },
  en: {
    auth: {
      welcomeIntro:
        'Our app is designed to help you build healthy habits that improve your well-being from the ground up, and to leave bad habits behind in the simplest and kindest way possible.',
    },
  },
};

/**
 * Devuelve el bloque de textos para un idioma dado.
 * Acepta strings tipo "es-ES" o "en-US" y hace normalización a 'es' | 'en'.
 * Fallback seguro a 'es'.
 */
export function getCopy(locale?: string): Copy {
  const norm = normalizeLocale(locale);
  return COPY[norm];
}

/** Normaliza un locale arbitrario a 'es' | 'en' con fallback a 'es'. */
export function normalizeLocale(locale?: string): Locale {
  const base = (locale || 'es').toLowerCase().slice(0, 2);
  return base === 'en' ? 'en' : 'es';
}
