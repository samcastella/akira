'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import {
ImagePlus, Info, X, Camera, Check, XCircle, AlertTriangle,
Share2, Copy, Trash2
} from 'lucide-react';
import CreateHabitBar from '@/components/habits/CreateHabitBar';

type Challenge = {
id: string;
owner_id: string;
title: string;
start: string;
end: string;
cover_url?: string | null;
description?: string | null;
rules?: string | null;
};

type Summary = {
members_count: number;
my_checks: number;
total_days: number;
progress_pct: number;
score: number;
rank_position: number;
};

type QueueItem = {
check_id: string;
challenge_id: string;
author_id: string;
day_index: number;
photo_path: string;
status: 'pending' | 'valid' | 'invalid' | 'auto_valid';
created_at: string;
photo_expires_at: string;
signed_url?: string | null;
};

type LeaderRow = {
user_id: string;
score: number;
rank_position: number;
handle: string | null;
nombre: string | null;
apellido: string | null;
};

const PHOTOS_BUCKET = 'challenge-photos';
const COVERS_BUCKET = 'challenge-covers';

const TABS = ['Resumen', 'Check del día', 'Validaciones', 'Ranking'] as const;
type Tab = (typeof TABS)[number];

function diffDays(aISO: string, bISO: string) {
const a = new Date(aISO + 'T00:00:00');
const b = new Date(bISO + 'T00:00:00');
return Math.round((b.getTime() - a.getTime()) / 86400000);
}
function clamp(n: number, min: number, max: number) {
return Math.max(min, Math.min(max, n));
}

export default function RetoDetallePage() {
const { id } = useParams() as { id: string };
const router = useRouter();
const [uid, setUid] = useState<string | null>(null);

const [challenge, setChallenge] = useState<Challenge | null>(null);
const [summary, setSummary] = useState<Summary | null>(null);
const [activeTab, setActiveTab] = useState<Tab>('Check del día');
const [loading, setLoading] = useState(true);
const [modal, setModal] = useState<'delete' | 'leave' | null>(null);

// Fallbacks meta
const [metaDescription, setMetaDescription] = useState<string | null>(null);
const [metaCoverUrl, setMetaCoverUrl] = useState<string | null>(null);

// Edición
const [isEditing, setIsEditing] = useState(false);
const [titleEdit, setTitleEdit] = useState('');
const [descEdit, setDescEdit] = useState('');
const [savingEdit, setSavingEdit] = useState(false);

// Check del día
const [todayIdx, setTodayIdx] = useState<number | null>(null);
const [uploading, setUploading] = useState(false);
const fileRef = useRef<HTMLInputElement | null>(null);
const [myTodayCheck, setMyTodayCheck] = useState<QueueItem | null>(null);

// Validaciones
const [queue, setQueue] = useState<QueueItem[]>([]);
const [reviewables, setReviewables] = useState<QueueItem[]>([]);
const [authorNames, setAuthorNames] = useState<Record<string, string>>({});

// Pop-ups
const [showVoteOk, setShowVoteOk] = useState(false);
const [showUploadOk, setShowUploadOk] = useState(false);

// Ranking
const [leaders, setLeaders] = useState<LeaderRow[]>([]);
const [leaderPhotos, setLeaderPhotos] = useState<Record<string, string | null>>({});
const [leaderImgOk, setLeaderImgOk] = useState<Record<string, boolean>>({});

// Participantes y labels
const [membersCount, setMembersCount] = useState<number>(0);
const [dayLabels, setDayLabels] = useState<Record<number, string>>({});

// Cover
const coverCameraInputRef = useRef<HTMLInputElement | null>(null);
const coverFileInputRef = useRef<HTMLInputElement | null>(null);
const [coverUploading, setCoverUploading] = useState(false);
const [coverModalOpen, setCoverModalOpen] = useState(false);
const [coverModalStep, setCoverModalStep] = useState<'pick' | 'success'>('pick');

// Compartir
const [shareOpen, setShareOpen] = useState(false);

// Expulsar usuario (solo admin)
const [kickUser, setKickUser] = useState<LeaderRow | null>(null);
const [kicking, setKicking] = useState(false);
const [kickDone, setKickDone] = useState(false);

useEffect(() => {
supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null));
}, []);

// Cargar reto + resumen + ranking + meta
useEffect(() => {
if (!id) return;
let alive = true;

(async () => {
setLoading(true);
const [retos, resumen, lb, meta] = await Promise.all([
supabase
.from('challenges')
.select('id, owner_id, title, start, end, cover_url, description, rules')
.eq('id', id)
.single(),
supabase.from('challenge_card_user_summary').select('*').eq('challenge_id', id).maybeSingle(),
supabase
.from('challenge_leaderboard')
.select('user_id, score, rank_position, handle, nombre, apellido')
.eq('challenge_id', id)
.order('rank_position', { ascending: true }),
supabase.from('challenge_meta').select('key, value').eq('challenge_id', id),
]);

if (!alive) return;
if (retos.error) console.error(retos.error);
if (resumen.error) console.error(resumen.error);
if (lb.error) console.error(lb.error);
if ((meta as any).error) console.error((meta as any).error);

setChallenge(retos.data ?? null);
setSummary(resumen.data ?? null);
setLeaders(lb.data ?? []);

// Fallbacks desde meta
const metaRows: Array<{ key: string; value: string }> = (meta as any).data ?? [];
const metaMap = Object.fromEntries(metaRows.map((r) => [r.key, r.value]));
setMetaDescription(metaMap['description'] || metaMap['normas'] || metaMap['rules'] || null);
setMetaCoverUrl(metaMap['cover_url'] || null);

// Avatares ranking
try {
const ids = ((lb.data ?? []) as LeaderRow[]).map((r) => r.user_id).filter(Boolean);
if (ids.length) {
const { data: profs, error: pErr } = await supabase
.from('public_profiles')
.select('user_id, avatar_url')
.in('user_id', ids);
if (pErr) {
console.warn('[public_profiles] no disponible:', pErr);
setLeaderPhotos({});
} else {
const map: Record<string, string | null> = {};
(profs ?? []).forEach((p) => { /* @ts-ignore */
map[p.user_id] = (p as any).avatar_url ?? null;
});
setLeaderPhotos(map);
}
} else {
setLeaderPhotos({});
}
} catch (e) {
console.warn('[public_profiles] excepción:', e);
setLeaderPhotos({});
}

setLoading(false);
})();

return () => { alive = false; };
}, [id]);

