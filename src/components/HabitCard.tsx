'use client';
import Image from 'next/image';
import { Archivo_Black } from 'next/font/google';

const archivoBlack = Archivo_Black({ weight: '400', subsets: ['latin'], variable: '--font-archivo-black' });

export type HabitCardData = { key: string; title: string; subtitle: string; image: string };

export default function HabitCard({
  data,
  onOpen,
  imagePriority = false, // ⬅️ nuevo prop
}: {
  data: HabitCardData;
  onOpen: (key: string) => void;
  imagePriority?: boolean;
}) {
  const open = () => onOpen(data.key);

  return (
    <div
      className="relative overflow-hidden cursor-pointer"
      onClick={open}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } }}
      role="button"
      tabIndex={0}
      aria-label={data.title}
    >
      <div className="relative w-full" style={{ height: 0, paddingBottom: '125%', backgroundColor: '#111' }}>
        <Image
          src={data.image}
          alt={data.title}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 600px"
          priority={imagePriority}             // ⬅️ prioridad para precarga de las 2 primeras
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
      </div>

      <div className="absolute inset-0 flex flex-col justify-end p-5">
        <div className="text-white/85 text-sm">{data.subtitle}</div>
        <div className={`${archivoBlack.className} text-white text-4xl leading-tight`}>{data.title}</div>
        <button className="mt-3 inline-flex items-center gap-2 self-start rounded-full bg-white px-4 py-2 text-sm font-medium text-black shadow">
          Empieza ahora
        </button>
      </div>
    </div>
  );
}
