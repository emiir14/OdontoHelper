import {
  ClinicalEvolutionEntry,
  ClinicProfessional,
  FinancialTransaction,
  LabOrder,
  OdontogramRecord,
  PatientFileAttachment,
  PeriodontogramRecord,
  TreatmentPlan,
} from '../../core/types';
import { db } from './db';

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
    const rows = await db.clinicalEvolutions
      .where('workspaceId')
      .equals(workspaceId)
      .filter((e) => !e.deletedAt)
      .toArray();
    return rows.sort((a, b) => b.createdAt - a.createdAt);
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
    const rows = await db.odontograms
      .where('workspaceId')
      .equals(workspaceId)
      .filter((o) => !o.deletedAt)
      .toArray();
    return rows.sort((a, b) => b.createdAt - a.createdAt);
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
    const rows = await db.periodontograms
      .where('workspaceId')
      .equals(workspaceId)
      .filter((p) => !p.deletedAt)
      .toArray();
    return rows.sort((a, b) => b.createdAt - a.createdAt);
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

/**
 * X-rays, intraoral photos and PDFs stay local in browser IndexedDB (like audio PCM)
 * for zero-latency preview without requiring external storage buckets.
 */
export class LocalPatientFileStore {
  public async getAll(workspaceId: string): Promise<PatientFileAttachment[]> {
    const rows = await db.patientFiles
      .where('workspaceId')
      .equals(workspaceId)
      .toArray();
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  }

  public async add(file: PatientFileAttachment): Promise<void> {
    await db.patientFiles.put(file);
  }

  public async delete(id: string): Promise<void> {
    await db.patientFiles.delete(id);
  }
}