// Cargar miembros y labels
useEffect(() => {
let alive = true;
(async () => {
if (!id) return;

const { data: cnt, error: cntErr } = await supabase.rpc('get_members_count', { p_challenge: id });
if (!alive) return;
if (cntErr) console.error(cntErr);
setMembersCount(Number(cnt ?? 0));

const { data: rows, error: dlErr } = await supabase
.from('challenge_days')
.select('day_index, label')
.eq('challenge_id', id)
.order('day_index', { ascending: true });

if (!alive) return;
if (dlErr) setDayLabels({});
else {
const map: Record<number, string> = {};
(rows ?? []).forEach((r: any) => {
if (r.label) map[r.day_index] = r.label;
});
setDayLabels(map);
}
})();

return () => { alive = false; };
}, [id]);

// Días totales
const totalDays = useMemo(() => {
if (!challenge) return 1;
const d = diffDays(challenge.start, challenge.end) + 1;
return Math.max(1, d || 1);
}, [challenge]);

// Índice del día + mi check
useEffect(() => {
if (!challenge || !uid) return;
const todayISO = new Date().toISOString().slice(0, 10);
const idx = clamp(diffDays(challenge.start, todayISO) + 1, 1, totalDays);
setTodayIdx(idx);
fetchMyTodayCheck(idx);
}, [challenge, uid, totalDays]);

async function fetchMyTodayCheck(idx: number) {
if (!challenge || !uid) return;
const { data, error } = await supabase
.from('challenge_checks')
.select('id, challenge_id, user_id, day_index, photo_path, status, created_at, photo_expires_at')
.eq('challenge_id', challenge.id)
.eq('user_id', uid)
.eq('day_index', idx)
.maybeSingle();

if (error && error.code !== 'PGRST116') {
console.error(error);
return;
}
if (data) {
const signed = await signPath(data.photo_path);
setMyTodayCheck({
check_id: data.id,
challenge_id: data.challenge_id,
author_id: data.user_id,
day_index: data.day_index,
photo_path: data.photo_path,
status: data.status as any,
created_at: data.created_at,
photo_expires_at: data.photo_expires_at,
signed_url: signed ?? undefined,
});
} else {
setMyTodayCheck(null);
}
}

// Cargar colas + nombres
const loadQueues = async () => {
if (!id) return;
const [q, r] = await Promise.all([
supabase
.from('challenge_validations_queue')
.select('*')
.eq('challenge_id', id)
.order('created_at', { ascending: false }),
supabase
.from('challenge_reviewables')
.select('*')
.eq('challenge_id', id)
.order('created_at', { ascending: false }),
]);

if (q.error) console.error(q.error);
if (r.error) console.error(r.error);

const withSigned = await Promise.all(
(q.data ?? []).map(async (row: any) => ({ ...row, signed_url: await signPath(row.photo_path) }))
);
const withSignedR = await Promise.all(
(r.data ?? []).map(async (row: any) => ({ ...row, signed_url: await signPath(row.photo_path) }))
);

setQueue(withSigned as any);
setReviewables(withSignedR as any);

// nombres de autores
const authorIds = Array.from(
new Set([...(withSigned as any[]).map((x) => x.author_id), ...(withSignedR as any[]).map((x) => x.author_id)]).values()
).filter(Boolean);

if (authorIds.length) {
const { data: profs, error: pErr } = await supabase.from('public_profiles').select('*').in('user_id', authorIds);
if (pErr) console.error(pErr);
const map: Record<string, string> = {};
(profs ?? []).forEach((p: any) => {
const composed = `${(p.nombre ?? '').trim()} ${(p.apellido ?? '').trim()}`.trim();
const best =
p.handle?.trim?.() || p.username?.trim?.() || p.display_name?.trim?.() || p.full_name?.trim?.() || composed || '';
map[p.user_id] = (best || '').trim() || p.user_id.slice(0, 6);
});
setAuthorNames(map);
} else {
setAuthorNames({});
}
};

useEffect(() => {
loadQueues();
}, [id, uploading, activeTab, uid]);

async function signPath(path: string | null) {
if (!path) return null;
const { data, error } = await supabase.storage.from(PHOTOS_BUCKET).createSignedUrl(path, 60 * 60 * 6);
if (error) console.error(error);
return data?.signedUrl ?? null;
}

// ===== Compartir =====
const joinCode = useMemo(() => {
return (challenge?.id || '').replace(/-/g, '').slice(-6).toUpperCase();
}, [challenge?.id]);

