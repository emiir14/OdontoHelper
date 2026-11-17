import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  CalendarCheck,
  CalendarPlus,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  Download,
  Edit2,
  FileAudio,
  FileText,
  FlaskConical,
  History,
  Image as ImageIcon,
  Lock,
  Mail,
  MapPin,
  MessageCircle,
  Mic,
  MoreVertical,
  Phone,
  Plus,
  Printer,
  Search,
  Share2,
  ShieldAlert,
  Smile,
  Trash2,
  Upload,
  User,
  UserPlus,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { formatTimeDisplay } from '../core/export/formatter';
import {
  COMMON_DENTAL_PROCEDURES,
  DEFAULT_CURRENCY,
  PAYMENT_METHOD_LABELS,
  buildAppointmentIcs,
  calculateAgeFromBirthDate,
  calculateSingleCurrencyBalance,
  formatBirthDateDisplay,
  formatMoney,
  generateAppointmentMailtoUrl,
  generateGoogleCalendarUrl,
  generateWhatsAppUrl,
  getPatientPendingLabAlerts,
} from '../core/clinic/clinicHelpers';
import {
  AppointmentStatus,
  EvolutionHighlightColor,
  LabOrderStatus,
  Patient,
  PatientAnamnesis,
  PatientFileAttachment,
  PatientFileCategory,
  PatientPhysicalExam,
} from '../core/types';
import { useAppStore } from '../store/useAppStore';
import { TransactionModal } from './CajaView';
import { OdontogramPanel } from './OdontogramPanel';
import { PeriodontogramPanel } from './PeriodontogramPanel';
import { TreatmentPlanCard, TreatmentPlanModal } from './PresupuestosView';
import { PatientEditModal } from './patient/PatientEditModal';
import { PatientNextControlModal } from './patient/PatientNextControlModal';

type PatientSubView =
  | 'overview'
  | 'cuentas'
  | 'historia'
  | 'archivos'
  | 'cuestionario'
  | 'odontograma'
  | 'citas_pendientes'
  | 'historial_citas'
  | 'trabajos_lab';

const ANAMNESIS_LABELS: Array<{ key: keyof PatientAnamnesis; label: string }> = [
  { key: 'hypertension', label: 'Hipertensión arterial' },
  { key: 'diabetes', label: 'Diabetes' },
  { key: 'heartCondition', label: 'Cardiopatías / Marcapasos' },
  { key: 'coagulationDisorder', label: 'Trastornos de coagulación' },
  { key: 'anesthesiaReaction', label: 'Reacción a anestesia' },
  { key: 'bruxism', label: 'Bruxismo / ATM' },
  { key: 'smoking', label: 'Tabaquismo' },
  { key: 'pregnancy', label: 'Embarazo / Lactancia' },
  { key: 'infectiousHistory', label: 'Antecedentes infecciosos' },
  { key: 'takesMedication', label: 'Medicación habitual' },
];

const HIGHLIGHT_OPTIONS: Array<{
  id: EvolutionHighlightColor;
  label: string;
  dotClass: string;
  cardClass: string;
}> = [
  {
    id: 'default',
    label: 'Estándar',
    dotClass: 'bg-slate-400',
    cardClass: 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800',
  },
  {
    id: 'teal',
    label: 'Realizado',
    dotClass: 'bg-teal-500',
    cardClass: 'bg-teal-50/50 dark:bg-teal-950/25 border-teal-200/70 dark:border-teal-900/50',
  },
  {
    id: 'blue',
    label: 'Control / Plan',
    dotClass: 'bg-blue-500',
    cardClass: 'bg-blue-50/50 dark:bg-blue-950/25 border-blue-200/70 dark:border-blue-900/50',
  },
  {
    id: 'amber',
    label: 'Seguimiento',
    dotClass: 'bg-amber-500',
    cardClass: 'bg-amber-50/60 dark:bg-amber-950/25 border-amber-200/70 dark:border-amber-900/50',
  },
  {
    id: 'rose',
    label: 'Alerta / Urgencia',
    dotClass: 'bg-rose-500',
    cardClass: 'bg-rose-50/60 dark:bg-rose-950/25 border-rose-200/70 dark:border-rose-900/50',
  },
];

const FILE_CATEGORY_LABELS: Record<PatientFileCategory, string> = {
  radiografia: 'Radiografía',
  foto_clinica: 'Foto clínica',
  documento: 'Estudio / PDF',
  consentimiento: 'Consentimiento',
};

const APPT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmado',
  waiting: 'En sala',
  in_progress: 'En atención',
  completed: 'Completado',
  cancelled: 'Cancelado',
};

const LAB_STATUS_LABELS: Record<LabOrderStatus, string> = {
  sin_enviar: 'Sin enviar',
  en_laboratorio: 'En laboratorio',
  en_clinica: 'En clínica',
  instalado: 'Instalado',
};

