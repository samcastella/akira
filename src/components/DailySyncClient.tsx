// src/components/DailySyncClient.tsx
'use client';

import { useEffect } from 'react';
import { useDailySync } from '@/lib/useDailySync';
import { runMigrations } from '@/lib/migrations';

export default function DailySyncClient() {
  // 1) Migraciones/normalización (una vez al montar)
  useEffect(() => {
    try { runMigrations(); } catch {}
  }, []);

  // 2) Orquestador diario (crea retos del día si falta)
  useDailySync();

  return null;
}
