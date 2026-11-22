import {
  ClinicalEvolutionEntry,
  ClinicProfessional,
  FinancialTransaction,
  LabOrder,
  OdontogramRecord,
  PatientShareLink,
  PatientSharePreview,
  PeriodontogramRecord,
  TreatmentPlan,
} from '../../core/types';
import { db } from './db';

async function getAcceptedSharedPatientIds(workspaceId: string): Promise<string[]> {
  const shares = await db.patientShares
    .where('recipientWorkspaceId')
    .equals(workspaceId)
    .filter((s) => s.status === 'accepted')
    .toArray();
  return Array.from(new Set(shares.map((s) => s.patientId)));
}

export class LocalProfessionalRepository {
  public async getAll(workspaceId: string): Promise<ClinicProfessional[]> {
    return await db.clinicProfessionals
      .where('workspaceId')
      .equals(workspaceId)
      .filter((p) => !p.deletedAt)
      .sortBy('createdAt');
  }

  public async create(professional: ClinicProfessional): Promise<void> {
    await db.clinicProfessionals.put(professional);
  }

  public async update(id: string, patch: Partial<ClinicProfessional>): Promise<void> {
    await db.clinicProfessionals.update(id, { ...patch, updatedAt: Date.now() });
  }

  public async delete(id: string): Promise<void> {
    await db.clinicProfessionals.update(id, { deletedAt: Date.now(), updatedAt: Date.now() });
  }
}

