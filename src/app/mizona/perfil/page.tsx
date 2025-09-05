// src/app/mizona/perfil/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Camera } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useUserProfile, upsertProfile, saveUserMerge, Sex, normalizeUsername } from '@/lib/user';

type Profile = {
  username?: string;
  nombre?: string;
  apellido?: string;
  // Conservamos edad por compatibilidad, pero usamos fechaNacimiento
  edad?: number;
  fechaNacimiento?: string; // YYYY-MM-DD
  sexo?: Sex;
  caloriasDiarias?: number;
  instagram?: string;
  tiktok?: string;
  email?: string;
  telefono?: string;
  peso?: number;
  foto?: string; // dataURL/URL
};

/* ===== Helpers Instagram ===== */
function normalizeInstagramLink(val?: string) {
  if (!val) return undefined;
  const trimmed = val.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed; // ya es URL
  const user = trimmed.replace(/^@/, '');
  return `https://instagram.com/${user}`;
}

function instagramLabel(val?: string) {
  if (!val) return '—';
  const m = val.match(/instagram\.com\/([^/?#]+)/i);
  if (m?.[1]) return '@' + m[1];
  return '@' + val.replace(/^@/, '');
}

export default function PerfilPage() {
  const user = useUserProfile(); // ← reactivo a cambios (pullProfile)
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState<Profile>({});
  const [savedOpen, setSavedOpen] = useState(false); // pop-up guardado
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  // Hidrata el formulario con el perfil global cuando no estamos editando
  useEffect(() => {
    if (!editing && user) {
      setProfile(user as Profile);
    }
  }, [user, editing]);

  function handleChange<K extends keyof Profile>(k: K, v: Profile[K]) {
    setProfile((prev) => ({ ...prev, [k]: v }));
  }

  // === Redimensionar a máx 200 px antes de guardar ===
  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const dataURL = await readFileAsDataURL(file);
    const resized = await resizeImageDataURL(dataURL, 200); // max 200 px lado mayor
    handleChange('foto', resized);
  }

  async function save() {
    setSaving(true);
    try {
      // Normalización suave (+ username normalizado)
      const payload: Profile = {
        ...profile,
        email: profile.email?.trim().toLowerCase(),
        instagram: normalizeInstagramLink(profile.instagram),
        tiktok: profile.tiktok?.trim() || undefined,
        username: profile.username ? normalizeUsername(profile.username) : undefined,
        fechaNacimiento: profile.fechaNacimiento || undefined,
        // mantenemos edad si existiera por compatibilidad, pero no la forzamos
      };

      // 1) Escribe en Supabase (propaga a otros dispositivos)
      await upsertProfile(payload as any);

      // 2) Refleja local y dispara evento para la UI actual
      const updated = saveUserMerge(payload as any);

      setProfile(updated as Profile);
      setSavedOpen(true);
      setEditing(false);
    } catch (err: any) {
      const code = String(err?.code || err?.status || '');
      const msg = String(err?.message || '');

      // Username duplicado → no cierres el editor ni sigas con guardado local
      if (code === '23505' || /duplicate|unique/i.test(msg)) {
        try { alert('Ese nombre de usuario ya está en uso. Prueba con otro.'); } catch {}
        setSaving(false);
        return;
      }

      console.warn('[PerfilPage] upsertProfile falló, guardo local y continúo', err);
      const updated = saveUserMerge(profile as any);
      setProfile(updated as Profile);
      setSavedOpen(true);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
    } finally {
      // limpiamos perfil local por seguridad (clave decidida en el proyecto)
      try { localStorage.removeItem('akira_user_profile_v2'); } catch {}
      router.push('/login');
    }
  }

  return (
    <main className="container" style={{ paddingTop: 24, paddingBottom: 24 }}>
      <div className="flex items-center justify-between">
        <h2 className="page-title">Perfil</h2>
        <Link href="/mizona" className="btn secondary">
          Volver
        </Link>
      </div>

      <section
        style={{
          background: 'var(--background)',
          borderRadius: 'var(--radius-card)',
          padding: 18,
          border: '1px solid var(--line)',
        }}
      >
        {!editing ? (
          <div className="space-y-3 text-sm">
            {/* Avatar */}
            <div className="flex items-center gap-3">
              <div
                className="rounded-full overflow-hidden"
                style={{
                  width: 80,
                  height: 80,
                  border: '1px solid var(--line)',
                  background: '#f7f7f7',
                }}
              >
                {profile.foto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.foto}
                    alt="Foto de perfil"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : null}
              </div>
              <div className="muted">Tu foto de perfil</div>
            </div>

            <Row label="Usuario" value={profile.username || '—'} />
            <Row label="Nombre" value={profile.nombre || '—'} />
            <Row label="Apellidos" value={profile.apellido || '—'} />

            {/* Fecha de nacimiento sustituye Edad */}
            <Row label="Fecha de nacimiento" value={profile.fechaNacimiento || '—'} />

            <Row label="Sexo" value={profile.sexo || '—'} />
            <Row label="Peso (kg)" value={profile.peso ?? '—'} />
            <Row label="Calorías diarias" value={profile.caloriasDiarias ?? '—'} />

            {/* Instagram con formateo y enlace normalizado */}
            <Row
              label="Instagram"
              value={profile.instagram ? instagramLabel(profile.instagram) : '—'}
              link={normalizeInstagramLink(profile.instagram)}
            />

            <Row
              label="TikTok"
              value={profile.tiktok || '—'}
              link={profile.tiktok?.startsWith('http') ? profile.tiktok : undefined}
            />
            <Row label="Email" value={profile.email || '—'} />
            <Row label="Teléfono" value={profile.telefono || '—'} />

            <div className="mt-4 flex gap-2">
              <button className="btn" onClick={() => setEditing(true)}>
                Editar perfil
              </button>
            </div>
          </div>
        ) : (
          <form
            className="space-y-3 text-sm"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            {/* Avatar + selector de archivo con overlay de cámara */}
            <div className="flex items-center gap-3">
              <div
                className="relative rounded-full overflow-hidden"
                style={{
                  width: 96,
                  height: 96,
                  border: '1px solid var(--line)',
                  background: '#f7f7f7',
                }}
              >
                {profile.foto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.foto}
                    alt="Foto de perfil"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : null}

                {/* Botón cámara (overlay) */}
                <label
                  htmlFor="fotoInput"
                  title="Cambiar foto"
                  aria-label="Cambiar foto"
                  className="absolute bottom-1 right-1 rounded-full shadow"
                  style={{
                    background: 'white',
                    border: '1px solid var(--line)',
                    width: 32,
                    height: 32,
                    display: 'grid',
                    placeItems: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <Camera size={18} />
                </label>
              </div>

              <div>
                {/* Mantengo también el botón textual por accesibilidad */}
                <label className="btn secondary" htmlFor="fotoInput">
                  Subir foto
                </label>
                <input
                  id="fotoInput"
                  type="file"
                  accept="image/*"
                  onChange={onPickFile}
                  className="hidden"
                />
              </div>
            </div>

            <Field label="Nombre de usuario">
              <input
                className="input text-[16px]"
                placeholder="tu_usuario"
                value={profile.username || ''}
                onChange={(e) => handleChange('username', e.target.value)}
              />
            </Field>

            <Field label="Nombre">
              <input
                className="input text-[16px]"
                value={profile.nombre || ''}
                onChange={(e) => handleChange('nombre', e.target.value)}
              />
            </Field>

            <Field label="Apellidos">
              <input
                className="input text-[16px]"
                value={profile.apellido || ''}
                onChange={(e) => handleChange('apellido', e.target.value)}
              />
            </Field>

            {/* Sustituimos Edad por Fecha de nacimiento */}
            <Field label="Fecha de nacimiento">
              <input
                type="date"
                className="input text-[16px]"
                value={profile.fechaNacimiento || ''}
                onChange={(e) => handleChange('fechaNacimiento', e.target.value || undefined)}
              />
            </Field>

            <Field label="Sexo">
              <select
                className="input text-[16px]"
                value={profile.sexo || 'prefiero_no_decirlo'}
                onChange={(e) => handleChange('sexo', e.target.value as Sex)}
              >
                <option value="masculino">Masculino</option>
                <option value="femenino">Femenino</option>
                <option value="prefiero_no_decirlo">Prefiero no decirlo</option>
              </select>
            </Field>

            <Field label="Peso (kg)">
              <input
                type="number"
                min={20}
                step="0.1"
                className="input text-[16px]"
                value={profile.peso ?? ''}
                onChange={(e) =>
                  handleChange('peso', e.target.value ? Number(e.target.value) : undefined)
                }
              />
            </Field>

            <Field label="Calorías diarias">
              <input
                type="number"
                min={800}
                className="input text-[16px]"
                value={profile.caloriasDiarias ?? ''}
                onChange={(e) =>
                  handleChange(
                    'caloriasDiarias',
                    e.target.value ? Number(e.target.value) : undefined
                  )
                }
              />
            </Field>

            <Field label="Instagram (URL o @usuario)">
              <input
                className="input text-[16px]"
                placeholder="https://instagram.com/usuario o @usuario"
                value={profile.instagram || ''}
                onChange={(e) => handleChange('instagram', e.target.value)}
              />
            </Field>

            <Field label="TikTok (URL)">
              <input
                className="input text-[16px]"
                placeholder="https://tiktok.com/@usuario"
                value={profile.tiktok || ''}
                onChange={(e) => handleChange('tiktok', e.target.value)}
              />
            </Field>

            <Field label="Email">
              <input
                type="email"
                className="input text-[16px]"
                value={profile.email || ''}
                onChange={(e) => handleChange('email', e.target.value)}
              />
            </Field>

            <Field label="Teléfono">
              <input
                className="input text-[16px]"
                value={profile.telefono || ''}
                onChange={(e) => handleChange('telefono', e.target.value)}
              />
            </Field>

            <div className="flex gap-2 mt-4">
              <button type="submit" className="btn" disabled={saving}>
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </button>
              <button
                type="button"
                className="btn secondary"
                onClick={() => setEditing(false)}
                disabled={saving}
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </section>

      {/* Botón Cerrar sesión */}
      <div className="mt-4">
        <button type="button" className="btn secondary" onClick={handleLogout}>
          Cerrar sesión
        </button>
      </div>

      {/* Pop-up de confirmación */}
      {savedOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50">
          <div
            className="bg-white rounded-2xl shadow-xl p-6 text-sm"
            style={{ width: 'min(90vw, 360px)' }}
            role="dialog"
            aria-modal="true"
          >
            <p className="font-semibold">Tus cambios han sido guardados con éxito</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="btn"
                onClick={() => {
                  setSavedOpen(false);
                }}
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/* ===== Helpers UI ===== */
function Row({
  label,
  value,
  link,
}: {
  label: string;
  value: React.ReactNode;
  link?: string;
}) {
  const content = link ? (
    <a href={link} target="_blank" rel="noreferrer" className="underline break-all">
      {value}
    </a>
  ) : (
    <span className="break-all">{value}</span>
  );

  return (
    <div
      className="flex items-start gap-3 border-t"
      style={{ borderColor: 'var(--line)', paddingTop: 8 }}
    >
      <div className="muted shrink-0">{label}</div>
      {/* min-w-0 es CLAVE para que los enlaces largos no rompan el layout en flex */}
      <div className="ml-auto font-semibold text-right min-w-0">{content}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

/* ===== Utils: lectura/resize imagen ===== */
function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res(String(reader.result || ''));
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });
}

/**
 * Redimensiona un dataURL a que su lado mayor sea <= maxSize (p.ej. 200 px).
 * Mantiene proporciones. Devuelve dataURL PNG.
 */
function resizeImageDataURL(dataURL: string, maxSize: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const { width, height } = img;
      const scale = Math.min(1, maxSize / Math.max(width, height)); // no ampliamos
      const newW = Math.max(1, Math.round(width * scale));
      const newH = Math.max(1, Math.round(height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = newW;
      canvas.height = newH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('No canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0, newW, newH);
      try {
        const out = canvas.toDataURL('image/png');
        resolve(out);
      } catch (e) {
        reject(e as Error);
      }
    };
    img.onerror = reject;
    img.src = dataURL;
  });
}
