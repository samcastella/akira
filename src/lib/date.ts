// Utilidades de fecha
export const todayKey = () => new Date().toISOString().slice(0, 10); // YYYY-MM-DD
export const dateKey = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (d: Date, n: number) => { const c = new Date(d); c.setDate(c.getDate() + n); return c; };
export const diffDays = (a: Date, b: Date) => Math.floor((a.getTime() - b.getTime()) / 86400000);
export const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
