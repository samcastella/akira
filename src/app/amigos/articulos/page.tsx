'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

import {
  getAllCommunityArticles,
  getFeaturedArticle,
  type CommunityArticle,
} from '@/data/communityArticles';

function formatDate(dateISO: string) {
  try {
    return new Date(dateISO).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateISO;
  }
}

function ArticleMeta({ article }: { article: CommunityArticle }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-600">
      <span className="inline-flex items-center rounded-full border px-2 py-0.5 uppercase tracking-wide">
        {article.category}
      </span>
      <span>·</span>
      <span>{formatDate(article.publishedAt)}</span>
      <span>·</span>
      <span>{article.readMinutes} min de lectura</span>
    </div>
  );
}

export default function ArticulosPage() {
  const featured = getFeaturedArticle();
  const all = getAllCommunityArticles();

  const list = featured
    ? all.filter((a) => a.slug !== featured.slug)
    : all;

  return (
    <main className="pb-6">
      {/* Hero / encabezado */}
      <section className="px-4 pt-4 pb-3">
        <h1 className="text-2xl sm:text-3xl font-black tracking-[-0.03em]">
          Artículos de la comunidad
        </h1>
        <p className="mt-2 text-sm text-neutral-600 max-w-xl">
          Ideas, ciencia y experiencias reales para ayudarte a construir hábitos
          que encajen con tu vida y no con la agenda de nadie más.
        </p>
      </section>

      {/* Artículo destacado */}
      {featured && (
        <section className="px-4 pb-6">
          <Link
            href={`/amigos/articulos/${featured.slug}`}
            className="block rounded-3xl overflow-hidden bg-white border shadow-sm hover:shadow-md transition focus:outline-none focus:ring-2 focus:ring-black"
            style={{ borderColor: 'var(--line)' }}
          >
            <div className="relative w-full aspect-[16/9]">
              <Image
                src={featured.cover}
                alt={featured.title}
                fill
                className="object-cover"
                sizes="(min-width: 768px) 800px, 100vw"
                priority
              />
            </div>

            <div className="p-4 sm:p-5 space-y-2">
              <ArticleMeta article={featured} />
              <h2 className="text-xl sm:text-2xl font-semibold leading-snug">
                {featured.title}
              </h2>
              <p className="text-sm text-neutral-700 line-clamp-3">
                {featured.excerpt}
              </p>
              <div className="mt-2 text-sm font-semibold text-neutral-900">
                Leer artículo →
              </div>
            </div>
          </Link>
        </section>
      )}

      {/* Listado de artículos */}
      <section className="px-4">
        <h2 className="text-base font-semibold text-neutral-900 mb-3">
          Todos los artículos
        </h2>

        {list.length === 0 ? (
          <p className="text-sm text-neutral-500">
            Todavía no hay artículos publicados.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {list.map((article) => (
              <Link
                key={article.slug}
                href={`/amigos/articulos/${article.slug}`}
                className="group rounded-2xl border bg-white p-3 flex flex-col h-full hover:shadow-sm transition focus:outline-none focus:ring-2 focus:ring-black"
                style={{ borderColor: 'var(--line)' }}
              >
                <div className="relative w-full aspect-[16/10] rounded-xl overflow-hidden mb-3 bg-neutral-100">
                  <Image
                    src={article.cover}
                    alt={article.title}
                    fill
                    className="object-cover group-hover:scale-[1.03] transition-transform"
                    sizes="(min-width: 768px) 400px, 100vw"
                  />
                </div>

                <ArticleMeta article={article} />

                <h3 className="mt-2 text-[15px] font-semibold leading-snug line-clamp-2">
                  {article.title}
                </h3>

                <p className="mt-1 text-xs text-neutral-600 line-clamp-3">
                  {article.excerpt}
                </p>

                <div className="mt-auto pt-2 text-xs font-semibold text-neutral-900">
                  Leer →
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
