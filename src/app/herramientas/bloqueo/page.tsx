'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';

/* ————————— Utils ————————— */

// Genera una expresión tipo: a^2 + b - c + (d+e)
// y devuelve { expr: string, value: number }
function genExpression() {
  // rangos suaves
  const a = rand(2, 5);
  const b = rand(3, 12);
  const c = rand(1, 7);
  const d = rand(2, 9);
  const e = rand(1, 9);

  // 30% de prob usar ^3 en lugar de ^2
  const power = Math.random() < 0.3 ? 3 : 2;

  const value = Math.pow(a, power) + b - c + (d + e);
  const expr = `${a}^${power} + ${b} - ${c} + (${d}+${e}) = ?`;
  return { expr, value };
}

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function toSeconds(mins: number, secs: number) {
  const m = Math.max(0, Math.floor(mins) || 0);
  const s = Math.max(0, Math.floor(secs) || 0);
  return Math.min(3599, m * 60 + s); // cap ~1h
}

function fmtTime(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/* ————————— Page ————————— */

export default function BloqueoToolPage() {
  const [mins, setMins] = useState(10);
  const [secs, setSecs] = useState(0);
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState(0);

  const [challengeOpen, setChallengeOpen] = useState(false);
  const [challenge, setChallenge] = useState<{ expr: string; value: number } | null>(null);
  const [answer, setAnswer] = useState('');
  const [wrong, setWrong] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Evitar back “accidental” y cerrar pestaña mientras corre
  useEffect(() => {
    if (!running) return;

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);

    // Traba leve al botón atrás
    const trap = () => history.pushState(null, '', location.href);
    trap();
    window.addEventListener('popstate', trap);

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('popstate', trap);
    };
  }, [running]);

  // Timer
  useEffect(() => {
    if (!running) return;
    if (timerRef.current) clearInterval(timerRef.current as any);

    timerRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(timerRef.current as any);
          timerRef.current = null;
          setRunning(false);
          setChallengeOpen(false);
          return 0;
        }
        return r - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current as any);
      timerRef.current = null;
    };
  }, [running]);

  function start() {
    const total = toSeconds(mins, secs);
    if (total <= 0) return;
    setRemaining(total);
    setRunning(true);
    setChallengeOpen(false);
    setAnswer('');
    setWrong(false);
  }

  function stop() {
    // Solo sale si no está corriendo o si supera el reto
    setRunning(false);
    setChallengeOpen(false);
    setAnswer('');
    setWrong(false);
  }

  function openChallenge() {
    setChallenge(genExpression());
    setChallengeOpen(true);
    setAnswer('');
    setWrong(false);
  }

  function submitChallenge() {
    const val = Number(answer.replace(',', '.'));
    if (challenge && Number.isFinite(val) && Math.round(val) === Math.round(challenge.value)) {
      stop(); // desbloquea
    } else {
      setWrong(true);
      setTimeout(() => setWrong(false), 450);
      setChallenge(genExpression()); // cambia el problema para evitar spam de prueba/error
      setAnswer('');
    }
  }

  const disabled = running && remaining > 0;

  return (
    <main className="container mx-auto px-4 py-6">
      <div className="mb-4">
        <Link href="/herramientas" className="text-sm inline-flex items-center gap-2 hover:underline">
          <ChevronLeft className="w-4 h-4" /> Volver
        </Link>
      </div>

      <h2 className="page-title">Bloqueo de uso</h2>
      <p className="muted mb-4">
        Pantalla negra con cuenta atrás. Para desbloquear antes de tiempo tendrás que resolver una operación.
      </p>

      <section className="card mt-3">
        <div className="grid grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-xs text-neutral-500 mb-1">Minutos</label>
            <input
              type="number"
              min={0}
              max={59}
              value={mins}
              onChange={(e) => setMins(Math.max(0, Math.min(59, Number(e.target.value) || 0)))}
              className="w-full px-3 py-2 rounded-xl border"
              disabled={disabled}
            />
          </div>
          <div>
            <label className="block text-xs text-neutral-500 mb-1">Segundos</label>
            <input
              type="number"
              min={0}
              max={59}
              value={secs}
              onChange={(e) => setSecs(Math.max(0, Math.min(59, Number(e.target.value) || 0)))}
              className="w-full px-3 py-2 rounded-xl border"
              disabled={disabled}
            />
          </div>
          <div className="flex gap-2">
            {!running ? (
              <button
                onClick={start}
                className="w-full rounded-2xl px-4 py-2 font-semibold bg-black text-white"
                disabled={toSeconds(mins, secs) <= 0}
              >
                Empezar
              </button>
            ) : (
              <button
                onClick={openChallenge}
                className="w-full rounded-2xl px-4 py-2 font-semibold border"
              >
                Desbloquear
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Overlay de bloqueo */}
      {running && (
        <div className="fixed inset-0 z-[100] bg-black text-yellow-400 flex items-center justify-center">
          <div className="text-center select-none">
            <div className="text-[56px] md:text-[96px] font-black tabular-nums leading-none">
              {fmtTime(remaining)}
            </div>
            <div className="mt-6">
              <button
                onClick={openChallenge}
                className="rounded-xl px-4 py-2 font-semibold border border-yellow-400 text-yellow-400 hover:bg-yellow-400 hover:text-black active:scale-[0.98]"
              >
                Desbloquear
              </button>
            </div>
          </div>

          {/* Modal reto matemático */}
          {challengeOpen && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-4">
              <div className={`w-full max-w-md rounded-2xl border border-yellow-400 p-5 bg-black ${wrong ? 'animate-[shake_0.45s]' : ''}`}>
                <div className="text-yellow-400 font-semibold mb-2">
                  Resuelve para desbloquear
                </div>
                <div className="text-xl text-yellow-300 mb-3 font-mono">
                  {challenge?.expr ?? '…'}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    inputMode="numeric"
                    placeholder="Respuesta"
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') submitChallenge(); }}
                    className="flex-1 px-3 py-2 rounded-xl bg-black text-yellow-200 border border-yellow-700 focus:outline-none"
                  />
                  <button
                    onClick={submitChallenge}
                    className="rounded-xl px-4 py-2 font-semibold bg-yellow-400 text-black hover:opacity-90 active:scale-[0.98]"
                  >
                    Comprobar
                  </button>
                </div>
                <div className="text-xs text-yellow-600 mt-3">
                  * La cuenta atrás continúa en segundo plano.
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Animación shake simple */}
      <style jsx global>{`
        @keyframes shake {
          10%, 90% { transform: translateX(-1px); }
          20%, 80% { transform: translateX(2px); }
          30%, 50%, 70% { transform: translateX(-4px); }
          40%, 60% { transform: translateX(4px); }
        }
      `}</style>
    </main>
  );
}
