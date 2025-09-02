'use client';
import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  async function sendMagic() {
    setMsg(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin }
    });
    setMsg(error ? error.message : 'Te hemos enviado un enlace de acceso a tu email.');
  }

  return (
    <main className="container" style={{ paddingTop: 24 }}>
      <h2 className="page-title">Acceder</h2>
      <div className="space-y-3" style={{ maxWidth: 420 }}>
        <input
          className="input text-[16px]"
          placeholder="tu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button className="btn" onClick={sendMagic} disabled={!email}>Enviar enlace</button>
        {msg && <p className="text-xs muted">{msg}</p>}
        <Link href="/" className="btn secondary">Volver</Link>
      </div>
    </main>
  );
}
