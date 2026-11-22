export const TEST_AUTH_USERNAME = 'drtest';
export const TEST_AUTH_PASSWORD = 'test';
const TEST_AUTH_STORAGE_KEY = 'odontohelper_test_auth_session';
const LOCAL_TRIAL_STORAGE_KEY = 'odontohelper_local_trial_session';

export interface TestAuthSession {
  username: string;
  fullName: string;
  loggedInAt: number;
}

export interface LocalTrialSession {
  email: string;
  fullName: string;
  intendedPlan?: string;
  intendedCycle?: string;
  loggedInAt: number;
}

export function verifyTestCredentials(identifier: string, password: string): boolean {
  const normalized = identifier.trim().toLowerCase();
  const isValidUser =
    normalized === TEST_AUTH_USERNAME || normalized === `${TEST_AUTH_USERNAME}@odontohelper.local`;
  return isValidUser && password === TEST_AUTH_PASSWORD;
}

export function getTestAuthSession(): TestAuthSession | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(TEST_AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TestAuthSession>;
    if (parsed && parsed.username === TEST_AUTH_USERNAME) {
      return {
        username: TEST_AUTH_USERNAME,
        fullName: parsed.fullName || 'Dr. Test',
        loggedInAt: typeof parsed.loggedInAt === 'number' ? parsed.loggedInAt : Date.now(),
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function getLocalTrialSession(): LocalTrialSession | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(LOCAL_TRIAL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LocalTrialSession>;
    if (parsed && parsed.email) {
      return {
        email: parsed.email,
        fullName: parsed.fullName || parsed.email.split('@')[0] || 'Odontólogo',
        intendedPlan: parsed.intendedPlan,
        intendedCycle: parsed.intendedCycle,
        loggedInAt: typeof parsed.loggedInAt === 'number' ? parsed.loggedInAt : Date.now(),
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function isTestAuthActive(): boolean {
  return Boolean(getTestAuthSession() || getLocalTrialSession());
}

export function startLocalTrialSession(input: {
  email: string;
  fullName: string;
  intendedPlan?: string;
  intendedCycle?: string;
}): LocalTrialSession {
  const session: LocalTrialSession = {
    email: input.email.trim(),
    fullName: input.fullName.trim() || input.email.split('@')[0] || 'Odontólogo',
    intendedPlan: input.intendedPlan,
    intendedCycle: input.intendedCycle,
    loggedInAt: Date.now(),
  };
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(LOCAL_TRIAL_STORAGE_KEY, JSON.stringify(session));
    }
  } catch {
    // ignore storage restrictions
  }
  return session;
}

export function signInWithTestCredentials(identifier: string, password: string): boolean {
  if (!verifyTestCredentials(identifier, password)) return false;
  const session: TestAuthSession = {
    username: TEST_AUTH_USERNAME,
    fullName: 'Dr. Test',
    loggedInAt: Date.now(),
  };
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(TEST_AUTH_STORAGE_KEY, JSON.stringify(session));
    }
  } catch {
    // ignore storage restrictions
  }
  return true;
}

export function clearTestAuthSession(): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(TEST_AUTH_STORAGE_KEY);
      window.localStorage.removeItem(LOCAL_TRIAL_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}

