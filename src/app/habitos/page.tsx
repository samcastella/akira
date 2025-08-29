'use client';
import { useMemo } from 'react';

export type HabitCardData = {
key: string;
title: string;
subtitle: string;
image: string; // ruta pública
};

const FEATURED_HABITS: HabitCardData[] = [
{ key: 'lectura', title: 'La máquina lectora', subtitle: 'Conviértete en un superlector', image: '/reading.jpg' },
{ key: 'burpees', title: 'Unos f*kn burpees', subtitle: 'Comienza hoy y no pares', image: '/burpees.jpg' },
{ key: 'finanzas', title: 'Finanzas en orden', subtitle: '30 días para tu dinero', image: '/finanzas.jpg' },
{ key: 'meditacion', title: 'Meditación esencial', subtitle: 'Respira. 10 min diarios', image: '/meditacion.jpg' },
];

export default function HabitosPage() {
const items = useMemo(() => FEATURED_HABITS, []);

return (
<main className="container">
<h2 style={{ margin: '8px 0 12px' }}>Programas destacados</h2>
<div className="grid grid-2">
{items.map((h) => (
<article key={h.key} className="card">
{/* Para imágenes estáticas desde /public en móvil funciona con <img src="/file.jpg"/> */}
<img src={h.image} alt={h.title} style={{ width:'100%', height:180, objectFit:'cover', borderRadius:12, border:'1px solid #eee' }} />
<h3 style={{ margin: '10px 0 4px' }}>{h.title}</h3>
<p style={{ margin: 0, color:'#666' }}>{h.subtitle}</p>
</article>
))}
</div>
</main>
);
}