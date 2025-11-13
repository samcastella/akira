// src/lib/commitments.ts
'use client';

const LS_KEY = 'akira_commitments_v1';
// Sube este número si cambias el texto del compromiso en el futuro
export const COMMITMENT_VERSION = 1;

type CommitmentRecord = {
  version: number;
  name: string;
  checks: string[];        // ids o labels de los puntos aceptados
  acceptedAt: number;      // epoch ms
  context?: 'program' | 'community';
};

type CommitmentStore = {
  [userId: string]: {
    [programKey: string]: CommitmentRecord; // programSlug o programSlug#challengeId si algún día lo necesitas
  };
};

function readStore(): CommitmentStore {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as CommitmentStore) : {};
  } catch {
    return {};
  }
}

function writeStore(store: CommitmentStore) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(store));
  } catch {
    // noop (cuotas llenas, modo privado, etc.)
  }
}

export function getCommitment(userId: string | null | undefined, programKey: string) {
  if (!userId) return null;
  const store = readStore();
  return store[userId]?.[programKey] ?? null;
}

export function hasValidCommitment(userId: string | null | undefined, programKey: string) {
  const rec = getCommitment(userId, programKey);
  return !!rec && rec.version === COMMITMENT_VERSION;
}

export function setCommitment(
  userId: string | null | undefined,
  programKey: string,
  payload: Omit<CommitmentRecord, 'acceptedAt' | 'version'> & Partial<Pick<CommitmentRecord, 'acceptedAt' | 'version'>>
) {
  if (!userId) return;
  const store = readStore();
  if (!store[userId]) store[userId] = {};
  store[userId][programKey] = {
    version: payload.version ?? COMMITMENT_VERSION,
    name: payload.name,
    checks: payload.checks,
    acceptedAt: payload.acceptedAt ?? Date.now(),
    context: payload.context,
  };
  writeStore(store);
}
