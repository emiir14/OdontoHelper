/**
 * Local device identification for tracking where audio recordings physically live.
 * Raw audio chunks are NEVER uploaded on the free tier, so identifying the originating
 * device lets other devices show audio metadata while preventing broken playback.
 */

const DEVICE_ID_KEY = 'odontohelper_device_id';
const DEVICE_LABEL_KEY = 'odontohelper_device_label';

export interface LocalDeviceInfo {
  deviceId: string;
  deviceLabel: string;
  defaultLabel: string;
  hasCustomLabel: boolean;
}

export function detectDefaultDeviceLabel(): string {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 'Equipo local';
  }

  const ua = navigator.userAgent || '';
  const isTauri = '__TAURI_INTERNALS__' in window || '__TAURI__' in window;

  let os = 'Equipo';
  if (/Windows/i.test(ua)) os = 'Windows';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
  else if (/Mac OS X|Macintosh/i.test(ua)) os = 'macOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/Linux/i.test(ua)) os = 'Linux';

  if (isTauri) {
    return `OdontoHelper Escritorio · ${os}`;
  }

  let browser = 'Navegador';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/OPR\//i.test(ua)) browser = 'Opera';
  else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) browser = 'Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = 'Safari';

  return `${browser} · ${os}`;
}

export function getOrCreateLocalDeviceInfo(): LocalDeviceInfo {
  const defaultLabel = detectDefaultDeviceLabel();

  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return {
      deviceId: 'dev_server',
      deviceLabel: defaultLabel,
      defaultLabel,
      hasCustomLabel: false,
    };
  }

  let deviceId = localStorage.getItem(DEVICE_ID_KEY) || '';
  if (!deviceId) {
    const rand =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID().slice(0, 8)
        : Math.random().toString(36).slice(2, 10);
    deviceId = `dev_${Date.now().toString(36)}_${rand}`;
    try {
      localStorage.setItem(DEVICE_ID_KEY, deviceId);
    } catch {
      // ignore quota/private mode errors
    }
  }

  let customLabel = '';
  try {
    customLabel = (localStorage.getItem(DEVICE_LABEL_KEY) || '').trim();
  } catch {
    customLabel = '';
  }

  return {
    deviceId,
    deviceLabel: customLabel || defaultLabel,
    defaultLabel,
    hasCustomLabel: Boolean(customLabel),
  };
}

export function setCustomLocalDeviceLabel(label: string): LocalDeviceInfo {
  const clean = label.trim();
  if (typeof localStorage !== 'undefined') {
    try {
      if (clean) {
        localStorage.setItem(DEVICE_LABEL_KEY, clean);
      } else {
        localStorage.removeItem(DEVICE_LABEL_KEY);
      }
    } catch {
      // ignore storage errors
    }
  }
  return getOrCreateLocalDeviceInfo();
}

export function buildRecordingAudioFileName(reference?: string, createdAt = Date.now()): string {
  const dt = new Date(createdAt);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  const hh = String(dt.getHours()).padStart(2, '0');
  const min = String(dt.getMinutes()).padStart(2, '0');
  const cleanRef = (reference || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32);

  return cleanRef
    ? `audio_${cleanRef}_${yyyy}-${mm}-${dd}_${hh}${min}.wav`
    : `consulta_${yyyy}-${mm}-${dd}_${hh}${min}.wav`;
}
