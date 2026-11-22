import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetSupabaseClient,
  mockIsSupabaseConfigured,
} = vi.hoisted(() => ({
  mockGetSupabaseClient: vi.fn(),
  mockIsSupabaseConfigured: vi.fn(() => false),
}));

vi.mock('../src/adapters/supabase/supabaseClient', () => ({
  getSupabaseClient: mockGetSupabaseClient,
  isSupabaseConfigured: mockIsSupabaseConfigured,
}));

import { db } from '../src/adapters/local/db';
import { LocalAudioStore } from '../src/adapters/local/LocalAudioStore';
import {
  CloudRequiredPatientFileError,
  sharedAudioStore,
  sharedPatientFileStore,
} from '../src/adapters/repositoryRegistry';
import { SupabasePatientFileStore } from '../src/adapters/supabase/SupabaseRepositories';
import {
  CloudAudioUploadBlockedError,
  ICloudAudioStorageAdapter,
  NoopCloudAudioStorageAdapter,
  guardedUploadSessionAudio,
  resolveCloudAudioCapability,
} from '../src/core/audio/cloudAudioSync';
import {
  FORBIDDEN_PII_QUERY_KEYS,
  buildAppUrl,
  parseAppLocation,
  sanitizeSortParam,
  stripSensitiveQueryParams,
} from '../src/core/routing/appRoutes';
import {
  buildRecordingAudioFileName,
  detectDefaultDeviceLabel,
  getOrCreateLocalDeviceInfo,
  setCustomLocalDeviceLabel,
} from '../src/core/runtime/deviceIdentity';
import { AudioChunk, PatientFileAttachment } from '../src/core/types';
import {
  clearLocalDraft,
  hasLocalDraft,
  loadLocalDraft,
  saveLocalDraft,
} from '../src/core/utils/localDrafts';
import { useAppStore } from '../src/store/useAppStore';

function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => (map.has(key) ? map.get(key)! : null),
    key: (idx: number) => Array.from(map.keys())[idx] ?? null,
    removeItem: (key: string) => {
      map.delete(key);
    },
    setItem: (key: string, value: string) => {
      map.set(key, String(value));
    },
  };
}

