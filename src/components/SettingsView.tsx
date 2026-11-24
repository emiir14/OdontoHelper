import React, { useEffect, useState, useRef } from 'react';
import {
  Cpu,
  Mic,
  BookOpen,
  HardDrive,
  Trash2,
  Plus,
  Check,
  Sun,
  Moon,
  Laptop,
  RotateCw,
  Radio,
  Download,
  Upload,
  CheckCircle2,
  CloudDownload,
  LogOut,
  Coins,
  Cloud,
  Landmark,
  Lock,
  User,
} from 'lucide-react';
import {
  buildWorkspaceTransferCode,
  evaluateSubscriptionStatus,
  getCycleDisplayLabel,
  getTierDisplayLabel,
} from '../core/clinic/subscriptionPlans';
import { resolveCloudAudioCapability } from '../core/audio/cloudAudioSync';
import {
  CURRENCY_OPTIONS,
  DEFAULT_CURRENCY,
  downloadTextFile,
  formatMoney,
  getCurrencyMeta,
} from '../core/clinic/clinicHelpers';
import {
  getOrCreateLocalDeviceInfo,
  setCustomLocalDeviceLabel,
} from '../core/runtime/deviceIdentity';
import { getDefaultModelTier, getTauriBridge, isTauriDesktop } from '../core/runtime/platform';
import { NativeCapabilitiesResponse } from '../core/transcription/tauriEngine';
import { detectHardwareCapabilities, HardwareCapabilities } from '../core/transcription/tierDetector';
import { CurrencyCode, ModelTier } from '../core/types';
import { useAppStore } from '../store/useAppStore';
import { Button } from './ui/Button';
import {
  cardClass,
  inputClass,
  labelCompactClass,
  pageContainerNarrowClass,
  pageSubtitleClass,
  pageTitleClass,
  selectClass,
} from './ui/uiClasses';

