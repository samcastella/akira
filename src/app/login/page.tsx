'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import AuthStartModal from '@/components/AuthStartModal';
import RegistrationModal from '@/components/RegistrationModal';

export default function LoginPage() {
  const router = useRouter();

  const [showStart, setShowStart] = useState(true);
  const [showReg, setShowReg] = useState(false);
  const [regStep, setRegStep] = useState<1 | 2>(1);
  const [prefill, setPrefill] = useState<any>(null);

  // Si ya hay sesión, no mostramos nada de login
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        // Si vienen de OAuth por primera vez, abrimos paso 2
        const meta = data.session.user?.user_metadata || {};
        setPrefill({
          email: data.session.user?.email ?? '',
          nombre: meta.name || meta.full_name || '',
          apellido: meta.family_name || '',
        });
        setRegStep(2);
        setShowStart(false);
        setShowReg(true);
      } else {
        setShowStart(true);
      }
    })();
  }, []);

  // Handlers de AuthStartModal
  function loginGoogle() {
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/login`,
        queryParams: { prompt: 'select_account' }
      }
    });
  }

  function loginApple() {
    supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: `${window.location.origin}/login`,
      }
    });
  }

  function signupEmail() {
    setShowStart(false);
    setRegStep(1);
    setPrefill(null);
    setShowReg(true);
  }

  return (
    <main className="container" style={{ paddingTop: 24, paddingBottom: 24 }}>
      {/* Pop-up de inicio */}
      {showStart && (
        <AuthStartModal
          onGoogle={loginGoogle}
          onApple={loginApple}
          onEmail={signupEmail}
        />
      )}

      {/* Modal de registro */}
      {showReg && (
        <RegistrationModal
          initialStep={regStep}
          prefill={prefill || undefined}
          onClose={() => {
            setShowReg(false);
            router.push('/'); // navega a home tras terminar
          }}
        />
      )}
    </main>
  );
}
