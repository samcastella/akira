'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';
import ProgramDetail from '@/components/ProgramDetail';
import { useAuthUserId } from '@/lib/user';
import { Trash2 } from 'lucide-react';

type LeaderRow = {
  user_id: string;
  score: number;
  rank_position: number;
  handle: string | null;
  nombre: string | null;
  apellido: string | null;
};

export default function ProgramCommunityPage() {
  const { slug } = useParams() as { slug: string }; // ej: "san-silvestre-60"
  const uid = useAuthUserId();

  const [participants, setParticipants] = useState<number>(0);
  const [leaders, setLeaders] = useState<LeaderRow[]>([]);
  const [leaderPhotos, setLeaderPhotos] = useState<Record<string, string | null>>({});
  const [leaderImgOk, setLeaderImgOk] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!slug) return;

      // participantes
      const { data: cnt, error: cntErr } = await supabase.rpc('get_program_participants_count', { p_slug: slug });
      if (!alive) return;
      if (cntErr) console.error(cntErr);
      setParticipants(Number(cnt ?? 0));

      // ranking
      const { data: lb, error: lbErr } = await supabase.rpc('get_program_leaderboard', { p_slug: slug, p_limit: 200, p_offset: 0 });
      if (!alive) return;
      if (lbErr) console.error(lbErr);
      setLeaders(lb ?? []);

      // avatares
      try {
        const ids = (lb ?? []).map((r: any) => r.user_id).filter(Boolean);
        if (ids.length) {
          const { data: profs, error: pErr } = await supabase
            .from('public_profiles')
            .select('user_id, avatar_url')
            .in('user_id', ids);
          if (pErr) console.warn('[public_profiles]', pErr);
          const map: Record<string, string | null> = {};
          (profs ?? []).forEach((p: any) => { map[p.user_id] = p.avatar_url ?? null; });
          setLeaderPhotos(map);
        } else {
          setLeaderPhotos({});
        }
      } catch (e) {
        console.warn('[avatars]', e);
        setLeaderPhotos({});
      }
    })();
    return () => { alive = false; };
  }, [slug]);

  return (
    <div className="bg-white">
      {/* 1) ProgramDetail “normal” arriba */}
      <ProgramDetail
        slug={slug}
        imageSrc={undefined}
        title=""
        shortDescription=""
        howItWorks=""
      />

      {/* 2) Bloque Comunidad */}
      <section className="px-4 pb-24 container mx-auto">
        <div className="mt-8 mb-2 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Comunidad</h2>
          <div className="text-sm text-neutral-600">👥 {participants} participantes</div>
        </div>

        <div className="rounded-2xl border" style={{ borderColor: 'var(--line)' }}>
          <div className="px-4 py-3 text-sm font-semibold bg-neutral-50">Ranking del programa</div>
          <div className="p-3">
            {!leaders.length && <p className="text-sm text-neutral-600">Aún no hay participantes con puntos.</p>}
            <ul className="space-y-2">
              {leaders.map((r) => {
                const name = r.handle || `${(r.nombre ?? '').trim()} ${(r.apellido ?? '').trim()}`.trim() || r.user_id.slice(0, 6);
                const avatar = leaderPhotos[r.user_id] || null;
                return (
                  <li
                    key={r.user_id}
                    className="flex items-center justify-between rounded-[28px] px-3 py-2 shadow-sm bg-white border"
                    style={{ borderColor: 'var(--line)' }}
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
                        <div className="text-xs opacity-80 truncate">Puntos del programa</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-base font-bold tabular-nums">{r.score} pts</div>
                      {/* No hay “kick” en comunitarios */}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <p className="text-xs text-neutral-500 mt-3">
          * Los puntos de este programa cuentan para tu ranking global.
        </p>
      </section>
    </div>
  );
}