export const SettingsView: React.FC = () => {
  const {
    settings,
    updateSettings,
    glossary,
    addGlossaryEntry,
    removeGlossaryEntry,
    storageUsage,
    sessions,
    localAudioAvailability,
    clearTranscribedAudioAll,
    clearAllLocalAudio,
    openConfirm,
    showToast,
    modelCacheStatuses,
    downloadingModelTier,
    modelDownloadProgress,
    downloadModelForOffline,
    exportGlossaryBackup,
    importGlossaryBackup,
    authEmail,
    signOutSupabase,
    professionals,
    activeProfessionalId,
    profile,
    updatePersonalPractitioner,
    workspace,
    workspaceSubscription,
    transferRequests,
    openTransferModal,
  } = useAppStore();

  const runningDesktop = isTauriDesktop();
  const [hardware, setHardware] = useState<HardwareCapabilities | null>(null);
  const [nativeCaps, setNativeCaps] = useState<NativeCapabilitiesResponse | null>(null);
  const [newIncorrect, setNewIncorrect] = useState('');
  const [newCorrect, setNewCorrect] = useState('');
  const [isAddingGlossary, setIsAddingGlossary] = useState(false);

  const activePractitioner =
    professionals.find((p) => p.id === activeProfessionalId) || professionals[0];
  const [practitionerName, setPractitionerName] = useState(
    activePractitioner?.fullName || profile?.fullName || ''
  );
  const [practitionerSpecialty, setPractitionerSpecialty] = useState(
    activePractitioner?.specialty || 'Odontología General'
  );
  const [practitionerLicense, setPractitionerLicense] = useState(
    activePractitioner?.licenseNumber || ''
  );
  const [savingPractitioner, setSavingPractitioner] = useState(false);

  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [isTestingMic, setIsTestingMic] = useState(false);
  const [testVuLevel, setTestVuLevel] = useState(0);
  const [deviceInfo, setDeviceInfo] = useState(() => getOrCreateLocalDeviceInfo());
  const [deviceLabelInput, setDeviceLabelInput] = useState(() => getOrCreateLocalDeviceInfo().deviceLabel);

  const testStreamRef = useRef<MediaStream | null>(null);
  const testContextRef = useRef<AudioContext | null>(null);
  const testAnimFrameRef = useRef<number | null>(null);
  const glossaryInputRef = useRef<HTMLInputElement | null>(null);

  const loadAudioDevices = async () => {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.enumerateDevices) {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const inputs = devices.filter((d) => d.kind === 'audioinput');
        setAudioDevices(inputs);
      } catch {
        // ignore
      }
    }
  };

  useEffect(() => {
    detectHardwareCapabilities().then(setHardware);
    if (runningDesktop) {
      const bridge = getTauriBridge();
      bridge?.core
        .invoke<NativeCapabilitiesResponse>('get_native_capabilities')
        .then(setNativeCaps)
        .catch(() => {});
    }
    loadAudioDevices();

    const handleDeviceChange = () => {
      loadAudioDevices();
    };

    navigator.mediaDevices?.addEventListener('devicechange', handleDeviceChange);
    return () => {
      navigator.mediaDevices?.removeEventListener('devicechange', handleDeviceChange);
      stopMicTest();
    };
  }, []);

  useEffect(() => {
    setPractitionerName(activePractitioner?.fullName || profile?.fullName || '');
    setPractitionerSpecialty(activePractitioner?.specialty || 'Odontología General');
    setPractitionerLicense(activePractitioner?.licenseNumber || '');
  }, [
    activePractitioner?.id,
    activePractitioner?.fullName,
    activePractitioner?.specialty,
    activePractitioner?.licenseNumber,
    profile?.fullName,
  ]);

  const handleSavePractitioner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!practitionerName.trim()) {
      showToast('Ingresá tu nombre y apellido profesional.', 'warning');
      return;
    }
    setSavingPractitioner(true);
    try {
      await updatePersonalPractitioner({
        fullName: practitionerName.trim(),
        specialty: practitionerSpecialty.trim() || undefined,
        licenseNumber: practitionerLicense.trim() || undefined,
      });
    } finally {
      setSavingPractitioner(false);
    }
  };

  const handleRefreshDevices = async () => {
    try {
      const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      tempStream.getTracks().forEach((t) => t.stop());
    } catch {
      // ignore
    }
    await loadAudioDevices();
    showToast('Lista de micrófonos actualizada', 'info');
  };

  const stopMicTest = () => {
    if (testAnimFrameRef.current) {
      cancelAnimationFrame(testAnimFrameRef.current);
      testAnimFrameRef.current = null;
    }
    if (testStreamRef.current) {
      testStreamRef.current.getTracks().forEach((t) => t.stop());
      testStreamRef.current = null;
    }
    if (testContextRef.current && testContextRef.current.state !== 'closed') {
      try {
        testContextRef.current.close();
      } catch {
        // ignore
      }
      testContextRef.current = null;
    }
    setIsTestingMic(false);
    setTestVuLevel(0);
  };

  const toggleMicTest = async () => {
    if (isTestingMic) {
      stopMicTest();
      return;
    }

    try {
      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: false,
        autoGainControl: false,
        noiseSuppression: settings?.noiseSuppression ?? false,
      };
      if (settings?.selectedAudioDeviceId) {
        audioConstraints.deviceId = { exact: settings.selectedAudioDeviceId };
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: audioConstraints,
          video: false,
        });
      } catch {
        if (settings?.selectedAudioDeviceId) {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: false,
              autoGainControl: false,
              noiseSuppression: settings?.noiseSuppression ?? false,
            },
            video: false,
          });
        } else {
          throw new Error('No se pudo acceder al micrófono');
        }
      }

      testStreamRef.current = stream;
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtx();
      testContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      setIsTestingMic(true);

      const checkLevel = () => {
        if (!testContextRef.current) return;
        analyser.getByteTimeDomainData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const val = (dataArray[i] - 128) / 128;
          sum += val * val;
        }
        const rms = Math.sqrt(sum / dataArray.length);
        setTestVuLevel(Math.min(1, rms * 4.5));
        testAnimFrameRef.current = requestAnimationFrame(checkLevel);
      };
      checkLevel();
    } catch {
      stopMicTest();
      showToast('No se pudo iniciar la prueba del micrófono', 'warning');
    }
  };

  const handleTierChange = async (tier: ModelTier) => {
    await updateSettings({ modelTier: tier });
  };

  const handleAddGlossarySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newIncorrect.trim() && newCorrect.trim()) {
      await addGlossaryEntry(newIncorrect, newCorrect);
      setNewIncorrect('');
      setNewCorrect('');
      setIsAddingGlossary(false);
    }
  };

  const handleExportGlossary = () => {
    const json = exportGlossaryBackup();
    const dateTag = new Date().toISOString().slice(0, 10);
    downloadTextFile(`odontohelper_glosario_${dateTag}.json`, json, 'application/json');
    showToast('Glosario dental exportado', 'success');
  };

  const handleImportGlossary = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      await importGlossaryBackup(text);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al importar glosario';
      showToast(msg, 'warning');
    } finally {
      e.target.value = '';
    }
  };

  const usedMb = Math.round(storageUsage.usedBytes / (1024 * 1024));
  const totalMb = Math.round(storageUsage.quotaBytes / (1024 * 1024));
  const localAudioCount = sessions.filter((s) => localAudioAvailability[s.id]).length;
  const transcribedLocalAudioCount = sessions.filter(
    (s) => s.status === 'completed' && localAudioAvailability[s.id]
  ).length;
  const cloudAudioCap = resolveCloudAudioCapability(settings);

  const handleSaveDeviceLabel = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = setCustomLocalDeviceLabel(deviceLabelInput);
    setDeviceInfo(updated);
    setDeviceLabelInput(updated.deviceLabel);
    showToast(`Nombre del dispositivo guardado: ${updated.deviceLabel}`, 'success');
  };

  const handleResetDeviceLabel = () => {
    const updated = setCustomLocalDeviceLabel('');
    setDeviceInfo(updated);
    setDeviceLabelInput(updated.deviceLabel);
    showToast('Nombre del dispositivo restablecido al detectado automáticamente', 'info');
  };

  return (
    <div className={`${pageContainerNarrowClass} py-8 space-y-8`}>
      <div>
        <h1 className={pageTitleClass}>
          Configuración
        </h1>
        <p className={pageSubtitleClass}>
          Moneda del consultorio, apariencia visual, ajustes del dictado por voz y almacenamiento local de audios.
        </p>
      </div>

      {authEmail && (
        <section className={`${cardClass} p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
          <div className="space-y-0.5 min-w-0">
            <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 break-words">
              Cuenta conectada: {authEmail}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {authEmail === 'drtest'
                ? 'Sesión de prueba local activa (drtest). Los datos de demostración, el audio y Whisper corren localmente en tu navegador.'
                : 'Tus fichas clínicas, pacientes, radiografías y agenda se guardan en Supabase. El audio y Whisper corren solo en tu navegador.'}
            </p>
          </div>
          <Button
            variant="subtle"
            size="sm"
            icon={<LogOut className="w-3.5 h-3.5" />}
            className="w-full sm:w-auto justify-center"
            onClick={() => signOutSupabase()}
          >
            Cerrar sesión
          </Button>
        </section>
      )}

      {/* Section 0: Plan, Prueba Gratuita y Suscripción por Transferencia */}
      {(() => {
        const subEval = evaluateSubscriptionStatus(workspaceSubscription);
        const targetTier = subEval.tier === 'trial' ? 'base' : subEval.tier;
        const statusToneClass =
          subEval.alertLevel === 'expired'
            ? 'bg-rose-50/70 dark:bg-rose-950/35 border-rose-200 dark:border-rose-800/70 text-rose-900 dark:text-rose-100'
            : subEval.alertLevel === 'critical' || subEval.alertLevel === 'warning'
            ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/70 text-amber-950 dark:text-amber-100'
            : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700/70 text-slate-800 dark:text-slate-200';
        const transferCode = workspace ? buildWorkspaceTransferCode(workspace.id) : 'OH-CONSULTORIO';

        return (
          <section className={`${cardClass} p-4 sm:p-6 space-y-4`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/60 flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0">
                  <Landmark className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Plan, vigencia y pago por transferencia
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Avisos automáticos de vencimiento en todos los planes · Código de referencia:{' '}
                    <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                      {transferCode}
                    </span>
                  </p>
                </div>
              </div>

              <Button
                variant="primary"
                size="sm"
                icon={<Landmark className="w-3.5 h-3.5" />}
                onClick={() => openTransferModal(targetTier, subEval.billingCycle)}
                className="w-full sm:w-auto justify-center"
              >
                {subEval.isTrial ? 'Activar plan por transferencia' : 'Renovar o cambiar plan'}
              </Button>
            </div>

            <div className={`p-4 rounded-2xl border space-y-1.5 ${statusToneClass}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold tabular-nums">{subEval.headline}</span>
                <span className="text-[11px] font-mono font-semibold">
                  {subEval.isIndefinite
                    ? `${subEval.tierLabel} · Indefinido`
                    : `${subEval.tierLabel} · ${getCycleDisplayLabel(subEval.billingCycle)}`}
                </span>
              </div>
              <p className="text-[11px] opacity-85 leading-relaxed">{subEval.description}</p>
            </div>

            {transferRequests.length > 0 && (
              <div className="space-y-2 pt-1">
                <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Últimos avisos de transferencia informados
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200/70 dark:border-slate-800">
                  {transferRequests.slice(0, 4).map((req) => (
                    <div
                      key={req.id}
                      className="px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {getTierDisplayLabel(req.requestedTier)} ({getCycleDisplayLabel(req.billingCycle)})
                        </span>
                        <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                          {req.bankName} · Ref <span className="font-mono">{req.transferReference}</span>
                        </span>
                      </div>
                      <div className="text-right tabular-nums">
                        <div className="font-mono font-bold text-slate-900 dark:text-slate-100">
                          USD {req.amountUsd}
                        </div>
                        <div className="text-[11px] font-medium text-amber-700 dark:text-amber-300">
                          {req.status === 'approved'
                            ? 'Aprobada'
                            : req.status === 'rejected'
                            ? 'Revisar'
                            : 'En verificación'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        );
      })()}

      {/* Section 0a: Perfil profesional personal (Uso individual) */}
      <section className={`${cardClass} p-4 sm:p-6 space-y-4`}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/60 flex items-center justify-center text-teal-600 dark:text-teal-400">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Perfil profesional personal
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Tus datos como odontólogo titular para historias clínicas, presupuestos y encabezados de reportes.
            </p>
          </div>
        </div>

        <form onSubmit={handleSavePractitioner} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className={labelCompactClass}>Nombre y apellido del odontólogo *</label>
              <input
                type="text"
                required
                value={practitionerName}
                onChange={(e) => setPractitionerName(e.target.value)}
                placeholder="Ej: Dra. Sofía Martínez"
                className={`${inputClass} bg-white dark:bg-slate-900`}
              />
            </div>

            <div>
              <label className={labelCompactClass}>Especialidad</label>
              <input
                type="text"
                value={practitionerSpecialty}
                onChange={(e) => setPractitionerSpecialty(e.target.value)}
                placeholder="Odontología General"
                className={`${inputClass} bg-white dark:bg-slate-900`}
              />
            </div>

            <div>
              <label className={labelCompactClass}>Matrícula profesional (opcional)</label>
              <input
                type="text"
                value={practitionerLicense}
                onChange={(e) => setPractitionerLicense(e.target.value)}
                placeholder="Ej: MP 4521 / CJPPU"
                className={`${inputClass} bg-white dark:bg-slate-900 font-mono`}
              />
            </div>
          </div>

          <div className="flex justify-center sm:justify-end">
            <Button type="submit" variant="primary" size="sm" loading={savingPractitioner} className="w-full sm:w-auto">
              {savingPractitioner ? 'Guardando...' : 'Guardar perfil profesional'}
            </Button>
          </div>
        </form>
      </section>

      {/* Section 0b: Moneda del sistema (Moneda única configurable) */}
      <section className={`${cardClass} p-4 sm:p-6 space-y-4`}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/60 flex items-center justify-center text-teal-600 dark:text-teal-400">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Moneda del consultorio (Latinoamérica y USD)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Todo el sistema opera en una sola moneda unificada (por defecto Pesos Uruguayos). Elegí la moneda para presupuestos, caja, cuenta corriente, laboratorio y reportes.
            </p>
          </div>
        </div>

        {(() => {
          const activeCurrency = settings?.currency || DEFAULT_CURRENCY;
          const activeMeta = getCurrencyMeta(activeCurrency);
          const showCurrencyCode = Boolean(settings?.showCurrencyCode);
          return (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                <div className="sm:col-span-8">
                  <label className={labelCompactClass}>
                    Moneda activa del sistema
                  </label>
                  <select
                    aria-label="Moneda activa del sistema"
                    value={activeCurrency}
                    onChange={(e) => updateSettings({ currency: e.target.value as CurrencyCode })}
                    className={`${selectClass} font-medium min-h-[42px]`}
                  >
                    {CURRENCY_OPTIONS.map((opt) => (
                      <option key={opt.code} value={opt.code}>
                        {opt.code} ({opt.symbol}) — {opt.name} · {opt.country}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-4 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Vista previa ({activeMeta.country})
                  </div>
                  <div className="text-sm font-bold font-mono tabular-nums text-teal-700 dark:text-teal-300 mt-0.5">
                    {formatMoney(2500, activeCurrency, showCurrencyCode)}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    Mostrar tipo de moneda en la app
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 max-w-lg leading-relaxed">
                    Por defecto los importes muestran solo el símbolo (ej. $ 2.500). Activá esta opción para ver el código de la moneda seleccionada (ej. {activeCurrency} {activeMeta.symbol} 2.500) en tablas y reportes.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => updateSettings({ showCurrencyCode: !showCurrencyCode })}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors shrink-0 cursor-pointer ${
                    showCurrencyCode ? 'bg-teal-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                  aria-label="Alternar visualización del tipo de moneda"
                  aria-pressed={showCurrencyCode}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      showCurrencyCode ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          );
        })()}
      </section>

      {/* Section 1: Transcription Model Tier & Offline Readiness */}
      <section className={`${cardClass} p-4 sm:p-6 space-y-5`}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/60 flex items-center justify-center text-teal-600 dark:text-teal-400">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Nivel del modelo de transcripción (Whisper)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Selecciona el modelo y verifica si sus pesos ya están descargados para trabajar sin internet.
            </p>
          </div>
        </div>

        {runningDesktop && nativeCaps ? (
          <div className="p-3.5 rounded-2xl bg-teal-50/70 dark:bg-teal-950/30 border border-teal-200/70 dark:border-teal-800/60 text-xs text-slate-700 dark:text-slate-200 space-y-1">
            <div className="font-semibold text-teal-900 dark:text-teal-200">
              Motor nativo detectado en Windows (.exe):
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-teal-800 dark:text-teal-300">
              <span>Aceleración: {nativeCaps.backendLabel}</span>
              <span>Hilos de CPU: {nativeCaps.cpuThreads}</span>
            </div>
          </div>
        ) : hardware ? (
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-600 dark:text-slate-300 space-y-1">
            <div className="font-semibold text-slate-800 dark:text-slate-200">
              Hardware detectado en tu navegador:
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
              <span>
                Aceleración:{' '}
                {hardware.isMobile
                  ? 'WASM CPU Multihilo (Optimizado para móviles)'
                  : hardware.hasWebGpu
                  ? 'WebGPU Acelerado'
                  : 'WASM CPU Multihilo'}
              </span>
              {hardware.adapterInfo && <span>Adaptador: {hardware.adapterInfo}</span>}
              {hardware.deviceMemoryGb && <span>Memoria RAM: ~{hardware.deviceMemoryGb} GB</span>}
              <span>Hilos de CPU: {hardware.hardwareConcurrency}</span>
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {[
            {
              id: 'balanced' as const,
              label: runningDesktop
                ? 'Estándar clínico (whisper-small)'
                : 'Estándar clínico (whisper-small) — Recomendado',
              desc: runningDesktop
                ? 'Modelo GGML q8_0 (~190 MB). Ultra rápido para equipos sin GPU dedicada o consultas breves.'
                : 'Modelo de 244M parámetros (~240 MB, q8). Mejor ortografía y precisión en español para móviles y PCs.',
            },
            {
              id: 'max' as const,
              label: runningDesktop
                ? 'Máxima resolución (whisper-large-v3-turbo) — Recomendado'
                : 'Máxima resolución (whisper-large-v3-turbo)',
              desc: runningDesktop
                ? 'Modelo GGML q5_0 (~574 MB). Máxima fidelidad clínica para Windows con GPU Vulkan o CPU multinúcleo.'
                : 'Modelo de 800M parámetros (~480 MB, decodificador q8). Máxima fidelidad acústica para consultas extensas o hardware potente.',
            },
          ].map((tier) => {
            const currentTier = settings?.modelTier || getDefaultModelTier();
            const isSelected =
              tier.id === 'balanced'
                ? currentTier === 'balanced' ||
                  currentTier === 'fast' ||
                  (currentTier === 'auto' && !runningDesktop)
                : currentTier === 'max' || (currentTier === 'auto' && runningDesktop);
            const cacheInfo = modelCacheStatuses[tier.id];
            const isDownloadingThis = downloadingModelTier === tier.id;

            return (
              <div
                key={tier.id}
                className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                  isSelected
                    ? 'border-teal-600 bg-teal-50/50 dark:bg-teal-950/30 ring-1 ring-teal-600'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleTierChange(tier.id)}
                  className="text-left space-y-1 w-full"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      {tier.label}
                    </span>
                    {isSelected && <Check className="w-4 h-4 text-teal-600 shrink-0" />}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    {tier.desc}
                  </p>
                </button>

                <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
                  {cacheInfo?.isCached ? (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-teal-700 dark:text-teal-400">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Listo sin internet</span>
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Descarga inicial pendiente
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => downloadModelForOffline(tier.id)}
                    disabled={Boolean(downloadingModelTier)}
                    className="px-3 py-1.5 rounded-xl text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-50 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap min-h-[36px]"
                  >
                    {isDownloadingThis ? (
                      <>
                        <RotateCw className="w-3.5 h-3.5 animate-spin text-teal-600" />
                        <span>{modelDownloadProgress}%</span>
                      </>
                    ) : (
                      <>
                        <CloudDownload className="w-3.5 h-3.5 text-teal-600" />
                        <span>{cacheInfo?.isCached ? 'Verificar caché' : 'Descargar offline'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Transcription Context Mode Switch */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
          <div>
            <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
              Contexto del vocabulario (Prompt de Whisper)
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Elegí si querés priorizar terminología odontológica o español general sin sesgo médico (reuniones, charlas, gaming).
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {[
              {
                id: 'dental' as const,
                title: 'Odontología (Clínico)',
                desc: 'Aplica vocabulario dental, piezas FDI y corrección automática del glosario.',
              },
              {
                id: 'general' as const,
                title: 'General / Conversación libre',
                desc: 'Español rioplatense neutro sin glosario dental para evitar palabras forzadas.',
              },
            ].map((modeOption) => {
              const activeMode = settings?.transcriptionMode || 'dental';
              const isSelected = activeMode === modeOption.id;
              return (
                <button
                  key={modeOption.id}
                  type="button"
                  onClick={() => updateSettings({ transcriptionMode: modeOption.id })}
                  className={`p-3.5 rounded-2xl border text-left transition-all min-h-[44px] ${
                    isSelected
                      ? 'border-teal-600 bg-teal-50/50 dark:bg-teal-950/30 ring-1 ring-teal-600'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      {modeOption.title}
                    </span>
                    {isSelected && <Check className="w-4 h-4 text-teal-600 shrink-0" />}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    {modeOption.desc}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Section 2: Audio, Mic & Recording Settings */}
      <section className={`${cardClass} p-4 sm:p-6 space-y-5`}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/60 flex items-center justify-center text-teal-600 dark:text-teal-400">
            <Mic className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Micrófono y grabación
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Ajustes acústicos para el consultorio.
            </p>
          </div>
        </div>

        <div className="space-y-4 pt-1 divide-y divide-slate-100 dark:divide-slate-800">
          <div className="pt-2 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <span>Dispositivo de micrófono de entrada</span>
                  {settings?.selectedAudioDeviceId && (
                    <span className="text-[10px] text-teal-700 dark:text-teal-300 font-medium">
                      · Personalizado
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Elige qué micrófono utilizar (auriculares Bluetooth, micrófono de escritorio o micrófono integrado).
                </p>
              </div>

              <button
                type="button"
                onClick={handleRefreshDevices}
                className="self-start sm:self-auto px-3 py-1.5 text-[11px] font-medium rounded-xl text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center gap-1.5 transition-colors min-h-[36px]"
              >
                <RotateCw className="w-3 h-3 text-slate-500" />
                <span>Actualizar dispositivos</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
              <div className="sm:col-span-2">
                <select
                  value={settings?.selectedAudioDeviceId || ''}
                  onChange={(e) => updateSettings({ selectedAudioDeviceId: e.target.value || undefined })}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-teal-500 font-medium min-h-[40px]"
                >
                  <option value="">Predeterminado del sistema / navegador</option>
                  {audioDevices.map((dev, idx) => (
                    <option key={dev.deviceId || idx} value={dev.deviceId}>
                      {dev.label || `Micrófono ${idx + 1}`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <button
                  type="button"
                  onClick={toggleMicTest}
                  className={`w-full px-3 py-2 text-xs font-semibold rounded-xl border transition-colors flex items-center justify-center gap-2 min-h-[40px] ${
                    isTestingMic
                      ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                      : 'bg-teal-50/70 dark:bg-teal-950/40 border-teal-200 dark:border-teal-800/80 text-teal-800 dark:text-teal-200 hover:bg-teal-100 dark:hover:bg-teal-900/50'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${isTestingMic ? 'bg-rose-500 animate-ping' : 'bg-teal-500'}`} />
                  <span>{isTestingMic ? 'Detener prueba' : 'Probar nivel'}</span>
                </button>
              </div>
            </div>

            {isTestingMic && (
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300">
                  <span className="font-medium flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-teal-600 animate-pulse" />
                    <span>Nivel captado por el micrófono:</span>
                  </span>
                  <span className="font-mono font-bold text-teal-600">{Math.round(testVuLevel * 100)}%</span>
                </div>
                <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-75 rounded-full ${
                      testVuLevel > 0.7
                        ? 'bg-amber-500'
                        : testVuLevel > 0.05
                        ? 'bg-teal-500'
                        : 'bg-slate-400'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(2, testVuLevel * 100))}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  {testVuLevel < 0.03
                    ? 'Hablá hacia el micrófono. Si la barra no responde, verificá que los auriculares no estén silenciados o probá otro dispositivo de la lista.'
                    : 'Nivel óptimo detectado. Tu voz está llegando con buena amplitud.'}
                </p>
              </div>
            )}
          </div>

          {/* Noise Suppression Toggle */}
          <div className="flex items-center justify-between gap-4 pt-4">
            <div>
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Supresión de ruido por hardware del navegador
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 max-w-lg leading-relaxed">
                Desactivada por defecto para evitar que los algoritmos de cancelación corten consonantes o voces suaves en el gabinete.
              </p>
            </div>
            <button
              onClick={() => updateSettings({ noiseSuppression: !settings?.noiseSuppression })}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors shrink-0 ${
                settings?.noiseSuppression ? 'bg-teal-600' : 'bg-slate-300 dark:bg-slate-700'
              }`}
              aria-label="Alternar supresión de ruido"
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  settings?.noiseSuppression ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Auto Transcribe on Stop Toggle */}
          <div className="flex items-center justify-between gap-4 pt-4">
            <div>
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Transcribir automáticamente al detener la grabación
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Inicia la conversión a texto de inmediato apenas finaliza la consulta.
              </p>
            </div>
            <button
              onClick={() => updateSettings({ autoTranscribeOnStop: !settings?.autoTranscribeOnStop })}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors shrink-0 ${
                settings?.autoTranscribeOnStop ? 'bg-teal-600' : 'bg-slate-300 dark:bg-slate-700'
              }`}
              aria-label="Alternar transcripción automática"
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  settings?.autoTranscribeOnStop ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Progressive Background Transcription Toggle */}
          <div className="flex items-center justify-between gap-4 pt-4">
            <div>
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Transcripción progresiva en segundo plano · Recomendado
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 max-w-lg leading-relaxed">
                Transcribe bloques cada 30 segundos mientras la consulta continúa. Al finalizar, casi todo el texto ya está listo de inmediato.
              </p>
            </div>
            <button
              onClick={() => updateSettings({ progressiveTranscription: !(settings?.progressiveTranscription ?? true) })}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors shrink-0 ${
                (settings?.progressiveTranscription ?? true) ? 'bg-teal-600' : 'bg-slate-300 dark:bg-slate-700'
              }`}
              aria-label="Alternar transcripción progresiva"
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  (settings?.progressiveTranscription ?? true) ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Consent Requirement Toggle */}
          <div className="flex items-center justify-between gap-4 pt-4">
            <div>
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Recordatorio de consentimiento informado
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Muestra la confirmación de consentimiento antes de cada nueva consulta.
              </p>
            </div>
            <button
              onClick={() => updateSettings({ requireConsent: !settings?.requireConsent })}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors shrink-0 ${
                settings?.requireConsent ? 'bg-teal-600' : 'bg-slate-300 dark:bg-slate-700'
              }`}
              aria-label="Alternar recordatorio de consentimiento"
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  settings?.requireConsent ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </section>

      {/* Section 3: Dental Glossary + Share/Migrate */}
      <section className={`${cardClass} p-4 sm:p-6 space-y-5`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/60 flex items-center justify-center text-teal-600 dark:text-teal-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Glosario odontológico post-proceso
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Corrige automáticamente palabras técnicas y compártelo entre tus equipos.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2">
            <input
              type="file"
              ref={glossaryInputRef}
              onChange={handleImportGlossary}
              accept=".json,application/json"
              className="hidden"
            />
            <Button
              variant="subtle"
              size="xs"
              icon={<Upload className="w-3.5 h-3.5" />}
              onClick={() => glossaryInputRef.current?.click()}
            >
              Importar
            </Button>
            <Button
              variant="subtle"
              size="xs"
              icon={<Download className="w-3.5 h-3.5" />}
              onClick={handleExportGlossary}
            >
              Exportar
            </Button>
            <Button
              variant="soft"
              size="xs"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => setIsAddingGlossary(true)}
            >
              Agregar término
            </Button>
          </div>
        </div>

        {isAddingGlossary && (
          <form onSubmit={handleAddGlossarySubmit} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCompactClass}>
                  Texto escuchado / erróneo
                </label>
                <input
                  type="text"
                  value={newIncorrect}
                  onChange={(e) => setNewIncorrect(e.target.value)}
                  placeholder="Ej: conducto metría"
                  className={`${inputClass} bg-white dark:bg-slate-900`}
                  required
                />
              </div>
              <div>
                <label className={labelCompactClass}>
                  Término odontológico correcto
                </label>
                <input
                  type="text"
                  value={newCorrect}
                  onChange={(e) => setNewCorrect(e.target.value)}
                  placeholder="Ej: conductometría"
                  className={`${inputClass} bg-white dark:bg-slate-900`}
                  required
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="xs" onClick={() => setIsAddingGlossary(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="primary" size="xs">
                Guardar
              </Button>
            </div>
          </form>
        )}

        <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200/60 dark:border-slate-800/60">
          {glossary.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between gap-2 p-3 text-xs hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 min-w-0 flex-1">
                <span className="text-rose-600 line-through dark:text-rose-400 break-words">{entry.incorrect}</span>
                <span className="text-slate-400">→</span>
                <span className="font-semibold text-teal-700 dark:text-teal-300 break-words">{entry.correct}</span>
              </div>
              <button
                onClick={() => removeGlossaryEntry(entry.id)}
                className="p-2 text-slate-400 hover:text-rose-600 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                title="Eliminar término"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Section 4: Visual Theme */}
      <section className={`${cardClass} p-4 sm:p-6 space-y-4`}>
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Aspecto visual
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            El modo claro utiliza una paleta cálida antifatiga visual (lino y porcelana suave) bajo la luz del consultorio.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
          {[
            { id: 'light', label: 'Claro cálido', icon: Sun },
            { id: 'dark', label: 'Oscuro', icon: Moon },
            { id: 'system', label: 'Sistema', icon: Laptop },
          ].map((item) => {
            const Icon = item.icon;
            const isSelected = (settings?.theme || 'light') === item.id;
            return (
              <button
                key={item.id}
                onClick={() => updateSettings({ theme: item.id as 'light' | 'dark' | 'system' })}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl text-xs font-semibold border transition-all min-h-[44px] ${
                  isSelected
                    ? 'border-teal-600 bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Section 5: Local Audio Storage & Cleanup */}
      <section className={`${cardClass} p-4 sm:p-6 space-y-5`}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/60 flex items-center justify-center text-teal-600 dark:text-teal-400">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Almacenamiento local de audios
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Liberá espacio en este dispositivo eliminando grabaciones ya procesadas. Tus pacientes, historias clínicas, turnos y transcripciones permanecen intactos.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 text-xs space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-4">
            <span className="text-slate-600 dark:text-slate-300">Espacio local en uso:</span>
            <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
              ~{usedMb} MB de {totalMb > 0 ? `${totalMb} MB disponibles` : 'cuota permitida'}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-4">
            <span className="text-slate-600 dark:text-slate-300">Grabaciones guardadas en este navegador:</span>
            <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
              {localAudioCount} {localAudioCount === 1 ? 'consulta' : 'consultas'}
            </span>
          </div>
        </div>

        {/* Cleanup Actions */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button
            variant="subtle"
            size="md"
            className="w-full sm:w-auto"
            disabled={transcribedLocalAudioCount === 0}
            onClick={() => {
              openConfirm({
                title: '¿Liberar audio de consultas ya transcritas?',
                description: `Se borrarán los archivos de audio locales de ${transcribedLocalAudioCount} ${transcribedLocalAudioCount === 1 ? 'consulta ya transcrita' : 'consultas ya transcritas'} para liberar espacio en disco. Las transcripciones, notas y fichas clínicas permanecerán intactas.`,
                confirmText: 'Liberar audio',
                cancelText: 'Cancelar',
                isDestructive: false,
                onConfirm: () => clearTranscribedAudioAll(),
              });
            }}
          >
            Liberar audios de consultas ya transcritas
          </Button>

          <Button
            variant="dangerSoft"
            size="md"
            className="w-full sm:w-auto"
            disabled={localAudioCount === 0}
            onClick={() => {
              openConfirm({
                title: '¿Borrar todos los audios locales?',
                description: 'Se eliminarán todas las grabaciones de audio almacenadas en este navegador (incluidas consultas aún no transcritas). Tus pacientes, evoluciones, turnos y transcripciones ya guardadas no se perderán.',
                confirmText: 'Borrar audios',
                cancelText: 'Cancelar',
                isDestructive: true,
                onConfirm: () => clearAllLocalAudio(),
              });
            }}
          >
            Borrar todos los audios locales
          </Button>
        </div>
      </section>

      {/* Section 5b: Local Device Identity & Upcoming Premium Cloud Audio Tier */}
      <section className={`${cardClass} p-4 sm:p-6 space-y-5`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/60 flex items-center justify-center text-teal-600 dark:text-teal-400">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Dispositivo local y Respaldo de audios (Paquete Premium)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Las transcripciones, radiografías y archivos se sincronizan en Supabase; los audios viven solo en el dispositivo que los grabó.
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 self-start sm:self-auto shrink-0">
            <Lock className="w-3.5 h-3.5 text-amber-600" />
            <span>
              {cloudAudioCap.tier === 'premium_audio'
                ? 'Premium · Nube pendiente'
                : 'Plan gratuito · Audio 100% local'}
            </span>
          </span>
        </div>

        {/* Device Name Form */}
        <form
          onSubmit={handleSaveDeviceLabel}
          className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Laptop className="w-3.5 h-3.5 text-teal-600" />
                <span>Nombre identificador de este dispositivo</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Se guarda junto a tus grabaciones para que desde otro equipo puedas ver en qué PC, tablet o consultorio quedó el archivo de audio.
              </p>
            </div>
            <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
              ID: {deviceInfo.deviceId}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={deviceLabelInput}
              onChange={(e) => setDeviceLabelInput(e.target.value)}
              placeholder={deviceInfo.defaultLabel}
              className={`${inputClass} bg-white dark:bg-slate-900 flex-1`}
            />
            <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 shrink-0">
              <Button type="submit" variant="primary" size="sm">
                Guardar nombre
              </Button>
              {deviceInfo.hasCustomLabel && (
                <Button type="button" variant="ghost" size="sm" onClick={handleResetDeviceLabel}>
                  Restablecer
                </Button>
              )}
            </div>
          </div>
        </form>

        {/* Locked Premium Cloud Audio Tier Info */}
        <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/25 border border-amber-200/80 dark:border-amber-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-semibold text-amber-950 dark:text-amber-100 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>Subida de audios a la nube bloqueada en el plan actual</span>
            </div>
            <p className="text-[11px] text-amber-900/85 dark:text-amber-200/85 leading-relaxed">
              {cloudAudioCap.blockedReason} El sistema ya está preparado para habilitar el almacenamiento externo encriptado cuando se defina la nube del paquete Premium. Mientras tanto, podés exportar cualquier audio directo en formato <span className="font-mono font-semibold">.wav</span> desde el detalle de la consulta.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 opacity-60 cursor-not-allowed" title="Disponible próximamente con el paquete Premium">
            <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">
              Auto-sync nube
            </span>
            <div className="w-11 h-6 flex items-center rounded-full p-1 bg-slate-300 dark:bg-slate-700">
              <div className="bg-white w-4 h-4 rounded-full shadow-md" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
