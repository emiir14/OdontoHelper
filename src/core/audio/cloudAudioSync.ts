import { AppSettings, SubscriptionPlanTier } from '../types';

/**
 * Premium Cloud Audio Storage contract (Plan Extra / Mega — future R2 integration).
 * - Plan Profesional ('base') & 7-day trial ('trial'): NEVER compress or upload audio;
 *   16 kHz local PCM + local Whisper only.
 * - Advanced plans ('extra', 'mega'): When R2 presign backend is connected, browser records
 *   a parallel Opus/AAC compressed stream (~24 kbps = ~10.8 MB/hour) within a 20 GB
 *   (~1,800 hours) reasonable-use clinic quota.
 * - Raw audio NEVER leaves the device unless BOTH:
 *   1. The workspace has an active eligible entitlement ('extra' | 'mega' / 'premium_audio'), AND
 *   2. A concrete cloud storage adapter has been configured and injected.
 */

export const CLOUD_AUDIO_FAIR_USE_BYTES = 20 * 1024 * 1024 * 1024; // 20 GB (~1,800 h @ 24 kbps)
export const CLOUD_AUDIO_TARGET_BITRATE_BPS = 24_000;

export type CloudAudioPlanTier = 'free' | 'premium_audio';
export type CloudAudioProviderKind = 'unconfigured' | 'future_cloud' | 'cloudflare_r2';
export type CloudAudioCompressedCodec = 'opus_webm' | 'aac_mp4';

export interface CloudAudioCompressionSpec {
  codec: CloudAudioCompressedCodec;
  mimeType: string;
  audioBitsPerSecond: number;
  fileExtension: 'webm' | 'm4a';
}

export function isPlanEligibleForCloudAudio(planTier?: SubscriptionPlanTier | null): boolean {
  return planTier === 'extra' || planTier === 'mega';
}

export function shouldCompressAudioForPlan(planTier?: SubscriptionPlanTier | null): boolean {
  return isPlanEligibleForCloudAudio(planTier);
}

export function resolvePreferredCompressedAudioSpec(): CloudAudioCompressionSpec | null {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return null;
  }
  const candidates: CloudAudioCompressionSpec[] = [
    {
      codec: 'opus_webm',
      mimeType: 'audio/webm;codecs=opus',
      audioBitsPerSecond: CLOUD_AUDIO_TARGET_BITRATE_BPS,
      fileExtension: 'webm',
    },
    {
      codec: 'opus_webm',
      mimeType: 'audio/webm',
      audioBitsPerSecond: CLOUD_AUDIO_TARGET_BITRATE_BPS,
      fileExtension: 'webm',
    },
    {
      codec: 'aac_mp4',
      mimeType: 'audio/mp4',
      audioBitsPerSecond: CLOUD_AUDIO_TARGET_BITRATE_BPS,
      fileExtension: 'm4a',
    },
  ];
  return candidates.find((c) => MediaRecorder.isTypeSupported(c.mimeType)) ?? null;
}

export interface CloudAudioCapability {
  tier: CloudAudioPlanTier;
  providerKind: CloudAudioProviderKind;
  cloudProviderConfigured: boolean;
  canUpload: boolean;
  autoSyncEnabled: boolean;
  blockedReason: string | null;
}

export interface UploadedCloudAudioReceipt {
  remoteObjectKey: string;
  uploadedAt: number;
  bytes: number;
}

export interface ICloudAudioStorageAdapter {
  readonly providerKind: CloudAudioProviderKind;
  readonly isConfigured: boolean;
  uploadWavAudio(input: {
    workspaceId: string;
    sessionId: string;
    fileName: string;
    wavBlob: Blob;
  }): Promise<UploadedCloudAudioReceipt>;
  getSignedPlaybackUrl?(remoteObjectKey: string): Promise<string | null>;
  deleteRemoteAudio?(remoteObjectKey: string): Promise<void>;
}

export class CloudAudioUploadBlockedError extends Error {
  public readonly code: 'TIER_FREE' | 'CLOUD_NOT_CONFIGURED';

  constructor(code: 'TIER_FREE' | 'CLOUD_NOT_CONFIGURED', message: string) {
    super(message);
    this.name = 'CloudAudioUploadBlockedError';
    this.code = code;
  }
}

export class NoopCloudAudioStorageAdapter implements ICloudAudioStorageAdapter {
  public readonly providerKind: CloudAudioProviderKind = 'unconfigured';
  public readonly isConfigured = false;

  public async uploadWavAudio(): Promise<UploadedCloudAudioReceipt> {
    throw new CloudAudioUploadBlockedError(
      'CLOUD_NOT_CONFIGURED',
      'La subida de audios a la nube requiere el paquete Premium y un proveedor de almacenamiento configurado.'
    );
  }

  public async getSignedPlaybackUrl(): Promise<string | null> {
    return null;
  }

  public async deleteRemoteAudio(): Promise<void> {
    return;
  }
}

export const defaultCloudAudioAdapter: ICloudAudioStorageAdapter = new NoopCloudAudioStorageAdapter();

export function resolveCloudAudioCapability(
  settings?: Pick<AppSettings, 'audioCloudTier' | 'audioCloudAutoSync'> | null,
  adapter: ICloudAudioStorageAdapter = defaultCloudAudioAdapter
): CloudAudioCapability {
  const tier: CloudAudioPlanTier =
    settings?.audioCloudTier === 'premium_audio' ? 'premium_audio' : 'free';
  const cloudProviderConfigured = Boolean(adapter.isConfigured);
  const autoSyncEnabled = tier === 'premium_audio' && Boolean(settings?.audioCloudAutoSync);

  if (tier !== 'premium_audio') {
    return {
      tier,
      providerKind: adapter.providerKind,
      cloudProviderConfigured,
      canUpload: false,
      autoSyncEnabled: false,
      blockedReason:
        'Plan gratuito: los audios permanecen exclusivamente en el dispositivo donde fueron grabados.',
    };
  }

  if (!cloudProviderConfigured) {
    return {
      tier,
      providerKind: adapter.providerKind,
      cloudProviderConfigured: false,
      canUpload: false,
      autoSyncEnabled: false,
      blockedReason:
        'Paquete Premium preparado, pero la nube de almacenamiento aún no está definida ni configurada.',
    };
  }

  return {
    tier,
    providerKind: adapter.providerKind,
    cloudProviderConfigured: true,
    canUpload: true,
    autoSyncEnabled,
    blockedReason: null,
  };
}

export async function guardedUploadSessionAudio(
  input: {
    workspaceId: string;
    sessionId: string;
    fileName: string;
    wavBlob: Blob;
    settings?: Pick<AppSettings, 'audioCloudTier' | 'audioCloudAutoSync'> | null;
  },
  adapter: ICloudAudioStorageAdapter = defaultCloudAudioAdapter
): Promise<UploadedCloudAudioReceipt> {
  const capability = resolveCloudAudioCapability(input.settings, adapter);
  if (capability.tier !== 'premium_audio') {
    throw new CloudAudioUploadBlockedError(
      'TIER_FREE',
      capability.blockedReason || 'Requiere paquete Premium de respaldo de audio.'
    );
  }
  if (!capability.cloudProviderConfigured || !capability.canUpload) {
    throw new CloudAudioUploadBlockedError(
      'CLOUD_NOT_CONFIGURED',
      capability.blockedReason || 'El almacenamiento en nube aún no está configurado.'
    );
  }
  return await adapter.uploadWavAudio({
    workspaceId: input.workspaceId,
    sessionId: input.sessionId,
    fileName: input.fileName,
    wavBlob: input.wavBlob,
  });
}