function makeSharePayload() {
const title = challenge?.title ?? 'Mi reto';
const code = joinCode;
const url = `https://akira-psi.vercel.app`;
const text =
`Únete al reto “${title}” en la app.\n` +
`${url}\n\nComunidad > Retos > Unirse a Reto\nCódigo: ${code}`;
return { title: `Reto: ${title}`, text, url, code };
}

async function doNativeShare() {
try {
const payload = makeSharePayload();
if (typeof navigator !== 'undefined' && (navigator as any).share) {
await (navigator as any).share({ title: payload.title, text: payload.text, url: payload.url });
return;
}
} catch {}
setShareOpen(true); // fallback modal
}

async function copyShareToClipboard() {
const { text } = makeSharePayload();
try {
await navigator.clipboard.writeText(text);
alert('Texto copiado al portapapeles');
} catch {
alert('No se pudo copiar. Copia manualmente desde el recuadro.');
}
}

// ===== Acciones =====
async function refreshMyTodayCheck() {
if (todayIdx) await fetchMyTodayCheck(todayIdx);
}

async function vote(checkId: string, kind: 'valid' | 'invalid') {
if (!uid) {
alert('No se pudo identificar al usuario.');
return;
}
const card = queue.find(q => q.check_id === checkId) || null;

const { error } = await supabase.rpc('vote_on_check', {
p_check_id: checkId,
p_vote: kind,
p_voter: uid,
});
if (error) {
console.error(error);
alert(`No se pudo registrar el voto: ${error.message ?? ''}`);
return;
}

setQueue(prev => prev.filter(q => q.check_id !== checkId));
if (card) {
const newItem: QueueItem = { ...card, status: kind === 'valid' ? 'valid' : 'invalid' };
setReviewables(prev => [newItem, ...prev]);
}

setShowVoteOk(true);
await loadQueues();
}

async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
const file = e.target.files?.[0];
if (!file || !uid || !todayIdx || !challenge) return;
setUploading(true);
try {
const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
const path = `${challenge.id}/${todayIdx}/${uid}/${crypto.randomUUID()}.${ext}`;

const { error: upErr } = await supabase.storage.from(PHOTOS_BUCKET).upload(path, file, {
cacheControl: '3600',
upsert: false,
contentType: file.type || 'application/octet-stream',
});
if (upErr) throw upErr;

const expiresAt = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
const { error: insErr } = await supabase.from('challenge_checks').insert([
{
challenge_id: challenge.id,
user_id: uid,
day_index: todayIdx,
photo_path: path,
photo_expires_at: expiresAt,
status: 'pending',
},
]);
if (insErr) throw insErr;

setShowUploadOk(true);
await refreshMyTodayCheck();
await loadQueues();
} catch (err: any) {
console.error(err);
alert(`No se pudo subir la foto. ${err?.message || 'Intenta de nuevo.'}`);
} finally {
setUploading(false);
if (fileRef.current) fileRef.current.value = '';
}
}

function openCoverModal() {
if (!isOwner) return;
setCoverModalStep('pick');
setCoverModalOpen(true);
}
function triggerCoverCamera() { coverCameraInputRef.current?.click(); }
function triggerCoverFile() { coverFileInputRef.current?.click(); }

async function onPickCoverFile(file: File) {
if (!file || !challenge) return;
setCoverUploading(true);
try {
const path = `${challenge.id}/${Date.now()}-${sanitizeFileName(file.name)}`;
const { error: upErr } = await supabase.storage.from(COVERS_BUCKET).upload(path, file, {
cacheControl: '3600',
upsert: false,
contentType: file.type || 'image/jpeg',
});
if (upErr) throw upErr;

const { data: pub } = supabase.storage.from(COVERS_BUCKET).getPublicUrl(path);
const coverUrl = pub?.publicUrl ?? null;
if (!coverUrl) throw new Error('No se pudo obtener URL pública de la portada.');
const { error: updErr } = await supabase.from('challenges').update({ cover_url: coverUrl }).eq('id', challenge.id);
if (updErr) throw updErr;

setChallenge((prev) => (prev ? { ...prev, cover_url: coverUrl } : prev));
setMetaCoverUrl(null);
setCoverModalStep('success');
} catch (err) {
console.error(err);
alert('No se pudo actualizar la imagen de portada.');
} finally {
setCoverUploading(false);
if (coverCameraInputRef.current) coverCameraInputRef.current.value = '';
if (coverFileInputRef.current) coverFileInputRef.current.value = '';
}
}
function onPickCoverCamera(e: React.ChangeEvent<HTMLInputElement>) {
const file = e.target.files?.[0]; if (file) onPickCoverFile(file);
}
function onPickCoverFromFiles(e: React.ChangeEvent<HTMLInputElement>) {
const file = e.target.files?.[0]; if (file) onPickCoverFile(file);
}

// helpers
function fmtDate(d: string) {
try { return new Date(d).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }); }
catch { return d; }
}
function sanitizeFileName(n: string) { return n.replace(/[^\w.\-]+/g, '_'); }
function displayName(userId: string) {
const name = (authorNames[userId] ?? '').trim();
return name || userId.slice(0, 6);
}
function getDayLabel(dayIndex?: number | null) {
if (!dayIndex || !challenge) return '';
const lbl = dayLabels[dayIndex];
return lbl?.trim() ? lbl.trim() : challenge.title;
}

const isOwner = uid === challenge?.owner_id;
const resolvedCover = challenge?.cover_url || metaCoverUrl || null;
const resolvedDescription =
(challenge?.rules && challenge.rules.trim()) ||
(challenge?.description && challenge.description.trim()) ||
(metaDescription && metaDescription.trim()) ||
'';

