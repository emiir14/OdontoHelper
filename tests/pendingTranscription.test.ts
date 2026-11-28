import { describe, expect, it } from 'vitest';
import { pickPendingTranscriptionSession } from '../src/core/transcription/pendingResume';
import type { Session } from '../src/core/types';

function makeSession(overrides: Partial<Session> & { id: string }): Session {
  return {
    workspaceId: 'ws_test',
    title: 'Consulta',
    status: 'recorded',
    durationSec: 120,
    consentGiven: true,
    audioDeleted: false,
    createdAt: 1_000,
    updatedAt: 1_000,
    ...overrides,
  } as Session;
}

describe('pickPendingTranscriptionSession', () => {
  it('returns the most recently active pending session', () => {
    const sessions = [
      makeSession({ id: 'old', createdAt: 1_000, updatedAt: 1_000 }),
      makeSession({ id: 'recent', createdAt: 2_000, updatedAt: 2_000 }),
    ];

    expect(pickPendingTranscriptionSession(sessions)?.id).toBe('recent');
  });

  it('prefers the session that was just stopped even if it is older', () => {
    const sessions = [
      makeSession({ id: 'just-stopped', createdAt: 1_000, updatedAt: 5_000 }),
      makeSession({ id: 'newer-created', createdAt: 2_000, updatedAt: 2_000 }),
    ];

    expect(
      pickPendingTranscriptionSession(sessions, { preferredSessionId: 'just-stopped' })?.id
    ).toBe('just-stopped');
  });

  it('ignores sessions that are not pending', () => {
    const sessions = [
      makeSession({ id: 'completed', status: 'completed', updatedAt: 9_000 }),
      makeSession({ id: 'error', status: 'error', updatedAt: 8_000 }),
      makeSession({ id: 'recording', status: 'recording', updatedAt: 7_000 }),
      makeSession({ id: 'pending', updatedAt: 1_000 }),
    ];

    expect(pickPendingTranscriptionSession(sessions)?.id).toBe('pending');
  });

  it('ignores deleted audio and audio that only exists on another device', () => {
    const sessions = [
      makeSession({ id: 'deleted', updatedAt: 9_000, audioDeleted: true }),
      makeSession({ id: 'remote', updatedAt: 8_000 }),
      makeSession({ id: 'local', updatedAt: 1_000 }),
    ];

    expect(
      pickPendingTranscriptionSession(sessions, {
        localAudioAvailability: { remote: false, local: true },
      })?.id
    ).toBe('local');
  });

  it('ignores a preferred session when it is no longer eligible', () => {
    const sessions = [
      makeSession({ id: 'preferred', status: 'completed', updatedAt: 9_000 }),
      makeSession({ id: 'pending', updatedAt: 1_000 }),
    ];

    expect(
      pickPendingTranscriptionSession(sessions, { preferredSessionId: 'preferred' })?.id
    ).toBe('pending');
  });

  it('returns null when there is nothing pending', () => {
    expect(pickPendingTranscriptionSession([])).toBeNull();
    expect(
      pickPendingTranscriptionSession([makeSession({ id: 'done', status: 'completed' })])
    ).toBeNull();
  });
});