export class LocalEvolutionRepository {
  public async getAll(workspaceId: string): Promise<ClinicalEvolutionEntry[]> {
    const own = await db.clinicalEvolutions
      .where('workspaceId')
      .equals(workspaceId)
      .filter((e) => !e.deletedAt)
      .toArray();
    const sharedIds = await getAcceptedSharedPatientIds(workspaceId);
    if (sharedIds.length === 0) {
      return own.sort((a, b) => b.createdAt - a.createdAt);
    }
    const shared = await db.clinicalEvolutions
      .where('patientId')
      .anyOf(sharedIds)
      .filter((e) => !e.deletedAt)
      .toArray();
    const merged = new Map<string, ClinicalEvolutionEntry>();
    own.forEach((e) => merged.set(e.id, e));
    shared.forEach((e) => merged.set(e.id, e));
    return Array.from(merged.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  public async create(entry: ClinicalEvolutionEntry): Promise<void> {
    await db.clinicalEvolutions.put(entry);
  }

  public async update(id: string, patch: Partial<ClinicalEvolutionEntry>): Promise<void> {
    await db.clinicalEvolutions.update(id, { ...patch, updatedAt: Date.now() });
  }

  public async delete(id: string): Promise<void> {
    await db.clinicalEvolutions.update(id, { deletedAt: Date.now(), updatedAt: Date.now() });
  }
}

export class LocalOdontogramRepository {
  public async getAll(workspaceId: string): Promise<OdontogramRecord[]> {
    const own = await db.odontograms
      .where('workspaceId')
      .equals(workspaceId)
      .filter((o) => !o.deletedAt)
      .toArray();
    const sharedIds = await getAcceptedSharedPatientIds(workspaceId);
    if (sharedIds.length === 0) {
      return own.sort((a, b) => b.createdAt - a.createdAt);
    }
    const shared = await db.odontograms
      .where('patientId')
      .anyOf(sharedIds)
      .filter((o) => !o.deletedAt)
      .toArray();
    const merged = new Map<string, OdontogramRecord>();
    own.forEach((o) => merged.set(o.id, o));
    shared.forEach((o) => merged.set(o.id, o));
    return Array.from(merged.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  public async create(record: OdontogramRecord): Promise<void> {
    await db.odontograms.put(record);
  }

  public async update(id: string, patch: Partial<OdontogramRecord>): Promise<void> {
    await db.odontograms.update(id, { ...patch, updatedAt: Date.now() });
  }

  public async delete(id: string): Promise<void> {
    await db.odontograms.update(id, { deletedAt: Date.now(), updatedAt: Date.now() });
  }
}

export class LocalPeriodontogramRepository {
  public async getAll(workspaceId: string): Promise<PeriodontogramRecord[]> {
    const own = await db.periodontograms
      .where('workspaceId')
      .equals(workspaceId)
      .filter((p) => !p.deletedAt)
      .toArray();
    const sharedIds = await getAcceptedSharedPatientIds(workspaceId);
    if (sharedIds.length === 0) {
      return own.sort((a, b) => b.createdAt - a.createdAt);
    }
    const shared = await db.periodontograms
      .where('patientId')
      .anyOf(sharedIds)
      .filter((p) => !p.deletedAt)
      .toArray();
    const merged = new Map<string, PeriodontogramRecord>();
    own.forEach((p) => merged.set(p.id, p));
    shared.forEach((p) => merged.set(p.id, p));
    return Array.from(merged.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  public async create(record: PeriodontogramRecord): Promise<void> {
    await db.periodontograms.put(record);
  }

  public async update(id: string, patch: Partial<PeriodontogramRecord>): Promise<void> {
    await db.periodontograms.update(id, { ...patch, updatedAt: Date.now() });
  }

  public async delete(id: string): Promise<void> {
    await db.periodontograms.update(id, { deletedAt: Date.now(), updatedAt: Date.now() });
  }
}

export class LocalTreatmentPlanRepository {
  public async getAll(workspaceId: string): Promise<TreatmentPlan[]> {
    const rows = await db.treatmentPlans
      .where('workspaceId')
      .equals(workspaceId)
      .filter((t) => !t.deletedAt)
      .toArray();
    return rows.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  public async create(plan: TreatmentPlan): Promise<void> {
    await db.treatmentPlans.put(plan);
  }

  public async update(id: string, patch: Partial<TreatmentPlan>): Promise<void> {
    await db.treatmentPlans.update(id, { ...patch, updatedAt: Date.now() });
  }

  public async delete(id: string): Promise<void> {
    await db.treatmentPlans.update(id, { deletedAt: Date.now(), updatedAt: Date.now() });
  }
}

export class LocalFinancialTransactionRepository {
  public async getAll(workspaceId: string): Promise<FinancialTransaction[]> {
    const rows = await db.financialTransactions
      .where('workspaceId')
      .equals(workspaceId)
      .filter((tx) => !tx.deletedAt)
      .toArray();
    return rows.sort((a, b) => {
      const dateCmp = b.date.localeCompare(a.date);
      if (dateCmp !== 0) return dateCmp;
      return b.createdAt - a.createdAt;
    });
  }

  public async create(tx: FinancialTransaction): Promise<void> {
    await db.financialTransactions.put(tx);
  }

  public async update(id: string, patch: Partial<FinancialTransaction>): Promise<void> {
    await db.financialTransactions.update(id, { ...patch, updatedAt: Date.now() });
  }

  public async delete(id: string): Promise<void> {
    await db.financialTransactions.update(id, { deletedAt: Date.now(), updatedAt: Date.now() });
  }
}

export class LocalLabOrderRepository {
  public async getAll(workspaceId: string): Promise<LabOrder[]> {
    const rows = await db.labOrders
      .where('workspaceId')
      .equals(workspaceId)
      .filter((o) => !o.deletedAt)
      .toArray();
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  }

  public async create(order: LabOrder): Promise<void> {
    await db.labOrders.put(order);
  }

  public async update(id: string, patch: Partial<LabOrder>): Promise<void> {
    await db.labOrders.update(id, { ...patch, updatedAt: Date.now() });
  }

  public async delete(id: string): Promise<void> {
    await db.labOrders.update(id, { deletedAt: Date.now(), updatedAt: Date.now() });
  }
}

export class LocalPatientShareRepository {
  public async getAllForWorkspace(workspaceId: string): Promise<PatientShareLink[]> {
    const asOwner = await db.patientShares
      .where('ownerWorkspaceId')
      .equals(workspaceId)
      .toArray();
    const asRecipient = await db.patientShares
      .where('recipientWorkspaceId')
      .equals(workspaceId)
      .filter((s) => s.status === 'accepted')
      .toArray();
    const merged = new Map<string, PatientShareLink>();
    asOwner.forEach((s) => merged.set(s.id, s));
    asRecipient.forEach((s) => merged.set(s.id, s));
    return Array.from(merged.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  public async create(share: PatientShareLink): Promise<void> {
    await db.patientShares.put(share);
  }

  public async getPreviewByToken(
    token: string,
    callerWorkspaceId?: string
  ): Promise<PatientSharePreview | null> {
    const row = await db.patientShares.where('inviteToken').equals(token).first();
    if (!row) return null;
    return {
      id: row.id,
      ownerName: row.ownerName,
      ownerSpecialty: row.ownerSpecialty,
      ownerLicense: row.ownerLicense,
      patientId: row.patientId,
      patientNameSnapshot: row.patientNameSnapshot,
      referralNote: row.referralNote,
      status: row.status,
      createdAt: row.createdAt,
      isOwnShare: Boolean(callerWorkspaceId && row.ownerWorkspaceId === callerWorkspaceId),
    };
  }

  public async acceptShare(input: {
    token: string;
    recipientWorkspaceId: string;
    recipientUserId?: string;
    recipientName: string;
    recipientSpecialty?: string;
    recipientLicense?: string;
  }): Promise<{ id: string; patientId: string; ownerWorkspaceId: string }> {
    const row = await db.patientShares.where('inviteToken').equals(input.token).first();
    if (!row) {
      throw new Error('El enlace de derivación no existe.');
    }
    if (row.status !== 'pending') {
      throw new Error('Este enlace de un solo uso ya fue utilizado o revocado.');
    }
    if (row.ownerWorkspaceId === input.recipientWorkspaceId) {
      throw new Error('No podés vincular una ficha con tu propio consultorio.');
    }
    const now = Date.now();
    await db.patientShares.update(row.id, {
      status: 'accepted',
      recipientWorkspaceId: input.recipientWorkspaceId,
      recipientUserId: input.recipientUserId,
      recipientName: input.recipientName.trim() || 'Colega',
      recipientSpecialty: input.recipientSpecialty?.trim() || undefined,
      recipientLicense: input.recipientLicense?.trim() || undefined,
      acceptedAt: now,
      updatedAt: now,
    });
    return {
      id: row.id,
      patientId: row.patientId,
      ownerWorkspaceId: row.ownerWorkspaceId,
    };
  }

  public async unlinkShare(shareId: string): Promise<void> {
    const now = Date.now();
    await db.patientShares.update(shareId, {
      status: 'revoked',
      revokedAt: now,
      updatedAt: now,
    });
  }
}