const computedProgressPct = useMemo(() => {
if (!todayIdx) return 0;
return Math.min(100, Math.round((todayIdx / (summary?.total_days || totalDays)) * 100));
}, [todayIdx, summary?.total_days, totalDays]);

const statusIcon = useMemo(() => {
const s = myTodayCheck?.status;
if (!s) return null;
if (s === 'pending') return <AlertTriangle className="h-4 w-4" />;
if (s === 'valid' || s === 'auto_valid') return <Check className="h-4 w-4" />;
if (s === 'invalid') return <XCircle className="h-4 w-4" />;
return null;
}, [myTodayCheck?.status]);

const statusText = myTodayCheck
? myTodayCheck.status === 'pending'
? 'Pendiente de validación'
: myTodayCheck.status === 'valid' || myTodayCheck.status === 'auto_valid'
? 'Validado'
: 'No válido'
: 'Aún no has subido tu check de hoy.';

// ======= RENDER =======
if (loading)
return (
<main className="container mx-auto px-4 py-8">
<div className="animate-pulse h-6 w-40 rounded bg-black/10 mb-3" />
<div className="animate-pulse h-4 w-64 rounded bg-black/10" />
</main>
);

if (!challenge)
return (
<main className="container mx-auto px-4 py-8 text-center text-sm text-neutral-600">
Reto no encontrado.
</main>
);

