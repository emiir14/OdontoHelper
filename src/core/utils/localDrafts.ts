/**
 * Local-only auto-save drafts stored in browser localStorage.
 * Ensures accidental F5 refreshes or Back navigation never lose in-progress clinical typing.
 */

const DRAFT_PREFIX = 'odontohelper_draft_v1:';

export interface StoredLocalDraft<T> {
  data: T;
  updatedAt: number;
}

function fullKey(key: string): string {
  return `${DRAFT_PREFIX}${key}`;
}

export function saveLocalDraft<T>(key: string, data: T): number | null {
  if (typeof localStorage === 'undefined') return null;
  const updatedAt = Date.now();
  const payload: StoredLocalDraft<T> = { data, updatedAt };
  try {
    localStorage.setItem(fullKey(key), JSON.stringify(payload));
    return updatedAt;
  } catch {
    return null;
  }
}

export function loadLocalDraft<T>(key: string): StoredLocalDraft<T> | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(fullKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredLocalDraft<T>;
    if (!parsed || typeof parsed !== 'object' || !('data' in parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearLocalDraft(key: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(fullKey(key));
  } catch {
    // ignore storage errors
  }
}

export function hasLocalDraft(key: string): boolean {
  return loadLocalDraft(key) !== null;
}
