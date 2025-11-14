'use client';

import React from 'react';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

import {
  getCommunityArticleBySlug,
  type CommunityArticle,
} from '@/data/communityArticles';

function formatDate(dateISO: string) {
  try {
    return new Date(dateISO).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'long',
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

type PageProps = {
  params: {
    slug: string;
  };
};

export default function ArticuloDetallePage({ params }: PageProps) {
  const article = getCommunityArticleBySlug(params.slug);

  if (!article) {
    // O podrías usar notFound(); si tienes una 404 más trabajada
    return (
      <main className="px-4 py-6">
        <Link href="/amigos/articulos" className="text-sm underline">
          ← Volver a artículos
        </Link>
        <h1 className="mt-4 text-xl font-semibold">Artículo no encontrado</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Es posible que el artículo haya cambiado de dirección o se haya eliminado.
        </p>
      </main>
    );
  }

  return (
    <main className="pb-8">
      <header className="px-4 pt-4 pb-2">
        <Link href="/amigos/articulos" className="text-xs underline">
          ← Volver a artículos
        </Link>

        <div className="mt-3 space-y-2">
          <ArticleMeta article={article} />
          <h1 className="text-2xl sm:text-3xl font-black tracking-[-0.03em] leading-tight">
            {article.title}
          </h1>
        </div>
      </header>

      <section className="px-4 pb-4">
        <div className="relative w-full aspect-[16/9] rounded-3xl overflow-hidden bg-neutral-100">
          <Image
            src={article.cover}
            alt={article.title}
            fill
            className="object-cover"
            sizes="(min-width: 768px) 800px, 100vw"
          />
        </div>
      </section>

      <section className="px-4">
        <article className="prose prose-sm sm:prose-base max-w-none prose-p:text-neutral-800">
          {article.content.map((paragraph, idx) => (
            <p key={idx}>{paragraph}</p>
          ))}
        </article>
      </section>
    </main>
  );
}
