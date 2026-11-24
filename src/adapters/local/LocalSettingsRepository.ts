import { ISettingsRepository } from '../../core/interfaces';
import {
  generateCalendarFeedToken,
  isValidCalendarFeedToken,
} from '../../core/clinic/calendarFeed';
import { DEFAULT_CURRENCY } from '../../core/clinic/clinicHelpers';
import { getDefaultModelTier, isTauriDesktop } from '../../core/runtime/platform';
import { AppSettings } from '../../core/types';
import { db } from './db';

const EXE_MAX_DEFAULT_APPLIED_KEY = 'escriba_exe_max_default_v1';

export const createDefaultSettings = (workspaceId: string): AppSettings => ({
  id: `settings_${workspaceId}`,
  workspaceId,
  modelTier: getDefaultModelTier(), // 'max' on Windows .exe, 'balanced' on browser/mobile
  noiseSuppression: false, // Turned off by default as requested in prompt to preserve voice frequencies
  selectedAudioDeviceId: undefined,
  requireConsent: true,
  autoTranscribeOnStop: false,
  progressiveTranscription: true,
  transcriptionMode: 'dental',
  theme: 'light',
  currency: DEFAULT_CURRENCY,
  showCurrencyCode: false,
  calendarFeedToken: generateCalendarFeedToken(),
  updatedAt: Date.now(),
});

export class LocalSettingsRepository implements ISettingsRepository {
  public async get(workspaceId: string): Promise<AppSettings> {
    const desktop = isTauriDesktop();
    const existing = await db.settings.where('workspaceId').equals(workspaceId).first();
    if (existing) {
      const hasValidToken = isValidCalendarFeedToken(existing.calendarFeedToken);
      const calendarFeedToken = hasValidToken
        ? existing.calendarFeedToken
        : generateCalendarFeedToken();
      if (!hasValidToken) {
        await db.settings.update(existing.id, { calendarFeedToken });
      }
      const normalized: AppSettings = {
        ...existing,
        currency: existing.currency || DEFAULT_CURRENCY,
        showCurrencyCode: existing.showCurrencyCode ?? false,
        calendarFeedToken,
      };
      if (desktop && typeof localStorage !== 'undefined') {
        const applied = localStorage.getItem(EXE_MAX_DEFAULT_APPLIED_KEY);
        if (applied !== '1') {
          localStorage.setItem(EXE_MAX_DEFAULT_APPLIED_KEY, '1');
          if (
            normalized.modelTier === 'balanced' ||
            normalized.modelTier === 'auto' ||
            normalized.modelTier === 'fast'
          ) {
            const upgraded: AppSettings = {
              ...normalized,
              modelTier: 'max',
              updatedAt: Date.now(),
            };
            await db.settings.update(existing.id, {
              modelTier: 'max',
              updatedAt: upgraded.updatedAt,
            });
            return upgraded;
          }
        }
      }
      return normalized;
    }
    const defaults = createDefaultSettings(workspaceId);
    if (desktop && typeof localStorage !== 'undefined') {
      localStorage.setItem(EXE_MAX_DEFAULT_APPLIED_KEY, '1');
    }
    await db.settings.put(defaults);
    return defaults;
  }

  public async update(workspaceId: string, patch: Partial<AppSettings>): Promise<void> {
    const current = await this.get(workspaceId);
    if (isTauriDesktop() && patch.modelTier && typeof localStorage !== 'undefined') {
      localStorage.setItem(EXE_MAX_DEFAULT_APPLIED_KEY, '1');
    }
    await db.settings.update(current.id, {
      ...patch,
      updatedAt: Date.now(),
    });
  }
}
