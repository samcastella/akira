// src/app/amigos/retos/[id]/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
// import Image from 'next/image';  // usamos <img> para evitar restricciones de dominios
import { supabase } from '@/lib/supabaseClient';
import { ChevronRight, ImagePlus, Info, X, Camera } from 'lucide-react';
import CreateHabitBar from '@/components/habits/CreateHabitBar';

type Challenge = {
  id: string;
  owner_id: string;
  title: string;
  start: string; // 'YYYY-MM-DD'
  end: string;   // 'YYYY-MM-DD'
  cover_url?: string | null;
  description?: string | null;
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
  signed_url?: string;
};

type LeaderRow = {
  user_id: string;
  score: number;
  rank_position: number;
  handle: string | null;
  nombre: string | null;
  apellido: string | null;
};

const PHOTOS_BUCKET = 'CHALLENGE-PHOTOS';
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
  const [activeTab, setActiveTab] = useState<Tab>('Resumen');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'delete' | 'leave' | null>(null);

  // Fallbacks desde meta
  const [metaDescription, setMetaDescription] = useState<string | null>(null);
  const [metaCoverUrl, setMetaCoverUrl] = useState<string | null>(null);

  // Edición inline
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

  // Ranking
  const [leaders, setLeaders] = useState<LeaderRow[]>([]);
  const [leaderPhotos, setLeaderPhotos] = useState<Record<string, string | null>>({});

  // Cover change
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);

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
          .select('id, owner_id, title, start, end, cover_url, description')
          .eq('id', id)
          .single(),
        supabase
          .from('challenge_card_user_summary')
          .select('*')
          .eq('challenge_id', id)
          .maybeSingle(),
        supabase
          .from('challenge_leaderboard')
          .select('user_id, score, rank_position, handle, nombre, apellido')
          .eq('challenge_id', id)
          .order('rank_position', { ascending: true }),
        supabase
          .from('challenge_meta')
          .select('key, value')
          .eq('challenge_id', id)
      ]);

      if (!alive) return;
      if (retos.error) console.error(retos.error);
      if (resumen.error) console.error(resumen.error);
      if (lb.error) console.error(lb.error);
      if ((meta as any).error) console.error((meta as any).error);

      setChallenge(retos.data ?? null);
      setSummary(resumen.data ?? null);
      setLeaders(lb.data ?? []);

      // Fallbacks desde meta: description/normas/rules y cover_url
      const metaRows: Array<{ key: string; value: string }> = (meta as any).data ?? [];
      const metaMap = Object.fromEntries(metaRows.map(r => [r.key, r.value]));
      const descMeta =
        metaMap['description'] ||
        metaMap['normas'] ||
        metaMap['rules'] ||
        null;
      const coverMeta = metaMap['cover_url'] || null;
      setMetaDescription(descMeta);
      setMetaCoverUrl(coverMeta);

      // Traer fotos de perfil para ranking
      const ids = ((lb.data ?? []) as LeaderRow[]).map(r => r.user_id);
      if (ids.length) {
        const { data: profs, error: pErr } = await supabase
          .from('public_profiles')
          .select('user_id, foto')
          .in('user_id', ids);
        if (pErr) console.error(pErr);
        const map: Record<string, string | null> = {};
        (profs ?? []).forEach((p) => { map[p.user_id] = p.foto ?? null; });
        setLeaderPhotos(map);
      } else {
        setLeaderPhotos({});
      }

      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [id]);

  // Calcular índice del día actual y cargar mi check de hoy
  useEffect(() => {
    if (!challenge || !summary || !uid) return;
    const today = new Date();
    const todayISO = today.toISOString().slice(0, 10);
    const idx = clamp(
      diffDays(challenge.start, todayISO) + 1,
      1,
      Math.max(1, summary.total_days || 1)
    );
    setTodayIdx(idx);

    (async () => {
      const { data, error } = await supabase
        .from('challenge_checks')
        .select('id, challenge_id, user_id, day_index, photo_path, status, created_at, photo_expires_at')
        .eq('challenge_id', challenge.id)
        .eq('user_id', uid)
        .eq('day_index', idx)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') console.error(error);
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
    })();
  }, [challenge, summary, uid]);

  // Cargar cola de validaciones + reviewables
  useEffect(() => {
    if (!id) return;
    let alive = true;
    (async () => {
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
      if (!alive) return;
      if (q.error) console.error(q.error);
      if (r.error) console.error(r.error);

      const withSigned = await Promise.all(
        (q.data ?? []).map(async (row) => ({
          ...row,
          signed_url: await signPath(row.photo_path),
        }))
      );
      const withSignedR = await Promise.all(
        (r.data ?? []).map(async (row) => ({
          ...row,
          signed_url: await signPath(row.photo_path),
        }))
      );
      setQueue(withSigned as any);
      setReviewables(withSignedR as any);
    })();

    return () => {
      alive = false;
    };
  }, [id, uploading, activeTab]);

  async function signPath(path: string | null) {
    if (!path) return null;
    const { data } = await supabase.storage
      .from(PHOTOS_BUCKET)
      .createSignedUrl(path, 60 * 60 * 6); // 6h
    return data?.signedUrl ?? null;
  }

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

  const isOwner = uid === challenge.owner_id;

  // ===== edición inline =====
