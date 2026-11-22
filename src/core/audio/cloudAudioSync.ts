import { AppSettings } from '../types';

/**
 * Premium Cloud Audio Storage contract.
 * By default, OdontoHelper operates on the 'free' tier and does NOT have any cloud
 * audio provider configured. Raw audio NEVER leaves the device unless BOTH:
 *   1. The workspace has an active 'premium_audio' entitlement, AND
 *   2. A concrete cloud storage adapter has been configured and injected.
 */

export type CloudAudioPlanTier = 'free' | 'premium_audio';
export type CloudAudioProviderKind = 'unconfigured' | 'future_cloud';

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