describe('Patient Files Cloud Sync vs Strictly Local Audio Architecture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps sharedAudioStore strictly local while routing sharedPatientFileStore through pickRepo', () => {
    expect(sharedAudioStore).toBeInstanceOf(LocalAudioStore);
    expect(typeof sharedPatientFileStore.getAll).toBe('function');
    expect(typeof sharedPatientFileStore.add).toBe('function');
    expect(typeof sharedPatientFileStore.delete).toBe('function');
  });

  it('syncs patient radiographs and files to Supabase when table exists', async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    const orderMock = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'pf_1',
          workspace_id: 'ws_1',
          patient_id: 'pat_1',
          name: 'rx_periapical.png',
          category: 'radiografia',
          mime_type: 'image/png',
          size_bytes: 2048,
          data_url: 'data:image/png;base64,AAA=',
          notes: 'Pieza 3.6',
          captured_at: '2026-11-19',
          created_at: 1700000000000,
        },
      ],
      error: null,
    });
    const eqSelectMock = vi.fn(() => ({ order: orderMock }));
    const selectMock = vi.fn(() => ({ eq: eqSelectMock, order: orderMock }));
    const eqDeleteMock = vi.fn().mockResolvedValue({ error: null });
    const deleteMock = vi.fn(() => ({ eq: eqDeleteMock }));

    mockGetSupabaseClient.mockReturnValue({
      from: vi.fn((table: string) => {
        expect(table).toBe('patient_files');
        return {
          select: selectMock,
          upsert: upsertMock,
          delete: deleteMock,
        };
      }),
    });

    const store = new SupabasePatientFileStore();
    const files = await store.getAll('ws_1');
    expect(files).toHaveLength(1);
    expect(files[0]).toEqual({
      id: 'pf_1',
      workspaceId: 'ws_1',
      patientId: 'pat_1',
      name: 'rx_periapical.png',
      category: 'radiografia',
      mimeType: 'image/png',
      sizeBytes: 2048,
      dataUrl: 'data:image/png;base64,AAA=',
      notes: 'Pieza 3.6',
      capturedAt: '2026-11-19',
      createdAt: 1700000000000,
    });

    const newFile: PatientFileAttachment = {
      id: 'pf_2',
      workspaceId: 'ws_1',
      patientId: 'pat_1',
      name: 'panoramica.jpg',
      category: 'radiografia',
      mimeType: 'image/jpeg',
      sizeBytes: 4096,
      dataUrl: 'data:image/jpeg;base64,BBB=',
      capturedAt: '2026-11-19',
      createdAt: 1700000001000,
    };
    await store.add(newFile);
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'pf_2',
        workspace_id: 'ws_1',
        patient_id: 'pat_1',
        name: 'panoramica.jpg',
      })
    );

    await store.delete('pf_2');
    expect(eqDeleteMock).toHaveBeenCalledWith('id', 'pf_2');
  });

  it('throws explicitly without IndexedDB fallback when Supabase patient_files table is missing', async () => {
    const missingError = {
      message: "Could not find the table 'public.patient_files' in the schema cache",
    };

    mockGetSupabaseClient.mockReturnValue({
      from: vi.fn(() => ({
        select: () => ({
          order: vi.fn().mockResolvedValue({ data: null, error: missingError }),
          eq: () => ({
            order: vi.fn().mockResolvedValue({ data: null, error: missingError }),
          }),
        }),
        upsert: vi.fn().mockResolvedValue({ error: missingError }),
        delete: () => ({
          eq: vi.fn().mockResolvedValue({ error: missingError }),
        }),
      })),
    });

    const store = new SupabasePatientFileStore();
    await expect(store.getAll('ws_1')).rejects.toThrow("La tabla 'patient_files' no existe en Supabase");

    const attachment: PatientFileAttachment = {
      id: 'pf_cloud_only',
      workspaceId: 'ws_1',
      patientId: 'pat_1',
      name: 'rx_36.png',
      category: 'radiografia',
      mimeType: 'image/png',
      sizeBytes: 512,
      dataUrl: 'data:image/png;base64,CCC=',
      capturedAt: '2026-11-19',
      createdAt: 1700000002000,
    };
    await expect(store.add(attachment)).rejects.toThrow("La tabla 'patient_files' no existe en Supabase");
    await expect(store.delete('pf_cloud_only')).rejects.toThrow("La tabla 'patient_files' no existe en Supabase");
  });

  it('rejects clinical file operations via CloudRequiredPatientFileError when no cloud DB is active and surfaces error in store', async () => {
    mockIsSupabaseConfigured.mockReturnValue(false);
    vi.stubGlobal('localStorage', createMemoryStorage());

    await expect(sharedPatientFileStore.getAll('ws_1')).rejects.toBeInstanceOf(
      CloudRequiredPatientFileError
    );
    await expect(
      sharedPatientFileStore.add({
        id: 'pf_blocked',
        workspaceId: 'ws_1',
        patientId: 'pat_1',
        name: 'rx.png',
        category: 'radiografia',
        mimeType: 'image/png',
        sizeBytes: 128,
        dataUrl: 'data:image/png;base64,DDD=',
        capturedAt: '2026-11-19',
        createdAt: 1700000003000,
      })
    ).rejects.toBeInstanceOf(CloudRequiredPatientFileError);
    await expect(sharedPatientFileStore.delete('pf_blocked')).rejects.toBeInstanceOf(
      CloudRequiredPatientFileError
    );

    useAppStore.setState({
      workspace: {
        id: 'ws_1',
        name: 'Clínica Demo',
        slug: 'clinica-demo',
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
      },
      patientFiles: [],
      patientFilesCloudError: null,
      toastMessage: null,
    });

    const added = await useAppStore.getState().addPatientFile({
      patientId: 'pat_1',
      name: 'panoramica.png',
      category: 'radiografia',
      mimeType: 'image/png',
      sizeBytes: 256,
      dataUrl: 'data:image/png;base64,EEE=',
    });
    expect(added).toBeNull();
    expect(useAppStore.getState().patientFiles).toEqual([]);
    expect(useAppStore.getState().patientFilesCloudError).toContain('exclusivamente en la nube');
    expect(useAppStore.getState().toastMessage?.type).toBe('warning');

    vi.unstubAllGlobals();
  });

  it('uploads radiographs to Supabase Storage, hydrates signed URLs in getByPatientId, and cleans up storage on delete', async () => {
    const uploadMock = vi.fn().mockResolvedValue({ error: null });
    const createSignedUrlMock = vi.fn().mockResolvedValue({
      data: { signedUrl: 'https://proj.supabase.co/storage/v1/object/sign/patient-files/ws_1/pat_1/pf_st1.png?token=abc' },
    });
    const createSignedUrlsMock = vi.fn().mockResolvedValue({
      data: [
        {
          path: 'ws_1/pat_1/pf_st1.png',
          signedUrl: 'https://proj.supabase.co/storage/v1/object/sign/patient-files/ws_1/pat_1/pf_st1.png?token=fresh',
        },
      ],
    });
    const removeMock = vi.fn().mockResolvedValue({ error: null });

    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    const orderMock = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'pf_st1',
          workspace_id: 'ws_1',
          patient_id: 'pat_1',
          name: 'rx_36.png',
          category: 'radiografia',
          mime_type: 'image/png',
          size_bytes: 12,
          data_url: '',
          storage_path: 'ws_1/pat_1/pf_st1.png',
          notes: 'Endodoncia',
          captured_at: '2026-11-20',
          created_at: 1700000005000,
        },
      ],
      error: null,
    });
    const eqPatientMock = vi.fn(() => ({ order: orderMock }));
    const maybeSingleMock = vi.fn().mockResolvedValue({
      data: { storage_path: 'ws_1/pat_1/pf_st1.png' },
      error: null,
    });
    const eqIdSelectMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }));
    const eqIdDeleteMock = vi.fn().mockResolvedValue({ error: null });

    mockGetSupabaseClient.mockReturnValue({
      from: vi.fn((table: string) => {
        expect(table).toBe('patient_files');
        return {
          select: (cols: string) =>
            cols === 'storage_path' ? { eq: eqIdSelectMock } : { eq: eqPatientMock, order: orderMock },
          upsert: upsertMock,
          delete: () => ({ eq: eqIdDeleteMock }),
        };
      }),
      storage: {
        from: vi.fn((bucket: string) => {
          expect(bucket).toBe('patient-files');
          return {
            upload: uploadMock,
            createSignedUrl: createSignedUrlMock,
            createSignedUrls: createSignedUrlsMock,
            remove: removeMock,
          };
        }),
      },
    });

    const store = new SupabasePatientFileStore();
    const attachment: PatientFileAttachment = {
      id: 'pf_st1',
      workspaceId: 'ws_1',
      patientId: 'pat_1',
      name: 'rx_36.png',
      category: 'radiografia',
      mimeType: 'image/png',
      sizeBytes: 3,
      dataUrl: 'data:image/png;base64,AAAA',
      capturedAt: '2026-11-20',
      createdAt: 1700000005000,
    };

    await store.add(attachment);
    expect(uploadMock).toHaveBeenCalledWith(
      'ws_1/pat_1/pf_st1.png',
      expect.any(Blob),
      expect.objectContaining({ contentType: 'image/png', upsert: true })
    );
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'pf_st1',
        storage_path: 'ws_1/pat_1/pf_st1.png',
        data_url: '',
      })
    );
    expect(attachment.dataUrl).toContain('token=abc');

    const byPatient = await store.getByPatientId('ws_1', 'pat_1');
    expect(eqPatientMock).toHaveBeenCalledWith('patient_id', 'pat_1');
    expect(createSignedUrlsMock).toHaveBeenCalledWith(['ws_1/pat_1/pf_st1.png'], 3600);
    expect(byPatient[0].dataUrl).toContain('token=fresh');

    await store.delete('pf_st1');
    expect(removeMock).toHaveBeenCalledWith(['ws_1/pat_1/pf_st1.png']);
    expect(eqIdDeleteMock).toHaveBeenCalledWith('id', 'pf_st1');
  });

  it('loads patientFiles lazily per patient on selectPatient and updates EMR mutations incrementally without full loadEmrData reload', async () => {
    const mod = await import('../src/store/useAppStore');
    const storeState = mod.useAppStore.getState();

    const fileGetAllSpy = vi.spyOn(mod.patientFileStore, 'getAll').mockResolvedValue([]);
    const fileGetByPatSpy = vi.spyOn(mod.patientFileStore, 'getByPatientId').mockResolvedValue([
      {
        id: 'pf_lazy_1',
        workspaceId: 'ws_lazy',
        patientId: 'pat_lazy',
        name: 'rx.png',
        category: 'radiografia',
        mimeType: 'image/png',
        sizeBytes: 100,
        dataUrl: 'https://example.com/rx.png',
        capturedAt: '2026-11-20',
        createdAt: 1700000000000,
      },
    ]);

    vi.spyOn(mod.patientRepo, 'getAll').mockResolvedValue([]);
    vi.spyOn(mod.providerRepo, 'getAll').mockResolvedValue([]);
    vi.spyOn(mod.appointmentRepo, 'getAll').mockResolvedValue([]);
    vi.spyOn(mod.activityRepo, 'getAll').mockResolvedValue([]);
    vi.spyOn(mod.professionalRepo, 'getAll').mockResolvedValue([
      {
        id: 'cprof_1',
        workspaceId: 'ws_lazy',
        fullName: 'Dr. Marcos',
        role: 'owner',
        agendaColor: '#0d9488',
        canViewFinance: true,
        active: true,
        createdAt: 1,
        updatedAt: 1,
      },
    ]);
    vi.spyOn(mod.evolutionRepo, 'getAll').mockResolvedValue([]);
    vi.spyOn(mod.odontogramRepo, 'getAll').mockResolvedValue([]);
    vi.spyOn(mod.periodontogramRepo, 'getAll').mockResolvedValue([]);
    vi.spyOn(mod.treatmentPlanRepo, 'getAll').mockResolvedValue([]);
    vi.spyOn(mod.financialTxRepo, 'getAll').mockResolvedValue([]);
    vi.spyOn(mod.labOrderRepo, 'getAll').mockResolvedValue([]);
    vi.spyOn(mod.patientRepo, 'create').mockResolvedValue(undefined);
    vi.spyOn(mod.activityRepo, 'add').mockResolvedValue(undefined);

    mod.useAppStore.setState({
      workspace: {
        id: 'ws_lazy',
        name: 'Personal',
        slug: 'personal',
        createdAt: 1,
        updatedAt: 1,
      },
      selectedPatientId: null,
      patientFiles: [],
      patients: [],
    });

    await storeState.loadEmrData();
    expect(fileGetAllSpy).not.toHaveBeenCalled();

    mod.useAppStore.getState().selectPatient('pat_lazy');
    await vi.waitFor(() => {
      expect(fileGetByPatSpy).toHaveBeenCalledWith('ws_lazy', 'pat_lazy');
      expect(mod.useAppStore.getState().patientFiles).toHaveLength(1);
    });

    mod.useAppStore.getState().selectPatient(null);
    expect(mod.useAppStore.getState().patientFiles).toEqual([]);

    const loadEmrSpy = vi.spyOn(mod.useAppStore.getState(), 'loadEmrData');
    const created = await mod.useAppStore.getState().createPatient({
      fullName: 'Valentina Gómez',
      dni: '40123456',
    });
    expect(created).not.toBeNull();
    expect(loadEmrSpy).not.toHaveBeenCalled();
    expect(mod.useAppStore.getState().patients.some((p) => p.fullName === 'Valentina Gómez')).toBe(
      true
    );
    expect(mod.useAppStore.getState().patientIndexes.patientsById.has(created!.id)).toBe(true);

    vi.restoreAllMocks();
  });
});

