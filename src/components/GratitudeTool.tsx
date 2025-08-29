'use client';
import { useEffect, useMemo, useState } from 'react';

const KEY = 'akira_gratitude_v2';

type Row = { id: string; text: string };

type Entry = {
date: string; // YYYY-MM-DD
rows: Row[]; // al menos 3
savedAt: number; // timestamp de última actualización
};

function todayKey(){ return new Date().toISOString().slice(0,10); }

export default function GratitudeTool(){
const [entries, setEntries] = useState<Record<string, Entry>>({});
const [initialised, setInitialised] = useState(false);
const today = todayKey();

// carga
useEffect(()=>{ try{ const raw = localStorage.getItem(KEY); if(raw) setEntries(JSON.parse(raw)); }catch{} setInitialised(true); },[]);
// persistencia
useEffect(()=>{ if(!initialised) return; try{ localStorage.setItem(KEY, JSON.stringify(entries)); }catch{} },[entries, initialised]);

const current = useMemo(() => {
const ex = entries[today];
if (ex) return ex;
// por defecto 3 filas
return { date: today, rows: [0,1,2].map(()=>({ id: crypto.randomUUID(), text:'' })), savedAt: 0 } as Entry;
}, [entries, today]);

const setCurrent = (e: Entry) => setEntries(prev => ({ ...prev, [today]: e }));

const onChangeRow = (id: string, text: string) => {
setCurrent({ ...current, rows: current.rows.map(r => r.id===id? {...r, text }: r) });
};

const addRow = () => setCurrent({ ...current, rows: [...current.rows, { id: crypto.randomUUID(), text:'' }] });

const hasAnyText = current.rows.some(r => r.text.trim());

const saveOrUpdate = () => {
const now = Date.now();
setCurrent({ ...current, savedAt: now });
};

const days = Object.keys(entries).filter(d=>d!==today).sort((a,b)=> b.localeCompare(a));

return (
<div>
<h3 style={{marginTop:0}}>Diario de gratitud</h3>
<p className="muted" style={{marginTop:4}}>Anota durante el día las cosas por las que te sientes agradecido, desde las más pequeñas a las más grandes.</p>

<div className="card" style={{marginTop:12}}>
<div className="card-header">
<div>
<div style={{fontWeight:600}}>Hoy · {new Date().toLocaleDateString()}</div>
</div>
<div className="muted">Escribe 3 cosas por las que dar las gracias</div>
</div>

<div className="rows">
}