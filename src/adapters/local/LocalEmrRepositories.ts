import {
  ActivityLogEntry,
  Appointment,
  Patient,
  Provider,
} from '../../core/types';
import { db } from './db';

export class LocalPatientRepository {
  public async getAll(workspaceId: string): Promise<Patient[]> {
    const own = await db.patients
      .where('workspaceId')
      .equals(workspaceId)
      .filter((p) => !p.deletedAt)
      .toArray();
    const acceptedShares = await db.patientShares
      .where('recipientWorkspaceId')
      .equals(workspaceId)
      .filter((s) => s.status === 'accepted')
      .toArray();
    if (acceptedShares.length === 0) {
      return own.sort((a, b) => b.updatedAt - a.updatedAt);
    }
    const sharedIds = Array.from(new Set(acceptedShares.map((s) => s.patientId)));
    const sharedRows = (await db.patients.bulkGet(sharedIds)).filter(
      (p): p is Patient => Boolean(p && !p.deletedAt)
    );
    const merged = new Map<string, Patient>();
    own.forEach((p) => merged.set(p.id, p));
    sharedRows.forEach((p) => merged.set(p.id, p));
    return Array.from(merged.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  public async getById(id: string): Promise<Patient | undefined> {
    const patient = await db.patients.get(id);
    if (!patient || patient.deletedAt) return undefined;
    return patient;
  }

  public async create(patient: Patient): Promise<void> {
    await db.patients.put(patient);
  }

  public async update(id: string, patch: Partial<Patient>): Promise<void> {
    await db.patients.update(id, {
      ...patch,
      updatedAt: Date.now(),
    });
  }

  public async delete(id: string): Promise<void> {
    await db.patients.update(id, {
      deletedAt: Date.now(),
      updatedAt: Date.now(),
    });
  }
}

export class LocalProviderRepository {
  public async getAll(workspaceId: string): Promise<Provider[]> {
    return await db.providers
      .where('workspaceId')
      .equals(workspaceId)
      .filter((p) => !p.deletedAt)
      .reverse()
      .sortBy('updatedAt');
  }

  public async getById(id: string): Promise<Provider | undefined> {
    const provider = await db.providers.get(id);
    if (!provider || provider.deletedAt) return undefined;
    return provider;
  }

  public async create(provider: Provider): Promise<void> {
    await db.providers.put(provider);
  }

  public async update(id: string, patch: Partial<Provider>): Promise<void> {
    await db.providers.update(id, {
      ...patch,
      updatedAt: Date.now(),
    });
  }

  public async delete(id: string): Promise<void> {
    await db.providers.update(id, {
      deletedAt: Date.now(),
      updatedAt: Date.now(),
    });
  }
}

export class LocalAppointmentRepository {
  public async getAll(workspaceId: string): Promise<Appointment[]> {
    const items = await db.appointments
      .where('workspaceId')
      .equals(workspaceId)
      .filter((a) => !a.deletedAt)
      .toArray();
    return items.sort((a, b) => {
      const dateCmp = a.date.localeCompare(b.date);
      if (dateCmp !== 0) return dateCmp;
      return a.startTime.localeCompare(b.startTime);
    });
  }

  public async create(appointment: Appointment): Promise<void> {
    await db.appointments.put(appointment);
  }

  public async update(id: string, patch: Partial<Appointment>): Promise<void> {
    await db.appointments.update(id, {
      ...patch,
      updatedAt: Date.now(),
    });
  }

  public async delete(id: string): Promise<void> {
    await db.appointments.update(id, {
      deletedAt: Date.now(),
      updatedAt: Date.now(),
    });
  }
}

export class LocalActivityRepository {
  public async getAll(workspaceId: string, limit = 250): Promise<ActivityLogEntry[]> {
    const entries = await db.activityLogs
      .where('workspaceId')
      .equals(workspaceId)
      .reverse()
      .sortBy('createdAt');
    return entries.slice(0, limit);
  }

  public async add(entry: ActivityLogEntry): Promise<void> {
    await db.activityLogs.put(entry);
  }

  public async clearAll(workspaceId: string): Promise<void> {
    const ids = await db.activityLogs
      .where('workspaceId')
      .equals(workspaceId)
      .primaryKeys();
    await db.activityLogs.bulkDelete(ids);
  }
}
