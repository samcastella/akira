export type Thought = { title: string; text: string };

export const THOUGHTS_BY_DAY: Record<number, Thought> = {
  1: { title: 'Visualízate', text: 'Imagina por un momento que ya lo lograste. Si tu reto es empezar a correr, mírate dentro de unos meses cruzando la meta... Hoy dedica 2–3 minutos a cerrar los ojos y verte consiguiendo tus objetivos.' },
  2: { title: 'Un paso más', text: 'No importa lo lejos que esté tu meta. Hoy comprométete a dar un paso pequeño: 5 páginas de lectura o 10 minutos de entreno.' },
  3: { title: 'Eres constante', text: 'La disciplina es volver incluso en los días que pesan. Elige una acción mínima para no romper la cadena.' },
  4: { title: 'Confía en ti', text: 'Piensa en un reto que ya superaste. Escribe tres cualidades tuyas que te ayudarán a conseguir tu meta.' },
  5: { title: 'El presente cuenta', text: 'Empieza con algo sencillo hoy: guarda 1€ o elige una comida sana. El cambio comienza ahora.' },
  6: { title: 'Pequeñas victorias', text: 'Camina 10 minutos, bebe un vaso de agua extra o envía ese mensaje pendiente. Suma victorias.' },
  0: { title: 'Reflexiona y agradece', text: 'Reconoce lo logrado esta semana. Respira y agradece una acción que te hizo avanzar.' },
};

export const todayThought = () => THOUGHTS_BY_DAY[new Date().getDay()];
