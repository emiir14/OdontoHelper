import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  Clock,
  Copy,
  FileText,
  Link2,
  Printer,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Unlink,
  Users,
} from 'lucide-react';
import {
  calculateAgeFromBirthDate,
  formatBirthDateDisplay,
  resolvePractitionerDisplay,
} from '../core/clinic/clinicHelpers';
import {
  buildExternalReferralWhatsAppText,
  buildInternalShareWhatsAppMessage,
  getPatientActiveAnamnesisAlerts,
  summarizeOdontogramFindings,
} from '../core/clinic/referralExport';
import { Patient, PatientFileCategory, PatientShareLink } from '../core/types';
import { useAppStore } from '../store/useAppStore';
import { AutoResizeTextarea } from './ui/AutoResizeTextarea';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { WhatsAppIcon } from './ui/WhatsAppIcon';
import { buttonClass, segmentedTabClass, segmentedTrackClass } from './ui/uiClasses';

interface SharePatientModalProps {
  patient: Patient;
  onClose: () => void;
}

const FILE_CATEGORY_LABELS: Record<PatientFileCategory, string> = {
  radiografia: 'Radiografía / Tomografía',
  foto_clinica: 'Fotografía clínica',
  documento: 'Estudio / Documento',
  consentimiento: 'Consentimiento',
};