return (
<main className="min-h-screen bg-white relative">
{/* ===== HERO ===== */}
<section className="relative w-full overflow-hidden bg-neutral-100 -mt-px">
{resolvedCover ? (
// eslint-disable-next-line @next/next/no-img-element
<img src={resolvedCover} alt={challenge.title} className="block w-full h-auto aspect-[16/9] object-cover" draggable={false} />
) : (
<div className="aspect-[16/9] w-full flex items-center justify-center text-neutral-400">
<ImagePlus className="h-10 w-10" />
<span className="ml-2 text-sm">Sin imagen</span>
</div>
)}

{isOwner && (
<>
<button
aria-label="Cambiar imagen de portada"
onClick={openCoverModal}
className="absolute top-3 right-3 h-10 w-10 rounded-full bg-black/60 text-white grid place-items-center backdrop-blur hover:bg-black/70 active:scale-95 transition"
>
<Camera className="h-5 w-5" />
</button>
<input ref={coverCameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPickCoverCamera} />
<input ref={coverFileInputRef} type="file" accept="image/*" className="hidden" onChange={onPickCoverFromFiles} />
</>
)}
</section>

{/* ===== SUBMENÚ ===== */}
<nav className="border-b border-neutral-200 bg-white sticky top-[48px] z-20 shadow-sm">
  <div className="flex justify-between px-4 overflow-x-auto">
    {TABS.map((tab) => (
      <button
        key={tab}
        onClick={() => setActiveTab(tab)}
        className={`relative py-3 px-3 text-sm whitespace-nowrap transition ${
          activeTab === tab
            ? 'font-semibold text-black after:absolute after:left-0 after:right-0 after:-bottom-[0px] after:h-[1.5px] after:bg-black'
            : 'text-neutral-500 hover:text-black'
        }`}
      >
        {tab}
      </button>
    ))}
  </div>
</nav>


{/* ===== CONTENIDO ===== */}
<section className="container mx-auto px-4 py-6 space-y-6">
{/* RESUMEN */}
{activeTab === 'Resumen' && (
<div className="space-y-5">
<div className="flex items-center justify-between">
{isEditing ? (
<input
value={titleEdit}
onChange={(e) => setTitleEdit(e.target.value)}
className="text-2xl font-semibold border-b outline-none flex-1 mr-3"
style={{ borderColor: 'var(--line)' }}
/>
) : (
<h1 className="text-2xl font-semibold">{challenge.title}</h1>
)}
<div className="text-sm text-neutral-500">👥 {membersCount} participantes</div>
</div>

<div className="space-y-2">
<h2 className="text-sm font-semibold tracking-wide text-neutral-900">Normas del reto</h2>
{isEditing ? (
<textarea
value={descEdit}
onChange={(e) => setDescEdit(e.target.value)}
rows={5}
className="w-full rounded-xl border px-3 py-2"
style={{ borderColor: 'var(--line)' }}
placeholder="Incluye aquí una breve descripción del reto, normas, premio para el ganador, castigo para el perdedor…"
/>
) : resolvedDescription ? (
<p className="text-sm text-neutral-700 whitespace-pre-line">{resolvedDescription}</p>
) : (
<p className="text-sm text-neutral-500">Sin descripción. Añade las normas del reto en la edición.</p>
)}
</div>

<details className="rounded-xl border p-3 text-sm" style={{ borderColor: 'var(--line)' }}>
<summary className="cursor-pointer font-medium flex items-center gap-1">
<Info className="h-4 w-4" /> ¿Cómo funcionan los retos con amigos?
</summary>
<div className="mt-2 text-neutral-700 leading-relaxed text-[13px] space-y-2">
<ul className="list-disc pl-5 space-y-1">
<li>Cada día subes una foto cumpliendo el reto.</li>
<li>Necesitas que otro participante valide tu participación diaria.</li>
<li>Cada validación suma 1 punto.</li>
<li>Si el 50% dice “no válido”, se rechaza.</li>
<li>Si nadie valida en 4 h (o en revisión en 24 h), se valida automáticamente.</li>
<li>Puedes pedir revisión si crees que una foto validada automáticamente no es válida y aplicarían las mismas reglas anteriores.</li>
</ul>
</div>
</details>

<div>
<div className="flex items-center justify-between text-sm mb-1">
<span>Progreso</span>
<span className="text-neutral-500">
{todayIdx ?? 0}/{summary?.total_days || totalDays} días
</span>
</div>
<div className="w-full h-3 rounded-full bg-neutral-200 overflow-hidden">
<div className="h-3 transition-all duration-300" style={{ width: `${computedProgressPct}%`, background: '#22c55e' }} />
</div>
</div>

{/* Acciones */}
<div className="flex flex-wrap gap-2">
{isOwner ? (
!isEditing ? (
<>
<button
className="rounded-xl border px-4 py-2 text-sm hover:bg-black/5 transition"
style={{ borderColor: 'var(--line)' }}
onClick={() => {
setTitleEdit(challenge!.title);
setDescEdit((challenge!.rules ?? challenge!.description ?? metaDescription ?? '') || '');
setIsEditing(true);
}}
>
Editar reto
</button>
<button
className="rounded-xl border px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition"
style={{ borderColor: 'var(--line)' }}
onClick={() => setModal('delete')}
>
Borrar reto
</button>
</>
) : (
<>
<button
className="rounded-xl border px-4 py-2 text-sm hover:bg-black/5 transition"
style={{ borderColor: 'var(--line)' }}
onClick={() => setIsEditing(false)}
disabled={savingEdit}
>
Cancelar
</button>
<button
className="rounded-xl bg-black text-white px-4 py-2 text-sm hover:opacity-90 transition disabled:opacity-60"
onClick={async () => {
setSavingEdit(true);
try {
const payload: Partial<Challenge> = { title: titleEdit.trim() || challenge!.title, rules: descEdit.trim() || null };
const { error } = await supabase.from('challenges').update(payload).eq('id', challenge!.id);
if (error) throw error;
setChallenge((prev) => (prev ? ({ ...prev, ...payload } as Challenge) : prev));
setIsEditing(false);
} catch (e) {
console.error(e);
alert('No se pudo guardar los cambios.');
} finally {
setSavingEdit(false);
}
}}
disabled={savingEdit}
>
{savingEdit ? 'Guardando…' : 'Guardar'}
</button>
</>
)
) : (
<button
className="rounded-xl border px-4 py-2 text-sm text-neutral-600 hover:bg-black/5 transition"
style={{ borderColor: 'var(--line)' }}
onClick={() => setModal('leave')}
>
Dejar reto
</button>
)}

{/* Compartir reto (visible para todos) */}
<button
onClick={doNativeShare}
className="rounded-xl border px-4 py-2 text-sm hover:bg-black/5 transition inline-flex items-center gap-2"
style={{ borderColor: 'var(--line)' }}
>
<Share2 className="h-4 w-4" />
Compartir reto
</button>
</div>
</div>
)}

{/* CHECK DEL DÍA */}
{activeTab === 'Check del día' && (
<div className="space-y-4">
{/* Barra con subida integrada (overlay) */}
<div className="mt-1 flex items-center gap-3">
<div className="relative flex-1">
<CreateHabitBar
variant="task"
checked={!!myTodayCheck && (myTodayCheck.status === 'valid' || myTodayCheck.status === 'auto_valid')}
label={`Día ${todayIdx ?? '-'} – ${getDayLabel(todayIdx)}`}
onToggle={() => {}}
onInfo={() => {
document.getElementById('my-today-check')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}}
color="#F8E68A"
className="pr-36"
/>

{/* 👇 Parche visual para ocultar el “+” que dibuja CreateHabitBar */}
<div className="absolute right-32 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white pointer-events-none" />

{/* Overlay clicable (toda la barra salvo el área del botón negro) */}
<button
type="button"
aria-label="Subir foto del día"
onClick={() => fileRef.current?.click()}
className="absolute top-0 bottom-0 left-0 right-32 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/40"
/>

{/* Botón negro “Subir foto” */}
<div className="absolute right-2 top-1/2 -translate-y-1/2">
<input
ref={fileRef}
type="file"
accept="image/*"
capture="environment"
className="hidden"
onChange={onPickFile}
/>
<button
onClick={() => fileRef.current?.click()}
disabled={uploading}
className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition active:scale-95 disabled:opacity-60 bg-black text-white"
>
{uploading ? (
<>
<span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/60 border-t-transparent" />
Subiendo…
</>
) : (
<>
<Camera className="h-3 w-3" />
{myTodayCheck ? 'Subido' : 'Subir foto'}
</>
)}
</button>
</div>
</div>

{statusIcon ? <div className="shrink-0">{statusIcon}</div> : null}
</div>

<div className="text-sm">
Día <b>{todayIdx ?? '-'}</b> / {summary?.total_days || totalDays}
</div>

{myTodayCheck ? (
<div id="my-today-check" className="rounded-2xl overflow-hidden border" style={{ borderColor: 'var(--line)' }}>
{myTodayCheck.signed_url ? (
// eslint-disable-next-line @next/next/no-img-element
<img src={myTodayCheck.signed_url} alt="Mi check" className="w-full object-cover max-h-[360px]" />
) : (
<div className="h-40 grid place-items-center text-neutral-400">Sin imagen</div>
)}
<div className="p-3 text-sm flex items-center justify-between">
<div className="flex items-center gap-2">
{statusIcon}
<span>{statusText}</span>
</div>
<div className="text-xs text-neutral-500">{fmtDate(myTodayCheck.created_at)}</div>
</div>
</div>
) : (
<p className="text-sm text-neutral-600">{statusText}</p>
)}
</div>
)}

{/* VALIDACIONES */}
{activeTab === 'Validaciones' && (
<div className="space-y-6">
{/* Pendientes */}
<section>
<h3 className="text-base font-semibold mb-2">Pendiente de validación</h3>
{!queue.length && <p className="text-sm text-neutral-500">No hay fotos pendientes ahora mismo.</p>}
<ul className="space-y-3">
{queue
.filter((q) => q.author_id !== uid)
.map((q) => (
<li key={q.check_id} className="rounded-2xl overflow-hidden border" style={{ borderColor: 'var(--line)' }}>
{q.signed_url ? (
// eslint-disable-next-line @next/next/no-img-element
<img src={q.signed_url} alt="Foto para validar" className="w-full object-cover max-h-[360px]" />
) : (
<div className="h-40 grid place-items-center text-neutral-400">Sin imagen</div>
)}
<div className="p-3 grid gap-2 sm:flex sm:items-center sm:justify-between text-sm">
<div className="min-w-0">
<div className="font-medium truncate">Día {q.day_index} – {getDayLabel(q.day_index)}</div>
<div className="text-[13px] text-neutral-600 truncate">
Subido {fmtDate(q.created_at)} — <b>{displayName(q.author_id)}</b>
</div>
</div>
<div className="flex items-center gap-2 sm:shrink-0">
<button
onClick={() => vote(q.check_id, 'invalid')}
className="rounded-full border px-3 py-1 text-[13px] hover:bg-black/5"
style={{ borderColor: 'var(--line)' }}
>
No válido
</button>
<button onClick={() => vote(q.check_id, 'valid')} className="rounded-full bg-green-600 text-white px-3 py-1 text-[13px] hover:opacity-90">
Validar
</button>
</div>
</div>
</li>
))}
</ul>
</section>

{/* Validados */}
<section>
<h3 className="text-base font-semibold mb-2">Validados</h3>
{reviewables.filter((r) => r.status === 'valid' || r.status === 'auto_valid').length === 0 && (
<p className="text-sm text-neutral-500">No hay elementos validados aún.</p>
)}
<ul className="space-y-3">
{reviewables
.filter((r) => r.status === 'valid' || r.status === 'auto_valid')
.map((q) => (
<li key={q.check_id} className="rounded-2xl overflow-hidden border" style={{ borderColor: 'var(--line)' }}>
{q.signed_url ? (
// eslint-disable-next-line @next/next/no-img-element
<img src={q.signed_url} alt="Foto validada" className="w-full object-cover max-h-[360px]" />
) : (
<div className="h-40 grid place-items-center text-neutral-400">Sin imagen</div>
)}
<div className="p-3 grid gap-2 sm:flex sm:items-center sm:justify-between text-sm">
<div className="min-w-0">
<div className="font-medium truncate">Día {q.day_index} – {getDayLabel(q.day_index)}</div>
<div className="text-[13px] text-neutral-600 truncate">
Estado: <b>{labelStatus(q.status)}</b> · Vence {fmtDate(q.photo_expires_at)} — <b>{displayName(q.author_id)}</b>
</div>
</div>
<button
onClick={async () => {
const { error } = await supabase.rpc('request_reconsideration', { p_check_id: q.check_id });
if (error) {
console.error(error);
alert('No se pudo pedir revisión.');
} else setReviewables((prev) => prev.filter((r) => r.check_id !== q.check_id));
}}
className="rounded-full border px-3 py-1 text-[13px] hover:bg-black/5"
style={{ borderColor: 'var(--line)' }}
>
Pedir revisión
</button>
</div>
</li>
))}
</ul>
</section>

{/* No validados */}
<section>
<h3 className="text-base font-semibold mb-2">No validados</h3>
{reviewables.filter((r) => r.status === 'invalid').length === 0 && <p className="text-sm text-neutral-500">No hay elementos no validados.</p>}
<ul className="space-y-3">
{reviewables
.filter((r) => r.status === 'invalid')
.map((q) => (
<li key={q.check_id} className="rounded-2xl overflow-hidden border" style={{ borderColor: 'var(--line)' }}>
{q.signed_url ? (
// eslint-disable-next-line @next/next/no-img-element
<img src={q.signed_url} alt="Foto no validada" className="w-full object-cover max-h-[360px]" />
) : (
<div className="h-40 grid place-items-center text-neutral-400">Sin imagen</div>
)}
<div className="p-3 text-sm">
<div className="font-medium truncate">Día {q.day_index} – {getDayLabel(q.day_index)}</div>
<div className="text-[13px] text-neutral-600 truncate">
Estado: <b>{labelStatus(q.status)}</b> · Vence {fmtDate(q.photo_expires_at)} — <b>{displayName(q.author_id)}</b>
</div>
</div>
</li>
))}
</ul>
<p className="text-xs text-neutral-500 mt-2">Nota: las imágenes se conservan durante 48 h.</p>
</section>
</div>
)}

{/* RANKING */}
{activeTab === 'Ranking' && (
<div className="space-y-3">
{!leaders.length && <p className="text-sm text-neutral-600">Sin datos de ranking.</p>}
<ul className="space-y-2">
{leaders.map((r) => {
const name = r.handle || `${(r.nombre ?? '').trim()} ${(r.apellido ?? '').trim()}`.trim() || r.user_id.slice(0, 6);
const avatar = leaderPhotos[r.user_id] || null;
return (
<li
key={r.user_id}
className="flex items-center justify-between rounded-[28px] px-3 py-2 shadow-sm"
style={{ background: 'linear-gradient(180deg, #F8E68A 0%, #F2D767 100%)' }}
>
<div className="flex items-center gap-3 min-w-0">
<div className="relative h-12 w-12 shrink-0 rounded-full overflow-hidden bg-neutral-200">
{avatar && leaderImgOk[r.user_id] !== false ? (
// eslint-disable-next-line @next/next/no-img-element
<img
src={avatar}
alt="Avatar"
className="absolute inset-0 h-full w-full object-cover object-center"
draggable={false}
referrerPolicy="no-referrer"
onError={() => setLeaderImgOk(s => ({ ...s, [r.user_id]: false }))}
onLoad={() => setLeaderImgOk(s => ({ ...s, [r.user_id]: true }))}
/>
) : (
<div className="absolute inset-0 grid place-items-center text-[12px] text-neutral-600">🙂</div>
)}
</div>
<div className="min-w-0">
<div className="text-sm font-semibold truncate">#{r.rank_position} · {name}</div>
<div className="text-xs opacity-80 truncate">Puntos acumulados</div>
</div>
</div>

{/* Puntos + papelera (solo owner y no a sí mismo) */}
<div className="flex items-center gap-2 shrink-0">
<div className="text-base font-bold tabular-nums">{r.score} pts</div>
{isOwner && r.user_id !== uid && (
<button
onClick={() => setKickUser(r)}
className="h-8 w-8 rounded-full border grid place-items-center hover:bg-red-50 text-red-600"
style={{ borderColor: 'var(--line)' }}
aria-label="Eliminar usuario del reto"
title="Eliminar usuario del reto"
>
<Trash2 className="h-4 w-4" />
</button>
)}
</div>
</li>
);
})}
</ul>
</div>
)}
</section>

{/* ===== MODALES BORRAR / SALIR ===== */}
{modal && (
<div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
<div className="bg-white rounded-2xl p-6 w-[90%] max-w-sm shadow-xl relative">
<button onClick={() => setModal(null)} className="absolute top-3 right-3 text-neutral-400 hover:text-black">
<X className="h-5 w-5" />
</button>

{modal === 'delete' ? (
<>
<h2 className="text-lg font-semibold mb-2">¿Eliminar reto?</h2>
<p className="text-sm text-neutral-600 mb-4">Esto borrará todos los datos conseguidos hasta ahora.</p>
<div className="flex justify-end gap-2">
<button className="px-4 py-2 text-sm rounded-xl border" onClick={() => setModal(null)}>
Cancelar
</button>
<button
className="px-4 py-2 text-sm rounded-xl bg-red-600 text-white"
onClick={async () => {
setModal(null);
const { error } = await supabase.from('challenges').delete().eq('id', id);
if (error) alert('Error al borrar el reto.');
else router.push('/amigos/retos');
}}
>
Confirmar
</button>
</div>
</>
) : (
<>
<h2 className="text-lg font-semibold mb-2">¿Dejar el reto?</h2>
<p className="text-sm text-neutral-600 mb-4">Esto borrará tus datos y progreso en este reto.</p>
<div className="flex justify-end gap-2">
<button className="px-4 py-2 text-sm rounded-xl border" onClick={() => setModal(null)}>
Cancelar
</button>
<button
className="px-4 py-2 text-sm rounded-xl bg-red-600 text-white"
onClick={async () => {
setModal(null);
if (!uid) return;
const { error } = await supabase.from('challenge_members').delete().eq('challenge_id', id).eq('user_id', uid);
if (error) alert('Error al dejar el reto.');
else router.push('/amigos/retos');
}}
>
Confirmar
</button>
</div>
</>
)}
</div>
</div>
)}

{/* ===== MODALES DE ÉXITO ===== */}
{showVoteOk && (
<ToastModal title="¡Validación registrada!" body="Has validado este reto con éxito." onClose={() => setShowVoteOk(false)} />
)}
{showUploadOk && (
<ToastModal
title="¡Foto subida!"
body="Fotografía subida con éxito. Toca esperar a que se valide."
onClose={() => setShowUploadOk(false)}
/>
)}

{/* ===== MODAL DE PORTADA ===== */}
{coverModalOpen && (
<div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 grid place-items-center">
<div className="bg-white rounded-2xl p-5 w-[92%] max-w-sm relative">
<button className="absolute top-3 right-3 text-neutral-400 hover:text-black" onClick={() => setCoverModalOpen(false)} aria-label="Cerrar">
<X className="h-5 w-5" />
</button>

{coverModalStep === 'pick' ? (
<>
<h3 className="text-lg font-semibold mb-1">Cambiar imagen de portada</h3>
<p className="text-sm text-neutral-600 mb-4">Elige una opción para subir tu imagen.</p>
<div className="flex flex-col gap-2">
<button onClick={triggerCoverCamera} disabled={coverUploading} className="rounded-xl border px-4 py-2 text-sm hover:bg-black/5 transition" style={{ borderColor: 'var(--line)' }}>
Hacer foto
</button>
<button onClick={triggerCoverFile} disabled={coverUploading} className="rounded-xl border px-4 py-2 text-sm hover:bg-black/5 transition" style={{ borderColor: 'var(--line)' }}>
Subir foto de la galería
</button>
</div>
{coverUploading && <p className="text-xs mt-3 text-neutral-500">Subiendo…</p>}
</>
) : (
<>
<h3 className="text-lg font-semibold mb-1">¡Listo!</h3>
<p className="text-sm text-neutral-700">Su imagen se ha subido con éxito.</p>
<div className="mt-4 flex justify-end">
<button className="rounded-xl border px-4 py-2 text-sm hover:bg-black/5 transition" style={{ borderColor: 'var(--line)' }} onClick={() => setCoverModalOpen(false)}>
Cerrar
</button>
</div>
</>
)}
</div>
</div>
)}

{/* ===== MODAL COMPARTIR ===== */}
{shareOpen && (
<div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 grid place-items-center">
<div className="bg-white rounded-2xl p-5 w-[92%] max-w-md relative">
<button className="absolute top-3 right-3 text-neutral-400 hover:text-black" onClick={() => setShareOpen(false)} aria-label="Cerrar">
<X className="h-5 w-5" />
</button>
<h3 className="text-lg font-semibold mb-2">Compartir reto</h3>
<p className="text-sm text-neutral-700 mb-3">Elige una opción o copia el texto.</p>

{(() => {
const p = makeSharePayload();
const wa = `https://wa.me/?text=${encodeURIComponent(p.text)}`;
const tg = `https://t.me/share/url?url=${encodeURIComponent(p.url)}&text=${encodeURIComponent(p.text)}`;
return (
<div className="grid gap-2">
<a href={wa} target="_blank" className="rounded-xl border px-4 py-2 text-sm inline-flex items-center gap-2 hover:bg黑/5" style={{ borderColor: 'var(--line)' }}>
<Share2 className="h-4 w-4" /> WhatsApp
</a>
<a href={tg} target="_blank" className="rounded-xl border px-4 py-2 text-sm inline-flex items-center gap-2 hover:bg黑/5" style={{ borderColor: 'var(--line)' }}>
<Share2 className="h-4 w-4" /> Telegram
</a>
<button onClick={copyShareToClipboard} className="rounded-xl border px-4 py-2 text-sm inline-flex items-center gap-2 hover:bg-black/5" style={{ borderColor: 'var(--line)' }}>
<Copy className="h-4 w-4" /> Copiar texto
</button>

<div className="mt-2 rounded-xl bg-neutral-50 border p-3 text-xs whitespace-pre-wrap" style={{ borderColor: 'var(--line)' }}>
{p.text}
</div>
</div>
);
})()}
</div>
</div>
)}

{/* ===== MODAL EXPULSAR USUARIO ===== */}
{kickUser && (
<div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 grid place-items-center">
<div className="bg-white rounded-2xl p-5 w-[92%] max-w-sm relative">
<button className="absolute top-3 right-3 text-neutral-400 hover:text-black" onClick={() => { setKickUser(null); setKickDone(false); }} aria-label="Cerrar">
<X className="h-5 w-5" />
</button>

{!kickDone ? (
<>
<h3 className="text-lg font-semibold mb-2">¿Borrar a este usuario del reto?</h3>
<p className="text-sm text-neutral-600 mb-4">
{kickUser.handle || `${(kickUser.nombre ?? '').trim()} ${(kickUser.apellido ?? '').trim()}`.trim() || kickUser.user_id.slice(0,6)}
</p>
<div className="flex justify-end gap-2">
<button className="px-4 py-2 text-sm rounded-xl border" onClick={() => { setKickUser(null); setKickDone(false); }}>
Cancelar
</button>
<button
className="px-4 py-2 text-sm rounded-xl bg-red-600 text-white disabled:opacity-60"
onClick={async () => {
if (!challenge?.id) return;
setKicking(true);
const { error } = await supabase
.from('challenge_members')
.delete()
.eq('challenge_id', challenge.id)
.eq('user_id', kickUser.user_id);
setKicking(false);
if (error) {
console.error(error);
alert('No se pudo borrar al usuario.');
return;
}
setLeaders(prev => prev.filter(l => l.user_id !== kickUser.user_id));
setKickDone(true);
}}
disabled={kicking}
>
{kicking ? 'Borrando…' : 'Confirmar'}
</button>
</div>
</>
) : (
<>
<h3 className="text-lg font-semibold mb-2">Listo</h3>
<p className="text-sm text-neutral-700">El usuario ha sido borrado con éxito del reto.</p>
<div className="mt-4 flex justify-end">
<button className="rounded-xl border px-4 py-2 text-sm hover:bg-black/5 transition" style={{ borderColor: 'var(--line)' }} onClick={() => { setKickUser(null); setKickDone(false); }}>
Cerrar
</button>
</div>
</>
)}
</div>
</div>
)}

</main>
);
}

function labelStatus(s: QueueItem['status']) {
switch (s) {
case 'pending': return 'Pendiente';
case 'valid': return 'Válido';
case 'invalid': return 'No válido';
case 'auto_valid': return 'Válido (auto)';
}
}

// ——— Modal reutilizable (éxitos) ———
function ToastModal({ title, body, onClose }: { title: string; body: string; onClose: () => void }) {
return (
<div className="fixed inset-0 z-50 grid place-items-center">
<div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
<div className="relative bg-white rounded-2xl p-5 w-[92%] max-w-md shadow-xl">
<button className="absolute top-3 right-3 text-neutral-400 hover:text-black" onClick={onClose} aria-label="Cerrar">
<X className="h-5 w-5" />
</button>
<h3 className="text-xl font-semibold mb-2">{title}</h3>
<p className="text-neutral-700 mb-4">{body}</p>
<div className="flex justify-end">
<button onClick={onClose} className="rounded-xl bg-black text-white px-4 py-2 text-sm hover:opacity-90">
OK
</button>
</div>
</div>
</div>
);
}