describe('Premium Cloud Audio Guard & Future Adapter Contract', () => {
  it('strictly blocks cloud audio upload on free tier even if an adapter is provided', async () => {
    const mockConfiguredAdapter: ICloudAudioStorageAdapter = {
      providerKind: 'future_cloud',
      isConfigured: true,
      uploadWavAudio: vi.fn(),
    };

    const cap = resolveCloudAudioCapability(
      { audioCloudTier: 'free', audioCloudAutoSync: true },
      mockConfiguredAdapter
    );
    expect(cap.canUpload).toBe(false);
    expect(cap.autoSyncEnabled).toBe(false);
    expect(cap.blockedReason).toContain('Plan gratuito');

    await expect(
      guardedUploadSessionAudio(
        {
          workspaceId: 'ws_1',
          sessionId: 'sess_1',
          fileName: 'consulta.wav',
          wavBlob: new Blob(['1234'], { type: 'audio/wav' }),
          settings: { audioCloudTier: 'free', audioCloudAutoSync: true },
        },
        mockConfiguredAdapter
      )
    ).rejects.toMatchObject({
      name: 'CloudAudioUploadBlockedError',
      code: 'TIER_FREE',
    });

    expect(mockConfiguredAdapter.uploadWavAudio).not.toHaveBeenCalled();
  });

  it('blocks upload when tier is premium_audio but cloud storage provider is unconfigured', async () => {
    const noopAdapter = new NoopCloudAudioStorageAdapter();
    const cap = resolveCloudAudioCapability(
      { audioCloudTier: 'premium_audio', audioCloudAutoSync: true },
      noopAdapter
    );
    expect(cap.tier).toBe('premium_audio');
    expect(cap.cloudProviderConfigured).toBe(false);
    expect(cap.canUpload).toBe(false);

    await expect(
      guardedUploadSessionAudio(
        {
          workspaceId: 'ws_1',
          sessionId: 'sess_1',
          fileName: 'consulta.wav',
          wavBlob: new Blob(['1234'], { type: 'audio/wav' }),
          settings: { audioCloudTier: 'premium_audio', audioCloudAutoSync: true },
        },
        noopAdapter
      )
    ).rejects.toBeInstanceOf(CloudAudioUploadBlockedError);

    await expect(noopAdapter.uploadWavAudio()).rejects.toMatchObject({
      code: 'CLOUD_NOT_CONFIGURED',
    });
  });

  it('allows upload only when both premium_audio entitlement and configured adapter exist', async () => {
    const uploadSpy = vi.fn().mockResolvedValue({
      remoteObjectKey: 'ws_1/sess_1/consulta.wav',
      uploadedAt: 1700000100000,
      bytes: 44,
    });
    const mockConfiguredAdapter: ICloudAudioStorageAdapter = {
      providerKind: 'future_cloud',
      isConfigured: true,
      uploadWavAudio: uploadSpy,
    };

    const wavBlob = new Blob([new Uint8Array(44)], { type: 'audio/wav' });
    const receipt = await guardedUploadSessionAudio(
      {
        workspaceId: 'ws_1',
        sessionId: 'sess_1',
        fileName: 'consulta.wav',
        wavBlob,
        settings: { audioCloudTier: 'premium_audio', audioCloudAutoSync: true },
      },
      mockConfiguredAdapter
    );

    expect(receipt.remoteObjectKey).toBe('ws_1/sess_1/consulta.wav');
    expect(uploadSpy).toHaveBeenCalledWith({
      workspaceId: 'ws_1',
      sessionId: 'sess_1',
      fileName: 'consulta.wav',
      wavBlob,
    });
  });
});