export const SharePatientModal: React.FC<SharePatientModalProps> = ({ patient, onClose }) => {
  const {
    workspace,
    professionals,
    activeProfessionalId,
    profile,
    clinicalEvolutions,
    odontograms,
    patientFiles,
    patientShares,
    createPatientShareInvite,
    unlinkPatientShare,
    openConfirm,
    showToast,
  } = useAppStore();

  const [tab, setTab] = useState<'external' | 'internal'>('external');
  const [referralNote, setReferralNote] = useState('');
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [latestGeneratedShare, setLatestGeneratedShare] = useState<PatientShareLink | null>(null);
  const [printingSheet, setPrintingSheet] = useState(false);

  const isOwner = !workspace || patient.workspaceId === workspace.id;

  const practitioner = useMemo(
    () => resolvePractitionerDisplay(professionals, activeProfessionalId, profile),
    [professionals, activeProfessionalId, profile]
  );

  const activeProf = useMemo(
    () =>
      professionals.find((p) => p.id === activeProfessionalId) ||
      professionals.find((p) => p.role === 'owner') ||
      professionals[0],
    [professionals, activeProfessionalId]
  );

  const patientEvolutions = useMemo(
    () =>
      clinicalEvolutions
        .filter((e) => !e.deletedAt && e.patientId === patient.id)
        .sort((a, b) =>
          b.date !== a.date ? b.date.localeCompare(a.date) : b.createdAt - a.createdAt
        ),
    [clinicalEvolutions, patient.id]
  );

  const patientOdontograms = useMemo(
    () =>
      odontograms
        .filter((o) => !o.deletedAt && o.patientId === patient.id)
        .sort((a, b) => b.createdAt - a.createdAt),
    [odontograms, patient.id]
  );

  const latestOdontogram = patientOdontograms[0];
  const odontogramFindings = useMemo(
    () => summarizeOdontogramFindings(latestOdontogram),
    [latestOdontogram]
  );

  const patientAttachments = useMemo(
    () => patientFiles.filter((f) => f.patientId === patient.id),
    [patientFiles, patient.id]
  );

  const activeAlerts = useMemo(() => getPatientActiveAnamnesisAlerts(patient), [patient]);

  const patientShareLinks = useMemo(
    () =>
      patientShares
        .filter((s) => s.patientId === patient.id && s.status !== 'revoked')
        .sort((a, b) => b.createdAt - a.createdAt),
    [patientShares, patient.id]
  );

  const incomingShare = useMemo(
    () =>
      !isOwner && workspace
        ? patientShareLinks.find(
            (s) => s.status === 'accepted' && s.recipientWorkspaceId === workspace.id
          ) || patientShareLinks[0]
        : undefined,
    [isOwner, workspace, patientShareLinks]
  );

  const externalWhatsAppText = useMemo(
    () =>
      buildExternalReferralWhatsAppText({
        patient,
        practitionerName: practitioner.name,
        practitionerSpecialty: activeProf?.specialty,
        practitionerLicense: activeProf?.licenseNumber,
        referralNote,
        latestOdontogram,
        evolutions: patientEvolutions,
        files: patientAttachments,
      }),
    [
      patient,
      practitioner.name,
      activeProf?.specialty,
      activeProf?.licenseNumber,
      referralNote,
      latestOdontogram,
      patientEvolutions,
      patientAttachments,
    ]
  );

  const externalWhatsAppUrl = useMemo(
    () => `https://wa.me/?text=${encodeURIComponent(externalWhatsAppText)}`,
    [externalWhatsAppText]
  );

  useEffect(() => {
    if (!printingSheet) return;
    document.body.classList.add('printing-referral-sheet');

    const cleanup = () => {
      document.body.classList.remove('printing-referral-sheet');
      setPrintingSheet(false);
    };

    window.addEventListener('afterprint', cleanup, { once: true });
    const frameId = window.requestAnimationFrame(() => {
      window.print();
    });
    const fallbackTimer = window.setTimeout(cleanup, 60000);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(fallbackTimer);
      window.removeEventListener('afterprint', cleanup);
      document.body.classList.remove('printing-referral-sheet');
    };
  }, [printingSheet]);

  const handleCopyText = async (text: string, label: string, inviteId?: string) => {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      showToast('Tu navegador bloqueó la copia automática al portapapeles.', 'warning');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      if (inviteId) {
        setCopiedInviteId(inviteId);
        window.setTimeout(() => setCopiedInviteId(null), 2200);
      } else {
        setCopiedSummary(true);
        window.setTimeout(() => setCopiedSummary(false), 2200);
      }
      showToast(label, 'success');
    } catch {
      showToast('No se pudo copiar al portapapeles.', 'warning');
    }
  };

  const handleGenerateInvite = async () => {
    setCreatingInvite(true);
    try {
      const created = await createPatientShareInvite(patient.id, referralNote);
      if (created) {
        setLatestGeneratedShare(created);
      }
    } finally {
      setCreatingInvite(false);
    }
  };

  const buildShareUrl = (token: string) => {
    if (typeof window === 'undefined') return `/compartir/${token}`;
    return `${window.location.origin}/compartir/${token}`;
  };

  const buildInviteWaUrl = (share: PatientShareLink) => {
    const shareUrl = buildShareUrl(share.inviteToken);
    const msg = buildInternalShareWhatsAppMessage({
      ownerName: practitioner.name,
      patientName: patient.fullName,
      shareUrl,
      referralNote: share.referralNote || referralNote,
    });
    return `https://wa.me/?text=${encodeURIComponent(msg)}`;
  };

  const birthDisplay = patient.birthDate ? formatBirthDateDisplay(patient.birthDate) : '';
  const calcAge = patient.birthDate ? calculateAgeFromBirthDate(patient.birthDate) : null;
  const pe = patient.physicalExam;

  const printPortal =
    printingSheet && typeof document !== 'undefined'
      ? createPortal(
          <div className="referral-print-sheet hidden print:block bg-white text-slate-900 p-2 space-y-5 text-xs">
            {/* Header */}
            <div className="border-b-2 border-teal-700 pb-3 flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-teal-700">
                  OdontoHelper · Ficha Clínica de Derivación
                </div>
                <h1 className="text-xl font-bold text-slate-900 mt-0.5">{patient.fullName}</h1>
                <div className="text-[11px] text-slate-600 mt-1">
                  Emitida el {new Date().toLocaleDateString('es-AR')} · Profesional remitente:{' '}
                  <strong>{practitioner.name}</strong>
                  {activeProf?.specialty ? ` (${activeProf.specialty})` : ''}
                  {activeProf?.licenseNumber ? ` · Mat. ${activeProf.licenseNumber}` : ''}
                </div>
              </div>
              <div className="text-right text-[10px] text-slate-500 max-w-[200px]">
                Documento clínico estándar. Sin presupuestos ni importes financieros.
              </div>
            </div>

            {/* Optional Referral Note */}
            {referralNote.trim() && (
              <div className="p-3 rounded-lg border border-teal-300 bg-teal-50/40 print-break-inside-avoid">
                <div className="text-[10px] font-bold uppercase tracking-wider text-teal-800 mb-1">
                  Motivo de derivación / Nota para el colega
                </div>
                <p className="text-xs text-slate-800 whitespace-pre-line leading-relaxed">
                  {referralNote.trim()}
                </p>
              </div>
            )}

            {/* Patient Demographics */}
            <div className="border border-slate-300 rounded-lg p-3 space-y-1.5 print-break-inside-avoid">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Datos de identificación
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                <div>
                  <span className="text-slate-500">Nombre:</span>{' '}
                  <strong>{patient.fullName}</strong>
                </div>
                {patient.dni && (
                  <div>
                    <span className="text-slate-500">CI / DNI:</span>{' '}
                    <strong className="font-mono">{patient.dni}</strong>
                  </div>
                )}
                {(birthDisplay || calcAge !== null || patient.age) && (
                  <div>
                    <span className="text-slate-500">Nacimiento / Edad:</span>{' '}
                    {[
                      birthDisplay,
                      calcAge !== null
                        ? `(${calcAge} años)`
                        : patient.age
                        ? `(${patient.age})`
                        : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  </div>
                )}
                {patient.phone && (
                  <div>
                    <span className="text-slate-500">Teléfono:</span>{' '}
                    <span className="font-mono">{patient.phone}</span>
                  </div>
                )}
                {patient.insuranceProvider && (
                  <div>
                    <span className="text-slate-500">Cobertura:</span> {patient.insuranceProvider}
                    {patient.insuranceNumber ? ` · N° ${patient.insuranceNumber}` : ''}
                  </div>
                )}
                {patient.chiefComplaint && (
                  <div className="col-span-2">
                    <span className="text-slate-500">Motivo de consulta:</span>{' '}
                    {patient.chiefComplaint}
                  </div>
                )}
              </div>
            </div>

            {/* Medical Alerts & Anamnesis */}
            {(patient.allergies ||
              activeAlerts.length > 0 ||
              patient.medicalHistory ||
              (pe &&
                (pe.bloodPressure ||
                  pe.mucosa ||
                  pe.lymphNodes ||
                  pe.tmj ||
                  pe.occlusion ||
                  pe.oralHygiene ||
                  pe.observations))) && (
              <div className="border border-slate-300 rounded-lg p-3 space-y-2 print-break-inside-avoid">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Alertas médicas, Anamnesis y Examen físico
                </div>
                {patient.allergies && (
                  <div className="text-xs">
                    <strong>Alergias:</strong> {patient.allergies}
                  </div>
                )}
                {activeAlerts.length > 0 && (
                  <div className="text-xs">
                    <strong>Antecedentes marcados:</strong> {activeAlerts.join(' · ')}
                  </div>
                )}
                {patient.medicalHistory && (
                  <div className="text-xs whitespace-pre-line">
                    <strong>Observaciones médicas:</strong> {patient.medicalHistory}
                  </div>
                )}
                {pe &&
                  (pe.bloodPressure ||
                    pe.mucosa ||
                    pe.lymphNodes ||
                    pe.tmj ||
                    pe.occlusion ||
                    pe.oralHygiene ||
                    pe.observations) && (
                    <div className="pt-1.5 border-t border-slate-200 grid grid-cols-2 gap-x-6 gap-y-1 text-[11px]">
                      {pe.bloodPressure && (
                        <div>
                          <strong>Signos vitales:</strong> {pe.bloodPressure}
                        </div>
                      )}
                      {pe.oralHygiene && (
                        <div>
                          <strong>Higiene oral:</strong> {pe.oralHygiene}
                        </div>
                      )}
                      {pe.mucosa && (
                        <div>
                          <strong>Mucosas:</strong> {pe.mucosa}
                        </div>
                      )}
                      {pe.lymphNodes && (
                        <div>
                          <strong>Ganglios:</strong> {pe.lymphNodes}
                        </div>
                      )}
                      {pe.tmj && (
                        <div>
                          <strong>ATM:</strong> {pe.tmj}
                        </div>
                      )}
                      {pe.occlusion && (
                        <div>
                          <strong>Oclusión:</strong> {pe.occlusion}
                        </div>
                      )}
                      {pe.observations && (
                        <div className="col-span-2">
                          <strong>Obs. examen físico:</strong> {pe.observations}
                        </div>
                      )}
                    </div>
                  )}
              </div>
            )}

            {/* Latest Odontogram Findings (no prices) */}
            {latestOdontogram && (
              <div className="space-y-1.5 print-break-inside-avoid">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Odontograma vigente · {latestOdontogram.label}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    {new Date(latestOdontogram.createdAt).toLocaleDateString('es-AR')}
                    {latestOdontogram.createdBy ? ` · ${latestOdontogram.createdBy}` : ''}
                  </div>
                </div>
                {odontogramFindings.length === 0 ? (
                  <div className="p-2.5 border border-slate-200 rounded text-slate-600">
                    Sin hallazgos patológicos o restauraciones marcadas.
                  </div>
                ) : (
                  <table className="w-full border border-slate-300 text-left text-[11px]">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-300">
                        <th className="px-2.5 py-1.5 font-semibold w-20">Pieza FDI</th>
                        <th className="px-2.5 py-1.5 font-semibold">Hallazgos / Tratamientos</th>
                        <th className="px-2.5 py-1.5 font-semibold">Observaciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {odontogramFindings.map((item) => (
                        <tr key={item.fdi}>
                          <td className="px-2.5 py-1.5 font-mono font-semibold">{item.fdi}</td>
                          <td className="px-2.5 py-1.5">{item.summary}</td>
                          <td className="px-2.5 py-1.5 text-slate-600">{item.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {latestOdontogram.notes && (
                  <div className="text-[11px] text-slate-600">
                    <strong>Nota odontograma:</strong> {latestOdontogram.notes}
                  </div>
                )}
              </div>
            )}

            {/* Clinical Evolutions */}
            <div className="space-y-1.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Evoluciones clínicas ({patientEvolutions.length})
              </div>
              {patientEvolutions.length === 0 ? (
                <div className="p-2.5 border border-slate-200 rounded text-slate-600">
                  Sin evoluciones clínicas registradas.
                </div>
              ) : (
                <table className="w-full border border-slate-300 text-left text-[11px]">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300">
                      <th className="px-2.5 py-1.5 font-semibold w-24">Fecha</th>
                      <th className="px-2.5 py-1.5 font-semibold w-16">Pieza</th>
                      <th className="px-2.5 py-1.5 font-semibold w-40">Prestación</th>
                      <th className="px-2.5 py-1.5 font-semibold">Detalle clínico</th>
                      <th className="px-2.5 py-1.5 font-semibold w-32">Profesional</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {patientEvolutions.map((ev) => (
                      <tr key={ev.id}>
                        <td className="px-2.5 py-1.5 font-mono whitespace-nowrap">
                          {formatBirthDateDisplay(ev.date)}
                        </td>
                        <td className="px-2.5 py-1.5 font-mono">{ev.toothFdi || '—'}</td>
                        <td className="px-2.5 py-1.5 font-semibold">{ev.procedure}</td>
                        <td className="px-2.5 py-1.5 whitespace-pre-line">{ev.description}</td>
                        <td className="px-2.5 py-1.5 text-slate-600">
                          {ev.professionalName || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Attached Files List */}
            {patientAttachments.length > 0 && (
              <div className="space-y-1.5 print-break-inside-avoid">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Estudios e imágenes adjuntos ({patientAttachments.length})
                </div>
                <table className="w-full border border-slate-300 text-left text-[11px]">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300">
                      <th className="px-2.5 py-1.5 font-semibold">Archivo</th>
                      <th className="px-2.5 py-1.5 font-semibold">Tipo</th>
                      <th className="px-2.5 py-1.5 font-semibold">Fecha</th>
                      <th className="px-2.5 py-1.5 font-semibold">Notas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {patientAttachments.map((f) => (
                      <tr key={f.id}>
                        <td className="px-2.5 py-1.5 font-medium">{f.name}</td>
                        <td className="px-2.5 py-1.5">{FILE_CATEGORY_LABELS[f.category]}</td>
                        <td className="px-2.5 py-1.5 font-mono">{f.capturedAt}</td>
                        <td className="px-2.5 py-1.5 text-slate-600">{f.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <Modal
        onClose={onClose}
        size="xl"
        zIndexClass="z-50"
        icon={
          <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/60 flex items-center justify-center text-teal-600 dark:text-teal-400">
            <Share2 className="w-4 h-4" />
          </div>
        }
        title="Compartir ficha clínica"
        subtitle={`${patient.fullName}${patient.dni ? ` · CI ${patient.dni}` : ''}`}
      >
        <div className="space-y-4">
          {/* Clinical Privacy Scope Banner */}
          <div className="p-3 rounded-xl bg-teal-50/70 dark:bg-teal-950/30 border border-teal-200/80 dark:border-teal-800/60 flex items-start gap-2.5 text-xs text-teal-900 dark:text-teal-100">
            <ShieldCheck className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              Se comparte la <strong>ficha clínica estándar completa</strong> (datos, alertas
              médicas, anamnesis, examen físico, odontograma, evoluciones y estudios).{' '}
              <strong>No incluye presupuestos, importes ni movimientos de Caja.</strong>
            </div>
          </div>

          {/* Mode Tabs */}
          <div className={segmentedTrackClass + ' w-full grid grid-cols-1 sm:grid-cols-2'}>
            <button
              type="button"
              onClick={() => setTab('external')}
              className={
                segmentedTabClass(tab === 'external') +
                ' flex items-center justify-center gap-1.5 !whitespace-normal text-center leading-tight'
              }
            >
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span>Colega externo (PDF + WhatsApp)</span>
            </button>
            <button
              type="button"
              onClick={() => setTab('internal')}
              className={
                segmentedTabClass(tab === 'internal') +
                ' flex items-center justify-center gap-1.5 !whitespace-normal text-center leading-tight'
              }
            >
              <Users className="w-3.5 h-3.5 shrink-0" />
              <span>Colega en OdontoHelper</span>
            </button>
          </div>

          {/* Optional Referral Note (only when owner or external) */}
          {(tab === 'external' || isOwner) && (
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                Motivo de derivación / Nota para el colega (opcional)
              </label>
              <AutoResizeTextarea
                minRows={2}
                value={referralNote}
                onChange={(e) => setReferralNote(e.target.value)}
                placeholder="Ej: Derivo para evaluación endodóntica en pieza 3.6. Presenta dolor a la percusión..."
                className="bg-slate-50 dark:bg-slate-800"
              />
            </div>
          )}

          {tab === 'external' ? (
            <div className="space-y-4">
              {/* Compact summary strip of what goes into PDF / WhatsApp */}
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div>
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">Alertas</div>
                  <div className="font-semibold text-slate-800 dark:text-slate-100 mt-0.5">
                    {patient.allergies || activeAlerts.length > 0
                      ? `${activeAlerts.length + (patient.allergies ? 1 : 0)} registradas`
                      : 'Sin alertas'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">Odontograma</div>
                  <div className="font-semibold text-slate-800 dark:text-slate-100 mt-0.5">
                    {latestOdontogram
                      ? `${odontogramFindings.length} piezas marcadas`
                      : 'Sin registros'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">Evoluciones</div>
                  <div className="font-semibold text-slate-800 dark:text-slate-100 mt-0.5 font-mono tabular-nums">
                    {patientEvolutions.length}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">Estudios</div>
                  <div className="font-semibold text-slate-800 dark:text-slate-100 mt-0.5 font-mono tabular-nums">
                    {patientAttachments.length}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <Button
                  variant="primary"
                  size="md"
                  icon={<Printer className="w-4 h-4" />}
                  onClick={() => setPrintingSheet(true)}
                >
                  Imprimir / Guardar PDF
                </Button>

                <a
                  href={externalWhatsAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonClass({ variant: 'whatsapp', size: 'md' })}
                >
                  <WhatsAppIcon className="w-4 h-4" />
                  <span>Enviar por WhatsApp</span>
                </a>

                <Button
                  variant="secondary"
                  size="md"
                  icon={
                    copiedSummary ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )
                  }
                  onClick={() =>
                    handleCopyText(
                      externalWhatsAppText,
                      'Resumen clínico copiado al portapapeles (sin precios).'
                    )
                  }
                >
                  {copiedSummary ? 'Copiado' : 'Copiar resumen'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {!isOwner ? (
                <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-800/60 bg-blue-50/70 dark:bg-blue-950/30 space-y-3 text-xs">
                  <div className="flex items-start gap-2.5 text-blue-950 dark:text-blue-100">
                    <ShieldAlert className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div className="space-y-1 leading-relaxed">
                      <p className="font-semibold">
                        Esta ficha fue compartida por{' '}
                        {incomingShare?.ownerName || 'el consultorio titular'}.
                      </p>
                      <p className="text-blue-800 dark:text-blue-200/90">
                        Solo el consultorio titular puede invitar a nuevos colegas. Vos podés
                        seguir registrando evoluciones, odontogramas y radiografías en tiempo real.
                      </p>
                    </div>
                  </div>
                  {incomingShare && (
                    <div className="flex justify-center sm:justify-end">
                      <Button
                        variant="dangerSoft"
                        size="sm"
                        icon={<Unlink className="w-3.5 h-3.5" />}
                        onClick={() =>
                          openConfirm({
                            title: '¿Desvincular ficha compartida?',
                            description: `Dejarás de ver "${patient.fullName}" y sus evoluciones compartidas en tu consultorio.`,
                            confirmText: 'Desvincular',
                            cancelText: 'Cancelar',
                            isDestructive: true,
                            onConfirm: async () => {
                              await unlinkPatientShare(incomingShare.id);
                              onClose();
                            },
                          })
                        }
                      >
                        Desvincular de mi consultorio
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    Generá un <strong>enlace de un solo uso</strong> y envialo por WhatsApp. Cuando
                    el colega lo acepte en OdontoHelper, el paciente quedará vinculado en tiempo
                    real entre ambos consultorios (lo que registre cada colega es inmutable).
                  </div>

                  <div className="flex justify-center sm:justify-end">
                    <Button
                      variant="primary"
                      size="md"
                      className="w-full sm:w-auto"
                      disabled={creatingInvite}
                      icon={<Link2 className="w-4 h-4" />}
                      onClick={handleGenerateInvite}
                    >
                      {creatingInvite
                        ? 'Generando enlace...'
                        : 'Generar enlace único de WhatsApp'}
                    </Button>
                  </div>

                  {latestGeneratedShare && (
                    <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800/70 bg-emerald-50/70 dark:bg-emerald-950/30 space-y-2.5 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-emerald-900 dark:text-emerald-200">
                          Enlace único listo para enviar
                        </span>
                        <Badge tone="emerald" size="xs">
                          Un solo uso
                        </Badge>
                      </div>
                      <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-emerald-200/80 dark:border-emerald-800/60 font-mono text-[11px] text-slate-700 dark:text-slate-200 break-all select-all">
                        {buildShareUrl(latestGeneratedShare.inviteToken)}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <a
                          href={buildInviteWaUrl(latestGeneratedShare)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={buttonClass({ variant: 'whatsapp', size: 'sm' })}
                        >
                          <WhatsAppIcon className="w-4 h-4" />
                          <span>Enviar por WhatsApp</span>
                        </a>
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={
                            copiedInviteId === latestGeneratedShare.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )
                          }
                          onClick={() =>
                            handleCopyText(
                              buildShareUrl(latestGeneratedShare.inviteToken),
                              'Enlace de derivación copiado.',
                              latestGeneratedShare.id
                            )
                          }
                        >
                          {copiedInviteId === latestGeneratedShare.id ? 'Copiado' : 'Copiar enlace'}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Active / Pending Shares List */}
                  <div className="space-y-2 pt-1">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Vínculos de este paciente ({patientShareLinks.length})
                    </div>
                    {patientShareLinks.length === 0 ? (
                      <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500">
                        Todavía no compartiste esta ficha con colegas en OdontoHelper.
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-200/70 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                        {patientShareLinks.map((share) => {
                          const isAccepted = share.status === 'accepted';
                          return (
                            <div
                              key={share.id}
                              className="p-3 bg-white dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs"
                            >
                              <div className="min-w-0 space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge tone={isAccepted ? 'teal' : 'amber'} size="xs">
                                    {isAccepted ? (
                                      <>
                                        <Users className="w-3 h-3" />
                                        <span>Vinculado en tiempo real</span>
                                      </>
                                    ) : (
                                      <>
                                        <Clock className="w-3 h-3" />
                                        <span>Pendiente de aceptación</span>
                                      </>
                                    )}
                                  </Badge>
                                  {isAccepted && share.recipientName && (
                                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                                      {share.recipientName}
                                      {share.recipientSpecialty
                                        ? ` (${share.recipientSpecialty})`
                                        : ''}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                                  Creado el{' '}
                                  {new Date(share.createdAt).toLocaleDateString('es-AR')}
                                  {share.acceptedAt
                                    ? ` · Aceptado ${new Date(
                                        share.acceptedAt
                                      ).toLocaleDateString('es-AR')}`
                                    : ''}
                                </div>
                                {share.referralNote && (
                                  <div className="text-[11px] text-slate-600 dark:text-slate-300 break-words">
                                    Nota: {share.referralNote}
                                  </div>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center justify-end sm:justify-start gap-1.5 shrink-0">
                                {!isAccepted && (
                                  <>
                                    <a
                                      href={buildInviteWaUrl(share)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={buttonClass({ variant: 'whatsapp', size: 'xs' })}
                                      title="Enviar enlace por WhatsApp"
                                    >
                                      <WhatsAppIcon className="w-3.5 h-3.5" />
                                      <span>WhatsApp</span>
                                    </a>
                                    <Button
                                      variant="secondary"
                                      size="xs"
                                      icon={
                                        copiedInviteId === share.id ? (
                                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                                        ) : (
                                          <Copy className="w-3.5 h-3.5" />
                                        )
                                      }
                                      onClick={() =>
                                        handleCopyText(
                                          buildShareUrl(share.inviteToken),
                                          'Enlace copiado.',
                                          share.id
                                        )
                                      }
                                    >
                                      Copiar
                                    </Button>
                                  </>
                                )}
                                <Button
                                  variant="dangerSoft"
                                  size="xs"
                                  icon={<Unlink className="w-3.5 h-3.5" />}
                                  onClick={() =>
                                    openConfirm({
                                      title: isAccepted
                                        ? '¿Desvincular colega de esta ficha?'
                                        : '¿Revocar enlace compartido?',
                                      description: isAccepted
                                        ? `${
                                            share.recipientName || 'El colega'
                                          } dejará de tener acceso a esta ficha clínica en tiempo real.`
                                        : 'El enlace pendiente dejará de funcionar inmediatamente.',
                                      confirmText: isAccepted ? 'Desvincular' : 'Revocar',
                                      cancelText: 'Cancelar',
                                      isDestructive: true,
                                      onConfirm: () => unlinkPatientShare(share.id),
                                    })
                                  }
                                >
                                  {isAccepted ? 'Desvincular' : 'Revocar'}
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </Modal>
      {printPortal}
    </>
  );
};
