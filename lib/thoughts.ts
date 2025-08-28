cat > lib/thoughts.ts <<'TS'
export type Thought = { title: string; text: string };

export const THOUGHTS_BY_DAY: Record<number, Thought> = {
  1: { title: 'Visualízate', text: 'Imagina por un momento que ya lo lograste...' },
  2: { title: 'Un paso más', text: 'Comprométete a un paso pequeño hoy.' },
  3: { title: 'Eres constante', text: 'La disciplina es volver incluso en días pesados.' },
  4: { title: 'Confía en ti', text: 'Piensa en un reto superado y 3 cualidades.' },
  5: { title: 'El presente cuenta', text: 'Empieza con algo sencillo hoy.' },
  6: { title: 'Pequeñas victorias', text: 'Suma victorias pequeñas.' },
  0: { title: 'Reflexiona y agradece', text: 'Reconoce lo logrado esta semana.' },
};

export const todayThought = () => THOUGHTS_BY_DAY[new Date().getDay()];
TS