function startEdit() {
  if (!challenge) return;                 // ✅ evita null
  setTitleEdit(challenge.title);
  setDescEdit((challenge.description ?? metaDescription ?? '') || '');
  setIsEditing(true);
}
  function cancelEdit() {
    setIsEditing(false);
  }
  async function saveEdit() {
    if (!challenge) return;
    setSavingEdit(true);
    try {
      const payload: Partial<Challenge> = {
        title: titleEdit.trim() || challenge.title,
        description: descEdit.trim() || null,
      };
      const { error } = await supabase.from('challenges').update(payload).eq('id', challenge.id);
      if (error) throw error;
      setChallenge((prev) => prev ? { ...prev, ...payload } as Challenge : prev);
      setIsEditing(false);
    } catch (e) {
      console.error(e);
      alert('No se pudo guardar los cambios.');
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete() {
    setModal(null);
    const { error } = await supabase.from('challenges').delete().eq('id', id);
    if (error) return alert('Error al borrar el reto.');
    router.push('/amigos/retos');
  }

  async function handleLeave() {
    setModal(null);
    if (!uid) return;
    const { error } = await supabase
      .from('challenge_members')
      .delete()
      .eq('challenge_id', id)
      .eq('user_id', uid);
    if (error) return alert('Error al dejar el reto.');
    router.push('/amigos/retos');
  }

  // === Subida del check del día ===
  function triggerPick() {
    fileRef.current?.click();
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !uid || !todayIdx || !challenge) return;
    setUploading(true);
    try {
      const path = `${challenge.id}/${todayIdx}/${uid}/${crypto.randomUUID()}.${ext(file.name)}`;

      const { error: upErr } = await supabase.storage
        .from(PHOTOS_BUCKET)
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || 'image/jpeg',
        });
      if (upErr) throw upErr;

      const expiresAt = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
      const { data, error: insErr } = await supabase
        .from('challenge_checks')
        .insert([
          {
            challenge_id: challenge.id,
            user_id: uid,
            day_index: todayIdx,
            photo_path: path,
            photo_expires_at: expiresAt,
            status: 'pending',
          },
        ])
        .select('id, challenge_id, user_id, day_index, photo_path, status, created_at, photo_expires_at')
        .single();
      if (insErr) throw insErr;

      const signed = await signPath(path);
      setMyTodayCheck({
        check_id: data.id,
        challenge_id: data.challenge_id,
        author_id: data.user_id,
        day_index: data.day_index,
        photo_path: path,
        status: data.status,
        created_at: data.created_at,
        photo_expires_at: data.photo_expires_at,
        signed_url: signed ?? undefined,
      } as any);
    } catch (err: any) {
      console.error(err);
      alert('No se pudo subir la foto. Intenta de nuevo.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  // === Cambiar portada ===
  function triggerCoverPick() {
    coverInputRef.current?.click();
  }

  async function onPickCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !challenge) return;
    setCoverUploading(true);
    try {
      const path = `${challenge.id}/${Date.now()}-${sanitizeFileName(file.name)}`;
      const { error: upErr } = await supabase.storage
        .from(COVERS_BUCKET)
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || 'image/jpeg',
        });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from(COVERS_BUCKET).getPublicUrl(path);
      const coverUrl = pub?.publicUrl ?? null;
      if (!coverUrl) throw new Error('No se pudo obtener URL pública de la portada.');

      const { error: updErr } = await supabase
        .from('challenges')
        .update({ cover_url: coverUrl })
        .eq('id', challenge.id);
      if (updErr) throw updErr;

      setChallenge((prev) => (prev ? { ...prev, cover_url: coverUrl } : prev));
      setMetaCoverUrl(null);
    } catch (err) {
      console.error(err);
      alert('No se pudo actualizar la imagen de portada.');
    } finally {
      setCoverUploading(false);
      if (coverInputRef.current) coverInputRef.current.value = '';
    }
  }

  // === Votar ===
  async function vote(checkId: string, kind: 'valid' | 'invalid') {
    const { error } = await supabase.rpc('vote_on_check', { p_check_id: checkId, p_vote: kind });
    if (error) {
      console.error(error);
      alert('No se pudo registrar el voto.');
    } else {
      setQueue((prev) => prev.filter((q) => q.check_id !== checkId));
    }
  }

  // === Pedir revisión ===
  async function requestReview(checkId: string) {
    const { error } = await supabase.rpc('request_reconsideration', { p_check_id: checkId });
    if (error) {
      console.error(error);
      alert('No se pudo pedir revisión.');
    } else {
      setReviewables((prev) => prev.filter((r) => r.check_id !== checkId));
    }
  }

  // Helpers UI
  function fmtDate(d: string) {
    try {
      return new Date(d).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
    } catch {
      return d;
    }
  }
  function pct(n?: number) {
    return Math.max(0, Math.min(100, Math.round(n ?? 0)));
  }
  function ext(name: string) {
    const m = /\.([a-zA-Z0-9]+)$/.exec(name);
    return (m?.[1] || 'jpg').toLowerCase();
  }
  function sanitizeFileName(n: string) {
    return n.replace(/[^\w.\-]+/g, '_');
  }

  // ===== labels por día (fallback = título del reto) =====
  function getDayLabel(dayIndex?: number | null) {
    if (!dayIndex || !challenge) return '';
    // Si más adelante lees una tabla de labels (challenge_day_labels), usa su valor aquí.
    return challenge.title;
  }

  const resolvedCover = challenge.cover_url || metaCoverUrl || null;

  const resolvedDescription =
    (challenge.description && challenge.description.trim()) ||
    (metaDescription && metaDescription.trim()) ||
    '';

  // ======= RENDER =======
  return (
    <main className="min-h-screen bg-white relative">
      {/* ===== HERO ===== */}
<section className="relative w-full overflow-hidden bg-neutral-100">
  {resolvedCover ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolvedCover}
      alt={challenge.title}
      className="block w-full h-auto aspect-[16/9] object-cover"
      draggable={false}
    />
  ) : (
    <div className="aspect-[16/9] w-full flex items-center justify-center text-neutral-400">
      <ImagePlus className="h-10 w-10" />
      <span className="ml-2 text-sm">Sin imagen</span>
    </div>
  )}

  {isOwner && (
    <>
      <input
        ref={coverInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onPickCover}
      />
      <button
        className="absolute top-3 right-3 rounded-full bg-white/80 backdrop-blur px-3 py-1.5 text-[13px] font-medium hover:bg-white transition"
        onClick={triggerCoverPick}
        disabled={coverUploading}
      >
        {coverUploading ? 'Subiendo…' : 'Cambiar imagen'}
      </button>
    </>
  )}
