import { IAuthProvider } from '../../core/interfaces';
import { getLocalTrialSession, getTestAuthSession } from '../../core/auth/testAuth';
import { Profile, Workspace } from '../../core/types';
import { db } from './db';

const DEFAULT_WORKSPACE_ID = 'ws_local_consultorio_1';
const DEFAULT_PROFILE_ID = 'prof_local_dentist_1';

export class LocalAuthProvider implements IAuthProvider {
  public async getCurrentWorkspace(): Promise<Workspace> {
    const existing = await db.workspaces.get(DEFAULT_WORKSPACE_ID);
    if (existing) {
      return existing;
    }

    const defaultWorkspace: Workspace = {
      id: DEFAULT_WORKSPACE_ID,
      name: 'Consultorio Odontológico',
      slug: 'consultorio-odontologico',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await db.workspaces.put(defaultWorkspace);
    return defaultWorkspace;
  }

  public async getCurrentProfile(): Promise<Profile> {
    const testSession = getTestAuthSession();
    const trialSession = getLocalTrialSession();
    const resolvedName = testSession?.fullName || trialSession?.fullName;
    const existing = await db.profiles.get(DEFAULT_PROFILE_ID);
    if (existing) {
      if (resolvedName && existing.fullName === 'Dra. Titular') {
        const updated = { ...existing, fullName: resolvedName, updatedAt: Date.now() };
        await db.profiles.put(updated);
        return updated;
      }
      return existing;
    }

    const defaultProfile: Profile = {
      id: DEFAULT_PROFILE_ID,
      workspaceId: DEFAULT_WORKSPACE_ID,
      fullName: resolvedName || 'Dra. Titular',
      role: 'owner',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await db.profiles.put(defaultProfile);
    return defaultProfile;
  }
}
