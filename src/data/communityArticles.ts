// src/data/communityArticles.ts

export type CommunityArticle = {
  slug: string;
  title: string;
  excerpt: string;
  cover: string;
  category: string;
  publishedAt: string; // ISO: '2025-11-14'
  readMinutes: number;
  featured?: boolean;
  content: string[]; // cada string = un párrafo
};

export const COMMUNITY_ARTICLES: CommunityArticle[] = [
  {
    slug: 'habitos-que-duran-mas-de-30-dias',
    title: 'Hábitos que duran más de 30 días',
    excerpt:
      'Por qué muchos retos de 30 días no funcionan y cómo construir hábitos que se quedan contigo a largo plazo.',
    cover: '/images/articles/habitos-30-dias.jpg',
    category: 'Hábitos',
    publishedAt: '2025-11-10',
    readMinutes: 6,
    featured: true,
    content: [
      'Muchos retos de 30 días son geniales para arrancar, pero no siempre están pensados para quedarse en tu vida. El objetivo de Akira no es que colecciones retos, sino que consolides hábitos que te acompañen años.',
      'Para que un hábito se mantenga más allá de los 30 días, necesitas tres cosas: que sea sostenible, que esté conectado con algo que te importe de verdad y que tenga un sistema sencillo para no romper la cadena.',
      'En este artículo veremos cómo elegir el nivel adecuado de dificultad, cómo diseñar tu entorno para que el hábito sea casi inevitable y cómo usar los retos de 30 días como “lanzadera” hacia una versión más estable del hábito.',
    ],
  },
  {
    slug: 'como-usar-retos-con-amigos-para-mantener-la-rachas',
    title: 'Cómo usar los retos con amigos para mantener la racha',
    excerpt:
      'La mayoría de personas rinde mejor cuando siente que forma parte de algo. Así es como los retos con amigos pueden salvar tus hábitos en días difíciles.',
    cover: '/images/articles/retos-con-amigos.jpg',
    category: 'Comunidad',
    publishedAt: '2025-11-08',
    readMinutes: 5,
    content: [
      'Cuando dependemos solo de fuerza de voluntad, cualquier día malo puede tirar por tierra una racha perfecta. Pero cuando sientes que formas parte de un grupo, la conversación cambia: ya no vas solo.',
      'Los retos con amigos añaden tres ingredientes clave: compromiso social, un poquito de sana presión y un espacio para celebrar juntos los avances. Esa mezcla hace que sea mucho más difícil rendirse en silencio.',
      'En Akira, los retos con amigos están pensados para que compartir tu progreso sea fácil y, sobre todo, seguro: ni rankings tóxicos ni vergüenza por fallar un día. La idea es ayudarte a volver al hábito, no castigarte.',
    ],
  },
  {
    slug: 'que-hacer-cuando-rompes-la-racha',
    title: 'Qué hacer cuando rompes la racha (sin castigarte)',
    excerpt:
      'Romper la racha no es el final del hábito. Es parte del proceso. Aquí tienes un plan simple para volver al camino sin machacarte.',
    cover: '/images/articles/romper-la-racha.jpg',
    category: 'Mente',
    publishedAt: '2025-11-05',
    readMinutes: 4,
    content: [
      'Antes o después, todo el mundo rompe la racha. El problema no es el día que fallas, sino lo que haces justo después. Muchos convierten un tropiezo puntual en una excusa para abandonar.',
      'La clave está en tener un protocolo para los “días después”: revisar qué ha pasado sin juicio, ajustar el nivel del hábito si hace falta y recordar por qué empezaste.',
      'En Akira, nos interesa más tu consistencia a lo largo de meses que tu perfección en una semana. Tu identidad no se rompe por un día malo. Se refuerza cada vez que decides volver.',
    ],
  },
];

/**
 * Devuelve todos los artículos ordenados por fecha (más recientes primero)
 */
export function getAllCommunityArticles(): CommunityArticle[] {
  return [...COMMUNITY_ARTICLES].sort((a, b) => {
    if (a.publishedAt === b.publishedAt) return 0;
    return a.publishedAt < b.publishedAt ? 1 : -1;
  });
}

/**
 * Busca un artículo por slug. Si no existe, devuelve null.
 */
export function getCommunityArticleBySlug(slug: string): CommunityArticle | null {
  return COMMUNITY_ARTICLES.find((a) => a.slug === slug) ?? null;
}

/**
 * Devuelve el artículo destacado (featured) o, si no hay,
 * el primero de la lista ordenada.
 */
export function getFeaturedArticle(): CommunityArticle | null {
  const featured = COMMUNITY_ARTICLES.find((a) => a.featured);
  if (featured) return featured;
  const all = getAllCommunityArticles();
  return all.length ? all[0] : null;
}