describe('Local Device Identity & Local Audio WAV Export', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('persists deviceId, supports custom device labels, and builds deterministic WAV filenames', () => {
    vi.stubGlobal('window', {});
    const info1 = getOrCreateLocalDeviceInfo();
    expect(info1.deviceId).toMatch(/^dev_/);
    expect(info1.hasCustomLabel).toBe(false);
    expect(info1.deviceLabel).toBe(detectDefaultDeviceLabel());

    const updated = setCustomLocalDeviceLabel('Consultorio 1 · Mac Mini');
    expect(updated.deviceId).toBe(info1.deviceId);
    expect(updated.deviceLabel).toBe('Consultorio 1 · Mac Mini');
    expect(updated.hasCustomLabel).toBe(true);

    const cleared = setCustomLocalDeviceLabel('   ');
    expect(cleared.hasCustomLabel).toBe(false);

    const ts = new Date(2026, 10, 19, 14, 5, 0).getTime();
    expect(buildRecordingAudioFileName('Lucía Fernández', ts)).toBe(
      'audio_lucia_fernandez_2026-11-19_1405.wav'
    );
    expect(buildRecordingAudioFileName('', ts)).toBe('consulta_2026-11-19_1405.wav');
  });

  it('reports local audio availability map and builds a valid RIFF/WAVE PCM blob for direct export', async () => {
    const pcmSamples = new Int16Array([0, 16384, -16384, 32767]);
    const chunk: AudioChunk = {
      id: 'chk_1',
      sessionId: 'sess_local',
      chunkIndex: 0,
      sampleRate: 16000,
      samples: pcmSamples.length,
      startTime: 0,
      endTime: pcmSamples.length / 16000,
      pcmData: pcmSamples.buffer.slice(0),
      createdAt: 1700000000000,
    };

    const whereSpy = vi.spyOn(db, 'audioChunks', 'get').mockReturnValue({
      where: () => ({
        equals: (sessId: string) => ({
          count: async () => (sessId === 'sess_local' ? 1 : 0),
          sortBy: async () => (sessId === 'sess_local' ? [chunk] : []),
        }),
      }),
    } as unknown as typeof db.audioChunks);

    const store = new LocalAudioStore();
    expect(await store.hasAudio('sess_local')).toBe(true);
    expect(await store.hasAudio('sess_other_device')).toBe(false);

    const availability = await store.getAudioAvailabilityMap([
      'sess_local',
      'sess_other_device',
    ]);
    expect(availability).toEqual({
      sess_local: true,
      sess_other_device: false,
    });

    const { blob, durationSec } = await store.createWavBlob('sess_local');
    expect(blob.type).toBe('audio/wav');
    expect(blob.size).toBe(44 + pcmSamples.byteLength);
    expect(durationSec).toBeCloseTo(4 / 16000);

    const buf = await blob.arrayBuffer();
    const view = new DataView(buf);
    const headerTag =
      String.fromCharCode(view.getUint8(0)) +
      String.fromCharCode(view.getUint8(1)) +
      String.fromCharCode(view.getUint8(2)) +
      String.fromCharCode(view.getUint8(3));
    const waveTag =
      String.fromCharCode(view.getUint8(8)) +
      String.fromCharCode(view.getUint8(9)) +
      String.fromCharCode(view.getUint8(10)) +
      String.fromCharCode(view.getUint8(11));

    expect(headerTag).toBe('RIFF');
    expect(waveTag).toBe('WAVE');
    expect(view.getUint32(4, true)).toBe(36 + pcmSamples.byteLength);
    expect(view.getUint16(20, true)).toBe(1); // PCM format
    expect(view.getUint16(22, true)).toBe(1); // Mono
    expect(view.getUint32(24, true)).toBe(16000); // Sample rate
    expect(view.getUint32(40, true)).toBe(pcmSamples.byteLength);

    whereSpy.mockRestore();
  });
});