</section>


      {/* ===== SUBMENÚ ===== */}
      <nav className="border-b bg-white sticky top-[48px] z-10">
        <div className="container mx-auto flex justify-between px-4 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`relative py-3 px-3 text-sm whitespace-nowrap transition ${
                activeTab === tab
                  ? 'font-semibold text-black after:absolute after:left-0 after:right-0 after:-bottom-[1px] after:h-[2px] after:bg-black'
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

              <div className="text-sm text-neutral-500">
                👥 {summary?.members_count ?? 0} participantes
              </div>
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
                  placeholder="Describe brevemente el reto, normas, premio y castigo…"
                />
              ) : resolvedDescription ? (
                <p className="text-sm text-neutral-700 whitespace-pre-line">
                  {resolvedDescription}
                </p>
              ) : (
                <p className="text-sm text-neutral-500">
                  Sin descripción. Añade las normas del reto en la edición.
                </p>
              )}
            </div>

            <details className="rounded-xl border p-3 text-sm" style={{ borderColor: 'var(--line)' }}>
              <summary className="cursor-pointer font-medium flex items-center gap-1">
                <Info className="h-4 w-4" /> ¿Cómo funcionan los retos con amigos?
              </summary>
              <div className="mt-2 text-neutral-700 leading-relaxed text-[13px] space-y-2">
                <p>Los retos con amigos están para cumplirlos, por eso hemos establecido ciertas normas a la hora de validar las participaciones en los retos:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Cada día subes una foto cumpliendo el reto.</li>
                  <li>Necesitas que otro participante valide tu participación diaria (con sólo 1 validación de otro usuario es suficiente).</li>
                  <li>Cada validación suma 1 punto.</li>
                  <li>Tu participación diaria puede quedar invalidada si el 50% de participantes deciden que tu foto no muestra que hayas cumplido con el reto diario.</li>
                  <li>Si nadie valida en 4 horas, se valida automáticamente.</li>
                </ul>
              </div>
            </details>

            <div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span>Progreso</span>
                {summary && (
                  <span className="text-neutral-500">
                    {summary.my_checks}/{summary.total_days} días
                  </span>
                )}
              </div>
              <div className="w-full h-3 rounded-full bg-neutral-200 overflow-hidden">
                <div
                  className="h-3 bg-green-500 transition-all duration-300"
                  style={{ width: `${pct(summary?.progress_pct)}%` }}
                />
              </div>
            </div>

            {isOwner && (
              <div className="flex gap-2">
                {!isEditing ? (
                  <button
                    className="rounded-xl border px-4 py-2 text-sm hover:bg-black/5 transition"
                    style={{ borderColor: 'var(--line)' }}
                    onClick={startEdit}
                  >
                    Editar reto
                  </button>
                ) : (
                  <>
                    <button
                      className="rounded-xl border px-4 py-2 text-sm hover:bg-black/5 transition"
                      style={{ borderColor: 'var(--line)' }}
                      onClick={cancelEdit}
                      disabled={savingEdit}
                    >
                      Cancelar
                    </button>
                    <button
                      className="rounded-xl bg-black text-white px-4 py-2 text-sm hover:opacity-90 transition disabled:opacity-60"
                      onClick={saveEdit}
                      disabled={savingEdit}
                    >
                      {savingEdit ? 'Guardando…' : 'Guardar'}
                    </button>
                  </>
                )}

                {!isEditing && (
                  <button
                    className="rounded-xl border px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition"
                    style={{ borderColor: 'var(--line)' }}
                    onClick={() => setModal('delete')}
                  >
                    Borrar reto
                  </button>
                )}
              </div>
            )}

            {!isOwner && !isEditing && (
              <button
                className="rounded-xl border px-4 py-2 text-sm text-neutral-600 hover:bg-black/5 transition"
                style={{ borderColor: 'var(--line)' }}
                onClick={() => setModal('leave')}
              >
                Dejar reto
              </button>
            )}
          </div>
        )}

        {/* CHECK DEL DÍA */}
        {activeTab === 'Check del día' && (
          <div className="space-y-4">
            {/* Barra estilo CreateHabitBar con label del día (fallback = título del reto) */}
            <CreateHabitBar
              variant="task"
              checked={!!myTodayCheck && (myTodayCheck.status === 'valid' || myTodayCheck.status === 'auto_valid')}
              label={`Día ${todayIdx ?? '-'} – ${getDayLabel(todayIdx)}`}
              onToggle={() => {
                // Solo visual: no cambiamos estado aquí; el check real lo decide la validación.
                // Podríamos abrir detalles si lo deseas.
              }}
              onInfo={() => {
                // ejemplo: scroll a la tarjeta del check
                document.getElementById('my-today-check')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              color="#F8E68A"
              className="mt-1"
            />

            <div className="flex items-center justify-between">
              <div className="text-sm">
                Día <b>{todayIdx ?? '-'}</b> / {summary?.total_days ?? '-'}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={onPickFile}
              />
              <button
                onClick={triggerPick}
                disabled={uploading}
                className="inline-flex items-center gap-2 rounded-full bg-black text-white px-4 py-2 text-sm font-semibold transition active:scale-95 disabled:opacity-60"
              >
                <Camera className="h-4 w-4" /> {uploading ? 'Subiendo…' : 'Subir foto'}
              </button>
            </div>

            {myTodayCheck ? (
              <div id="my-today-check" className="rounded-2xl overflow-hidden border" style={{ borderColor: 'var(--line)' }}>
                {myTodayCheck.signed_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={myTodayCheck.signed_url}
                    alt="Mi check"
                    className="w-full object-cover max-h-[360px]"
                  />
                ) : (
                  <div className="h-40 grid place-items-center text-neutral-400">
                    Sin imagen
                  </div>
                )}
                <div className="p-3 text-sm flex items-center justify-between">
                  <div>
                    Estado: <b>{labelStatus(myTodayCheck.status)}</b>
                  </div>
                  <div className="text-xs text-neutral-500">
                    {fmtDate(myTodayCheck.created_at)}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-neutral-600">
                Aún no has subido tu check de hoy.
              </p>
            )}
          </div>
        )}

        {/* VALIDACIONES */}
        {activeTab === 'Validaciones' && (
          <div className="space-y-6">
            <p className="text-sm text-neutral-600">
              Recuerda: con 1 validación cuenta como válido; si el 50% dice “no válido”, se rechaza. Si nadie vota en 4 h (o durante una revisión en 24 h), se valida.
            </p>

            {/* Pendientes para votar */}
            <section>
              <h3 className="text-base font-semibold mb-2">Pendientes de validar</h3>
              {!queue.length && (
                <p className="text-sm text-neutral-500">No hay fotos pendientes ahora mismo.</p>
              )}
              <ul className="space-y-3">
                {queue
                  .filter((q) => q.author_id !== uid)
                  .map((q) => (
                    <li
                      key={q.check_id}
                      className="rounded-2xl overflow-hidden border"
                      style={{ borderColor: 'var(--line)' }}
                    >
                      {q.signed_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={q.signed_url}
                          alt="Foto para validar"
                          className="w-full object-cover max-h-[360px]"
                        />
                      ) : (
                        <div className="h-40 grid place-items-center text-neutral-400">
                          Sin imagen
                        </div>
                      )}
                      <div className="p-3 flex items-center justify-between text-sm">
                        <div>
                          Día {q.day_index} – {getDayLabel(q.day_index)} · subido {fmtDate(q.created_at)}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => vote(q.check_id, 'invalid')}
                            className="rounded-xl border px-3 py-1.5 text-sm hover:bg-black/5"
                            style={{ borderColor: 'var(--line)' }}
                          >
                            No válido
                          </button>
                          <button
                            onClick={() => vote(q.check_id, 'valid')}
                            className="rounded-xl bg-green-600 text-white px-3 py-1.5 text-sm hover:opacity-90"
                          >
                            Validar
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
              </ul>
            </section>

            {/* Pedir revisión */}
            <section>
              <h3 className="text-base font-semibold mb-2">Pedir revisión</h3>
              {!reviewables.length && (
                <p className="text-sm text-neutral-500">No hay elementos revisables.</p>
              )}
              <ul className="space-y-3">
                {reviewables.map((q) => (
                  <li
                    key={q.check_id}
                    className="rounded-2xl overflow-hidden border"
                    style={{ borderColor: 'var(--line)' }}
                  >
                    {q.signed_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={q.signed_url}
                        alt="Foto validada"
                        className="w-full object-cover max-h-[360px]"
                      />
                    ) : (
                      <div className="h-40 grid place-items-center text-neutral-400">
                        Sin imagen
                      </div>
                    )}
                    <div className="p-3 flex items-center justify-between text-sm">
                      <div>
                        Día {q.day_index} – {getDayLabel(q.day_index)} · estado: <b>{labelStatus(q.status)}</b> · vence{' '}
                        {fmtDate(q.photo_expires_at)}
                      </div>
                      <button
                        onClick={() => requestReview(q.check_id)}
                        className="rounded-xl border px-3 py-1.5 text-sm hover:bg-black/5"
                        style={{ borderColor: 'var(--line)' }}
                      >
                        Pedir revisión (24 h)
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}

        {/* RANKING */}
        {activeTab === 'Ranking' && (
          <div className="space-y-3">
            {!leaders.length && (
              <p className="text-sm text-neutral-600">Sin datos de ranking.</p>
            )}

            <ul className="space-y-2">
              {leaders.map((r) => {
                const name =
                  r.handle ||
                  `${(r.nombre ?? '').trim()} ${(r.apellido ?? '').trim()}`.trim() ||
                  r.user_id.slice(0, 6);
                const avatar = leaderPhotos[r.user_id] || null;

                return (
                  <li
                    key={r.user_id}
                    className="flex items-center justify-between rounded-[28px] px-3 py-2 shadow-sm"
                    style={{ background: 'linear-gradient(180deg, #F8E68A 0%, #F2D767 100%)' }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 shrink-0 rounded-full overflow-hidden bg-neutral-100 aspect-square [clip-path:circle()]">
                        {avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={avatar}
                            alt="Avatar"
                            className="block h-full w-full object-cover object-center align-middle"
                            draggable={false}
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="h-full w-full grid place-items-center text-[12px] text-neutral-600">🙂</div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">
                          #{r.rank_position} · {name}
                        </div>
                        <div className="text-xs opacity-80 truncate">Puntos acumulados</div>
                      </div>
                    </div>

                    <div className="text-base font-bold tabular-nums shrink-0">
                      {r.score} pts
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      {/* ===== MODALES ===== */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-[90%] max-w-sm shadow-xl relative">
            <button
              onClick={() => setModal(null)}
              className="absolute top-3 right-3 text-neutral-400 hover:text-black"
            >
              <X className="h-5 w-5" />
            </button>

            {modal === 'delete' ? (
              <>
                <h2 className="text-lg font-semibold mb-2">¿Eliminar reto?</h2>
                <p className="text-sm text-neutral-600 mb-4">
                  Esto borrará todos los datos conseguidos hasta ahora.
                </p>
                <div className="flex justify-end gap-2">
                  <button className="px-4 py-2 text-sm rounded-xl border" onClick={() => setModal(null)}>
                    Cancelar
                  </button>
                  <button
                    className="px-4 py-2 text-sm rounded-xl bg-red-600 text-white"
                    onClick={handleDelete}
                  >
                    Confirmar
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold mb-2">¿Dejar el reto?</h2>
                <p className="text-sm text-neutral-600 mb-4">
                  Esto borrará tus datos y progreso en este reto.
                </p>
                <div className="flex justify-end gap-2">
                  <button className="px-4 py-2 text-sm rounded-xl border" onClick={() => setModal(null)}>
                    Cancelar
                  </button>
                  <button
                    className="px-4 py-2 text-sm rounded-xl bg-red-600 text-white"
                    onClick={handleLeave}
                  >
                    Confirmar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Inputs ocultos */}
      <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={onPickCover} />
    </main>
  );
}

function labelStatus(s: QueueItem['status']) {
  switch (s) {
    case 'pending':
      return 'Pendiente';
    case 'valid':
      return 'Válido';
    case 'invalid':
      return 'No válido';
    case 'auto_valid':
      return 'Válido (auto)';
  }
}
