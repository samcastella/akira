"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

interface ProgramDetailProps {
  imageSrc: string;
  title: string;
  shortDescription: string;
  howItWorks: string;
  startHref?: string;
  slug: string;
}

export default function ProgramDetail({
  imageSrc,
  title,
  shortDescription,
  howItWorks,
  startHref = "/habitos/lectura/dia-1",
  slug,
}: ProgramDetailProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const handleStart = () => {
    try {
      localStorage.setItem("akira_program_active", slug);
      localStorage.setItem("akira_program_started_at", new Date().toISOString());
      localStorage.setItem(`akira_program_${slug}_progress`, JSON.stringify({ day: 1 }));
    } catch (e) {
      console.warn("LocalStorage not available", e);
    }
    router.push(startHref);
  };

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <div className="overflow-hidden rounded-2xl shadow-sm">
        <img src={imageSrc} alt={title} className="h-56 w-full object-cover sm:h-72" />
      </div>

      <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>

      <p className="mt-2 text-base text-neutral-600 dark:text-neutral-300">
        {shortDescription}
      </p>

      <div className="mt-4">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-xl border border-neutral-200 px-4 py-3 text-left text-sm font-medium transition hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
          aria-expanded={open}
          aria-controls="how-it-works"
        >
          <span>Cómo funciona</span>
          <svg
            className={`h-5 w-5 transition-transform ${open ? "rotate-180" : "rotate-0"}`}
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.135l3.71-2.905a.75.75 0 111.06 1.06l-4.24 3.325a.75.75 0 01-.94 0L5.25 8.29a.75.75 0 01-.02-1.08z" clipRule="evenodd" />
          </svg>
        </button>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              id="how-it-works"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: "tween", duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="px-1 pt-3 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                {howItWorks}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={handleStart}
          className="rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 active:scale-[0.98] dark:bg-white dark:text-black"
        >
          Comenzar programa
        </button>
        <a
          href="#plan"
          className="text-sm font-medium text-neutral-600 underline-offset-4 hover:underline dark:text-neutral-300"
        >
          Ver plan de 30 días
        </a>
      </div>
    </div>
  );
}