describe('Local Draft Auto-Save & Unsaved Changes Navigation Guard', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage());
    useAppStore.setState({
      dirtyDraftKeys: {},
      confirmDialog: null,
      toastMessage: null,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('auto-saves, recovers, and clears local drafts safely across refreshes', () => {
    const key = 'patient_form:new';
    expect(hasLocalDraft(key)).toBe(false);

    const ts = saveLocalDraft(key, { fullName: 'Sofía Méndez', allergies: 'Penicilina' });
    expect(typeof ts).toBe('number');
    expect(hasLocalDraft(key)).toBe(true);

    const loaded = loadLocalDraft<{ fullName: string; allergies: string }>(key);
    expect(loaded?.data).toEqual({ fullName: 'Sofía Méndez', allergies: 'Penicilina' });

    clearLocalDraft(key);
    expect(loadLocalDraft(key)).toBeNull();
    expect(hasLocalDraft(key)).toBe(false);

    // Resilience on corrupted JSON
    localStorage.setItem('odontohelper_draft_v1:broken', '{not-json');
    expect(loadLocalDraft('broken')).toBeNull();
  });

  it('tracks dirty drafts and intercepts navigation via guardNavigation confirmation modal', () => {
    const cleanAction = vi.fn();
    useAppStore.getState().guardNavigation(cleanAction);
    expect(cleanAction).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().confirmDialog).toBeNull();

    // Mark two sections as dirty
    useAppStore.getState().setDraftDirty('patient_form:new', 'Nuevo paciente');
    useAppStore.getState().setDraftDirty('detail:note:s1', 'Nota clínica');
    expect(useAppStore.getState().hasUnsavedChanges()).toBe(true);

    const blockedAction = vi.fn();
    useAppStore.getState().guardNavigation(blockedAction);
    expect(blockedAction).not.toHaveBeenCalled();

    const dialog = useAppStore.getState().confirmDialog;
    expect(dialog).not.toBeNull();
    expect(dialog?.title).toBe('Tenés cambios sin guardar');
    expect(dialog?.description).toContain('Nuevo paciente');
    expect(dialog?.description).toContain('Nota clínica');

    // User confirms leaving -> clears dirty keys and executes action
    dialog?.onConfirm();
    expect(blockedAction).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().hasUnsavedChanges()).toBe(false);
  });
});

