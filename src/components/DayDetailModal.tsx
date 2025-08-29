'use client';

import { X, Check, RotateCcw, ExternalLink } from 'lucide-react';
import Link from 'next/link';

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('es-ES', {
    day: '2-digit', month: 'long', year: 'numeric'
  });
}

export type DayProgramItem = {
  legacyKey: string;
  title: string;
  slug?: string;
  tasksCount: number;
  doneCount: number;
};

export default function DayDetailModal({
  dateStr,
  items,
  onClose,
  onMarkAll,
  onClear,
}: {
  dateStr: string;
  items: DayProgramItem[];
  onClose: () => void;
  onMarkAll: (legacyKey: string) => void;
  onClear: (legacyKey: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold">Detalle — {fmtDate(dateStr)}</h3>
          <button className="btn" onClick={onClose} title="Cerrar">
            <X size={16} />
          </button>
        </div>

        {items.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>No hay programas activos para esta fecha.</p>
        ) : (
          <ul className="list" style={{ margin: 0 }}>
            {items.map((it) => {
              const full = it.doneCount >= it.tasksCount && it.tasksCount > 0;
              const partial = it.doneCount > 0 && it.doneCount < it.tasksCount;
              return (
                <li
                  key={it.legacyKey}
                  style={{
                    padding: '10px 0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                    borderTop: '1px solid var(--line)',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div className="truncate">
                      <strong>{it.title}</strong>{' '}
                      <span className="muted" style={{ fontSize: 12 }}>
                        · {it.doneCount}/{it.tasksCount} hechos
                      </span>
                    </div>
                    {it.slug && (
                      <Link
                        href={`/habitos/${it.slug}`}
                        className="muted"
                        style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                      >
                        Ir al programa <ExternalLink size={14} />
                      </Link>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn"
                      title="Desmarcar el día"
                      onClick={() => onClear(it.legacyKey)}
                    >
                      <RotateCcw size={16} />
                    </button>
                    <button
                      className="btn"
                      title="Marcar el día como hecho"
                      onClick={() => onMarkAll(it.legacyKey)}
                      style={{
                        background: full ? '#111' : partial ? '#111' : undefined,
                        color: full || partial ? '#fff' : undefined,
                      }}
                    >
                      <Check size={16} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex justify-end mt-3">
          <button className="btn" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