export const PatientSearchView: React.FC = () => {
  const {
    patients,
    sessions,
    appointments,
    professionals,
    activeProfessionalId,
    clinicalEvolutions,
    treatmentPlans,
    financialTransactions,
    labOrders,
    patientFiles,
    selectedPatientId,
    selectPatient,
    updatePatient,
    deletePatient,
    updateAppointmentStatus,
    startRecording,
    createEvolutionEntry,
    deleteEvolutionEntry,
    updateTreatmentPlan,
    toggleTreatmentItemCompleted,
    deleteTreatmentPlan,
    deleteFinancialTransaction,
    addPatientFile,
    deletePatientFile,
    setView,
    openConfirm,
    showToast,
    settings,
    canAccessFinance,
  } = useAppStore();

  const [query, setQuery] = useState('');
  const [insuranceFilter, setInsuranceFilter] = useState('all');

  // Card Modal & SubView State
  const [subView, setSubView] = useState<PatientSubView>('overview');
  const [menuOpen, setMenuOpen] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showNextControlModal, setShowNextControlModal] = useState(false);

  // Sub-tabs inside Cuentas & Odontograma
  const [cuentasTab, setCuentasTab] = useState<'movimientos' | 'presupuestos'>('movimientos');
  const [chartSubTab, setChartSubTab] = useState<'odontogram' | 'periodontogram'>('odontogram');

  // Cuestionario accordions
  const [anamnesisOpen, setAnamnesisOpen] = useState(false);
  const [physicalExamOpen, setPhysicalExamOpen] = useState(false);
  const [physicalDraft, setPhysicalDraft] = useState<PatientPhysicalExam>({});
  const [allergiesDraft, setAllergiesDraft] = useState('');
  const [medicalHistoryDraft, setMedicalHistoryDraft] = useState('');
  const [medicationDetailDraft, setMedicationDetailDraft] = useState('');

  // Evolution composer state
  const [showEvolutionForm, setShowEvolutionForm] = useState(false);
  const [evolDate, setEvolDate] = useState(new Date().toISOString().slice(0, 10));
  const [evolTooth, setEvolTooth] = useState('');
  const [evolProcedure, setEvolProcedure] = useState('');
  const [evolDescription, setEvolDescription] = useState('');
  const [evolColor, setEvolColor] = useState<EvolutionHighlightColor>('teal');
  const [evolPin, setEvolPin] = useState('');

  // Budget & Ledger modal state
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [txModalType, setTxModalType] = useState<'payment' | 'charge' | null>(null);

  // Files & Images state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [fileCategory, setFileCategory] = useState<PatientFileCategory>('radiografia');
  const [fileNotes, setFileNotes] = useState('');
  const [fileFilter, setFileFilter] = useState<'all' | PatientFileCategory>('all');
  const [previewFile, setPreviewFile] = useState<PatientFileAttachment | null>(null);

  const menuRef = useRef<HTMLDivElement | null>(null);

  const activeProf = professionals.find((p) => p.id === activeProfessionalId);
  const activeCurrency = settings?.currency || DEFAULT_CURRENCY;
  const financeAllowed = canAccessFinance();
  const todayStr = new Date().toISOString().slice(0, 10);

  const selectedPatient: Patient | undefined = useMemo(
    () => (selectedPatientId ? patients.find((p) => p.id === selectedPatientId) : undefined),
    [patients, selectedPatientId]
  );

  // Reset sub-screen and drafts whenever selected patient changes
  useEffect(() => {
    setSubView('overview');
    setMenuOpen(false);
    setAnamnesisOpen(false);
    setPhysicalExamOpen(false);
    setShowEvolutionForm(false);
    if (selectedPatient) {
      setPhysicalDraft(selectedPatient.physicalExam || {});
      setAllergiesDraft(selectedPatient.allergies || '');
      setMedicalHistoryDraft(selectedPatient.medicalHistory || '');
      setMedicationDetailDraft(selectedPatient.anamnesis?.medicationDetail || '');
    }
  }, [selectedPatient?.id]);

  // Close 3-dots menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [menuOpen]);

  const insurances = useMemo(() => {
    const set = new Set<string>();
    patients.forEach((p) => {
      if (p.insuranceProvider?.trim()) set.add(p.insuranceProvider.trim());
    });
    return Array.from(set).sort();
  }, [patients]);

  const filteredPatients = useMemo(() => {
    const q = query.trim().toLowerCase();
    return patients.filter((p) => {
      if (
        insuranceFilter !== 'all' &&
        (p.insuranceProvider || '').trim() !== insuranceFilter
      ) {
        return false;
      }
      if (!q) return true;
      return (
        p.fullName.toLowerCase().includes(q) ||
        (p.dni || '').toLowerCase().includes(q) ||
        (p.phone || '').toLowerCase().includes(q) ||
        (p.secondaryPhone || '').toLowerCase().includes(q) ||
        (p.insuranceProvider || '').toLowerCase().includes(q) ||
        (p.chiefComplaint || '').toLowerCase().includes(q)
      );
    });
  }, [patients, query, insuranceFilter]);

  const patientSessions = useMemo(() => {
    if (!selectedPatient) return [];
    const lowerName = selectedPatient.fullName.toLowerCase();
    return sessions.filter(
      (s) =>
        s.patientId === selectedPatient.id ||
        s.id === selectedPatient.sourceSessionId ||
        (s.reference || '').toLowerCase().includes(lowerName)
    );
  }, [selectedPatient, sessions]);

  const patientAppointments = useMemo(() => {
    if (!selectedPatient) return [];
    return appointments
      .filter(
        (a) =>
          !a.deletedAt &&
          (a.patientId === selectedPatient.id ||
            a.patientName.toLowerCase() === selectedPatient.fullName.toLowerCase())
      )
      .sort((a, b) => `${b.date} ${b.startTime}`.localeCompare(`${a.date} ${a.startTime}`));
  }, [selectedPatient, appointments]);

  const pendingAppointments = useMemo(() => {
    return patientAppointments
      .filter(
        (a) =>
          a.date >= todayStr &&
          a.status !== 'cancelled' &&
          a.status !== 'completed'
      )
      .sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));
  }, [patientAppointments, todayStr]);

  const nextAppointment = pendingAppointments[0];

  const patientEvolutions = useMemo(() => {
    if (!selectedPatient) return [];
    return clinicalEvolutions
      .filter((e) => !e.deletedAt && e.patientId === selectedPatient.id)
      .sort((a, b) => (b.date !== a.date ? b.date.localeCompare(a.date) : b.createdAt - a.createdAt));
  }, [selectedPatient, clinicalEvolutions]);

  const patientPlans = useMemo(() => {
    if (!selectedPatient) return [];
    return treatmentPlans.filter((p) => !p.deletedAt && p.patientId === selectedPatient.id);
  }, [selectedPatient, treatmentPlans]);

  const patientTransactions = useMemo(() => {
    if (!selectedPatient) return [];
    return financialTransactions
      .filter((tx) => !tx.deletedAt && tx.patientId === selectedPatient.id)
      .sort((a, b) => (b.date !== a.date ? b.date.localeCompare(a.date) : b.createdAt - a.createdAt));
  }, [selectedPatient, financialTransactions]);

  // Compute chronological running balance per row for the Cuentas table
  const transactionsWithRunningBalance = useMemo(() => {
    const asc = [...patientTransactions].sort((a, b) =>
      a.date !== b.date ? a.date.localeCompare(b.date) : a.createdAt - b.createdAt
    );
    let running = 0;
    const mapped = asc.map((tx) => {
      if (tx.type === 'charge') running += tx.amount;
      else if (tx.type === 'payment') running -= tx.amount;
      return { tx, runningBalance: Math.round(running * 100) / 100 };
    });
    return mapped.reverse();
  }, [patientTransactions]);

  const patientBalances = useMemo(() => {
    if (!selectedPatient) {
      return { charged: 0, paid: 0, balance: 0 };
    }
    return calculateSingleCurrencyBalance(selectedPatient.id, financialTransactions);
  }, [selectedPatient, financialTransactions]);

  const patientLabOrders = useMemo(() => {
    if (!selectedPatient) return [];
    const lower = selectedPatient.fullName.trim().toLowerCase();
    return labOrders.filter(
      (o) =>
        !o.deletedAt &&
        (o.patientId === selectedPatient.id || o.patientName.trim().toLowerCase() === lower)
    );
  }, [selectedPatient, labOrders]);

  const pendingLabAlerts = useMemo(() => {
    if (!selectedPatient) return [];
    return getPatientPendingLabAlerts(selectedPatient.id, selectedPatient.fullName, labOrders);
  }, [selectedPatient, labOrders]);

  const patientAttachments = useMemo(() => {
    if (!selectedPatient) return [];
    return patientFiles.filter(
      (f) => f.patientId === selectedPatient.id && (fileFilter === 'all' || f.category === fileFilter)
    );
  }, [selectedPatient, patientFiles, fileFilter]);

  const totalPatientAttachmentsCount = useMemo(() => {
    if (!selectedPatient) return 0;
    return patientFiles.filter((f) => f.patientId === selectedPatient.id).length;
  }, [selectedPatient, patientFiles]);

  const handleStartPatientDictation = (patient: Patient) => {
    startRecording(patient.fullName, !settings?.requireConsent || true, {
      patientId: patient.id,
      intakeTarget: 'consultation',
    });
  };

  const handleCreateEvolution = async (e: React.FormEvent, withPin: boolean) => {
    e.preventDefault();
    if (!selectedPatient) return;
    if (!evolProcedure.trim() || !evolDescription.trim()) {
      showToast('Completá la prestación y el detalle de la evolución clínica.', 'warning');
      return;
    }
    if (withPin && !evolPin.trim()) {
      showToast('Ingresá el PIN del profesional para firmar la evolución.', 'warning');
      return;
    }

    const created = await createEvolutionEntry(
      {
        patientId: selectedPatient.id,
        date: evolDate,
        toothFdi: evolTooth.trim() || undefined,
        procedure: evolProcedure.trim(),
        description: evolDescription.trim(),
        highlightColor: evolColor,
        professionalId: activeProf?.id,
        professionalName: activeProf?.fullName,
        signedWithPin: false,
      },
      withPin ? evolPin.trim() : undefined
    );

    if (created) {
      setEvolTooth('');
      setEvolProcedure('');
      setEvolDescription('');
      setEvolPin('');
      setShowEvolutionForm(false);
    }
  };

  const handleToggleAnamnesisFlag = async (key: keyof PatientAnamnesis) => {
    if (!selectedPatient) return;
    const current = selectedPatient.anamnesis || {};
    await updatePatient(selectedPatient.id, {
      anamnesis: {
        ...current,
        [key]: !current[key],
        updatedAt: Date.now(),
      },
    });
  };

  const handleSaveAnamnesisDetails = async () => {
    if (!selectedPatient) return;
    await updatePatient(selectedPatient.id, {
      allergies: allergiesDraft.trim() || undefined,
      medicalHistory: medicalHistoryDraft.trim() || undefined,
      anamnesis: {
        ...(selectedPatient.anamnesis || {}),
        medicationDetail: medicationDetailDraft.trim() || undefined,
        updatedAt: Date.now(),
      },
    });
    showToast('Anamnesis actualizada', 'success');
  };

  const handleSavePhysicalExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) return;
    await updatePatient(selectedPatient.id, {
      physicalExam: {
        ...physicalDraft,
        updatedAt: Date.now(),
      },
    });
    showToast('Examen físico guardado', 'success');
  };

  const handleUploadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedPatient) return;
    if (file.size > 15 * 1024 * 1024) {
      showToast('El archivo supera el límite de 15 MB para almacenamiento local.', 'warning');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) return;
      await addPatientFile({
        patientId: selectedPatient.id,
        name: file.name,
        category: fileCategory,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
        dataUrl,
        notes: fileNotes.trim() || undefined,
      });
      setFileNotes('');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleShareAccountStatement = async () => {
    if (!selectedPatient) return;
    const lines = [
      `OdontoHelper — Estado de cuenta`,
      `Paciente: ${selectedPatient.fullName}`,
      `Cargos totales: ${formatMoney(patientBalances.charged, activeCurrency)}`,
      `Total abonado: ${formatMoney(patientBalances.paid, activeCurrency)}`,
      `Saldo actual: ${formatMoney(patientBalances.balance, activeCurrency)}`,
      '',
      ...transactionsWithRunningBalance.slice(0, 8).map(
        ({ tx }) =>
          `${tx.date} · ${tx.concept}: ${tx.type === 'payment' ? '-' : '+'}${formatMoney(
            tx.amount,
            activeCurrency
          )}`
      ),
    ];
    const summary = lines.join('\n');
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(summary);
        showToast('Resumen de cuenta copiado al portapapeles para compartir.', 'success');
        return;
      } catch {
        // Fallback to print if clipboard fails
      }
    }
    window.print();
  };

  const handleDownloadIcs = (apptId: string) => {
    const appt = patientAppointments.find((a) => a.id === apptId);
    if (!appt) return;
    const ics = buildAppointmentIcs(appt);
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cita_${appt.date}_${appt.patientName.replace(/\s+/g, '_')}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const patientWhatsApp = selectedPatient
    ? generateWhatsAppUrl(
        selectedPatient.phone,
        `Hola ${selectedPatient.fullName}, te escribimos desde el consultorio OdontoHelper.`
      )
    : null;

  const patientMailUrl = selectedPatient
    ? generateAppointmentMailtoUrl(
        selectedPatient.email,
        'Contacto — OdontoHelper',
        `Hola ${selectedPatient.fullName},\n\n`
      )
    : null;

  const debtReminderText = selectedPatient
    ? `Hola ${selectedPatient.fullName}, te recordamos tu estado de cuenta en OdontoHelper. Saldo actual: ${formatMoney(
        patientBalances.balance,
        activeCurrency
      )}.`
    : '';

  const debtWaUrl = selectedPatient
    ? generateWhatsAppUrl(selectedPatient.phone, debtReminderText)
    : null;

  const activeAnamnesisFlags = selectedPatient
    ? ANAMNESIS_LABELS.filter((flag) => Boolean(selectedPatient.anamnesis?.[flag.key]))
    : [];

  const birthDateDisplay = selectedPatient?.birthDate
    ? formatBirthDateDisplay(selectedPatient.birthDate)
    : '';
  const calculatedAge = selectedPatient?.birthDate
    ? calculateAgeFromBirthDate(selectedPatient.birthDate)
    : null;

  const subViewTitles: Record<PatientSubView, string> = {
    overview: selectedPatient?.fullName || 'Ficha del paciente',
    cuentas: 'Cuentas',
    historia: 'Historia',
    archivos: 'Imágenes y Archivos',
    cuestionario: 'Cuestionario',
    odontograma: 'Odontograma',
    citas_pendientes: 'Citas Pendientes',
    historial_citas: 'Historial de Citas',
    trabajos_lab: 'Trabajos de Laboratorio',
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* =================================================== */}
      {/* SEARCH SCREEN: Buscando pacientes                   */}
      {/* =================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-3">
          <div className="w-9 h-5 rounded-full bg-teal-600/15 dark:bg-teal-900/50 flex items-center px-1">
            <span className="w-3.5 h-3.5 rounded-full bg-teal-600 dark:bg-teal-400 translate-x-3.5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Buscando pacientes
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Seleccioná un paciente para abrir su ficha completa, cuentas, historia, cuestionario y odontograma.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setView('patient-new')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 transition-colors shadow-xs min-h-[40px] self-start sm:self-auto whitespace-nowrap"
        >
          <UserPlus className="w-4 h-4" />
          <span>Nuevo paciente</span>
        </button>
      </div>

      {/* Centered Search Input + Mutualista Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 no-print">
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nombre, teléfono, CI o ID"
            className="w-full pl-4 pr-11 py-3 text-sm rounded-xl bg-white dark:bg-slate-900 border-b-2 border-slate-300 dark:border-slate-700 border-t border-x border-t-slate-200/70 border-x-slate-200/70 dark:border-t-slate-800 dark:border-x-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:border-b-teal-600 transition-colors shadow-2xs"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 absolute right-2.5 top-1/2 -translate-y-1/2"
              aria-label="Limpiar búsqueda"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          )}
        </div>

        {insurances.length > 0 && (
          <select
            value={insuranceFilter}
            onChange={(e) => setInsuranceFilter(e.target.value)}
            className="px-3.5 py-3 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:border-teal-500 min-h-[44px]"
          >
            <option value="all">Todas las coberturas</option>
            {insurances.map((ins) => (
              <option key={ins} value={ins}>
                {ins}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Patient Results List */}
      {patients.length === 0 ? (
        <div className="py-16 px-6 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-teal-50 dark:bg-teal-950/60 flex items-center justify-center text-teal-600 dark:text-teal-400 mb-4">
            <Users className="w-6 h-6" />
          </div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Aún no hay pacientes registrados
          </h2>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
            Crea tu primer paciente manualmente o dictando sus datos por voz desde el grabador local.
          </p>
          <button
            type="button"
            onClick={() => setView('patient-new')}
            className="mt-5 px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 transition-colors"
          >
            Registrar primer paciente
          </button>
        </div>
      ) : filteredPatients.length === 0 ? (
        <div className="py-12 px-6 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 text-xs text-slate-500 dark:text-slate-400">
          No se encontraron pacientes que coincidan con "{query}".
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden shadow-2xs no-print">
          {filteredPatients.map((patient) => {
            const bal = calculateSingleCurrencyBalance(patient.id, financialTransactions);
            const hasLab =
              getPatientPendingLabAlerts(patient.id, patient.fullName, labOrders).length > 0;
            return (
              <button
                key={patient.id}
                type="button"
                onClick={() => selectPatient(patient.id)}
                className="w-full text-left px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 overflow-hidden flex items-center justify-center text-slate-400 shrink-0">
                    {patient.photoDataUrl ? (
                      <img
                        src={patient.photoDataUrl}
                        alt={patient.fullName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-5 h-5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {patient.fullName}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums truncate mt-0.5">
                      {patient.phone || 'Sin teléfono'}
                      {patient.dni ? ` · CI ${patient.dni}` : ''}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {financeAllowed && bal.balance > 0 && (
                    <span className="hidden sm:inline text-[11px] font-mono tabular-nums font-semibold text-amber-700 dark:text-amber-400">
                      Saldo {formatMoney(bal.balance, activeCurrency)}
                    </span>
                  )}
                  {hasLab && (
                    <span className="hidden sm:inline text-[11px] font-medium text-blue-700 dark:text-blue-400">
                      Lab pendiente
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* =================================================== */}
      {/* PATIENT CARD MODAL (Overview + Full Sub-Views)      */}
      {/* =================================================== */}
      {selectedPatient && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 backdrop-blur-xs p-2 sm:p-5 print:static print:bg-transparent print:p-0">
          <div
            className={`w-full ${
              subView === 'overview' ? 'max-w-3xl' : 'max-w-6xl'
            } max-h-[92vh] print:max-h-none print:max-w-none rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl print:shadow-none print:border-none overflow-hidden flex flex-col transition-all`}
          >
            {/* Modal Header Bar */}
            <div
              className={`px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0 ${
                subView !== 'overview'
                  ? 'bg-teal-700 text-white border-teal-800'
                  : 'bg-white dark:bg-slate-900'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  type="button"
                  onClick={() => {
                    if (subView === 'overview') {
                      selectPatient(null);
                    } else {
                      setSubView('overview');
                    }
                  }}
                  className={`p-2 rounded-xl transition-colors no-print ${
                    subView !== 'overview'
                      ? 'text-white/90 hover:bg-white/15'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                  title={subView === 'overview' ? 'Volver a buscar pacientes' : 'Volver a ficha'}
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>

                <div className="min-w-0">
                  <h2
                    className={`text-base sm:text-lg font-bold truncate ${
                      subView !== 'overview' ? 'text-white' : 'text-slate-900 dark:text-slate-100'
                    }`}
                  >
                    {subViewTitles[subView]}
                  </h2>
                  {subView !== 'overview' && (
                    <div className="text-[11px] text-teal-100 truncate">
                      {selectedPatient.fullName}
                      {selectedPatient.dni ? ` · CI ${selectedPatient.dni}` : ''}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Header Actions */}
              <div className="flex items-center gap-1.5 shrink-0 no-print">
                {subView === 'overview' && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleStartPatientDictation(selectedPatient)}
                      className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 transition-colors"
                      title="Dictar consulta por voz"
                    >
                      <Mic className="w-3.5 h-3.5" />
                      <span>Dictar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowEditModal(true)}
                      className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title="Editar paciente"
                      aria-label="Editar paciente"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    {/* Three-dots Dropdown Menu */}
                    <div className="relative" ref={menuRef}>
                      <button
                        type="button"
                        onClick={() => setMenuOpen((v) => !v)}
                        className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Más opciones"
                        aria-label="Más opciones"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {menuOpen && (
                        <div className="absolute right-0 mt-1.5 w-60 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl py-1.5 z-50 text-xs">
                          <div className="px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                            Ver más
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setMenuOpen(false);
                              setSubView('citas_pendientes');
                            }}
                            className="w-full px-3 py-2 text-left flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                          >
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>Citas Pendientes</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setMenuOpen(false);
                              setSubView('historial_citas');
                            }}
                            className="w-full px-3 py-2 text-left flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                          >
                            <History className="w-3.5 h-3.5 text-slate-400" />
                            <span>Historial de Citas</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setMenuOpen(false);
                              setSubView('trabajos_lab');
                            }}
                            className="w-full px-3 py-2 text-left flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                          >
                            <FlaskConical className="w-3.5 h-3.5 text-slate-400" />
                            <span>Trabajos de Laboratorio</span>
                          </button>

                          <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                          <div className="px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                            Contacto
                          </div>
                          {patientMailUrl ? (
                            <a
                              href={patientMailUrl}
                              onClick={() => setMenuOpen(false)}
                              className="w-full px-3 py-2 text-left flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                            >
                              <Mail className="w-3.5 h-3.5 text-slate-400" />
                              <span>Enviar Correo</span>
                            </a>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setMenuOpen(false);
                                showToast('El paciente no tiene correo electrónico registrado.', 'warning');
                              }}
                              className="w-full px-3 py-2 text-left flex items-center gap-2.5 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                            >
                              <Mail className="w-3.5 h-3.5" />
                              <span>Enviar Correo</span>
                            </button>
                          )}

                          {patientWhatsApp ? (
                            <a
                              href={patientWhatsApp}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => setMenuOpen(false)}
                              className="w-full px-3 py-2 text-left flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                            >
                              <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Enviar Whatsapp</span>
                            </a>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setMenuOpen(false);
                                showToast('El paciente no tiene teléfono móvil registrado.', 'warning');
                              }}
                              className="w-full px-3 py-2 text-left flex items-center gap-2.5 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              <span>Enviar Whatsapp</span>
                            </button>
                          )}

                          <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                          <div className="px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                            Acciones
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setMenuOpen(false);
                              setShowEditModal(true);
                            }}
                            className="w-full px-3 py-2 text-left flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                            <span>Editar</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setMenuOpen(false);
                              openConfirm({
                                title: '¿Eliminar paciente?',
                                description: `Se eliminará la ficha de "${selectedPatient.fullName}".`,
                                confirmText: 'Eliminar',
                                cancelText: 'Cancelar',
                                isDestructive: true,
                                onConfirm: () => deletePatient(selectedPatient.id),
                              });
                            }}
                            className="w-full px-3 py-2 text-left flex items-center gap-2.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Eliminar</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {subView === 'cuentas' && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono tabular-nums font-bold px-2.5 py-1 rounded-lg bg-white/15">
                      Saldo: {formatMoney(patientBalances.balance, activeCurrency)}
                    </span>
                    <button
                      type="button"
                      onClick={handleShareAccountStatement}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white/15 hover:bg-white/25 transition-colors"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">COMPARTIR</span>
                    </button>
                  </div>
                )}

                {subView === 'historia' && (
                  <button
                    type="button"
                    onClick={() => handleStartPatientDictation(selectedPatient)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/15 hover:bg-white/25 transition-colors"
                  >
                    <Mic className="w-3.5 h-3.5" />
                    <span>Dictar evolución</span>
                  </button>
                )}
              </div>
            </div>

            {/* Modal Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {/* ================================================= */}
              {/* OVERVIEW CARD: Two-column Patient Summary + 6 Buttons */}
              {/* ================================================= */}
              {subView === 'overview' && (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                  {/* Left Summary Column */}
                  <div className="md:col-span-6 space-y-5">
                    {/* Avatar + CI + Group */}
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden flex items-center justify-center text-slate-400 shrink-0">
                        {selectedPatient.photoDataUrl ? (
                          <img
                            src={selectedPatient.photoDataUrl}
                            alt={selectedPatient.fullName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-8 h-8" />
                        )}
                      </div>
                      <div className="min-w-0 space-y-1 text-xs">
                        {selectedPatient.dni && (
                          <div className="font-mono tabular-nums font-semibold text-slate-700 dark:text-slate-200">
                            CI / ID: {selectedPatient.dni}
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                          <Users className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            {selectedPatient.groupTag ||
                              selectedPatient.insuranceProvider ||
                              'Sin grupos'}
                          </span>
                        </div>
                        {selectedPatient.insuranceProvider && (
                          <div className="text-[11px] text-teal-700 dark:text-teal-300 font-medium">
                            {selectedPatient.insuranceProvider}
                            {selectedPatient.insuranceNumber
                              ? ` · N° ${selectedPatient.insuranceNumber}`
                              : ''}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* CONTACTO */}
                    <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                      <div className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                        CONTACTO
                      </div>
                      <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-200 font-mono tabular-nums">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{selectedPatient.phone || 'Sin teléfono'}</span>
                        {selectedPatient.secondaryPhone && (
                          <span className="text-slate-400">· {selectedPatient.secondaryPhone}</span>
                        )}
                      </div>

                      {(birthDateDisplay || selectedPatient.age) && (
                        <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-200">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>
                            {birthDateDisplay || 'Fecha nac. no cargada'}
                            {calculatedAge !== null
                              ? ` (${calculatedAge} años)`
                              : selectedPatient.age
                              ? ` (${selectedPatient.age})`
                              : ''}
                          </span>
                        </div>
                      )}

                      {selectedPatient.email && (
                        <div className="flex items-center gap-2.5 text-slate-600 dark:text-slate-300 truncate">
                          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{selectedPatient.email}</span>
                        </div>
                      )}

                      {selectedPatient.address && (
                        <div className="flex items-center gap-2.5 text-slate-600 dark:text-slate-300">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{selectedPatient.address}</span>
                        </div>
                      )}
                    </div>

                    {/* PRÓXIMA CITA */}
                    <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                      <div className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                        PRÓXIMA CITA
                      </div>
                      {nextAppointment ? (
                        <button
                          type="button"
                          onClick={() => setSubView('citas_pendientes')}
                          className="w-full text-left flex items-center justify-between gap-2 p-2.5 rounded-xl bg-teal-50/70 dark:bg-teal-950/30 border border-teal-200/70 dark:border-teal-800/60 hover:bg-teal-100/70 transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <CalendarPlus className="w-4 h-4 text-teal-600 shrink-0" />
                            <div className="min-w-0">
                              <div className="font-semibold text-teal-900 dark:text-teal-200 font-mono tabular-nums">
                                {formatBirthDateDisplay(nextAppointment.date)} ·{' '}
                                {nextAppointment.startTime}
                              </div>
                              <div className="text-[11px] text-teal-700 dark:text-teal-300 truncate">
                                {nextAppointment.procedure}
                              </div>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-teal-600 shrink-0" />
                        </button>
                      ) : (
                        <div className="flex items-center gap-2.5 text-slate-500 dark:text-slate-400">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>Sin citas pendientes</span>
                        </div>
                      )}
                    </div>

                    {/* PRÓXIMO CONTROL (if assigned) */}
                    {selectedPatient.nextControlDate && (
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            Próximo Control
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowNextControlModal(true)}
                            className="text-[11px] font-semibold text-teal-700 dark:text-teal-300 hover:underline"
                          >
                            Editar
                          </button>
                        </div>
                        <div className="font-mono font-semibold text-slate-800 dark:text-slate-100">
                          {formatBirthDateDisplay(selectedPatient.nextControlDate)}
                        </div>
                        {selectedPatient.nextControlNote && (
                          <p className="text-[11px] text-slate-600 dark:text-slate-300">
                            {selectedPatient.nextControlNote}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Safety Alerts (Allergies / Pending Lab) */}
                    {(selectedPatient.allergies || pendingLabAlerts.length > 0) && (
                      <div className="space-y-2">
                        {selectedPatient.allergies &&
                          selectedPatient.allergies.toLowerCase() !== 'ninguna conocida' && (
                            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex items-start gap-2 text-xs text-amber-900 dark:text-amber-200">
                              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                              <div>
                                <span className="font-semibold">Alergias:</span>{' '}
                                {selectedPatient.allergies}
                              </div>
                            </div>
                          )}
                        {pendingLabAlerts.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setSubView('trabajos_lab')}
                            className="w-full p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 flex items-center justify-between gap-2 text-xs text-blue-900 dark:text-blue-200"
                          >
                            <span className="flex items-center gap-2 font-medium">
                              <FlaskConical className="w-4 h-4 text-blue-600 shrink-0" />
                              <span>
                                {pendingLabAlerts.length} trabajo(s) de laboratorio en curso
                              </span>
                            </span>
                            <ChevronRight className="w-4 h-4 text-blue-500 shrink-0" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right Column: The 6 Stacked Action Buttons */}
                  <div className="md:col-span-6 space-y-2.5">
                    {financeAllowed && (
                      <button
                        type="button"
                        onClick={() => setSubView('cuentas')}
                        className="w-full px-4 py-3.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm flex items-center justify-between gap-3 transition-colors shadow-xs"
                      >
                        <span className="flex items-center gap-3">
                          <Wallet className="w-4 h-4 shrink-0" />
                          <span>Cuentas</span>
                        </span>
                        <span className="text-xs font-mono tabular-nums text-teal-100">
                          {patientBalances.balance > 0
                            ? formatMoney(patientBalances.balance, activeCurrency)
                            : patientTransactions.length > 0
                            ? `${patientTransactions.length} mov.`
                            : ''}
                        </span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setSubView('historia')}
                      className="w-full px-4 py-3.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm flex items-center justify-between gap-3 transition-colors shadow-xs"
                    >
                      <span className="flex items-center gap-3">
                        <BookOpen className="w-4 h-4 shrink-0" />
                        <span>Historia</span>
                      </span>
                      {(patientEvolutions.length > 0 || patientSessions.length > 0) && (
                        <span className="text-xs font-mono tabular-nums text-teal-100">
                          {patientEvolutions.length + patientSessions.length}
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setSubView('archivos')}
                      className="w-full px-4 py-3.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm flex items-center justify-between gap-3 transition-colors shadow-xs"
                    >
                      <span className="flex items-center gap-3">
                        <ImageIcon className="w-4 h-4 shrink-0" />
                        <span>Imágenes y Archivos</span>
                      </span>
                      {totalPatientAttachmentsCount > 0 && (
                        <span className="text-xs font-mono tabular-nums text-teal-100">
                          {totalPatientAttachmentsCount}
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setSubView('cuestionario')}
                      className="w-full px-4 py-3.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm flex items-center justify-between gap-3 transition-colors shadow-xs"
                    >
                      <span className="flex items-center gap-3">
                        <ClipboardList className="w-4 h-4 shrink-0" />
                        <span>Cuestionario</span>
                      </span>
                      {activeAnamnesisFlags.length > 0 && (
                        <span className="text-xs font-mono tabular-nums text-teal-100">
                          {activeAnamnesisFlags.length} alertas
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setSubView('odontograma')}
                      className="w-full px-4 py-3.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm flex items-center justify-between gap-3 transition-colors shadow-xs"
                    >
                      <span className="flex items-center gap-3">
                        <Smile className="w-4 h-4 shrink-0" />
                        <span>Odontograma</span>
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowNextControlModal(true)}
                      className="w-full px-4 py-3.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm flex items-center justify-between gap-3 transition-colors shadow-xs"
                    >
                      <span className="flex items-center gap-3">
                        <CalendarCheck className="w-4 h-4 shrink-0" />
                        <span>Próximo Control</span>
                      </span>
                      {selectedPatient.nextControlDate && (
                        <span className="text-xs font-mono tabular-nums text-teal-100">
                          {formatBirthDateDisplay(selectedPatient.nextControlDate)}
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* ================================================= */}
              {/* SUB-VIEW 1: CUENTAS (Cuenta Corriente + Presupuestos) */}
              {/* ================================================= */}
              {subView === 'cuentas' && (
                <div className="space-y-4">
                  {/* Top Switcher & Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-3 no-print">
                    <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-0.5 text-xs">
                      <button
                        type="button"
                        onClick={() => setCuentasTab('movimientos')}
                        className={`px-3.5 py-1.5 rounded-lg font-semibold transition-colors ${
                          cuentasTab === 'movimientos'
                            ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-xs'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Movimientos ({patientTransactions.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setCuentasTab('presupuestos')}
                        className={`px-3.5 py-1.5 rounded-lg font-semibold transition-colors ${
                          cuentasTab === 'presupuestos'
                            ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-xs'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Presupuestos ({patientPlans.length})
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setTxModalType('payment')}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Registrar pago</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setTxModalType('charge')}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Agregar cargo</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowPlanModal(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Nuevo presupuesto</span>
                      </button>
                      {patientBalances.balance > 0 && debtWaUrl && (
                        <a
                          href={debtWaUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>Recordar saldo</span>
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>PDF</span>
                      </button>
                    </div>
                  </div>

                  {cuentasTab === 'movimientos' ? (
                    <>
                      {/* Balance Summary Cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                          <div className="text-[11px] text-slate-500">
                            Total cargos ({activeCurrency})
                          </div>
                          <div className="text-base font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-0.5">
                            {formatMoney(patientBalances.charged, activeCurrency)}
                          </div>
                        </div>
                        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                          <div className="text-[11px] text-slate-500">
                            Total pagado ({activeCurrency})
                          </div>
                          <div className="text-base font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 mt-0.5">
                            {formatMoney(patientBalances.paid, activeCurrency)}
                          </div>
                        </div>
                        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                          <div className="text-[11px] text-slate-500">
                            Saldo actual ({activeCurrency})
                          </div>
                          <div
                            className={`text-base font-bold font-mono tabular-nums mt-0.5 ${
                              patientBalances.balance > 0
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-teal-700 dark:text-teal-400'
                            }`}
                          >
                            {formatMoney(patientBalances.balance, activeCurrency)}
                          </div>
                        </div>
                      </div>

                      {transactionsWithRunningBalance.length === 0 ? (
                        <div className="py-12 text-center rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 text-xs text-slate-500">
                          No hay movimientos registrados en la cuenta corriente de este paciente.
                        </div>
                      ) : (
                        <div className="overflow-x-auto border border-slate-200/70 dark:border-slate-800 rounded-xl">
                          <table className="w-full text-xs text-left border-collapse">
                            <thead className="bg-slate-50 dark:bg-slate-800/70 text-[11px] text-slate-500 border-b border-slate-200/70 dark:border-slate-800">
                              <tr>
                                <th className="px-3.5 py-2.5 font-semibold">Fecha</th>
                                <th className="px-3.5 py-2.5 font-semibold">Concepto / Medio</th>
                                <th className="px-3.5 py-2.5 font-semibold text-right">Cargo</th>
                                <th className="px-3.5 py-2.5 font-semibold text-right">Pago</th>
                                <th className="px-3.5 py-2.5 font-semibold text-right">Saldo</th>
                                <th className="px-3.5 py-2.5 text-right no-print">Acción</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {transactionsWithRunningBalance.map(({ tx, runningBalance }) => (
                                <tr
                                  key={tx.id}
                                  className={
                                    tx.type === 'payment'
                                      ? 'bg-emerald-50/40 dark:bg-emerald-950/10'
                                      : ''
                                  }
                                >
                                  <td className="px-3.5 py-2.5 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                                    {formatBirthDateDisplay(tx.date)}
                                  </td>
                                  <td className="px-3.5 py-2.5">
                                    <div className="font-medium text-slate-900 dark:text-slate-100">
                                      {tx.concept}
                                    </div>
                                    <div className="text-[11px] text-slate-500">
                                      {PAYMENT_METHOD_LABELS[tx.paymentMethod]}
                                      {tx.receiptNumber ? ` · ${tx.receiptNumber}` : ''}
                                    </div>
                                  </td>
                                  <td className="px-3.5 py-2.5 font-mono tabular-nums text-right text-slate-700 dark:text-slate-200">
                                    {tx.type === 'charge'
                                      ? formatMoney(tx.amount, activeCurrency)
                                      : formatMoney(0, activeCurrency)}
                                  </td>
                                  <td className="px-3.5 py-2.5 font-mono tabular-nums text-right text-emerald-700 dark:text-emerald-400 font-semibold">
                                    {tx.type === 'payment'
                                      ? formatMoney(tx.amount, activeCurrency)
                                      : formatMoney(0, activeCurrency)}
                                  </td>
                                  <td className="px-3.5 py-2.5 font-mono tabular-nums text-right font-bold text-slate-900 dark:text-slate-100">
                                    {formatMoney(runningBalance, activeCurrency)}
                                  </td>
                                  <td className="px-3.5 py-2.5 text-right no-print">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openConfirm({
                                          title: '¿Anular movimiento?',
                                          description: `Se eliminará "${tx.concept}" de la cuenta corriente.`,
                                          confirmText: 'Anular',
                                          cancelText: 'Cancelar',
                                          isDestructive: true,
                                          onConfirm: () => deleteFinancialTransaction(tx.id),
                                        })
                                      }
                                      className="p-1 text-slate-400 hover:text-rose-600 rounded"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  ) : patientPlans.length === 0 ? (
                    <div className="py-10 text-center rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 text-xs text-slate-500">
                      Este paciente aún no tiene presupuestos asignados.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {patientPlans.map((plan) => (
                        <TreatmentPlanCard
                          key={plan.id}
                          plan={plan}
                          patient={selectedPatient}
                          onToggleItem={toggleTreatmentItemCompleted}
                          onChangeStatus={(id, status) => updateTreatmentPlan(id, { status })}
                          onDelete={(id) =>
                            openConfirm({
                              title: '¿Eliminar presupuesto?',
                              description: `Se eliminará "${plan.title}" de la ficha del paciente.`,
                              confirmText: 'Eliminar',
                              cancelText: 'Cancelar',
                              isDestructive: true,
                              onConfirm: () => deleteTreatmentPlan(id),
                            })
                          }
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ================================================= */}
              {/* SUB-VIEW 2: HISTORIA (Evoluciones cronológicas)   */}
              {/* ================================================= */}
              {subView === 'historia' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 no-print">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Registro cronológico de atenciones, evoluciones firmadas con PIN y dictados de voz.
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowEvolutionForm((v) => !v)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Nueva evolución</span>
                    </button>
                  </div>

                  {showEvolutionForm && (
                    <form
                      onSubmit={(e) => handleCreateEvolution(e, Boolean(evolPin.trim()))}
                      className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-3 no-print"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                            Fecha
                          </label>
                          <input
                            type="date"
                            value={evolDate}
                            onChange={(e) => setEvolDate(e.target.value)}
                            className="w-full px-2.5 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                            Pieza FDI
                          </label>
                          <input
                            type="text"
                            value={evolTooth}
                            onChange={(e) => setEvolTooth(e.target.value)}
                            placeholder="Ej: 1.6 / General"
                            className="w-full px-2.5 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                            Prestación / Procedimiento *
                          </label>
                          <input
                            type="text"
                            list="evol-procedures-list"
                            value={evolProcedure}
                            onChange={(e) => setEvolProcedure(e.target.value)}
                            placeholder="Ej: Control, endodoncia, ajuste de aparato..."
                            className="w-full px-2.5 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                            required
                          />
                          <datalist id="evol-procedures-list">
                            {COMMON_DENTAL_PROCEDURES.map((proc) => (
                              <option key={proc.code} value={proc.name} />
                            ))}
                          </datalist>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                          Detalle clínico de la evolución *
                        </label>
                        <textarea
                          rows={3}
                          value={evolDescription}
                          onChange={(e) => setEvolDescription(e.target.value)}
                          placeholder="Descripción de lo realizado, materiales, indicaciones..."
                          className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                          required
                        />
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="text-slate-500">Color:</span>
                          {HIGHLIGHT_OPTIONS.map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => setEvolColor(opt.id)}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] ${
                                evolColor === opt.id
                                  ? 'border-teal-600 bg-white dark:bg-slate-900 font-semibold'
                                  : 'border-transparent text-slate-500'
                              }`}
                            >
                              <span className={`w-2 h-2 rounded-full ${opt.dotClass}`} />
                              <span>{opt.label}</span>
                            </button>
                          ))}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <div className="relative">
                            <Lock className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                              type="password"
                              inputMode="numeric"
                              value={evolPin}
                              onChange={(e) => setEvolPin(e.target.value)}
                              placeholder={`PIN (${activeProf?.fullName?.split(' ')[0] || '1234'})`}
                              className="w-36 pl-8 pr-2.5 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={(e) => handleCreateEvolution(e, false)}
                            className="px-3 py-1.5 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-200/80 dark:bg-slate-700 hover:bg-slate-300"
                          >
                            Guardar sin firma
                          </button>
                          <button
                            type="submit"
                            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700"
                          >
                            {evolPin.trim() ? 'Firmar con PIN y guardar' : 'Guardar evolución'}
                          </button>
                        </div>
                      </div>
                    </form>
                  )}

                  {(selectedPatient.chiefComplaint || selectedPatient.notes) && (
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 space-y-1.5 text-xs">
                      {selectedPatient.chiefComplaint && (
                        <div>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            Motivo de consulta inicial:{' '}
                          </span>
                          <span className="text-slate-600 dark:text-slate-300">
                            {selectedPatient.chiefComplaint}
                          </span>
                        </div>
                      )}
                      {selectedPatient.notes && (
                        <div>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            Notas generales:{' '}
                          </span>
                          <span className="text-slate-600 dark:text-slate-300">
                            {selectedPatient.notes}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Chronological Evolutions Table / Timeline */}
                  {patientEvolutions.length === 0 ? (
                    <div className="py-12 text-center rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 text-xs text-slate-500">
                      No hay historias registradas para este paciente todavía.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-200/70 dark:divide-slate-800 border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden">
                      {patientEvolutions.map((ev) => {
                        const style =
                          HIGHLIGHT_OPTIONS.find((h) => h.id === ev.highlightColor) ||
                          HIGHLIGHT_OPTIONS[0];
                        return (
                          <div key={ev.id} className={`p-3.5 text-xs space-y-1 ${style.cardClass}`}>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${style.dotClass}`} />
                                <span className="font-mono tabular-nums font-semibold text-slate-600 dark:text-slate-300">
                                  {formatBirthDateDisplay(ev.date)}
                                </span>
                                <span className="font-bold text-slate-900 dark:text-slate-100">
                                  {ev.procedure}
                                </span>
                                {ev.toothFdi && (
                                  <span className="font-mono tabular-nums text-teal-700 dark:text-teal-300 font-semibold">
                                    · Pieza {ev.toothFdi}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                {ev.signedWithPin && (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Firmado PIN</span>
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() =>
                                    openConfirm({
                                      title: '¿Eliminar evolución clínica?',
                                      description: `Se borrará "${ev.procedure}" (${ev.date}).`,
                                      confirmText: 'Eliminar',
                                      cancelText: 'Cancelar',
                                      isDestructive: true,
                                      onConfirm: () => deleteEvolutionEntry(ev.id),
                                    })
                                  }
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded no-print"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                            <p className="text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed pl-4">
                              {ev.description}
                            </p>
                            {ev.professionalName && (
                              <div className="text-[11px] text-slate-500 pl-4">
                                Profesional: {ev.professionalName}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Linked Voice Sessions */}
                  {patientSessions.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        Consultas dictadas vinculadas ({patientSessions.length})
                      </h3>
                      <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200/70 dark:border-slate-800 rounded-xl overflow-hidden">
                        {patientSessions.map((sess) => (
                          <button
                            key={sess.id}
                            type="button"
                            onClick={() => setView('detail', sess.id)}
                            className="w-full text-left px-3.5 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex items-center justify-between gap-3 text-xs"
                          >
                            <span className="flex items-center gap-2 min-w-0">
                              <FileAudio className="w-4 h-4 text-teal-600 shrink-0" />
                              <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                                {sess.reference || sess.title}
                              </span>
                            </span>
                            <span className="text-slate-400 font-mono tabular-nums shrink-0">
                              {new Date(sess.createdAt).toLocaleDateString('es-UY')} ·{' '}
                              {formatTimeDisplay(sess.durationSec)}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ================================================= */}
              {/* SUB-VIEW 3: IMÁGENES Y ARCHIVOS                   */}
              {/* ================================================= */}
              {subView === 'archivos' && (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 space-y-3 no-print">
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                      <div className="sm:col-span-4">
                        <select
                          value={fileCategory}
                          onChange={(e) =>
                            setFileCategory(e.target.value as PatientFileCategory)
                          }
                          className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                        >
                          <option value="radiografia">Radiografía / Tomografía</option>
                          <option value="foto_clinica">Fotografía clínica</option>
                          <option value="documento">Estudio / Documento PDF</option>
                          <option value="consentimiento">Consentimiento firmado</option>
                        </select>
                      </div>

                      <div className="sm:col-span-5">
                        <input
                          type="text"
                          value={fileNotes}
                          onChange={(e) => setFileNotes(e.target.value)}
                          placeholder="Nota (ej: Periapical pieza 3.6)"
                          className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*,.pdf"
                          onChange={handleUploadFile}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>NUEVA IMAGEN</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Category filter */}
                  <div className="flex flex-wrap items-center gap-2 text-xs no-print">
                    {(
                      [
                        { id: 'all', label: 'Todos' },
                        { id: 'radiografia', label: 'Radiografías' },
                        { id: 'foto_clinica', label: 'Fotos clínicas' },
                        { id: 'documento', label: 'Estudios / PDF' },
                        { id: 'consentimiento', label: 'Consentimientos' },
                      ] as const
                    ).map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setFileFilter(f.id)}
                        className={`px-3 py-1.5 rounded-lg font-medium border ${
                          fileFilter === f.id
                            ? 'border-teal-600 bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300'
                            : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  {patientAttachments.length === 0 ? (
                    <div className="py-14 text-center rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 space-y-3">
                      <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                        Este paciente aún no tiene imágenes
                      </p>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>NUEVA IMAGEN</span>
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {patientAttachments.map((file) => {
                        const isImage = file.mimeType.startsWith('image/');
                        return (
                          <div
                            key={file.id}
                            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 overflow-hidden flex flex-col"
                          >
                            <button
                              type="button"
                              onClick={() => setPreviewFile(file)}
                              className="h-36 bg-slate-200/70 dark:bg-slate-900 flex items-center justify-center overflow-hidden relative group"
                            >
                              {isImage ? (
                                <img
                                  src={file.dataUrl}
                                  alt={file.name}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                />
                              ) : (
                                <div className="flex flex-col items-center gap-1.5 text-slate-500">
                                  <FileText className="w-8 h-8 text-teal-600" />
                                  <span className="text-[11px] font-medium">Documento PDF</span>
                                </div>
                              )}
                            </button>
                            <div className="p-3 space-y-1 flex-1 flex flex-col justify-between text-xs">
                              <div>
                                <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                                  {file.name}
                                </div>
                                <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                                  {FILE_CATEGORY_LABELS[file.category]} · {file.capturedAt}
                                </div>
                                {file.notes && (
                                  <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1">
                                    {file.notes}
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-800 no-print">
                                <button
                                  type="button"
                                  onClick={() => setPreviewFile(file)}
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-700 dark:text-teal-400 hover:underline"
                                >
                                  <ImageIcon className="w-3 h-3" />
                                  <span>Abrir</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    openConfirm({
                                      title: '¿Eliminar archivo local?',
                                      description: `Se eliminará "${file.name}" del almacenamiento local del navegador.`,
                                      confirmText: 'Eliminar',
                                      cancelText: 'Cancelar',
                                      isDestructive: true,
                                      onConfirm: () => deletePatientFile(file.id),
                                    })
                                  }
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ================================================= */}
              {/* SUB-VIEW 4: CUESTIONARIO (Anamnesis + Examen Físico) */}
              {/* ================================================= */}
              {subView === 'cuestionario' && (
                <div className="space-y-3">
                  {/* Accordion 1: Anamnesis */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
                    <button
                      type="button"
                      onClick={() => setAnamnesisOpen((v) => !v)}
                      className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          Anamnesis
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {activeAnamnesisFlags.length > 0
                            ? `${activeAnamnesisFlags.length} condiciones marcadas`
                            : 'Antecedentes sistémicos, alergias y medicación habitual'}
                        </div>
                      </div>
                      {anamnesisOpen ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </button>

                    {anamnesisOpen && (
                      <div className="p-4 border-t border-slate-200/70 dark:border-slate-800 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {ANAMNESIS_LABELS.map((flag) => {
                            const checked = Boolean(selectedPatient.anamnesis?.[flag.key]);
                            return (
                              <label
                                key={flag.key}
                                className="flex items-center gap-2.5 text-xs text-slate-800 dark:text-slate-200 cursor-pointer py-1"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => handleToggleAnamnesisFlag(flag.key)}
                                  className="accent-teal-600 rounded"
                                />
                                <span>{flag.label}</span>
                              </label>
                            );
                          })}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <div>
                            <label className="block text-[11px] font-medium text-slate-500 mb-1">
                              Alergias declaradas
                            </label>
                            <input
                              type="text"
                              value={allergiesDraft}
                              onChange={(e) => setAllergiesDraft(e.target.value)}
                              placeholder="Ej: Penicilina, látex, ninguna"
                              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-slate-500 mb-1">
                              Detalle de medicación
                            </label>
                            <input
                              type="text"
                              value={medicationDetailDraft}
                              onChange={(e) => setMedicationDetailDraft(e.target.value)}
                              placeholder="Ej: Losartán 50mg/día"
                              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                            />
                          </div>
                        </div>

                        <div className="text-xs">
                          <label className="block text-[11px] font-medium text-slate-500 mb-1">
                            Antecedentes médicos / observaciones
                          </label>
                          <textarea
                            rows={2}
                            value={medicalHistoryDraft}
                            onChange={(e) => setMedicalHistoryDraft(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                          />
                        </div>

                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={handleSaveAnamnesisDetails}
                            className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700"
                          >
                            Guardar Anamnesis
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Accordion 2: Examen Físico */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
                    <button
                      type="button"
                      onClick={() => setPhysicalExamOpen((v) => !v)}
                      className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          Examen Físico
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {selectedPatient.physicalExam?.updatedAt
                            ? `Última actualización: ${new Date(
                                selectedPatient.physicalExam.updatedAt
                              ).toLocaleDateString('es-UY')}`
                            : 'Signos vitales, mucosas, ganglios, ATM, oclusión e higiene oral'}
                        </div>
                      </div>
                      {physicalExamOpen ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </button>

                    {physicalExamOpen && (
                      <form
                        onSubmit={handleSavePhysicalExam}
                        className="p-4 border-t border-slate-200/70 dark:border-slate-800 space-y-3 text-xs"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-medium text-slate-500 mb-1">
                              Presión arterial / Signos vitales
                            </label>
                            <input
                              type="text"
                              value={physicalDraft.bloodPressure || ''}
                              onChange={(e) =>
                                setPhysicalDraft({ ...physicalDraft, bloodPressure: e.target.value })
                              }
                              placeholder="Ej: 120/80 mmHg"
                              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-slate-500 mb-1">
                              Higiene oral
                            </label>
                            <input
                              type="text"
                              value={physicalDraft.oralHygiene || ''}
                              onChange={(e) =>
                                setPhysicalDraft({ ...physicalDraft, oralHygiene: e.target.value })
                              }
                              placeholder="Buena / Regular / Deficiente"
                              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-slate-500 mb-1">
                              Mucosa oral y encías
                            </label>
                            <input
                              type="text"
                              value={physicalDraft.mucosa || ''}
                              onChange={(e) =>
                                setPhysicalDraft({ ...physicalDraft, mucosa: e.target.value })
                              }
                              placeholder="Ej: Rosada, sin lesiones"
                              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-slate-500 mb-1">
                              Ganglios y cuello
                            </label>
                            <input
                              type="text"
                              value={physicalDraft.lymphNodes || ''}
                              onChange={(e) =>
                                setPhysicalDraft({ ...physicalDraft, lymphNodes: e.target.value })
                              }
                              placeholder="Ej: Sin adenopatías palpables"
                              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-slate-500 mb-1">
                              ATM (Articulación temporomandibular)
                            </label>
                            <input
                              type="text"
                              value={physicalDraft.tmj || ''}
                              onChange={(e) =>
                                setPhysicalDraft({ ...physicalDraft, tmj: e.target.value })
                              }
                              placeholder="Ej: Apertura normal, sin ruidos ni dolor"
                              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-slate-500 mb-1">
                              Oclusión
                            </label>
                            <input
                              type="text"
                              value={physicalDraft.occlusion || ''}
                              onChange={(e) =>
                                setPhysicalDraft({ ...physicalDraft, occlusion: e.target.value })
                              }
                              placeholder="Ej: Normoclusión / Desgaste anterior"
                              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-slate-500 mb-1">
                            Observaciones del examen físico
                          </label>
                          <textarea
                            rows={2}
                            value={physicalDraft.observations || ''}
                            onChange={(e) =>
                              setPhysicalDraft({ ...physicalDraft, observations: e.target.value })
                            }
                            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                          />
                        </div>

                        <div className="flex justify-end">
                          <button
                            type="submit"
                            className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700"
                          >
                            Guardar Examen Físico
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                </div>
              )}

              {/* ================================================= */}
              {/* SUB-VIEW 5: ODONTOGRAMA Y PERIODONTOGRAMA         */}
              {/* ================================================= */}
              {subView === 'odontograma' && (
                <div className="space-y-4">
                  <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-0.5 text-xs no-print">
                    <button
                      type="button"
                      onClick={() => setChartSubTab('odontogram')}
                      className={`px-3.5 py-1.5 rounded-lg font-semibold transition-colors ${
                        chartSubTab === 'odontogram'
                          ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      Odontograma FDI interactivo
                    </button>
                    <button
                      type="button"
                      onClick={() => setChartSubTab('periodontogram')}
                      className={`px-3.5 py-1.5 rounded-lg font-semibold transition-colors ${
                        chartSubTab === 'periodontogram'
                          ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      Periodontograma
                    </button>
                  </div>

                  {chartSubTab === 'odontogram' ? (
                    <OdontogramPanel
                      patientId={selectedPatient.id}
                      patientName={selectedPatient.fullName}
                    />
                  ) : (
                    <PeriodontogramPanel
                      patientId={selectedPatient.id}
                      patientName={selectedPatient.fullName}
                    />
                  )}
                </div>
              )}

              {/* ================================================= */}
              {/* SUB-VIEW 6 & 7: CITAS PENDIENTES / HISTORIAL      */}
              {/* ================================================= */}
              {(subView === 'citas_pendientes' || subView === 'historial_citas') && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-slate-500">
                      {subView === 'citas_pendientes'
                        ? 'Turnos próximos y pendientes de atención para este paciente.'
                        : 'Registro histórico completo de citas agendadas, completadas y canceladas.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        selectPatient(null);
                        setView('agenda');
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700"
                    >
                      <CalendarPlus className="w-3.5 h-3.5" />
                      <span>Ir a Agenda</span>
                    </button>
                  </div>

                  {(() => {
                    const list =
                      subView === 'citas_pendientes' ? pendingAppointments : patientAppointments;
                    if (list.length === 0) {
                      return (
                        <div className="py-12 text-center rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 text-xs text-slate-500">
                          {subView === 'citas_pendientes'
                            ? 'Sin citas pendientes programadas.'
                            : 'No hay historial de citas registrado para este paciente.'}
                        </div>
                      );
                    }
                    return (
                      <div className="divide-y divide-slate-200/70 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                        {list.map((appt) => {
                          const waConfirm = generateWhatsAppUrl(
                            selectedPatient.phone,
                            `Hola ${selectedPatient.fullName}, te recordamos tu turno el ${formatBirthDateDisplay(
                              appt.date
                            )} a las ${appt.startTime} hs en OdontoHelper (${appt.procedure}).`
                          );
                          return (
                            <div
                              key={appt.id}
                              className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                            >
                              <div className="space-y-0.5 min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100">
                                    {formatBirthDateDisplay(appt.date)} · {appt.startTime}
                                  </span>
                                  <span className="text-slate-400">({appt.durationMin} min)</span>
                                  <span className="font-semibold text-teal-700 dark:text-teal-300">
                                    {APPT_STATUS_LABELS[appt.status]}
                                  </span>
                                </div>
                                <div className="font-medium text-slate-700 dark:text-slate-200">
                                  {appt.procedure}
                                </div>
                                {appt.professionalName && (
                                  <div className="text-[11px] text-slate-500">
                                    Profesional: {appt.professionalName}
                                  </div>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                                <select
                                  value={appt.status}
                                  onChange={(e) =>
                                    updateAppointmentStatus(
                                      appt.id,
                                      e.target.value as AppointmentStatus
                                    )
                                  }
                                  className="px-2.5 py-1.5 text-[11px] rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                                >
                                  {(Object.keys(APPT_STATUS_LABELS) as AppointmentStatus[]).map(
                                    (st) => (
                                      <option key={st} value={st}>
                                        {APPT_STATUS_LABELS[st]}
                                      </option>
                                    )
                                  )}
                                </select>
                                {waConfirm && (
                                  <a
                                    href={waConfirm}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 rounded-lg text-emerald-700 bg-emerald-50 dark:bg-emerald-950/50"
                                    title="Confirmar por WhatsApp"
                                  >
                                    <MessageCircle className="w-3.5 h-3.5" />
                                  </a>
                                )}
                                <a
                                  href={generateGoogleCalendarUrl(appt)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 rounded-lg text-slate-600 bg-slate-100 dark:bg-slate-800"
                                  title="Agregar a Google Calendar"
                                >
                                  <CalendarPlus className="w-3.5 h-3.5" />
                                </a>
                                <button
                                  type="button"
                                  onClick={() => handleDownloadIcs(appt.id)}
                                  className="p-1.5 rounded-lg text-slate-600 bg-slate-100 dark:bg-slate-800"
                                  title="Descargar archivo .ics"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* ================================================= */}
              {/* SUB-VIEW 8: TRABAJOS DE LABORATORIO               */}
              {/* ================================================= */}
              {subView === 'trabajos_lab' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-slate-500">
                      Órdenes protésicas y trabajos externos vinculados a {selectedPatient.fullName}.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        selectPatient(null);
                        setView('lab');
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700"
                    >
                      <FlaskConical className="w-3.5 h-3.5" />
                      <span>Ir a Laboratorio</span>
                    </button>
                  </div>

                  {patientLabOrders.length === 0 ? (
                    <div className="py-12 text-center rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 text-xs text-slate-500">
                      Este paciente no tiene trabajos de laboratorio registrados.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-200/70 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                      {patientLabOrders.map((order) => (
                        <div
                          key={order.id}
                          className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                        >
                          <div className="space-y-0.5">
                            <div className="font-semibold text-slate-900 dark:text-slate-100">
                              {order.workType}
                              {order.toothFdi ? ` · Pieza ${order.toothFdi}` : ''}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {order.providerName || 'Laboratorio'}
                              {order.shade ? ` · Color ${order.shade}` : ''}
                              {order.dueDate
                                ? ` · Entrega: ${formatBirthDateDisplay(order.dueDate)}`
                                : ''}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            {typeof order.cost === 'number' && order.cost > 0 && (
                              <span className="font-mono tabular-nums font-semibold text-slate-700 dark:text-slate-200">
                                {formatMoney(order.cost, activeCurrency)}
                              </span>
                            )}
                            <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                              {LAB_STATUS_LABELS[order.status]}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =================================================== */}
      {/* IN-PLACE MODALS (Editar Paciente, Próximo Control,  */}
      {/* Nuevo Presupuesto, Cargo/Pago, Preview Archivo)     */}
      {/* =================================================== */}
      {showEditModal && selectedPatient && (
        <PatientEditModal patient={selectedPatient} onClose={() => setShowEditModal(false)} />
      )}

      {showNextControlModal && selectedPatient && (
        <PatientNextControlModal
          patient={selectedPatient}
          onClose={() => setShowNextControlModal(false)}
        />
      )}

      {showPlanModal && selectedPatient && (
        <TreatmentPlanModal
          initialPatientId={selectedPatient.id}
          onClose={() => setShowPlanModal(false)}
        />
      )}

      {txModalType && selectedPatient && (
        <TransactionModal
          initialType={txModalType}
          initialPatientId={selectedPatient.id}
          onClose={() => setTxModalType(null)}
        />
      )}

      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-3xl max-h-[90vh] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                  {previewFile.name}
                </div>
                <div className="text-[11px] text-slate-500 font-mono">
                  {FILE_CATEGORY_LABELS[previewFile.category]} · {previewFile.capturedAt}
                  {previewFile.notes ? ` · ${previewFile.notes}` : ''}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={previewFile.dataUrl}
                  download={previewFile.name}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60"
                >
                  Descargar
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewFile(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-slate-950 flex items-center justify-center">
              {previewFile.mimeType.startsWith('image/') ? (
                <img
                  src={previewFile.dataUrl}
                  alt={previewFile.name}
                  className="max-w-full max-h-[75vh] object-contain"
                />
              ) : (
                <iframe
                  src={previewFile.dataUrl}
                  title={previewFile.name}
                  className="w-full h-[72vh] bg-white rounded-lg"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