describe('URL Persistence for Pagination, Sorting, and Non-PII Filters', () => {
  it('round-trips pagina, porPagina, orden, tab, filters, and dates cleanly', () => {
    const url = buildAppUrl({
      authRequired: false,
      currentView: 'finance',
      moduleQuery: {
        tab: 'deudores',
        period: 'month',
        method: 'transferencia',
        prof: 'prof_2',
        from: '2026-11-01',
        to: '2026-11-30',
        page: 3,
        pageSize: 50,
        sort: 'balance:desc',
      },
    });

    expect(url).toBe(
      '/caja?pagina=3&porPagina=50&orden=balance%3Adesc&tab=deudores&periodo=month&medio=transferencia&prof=prof_2&desde=2026-11-01&hasta=2026-11-30'
    );

    const [path, search] = url.split('?');
    const parsed = parseAppLocation(path, `?${search}`);
    expect(parsed.currentView).toBe('finance');
    expect(parsed.hadForbiddenPii).toBe(false);
    expect(parsed.moduleQuery).toEqual({
      page: 3,
      pageSize: 50,
      sort: 'balance:desc',
      tab: 'deudores',
      period: 'month',
      method: 'transferencia',
      prof: 'prof_2',
      from: '2026-11-01',
      to: '2026-11-30',
    });

    // Birthday month & report params
    const bdayUrl = buildAppUrl({
      authRequired: false,
      currentView: 'birthdays',
      moduleQuery: { month: '10', page: 2 },
    });
    expect(bdayUrl).toBe('/ventana/cumpleanos?pagina=2&mes=10');
    expect(parseAppLocation('/ventana/cumpleanos', '?pagina=2&mes=10').moduleQuery).toEqual({
      page: 2,
      month: '10',
    });
  });

  it('omits defaults and strictly strips search/PII query parameters from URLs', () => {
    const defaultCleanUrl = buildAppUrl({
      authRequired: false,
      currentView: 'manage-patients',
      moduleQuery: {
        page: 1,
        status: 'all',
        entity: 'all',
        method: 'all',
        category: 'all',
        prof: 'all',
      },
    });
    expect(defaultCleanUrl).toBe('/herramientas/pacientes');

    expect(sanitizeSortParam('fullName:asc')).toBe('fullName:asc');
    expect(sanitizeSortParam('col_2:desc')).toBe('col_2:desc');
    expect(sanitizeSortParam('bad;drop table:asc')).toBeNull();

    const stripped = stripSensitiveQueryParams(
      '?q=Juan&query=Perez&search=caries&busqueda=40123&nombre=Ana&pagina=2&orden=fullName:asc'
    );
    expect(stripped.hadForbiddenPii).toBe(true);
    expect(stripped.safeParams.toString()).toBe('pagina=2&orden=fullName%3Aasc');

    for (const forbidden of ['q', 'query', 'search', 'busqueda', 'nombre', 'dni']) {
      expect(FORBIDDEN_PII_QUERY_KEYS.has(forbidden)).toBe(true);
    }
  });
});
