// components/WelcomeCard.tsx
'use client';

import { useRouter } from 'next/navigation';

export default function WelcomeCard() {
  const router = useRouter();

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-4">Bienvenid@ a Build your Habits</h1>

      <p className="text-gray-700 mb-4">
        Nuestra app está diseñada para ayudarte a construir hábitos saludables que mejoren tu bienestar desde cero, y para dejar atrás los malos hábitos de la forma más sencilla y amable posible.
      </p>

      <p className="text-gray-700 mb-3">Pero tenemos algunas reglas que nos guiarán en el camino:</p>

      <ol className="list-decimal ml-6 space-y-2 text-gray-800">
        <li><strong>Decir siempre la verdad.</strong> Si marcas un hábito como realizado sin haberlo hecho, al único que engañas es a ti mism@.</li>
        <li><strong>Está permitido fallar, pero nunca rendirse.</strong> Si un día no consigues un reto, tendrás otra oportunidad al día siguiente.</li>
        <li><strong>Disfruta del proceso y celebra cada paso.</strong> La constancia es la clave, y cada avance merece orgullo.</li>
      </ol>

      <p className="mt-6 italic">✨ Recuerda: eres la suma de tus acciones.</p>

      <div className="mt-6">
        <button
          onClick={() => router.push('/')}
          className="rounded-full px-5 py-2 border border-black"
        >
          Vamos a por ello
        </button>
      </div>
    </div>
  );
}
