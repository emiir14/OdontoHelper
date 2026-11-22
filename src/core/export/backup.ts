import { sharedGlossaryRepo } from '../../adapters/repositoryRegistry';
import { GlossaryEntry } from '../types';

export interface EscribaGlossaryBackupPayload {
  schema: 'escriba_glossary_v1';
  exportedAt: string;
  entries: Array<{ incorrect: string; correct: string }>;
}

export function exportGlossaryJson(entries: GlossaryEntry[]): string {
  const payload: EscribaGlossaryBackupPayload = {
    schema: 'escriba_glossary_v1',
    exportedAt: new Date().toISOString(),
    entries: entries.map((e) => ({
      incorrect: e.incorrect,
      correct: e.correct,
    })),
  };
  return JSON.stringify(payload, null, 2);
}

export async function importGlossaryJson(
  jsonText: string,
  workspaceId: string
): Promise<number> {
  let parsed: EscribaGlossaryBackupPayload;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error('Archivo de glosario inválido.');
  }

  if (!parsed || parsed.schema !== 'escriba_glossary_v1' || !Array.isArray(parsed.entries)) {
    throw new Error('El archivo no corresponde a un glosario exportado de OdontoHelper.');
  }

  const existing = await sharedGlossaryRepo.getAll(workspaceId);
  const existingKeys = new Set(existing.map((e) => e.incorrect.trim().toLowerCase()));
  let added = 0;

  for (const item of parsed.entries) {
    const inc = item.incorrect?.trim();
    const cor = item.correct?.trim();
    if (!inc || !cor) continue;
    const key = inc.toLowerCase();
    if (!existingKeys.has(key)) {
      await sharedGlossaryRepo.add({
        id: `glossary_${Date.now()}_${added}_${Math.random().toString(36).slice(2, 6)}`,
        workspaceId,
        incorrect: inc,
        correct: cor,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      existingKeys.add(key);
      added++;
    }
  }

  return added;
}
