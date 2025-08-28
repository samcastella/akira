
Sam Castellá <samcastellamunoz@gmail.com>
12:19 (hace 0 minutos)
para mí

"use client";

import { useEffect, useState } from "react";

/* ========== Helpers ========== */
type UserData = {
nombre?: string;
streak?: number;
puntos?: number;
avatar?: string; // p.ej. "/avatar-default.png" en /public
};

function safeGet<T = any>(key: string, fallback: T): T {
if (typeof window === "undefined") return fallback;
try {
const raw = localStorage.getItem(key);
if (!raw) return fallback;
return JSON.parse(raw) as T;
} catch {
return fallback;
}
}

/* ========== Sub-vistas (todo en este archivo) ========== */
function InicioView({ goHabitos }: { goHabitos: () => void }) {
return (
<main style={{ padding: 24 }}>
<h1 style={{ marginBottom: 8 }}>Inicio</h1>
<p style={{ opacity: 0.75, marginBottom: 16 }}>
Bienvenido. Pulsa abajo para navegar.
</p>
<button onClick={goHabitos} style={btn}>Ir a Hábitos →</button>
</main>
);
}

function HabitosView() {
return (
<main style={{ padding: 24 }}>
<h1 style={{ marginBottom: 12 }}>Hábitos</h1>

<div style={{ display: "grid", gap: 16 }}>
<div className="card">
<img src="/burpees.jpg" alt="Burpees" width={1200} height={630}
style={img} />
<h3 style={{ marginTop: 10 }}>Burpees · 30 días</h3>
</div>
<div className="card">
<img src="/meditacion.jpg" alt="Meditación" width={1200} height={630}
style={img} />
<h3 style={{ marginTop: 10 }}>Meditación</h3>
</div>
<div className="card">
<img src="/finanzas.jpg" alt="Finanzas" width={1200} height={630}
style={img} />
<h3 style={{ marginTop: 10 }}>Finanzas</h3>
</div>
</div>

<style jsx>{`
.card { border: 1px solid #eee; border-radius: 12px; padding: 12px; }
`}</style>
</main>
);
}

function MiZonaView() {
const [ready, setReady] = useState(false);
const [user, setUser] = useState<UserData | null>(null);

useEffect(() => {
// Lectura segura (no rompe si no hay nada guardado)
const data = safeGet<UserData>("userData", {});
setUser(data);
setReady(true);
}, []);

if (!ready) {
return (
<main style={{ padding: 24 }}>
<h1>Mi zona</h1>
<p>Cargando tus datos…</p>
</main>
);
}

const nombre = user?.nombre ?? "¡Hola!";
const streak = user?.streak ?? 0;
const puntos = user?.puntos ?? 0;
const avatar = user?.avatar ?? "/avatar-default.png"; // asegúrate de tenerlo en /public

return (
<main style={{ padding: 24 }}>
<h1 style={{ marginBottom: 6 }}>Mi zona</h1>
<p style={{ opacity: 0.8, marginBottom: 20 }}>Bienvenido {nombre}</p>

{/* Avatar + saludo */}
<section
style={{
display: "grid",
gridTemplateColumns: "64px 1fr",
gap: 12,
alignItems: "center",
marginBottom: 20,
}}
>
<div style={{ width: 64, height: 64, borderRadius: "50%", overflow: "hidden" }}>
<img
src={avatar}
alt="Avatar"
width={64}
height={64}
style={{ width: 64, height: 64, objectFit: "cover" }}
/>
</div>
<div>
<strong style={{ display: "block" }}>{nombre}</strong>
<span style={{ fontSize: 13, opacity: 0.7 }}>
Sigue construyendo tus hábitos
</span>
</div>
</section>

{/* KPIs */}
<section
style={{
display: "grid",
gridTemplateColumns: "1fr 1fr",
gap: 12,
marginBottom: 20,
}}
>
<div style={kpiBox}>
<div style={kpiLabel}>Racha</div>
<div style={kpiValue}>{streak} días</div>
</div>
<div style={kpiBox}>
<div style={kpiLabel}>Puntos</div>
<div style={kpiValue}>{puntos}</div>
</div>
</section>

{/* Banner / Progreso */}
<section>
<h2 style={{ marginBottom: 10 }}>Tu progreso</h2>
<img
src="/mi-progreso.jpg"
alt="Progreso"
width={1600}
height={900}
style={{
width: "100%",
height: "auto",
borderRadius: 12,
border: "1px solid #eee",
}}
/>
</section>
</main>
);
}

function HerramientasView() {
return (
<main style={{ padding: 24 }}>
<h1>Herramientas</h1>
<ul style={{ marginTop: 12, lineHeight: 1.8 }}>
<li><strong>Mis notas:</strong> escribe y guarda frases/ideas.</li>
<li><strong>Diario de gratitud:</strong> registro diario.</li>
<li><strong>Lectura 30 días</strong> · <strong>Burpees</strong> · <strong>Finanzas</strong> · <strong>Meditación</strong></li>
</ul>
</main>
);
}

function AmigosView() {
return (
<main style={{ padding: 24 }}>
<h1>Amigos</h1>
<p style={{ opacity: 0.75 }}>Comparte tus logros con tus amigos.</p>
</main>
);
}

/* ========== Página con Tabs (todo aquí) ========== */
type Tab = "inicio" | "habitos" | "mi-zona" | "herramientas" | "amigos";

export default function Page() {
const [tab, setTab] = useState<Tab>("inicio");

return (
<>
<div style={{ paddingBottom: 76 }}>
{tab === "inicio" && <InicioView goHabitos={() => setTab("habitos")} />}
{tab === "habitos" && <HabitosView />}
{tab === "mi-zona" && <MiZonaView />}
{tab === "herramientas" && <HerramientasView />}
{tab === "amigos" && <AmigosView />}
</div>

{/* Barra inferior fija */}
<nav
style={{
position: "fixed",
left: 0,
right: 0,
bottom: 0,
height: 64,
display: "grid",
gridTemplateColumns: "repeat(5, 1fr)",
background: "#FFD500",
borderTop: "1px solid #eee",
}}
>
<TabBtn label="Inicio" active={tab === "inicio"} onClick={() => setTab("inicio")} />
<TabBtn label="Hábitos" active={tab === "habitos"} onClick={() => setTab("habitos")} />
<TabBtn label="Mi zona" active={tab === "mi-zona"} onClick={() => setTab("mi-zona")} />
<TabBtn label="Herramientas" active={tab === "herramientas"} onClick={() => setTab("herramientas")} />
<TabBtn label="Amigos" active={tab === "amigos"} onClick={() => setTab("amigos")} />
</nav>
</>
);
}

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
return (
<button
onClick={onClick}
aria-pressed={active}
style={{
background: "transparent",
border: "none",
fontWeight: active ? 700 : 500,
color: "#000",
}}
>
{label}
</button>
);
}

/* ========== Estilos compartidos simples ========== */
const btn: React.CSSProperties = {
background: "#000",
color: "#fff",
padding: "10px 18px",
borderRadius: 999,
border: "none",
};

const img: React.CSSProperties = {
width: "100%",
height: "auto",
borderRadius: 12,
border: "1px solid #eee",
};

const kpiBox: React.CSSProperties = {
border: "1px solid #eee",
borderRadius: 12,
padding: 16,
};

const kpiLabel: React.CSSProperties = {
fontSize: 13,
opacity: 0.7,
marginBottom: 6,
};

const kpiValue: React.CSSProperties = {
fontSize: 28,
fontWeight: 700,
};
