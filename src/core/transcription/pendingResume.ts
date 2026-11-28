import type { Session } from '../types';

export interface PendingTranscriptionOptions {
  /** Session that should win if it is still pending (e.g. the one just stopped). */
  preferredSessionId?: string | null;
  /** Local audio availability by session id, as loaded from IndexedDB. */
  localAudioAvailability?: Record<string, boolean>;
}

function sessionActivityTime(session: Session): number {
  return Math.max(session.updatedAt || 0, session.createdAt || 0);
}

/**
 * Picks the next session whose local audio is waiting to be transcribed.
 *
 * A session is eligible only when:
 * - it is not deleted,
 * - its status is `recorded` (audio captured but transcription not finished),
 * - its audio has not been deleted, and
 * - local audio is not known to live on another device.
 *
 * Sessions with local audio are ordered by most recent activity so a session
 * that was just stopped or appended to is transcribed first.
 */
export function pickPendingTranscriptionSession(
  sessions: Session[],
  options: PendingTranscriptionOptions = {}
): Session | null {
  const availability = options.localAudioAvailability || {};

  const isEligible = (session: Session): boolean =>
    !session.deletedAt &&
    session.status === 'recorded' &&
    !session.audioDeleted &&
    availability[session.id] !== false;

  if (options.preferredSessionId) {
    const preferred = sessions.find((session) => session.id === options.preferredSessionId);
    if (preferred && isEligible(preferred)) {
      return preferred;
    }
  }

  const candidates = sessions.filter(isEligible);
  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => sessionActivityTime(b) - sessionActivityTime(a));
  return candidates[0];
}
