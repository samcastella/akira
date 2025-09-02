'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { saveUserMerge } from '@/lib/user';

const LS_USER = 'akira_user_v1';

type Sex = 'masculino' | 'femenino' | 'prefiero_no_decirlo';

type Profile = {
  nombre?: string;
  apellido?: string;
  edad?: number;
  sexo?: Sex;
  caloriasDiarias?: number;
  instagram?: string;
  tiktok?: string;
  email?: string;
  telefono?: string;
  peso?: number;
  foto?: string; // dataURL/URL
};

function loadUser(): Profile {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(LS_USER);
    return raw ? (JSON.parse(raw) as Profile) : {};
  } catch {
    return {};
  }
}

export default function PerfilPage() {
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState<Profile>({});
  const [savedOpen, setSavedOpen] = useState(false); // pop-up guardado

  useEffect(() => {
    setProfile(loadUser());
  }, []);

  function handleChange<K extends keyof Profile>(k: K, v: Profile[K]) {
    setProfile((prev) => ({ ...prev, [k]: v }));
  }

  // === NUEVO: redimensionar a máx 200 px antes de guardar ===
  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const dataURL = await readFileAsDataURL(file);
    const resized = await resizeImageDataURL(dataURL, 200); // max 200 px lado mayor
    handleChange('foto', resized);
  }

  function save() {
    saveUserMerge(profile);
    if (typeof window !== 'undefined') {
      localStorage.setItem(
        LS_USER,
        JSON.stringify({ ...(loadUser() || {}), ...profile })
      );
    }
    setSavedOpen(true); // mostrar pop-up
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

            <Row label="Nombre" value={profile.nombre || '—'} />
            <Row label="Apellidos" value={profile.apellido || '—'} />
            <Row label="Edad" value={profile.edad ?? '—'} />
            <Row label="Sexo" value={profile.sexo || '—'} />
            <Row label="Peso (kg)" value={profile.peso ?? '—'} />
            <Row label="Calorías diarias" value={profile.caloriasDiarias ?? '—'} />
            <Row
              label="Instagram"
              value={profile.instagram || '—'}
              link={
                profile.instagram?.startsWith('http') ? profile.instagram : undefined
              }
            />
            <Row
              label="TikTok"
              value={profile.tiktok || '—'}
              link={profile.tiktok?.startsWith('http') ? profile.tiktok : undefined}
            />
            <Row label="Email" value={profile.email || '—'} />
            <Row label="Teléfono" value={profile.telefono || '—'} />

            <div className="mt-4">
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
              save();
            }}
          >
            {/* Avatar + selector de archivo */}
            <div className="flex items-center gap-3">
              <div
                className="rounded-full overflow-hidden"
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
              </div>
              <div>
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
            <Field label="Edad">
              <input
                type="number"
                min={5}
                className="input text-[16px]"
                value={profile.edad ?? ''}
                onChange={(e) =>
                  handleChange(
                    'edad',
                    e.target.value ? Number(e.target.value) : undefined
                  )
                }
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
                  handleChange(
                    'peso',
                    e.target.value ? Number(e.target.value) : undefined
                  )
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
            <Field label="Instagram (URL)">
              <input
                className="input text-[16px]"
                placeholder="https://instagram.com/usuario"
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
              <button type="submit" className="btn">
                Guardar cambios
              </button>
              <button
                type="button"
                className="btn secondary"
                onClick={() => setEditing(false)}
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </section>

      {/* Pop-up de confirmación */}
      {savedOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50">
          <div
            className="bg-white rounded-2xl shadow-xl p-6 text-sm"
            style={{ width: 'min(90vw, 360px)' }}
            role="dialog"
            aria-modal="true"
          >
            <p className="font-semibold">
              Tus cambios han sido guardados con éxitos
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="btn"
                onClick={() => {
                  setSavedOpen(false);
                  setEditing(false);
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
    <a href={link} target="_blank" rel="noreferrer" className="underline">
      {value}
    </a>
  ) : (
    value
  );
  return (
    <div
      className="flex items-center justify-between border-t"
      style={{ borderColor: 'var(--line)', paddingTop: 8 }}
    >
      <div className="muted" style={{ marginRight: 12 }}>
        {label}
      </div>
      <div style={{ fontWeight: 600 }}>{content}</div>
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
        const out = canvas.toDataURL('image/png'); // sin especificar quality para PNG
        resolve(out);
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = reject;
    img.src = dataURL;
  });
}
