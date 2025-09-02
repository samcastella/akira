'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { saveUserMerge } from '@/lib/user'; // ya lo usas en RegistrationModal

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
};

function loadUser(): Profile {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(LS_USER);
    return raw ? JSON.parse(raw) as Profile : {};
  } catch { return {}; }
}

export default function PerfilPage() {
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState<Profile>({});

  useEffect(() => { setProfile(loadUser()); }, []);

  function handleChange<K extends keyof Profile>(k: K, v: Profile[K]) {
    setProfile(prev => ({ ...prev, [k]: v }));
  }

  function save() {
    // “Guardar cambios” SIEMPRE activo
    saveUserMerge(profile);
    // refresco local
    if (typeof window !== 'undefined') {
      localStorage.setItem(LS_USER, JSON.stringify({ ...(loadUser() || {}), ...profile }));
    }
  }

  return (
    <main className="container" style={{ paddingTop: 24, paddingBottom: 24 }}>
      <div className="flex items-center justify-between">
        <h2 className="page-title">Perfil</h2>
        <Link href="/mizona" className="btn secondary">Volver</Link>
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
            <Row label="Nombre" value={profile.nombre || '—'} />
            <Row label="Apellidos" value={profile.apellido || '—'} />
            <Row label="Edad" value={profile.edad ?? '—'} />
            <Row label="Sexo" value={profile.sexo || '—'} />
            <Row label="Calorías diarias" value={profile.caloriasDiarias ?? '—'} />
            <Row label="Instagram" value={profile.instagram || '—'} link={profile.instagram?.startsWith('http') ? profile.instagram : undefined} />
            <Row label="TikTok" value={profile.tiktok || '—'} link={profile.tiktok?.startsWith('http') ? profile.tiktok : undefined} />
            <Row label="Email" value={profile.email || '—'} />
            <Row label="Teléfono" value={profile.telefono || '—'} />

            <div className="mt-4">
              <button className="btn" onClick={() => setEditing(true)}>Editar perfil</button>
            </div>
          </div>
        ) : (
          <form className="space-y-3 text-sm" onSubmit={(e) => { e.preventDefault(); save(); }}>
            <Field label="Nombre">
              <input className="input text-[16px]" value={profile.nombre || ''} onChange={e=>handleChange('nombre', e.target.value)} />
            </Field>
            <Field label="Apellidos">
              <input className="input text-[16px]" value={profile.apellido || ''} onChange={e=>handleChange('apellido', e.target.value)} />
            </Field>
            <Field label="Edad">
              <input type="number" min={5} className="input text-[16px]" value={profile.edad ?? ''} onChange={e=>handleChange('edad', e.target.value ? Number(e.target.value) : undefined)} />
            </Field>
            <Field label="Sexo">
              <select className="input text-[16px]" value={profile.sexo || 'prefiero_no_decirlo'} onChange={e=>handleChange('sexo', e.target.value as Sex)}>
                <option value="masculino">Masculino</option>
                <option value="femenino">Femenino</option>
                <option value="prefiero_no_decirlo">Prefiero no decirlo</option>
              </select>
            </Field>
            <Field label="Calorías diarias">
              <input type="number" min={800} className="input text-[16px]" value={profile.caloriasDiarias ?? ''} onChange={e=>handleChange('caloriasDiarias', e.target.value ? Number(e.target.value) : undefined)} />
            </Field>
            <Field label="Instagram (URL)">
              <input className="input text-[16px]" placeholder="https://instagram.com/usuario" value={profile.instagram || ''} onChange={e=>handleChange('instagram', e.target.value)} />
            </Field>
            <Field label="TikTok (URL)">
              <input className="input text-[16px]" placeholder="https://tiktok.com/@usuario" value={profile.tiktok || ''} onChange={e=>handleChange('tiktok', e.target.value)} />
            </Field>
            <Field label="Email">
              <input type="email" className="input text-[16px]" value={profile.email || ''} onChange={e=>handleChange('email', e.target.value)} />
            </Field>
            <Field label="Teléfono">
              <input className="input text-[16px]" value={profile.telefono || ''} onChange={e=>handleChange('telefono', e.target.value)} />
            </Field>

            <div className="flex gap-2 mt-4">
              <button type="submit" className="btn">Guardar cambios</button>
              <button type="button" className="btn secondary" onClick={() => setEditing(false)}>Cancelar</button>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}

function Row({ label, value, link }: { label: string; value: React.ReactNode; link?: string }) {
  const content = link ? <a href={link} target="_blank" rel="noreferrer" className="underline">{value}</a> : value;
  return (
    <div className="flex items-center justify-between border-t" style={{ borderColor: 'var(--line)', paddingTop: 8 }}>
      <div className="muted" style={{ marginRight: 12 }}>{label}</div>
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
