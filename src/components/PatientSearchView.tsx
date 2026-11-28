import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Calendar,
  CalendarCheck,
  CalendarPlus,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  Download,
  Edit2,
  ExternalLink,
  Eye,
  FileAudio,
  FileText,
  FlaskConical,
  History,
  Image as ImageIcon,
  List,
  Lock,
  Mail,
  MapPin,
  Mic,
  MoreVertical,
  Phone,
  Plus,
  Printer,
  RotateCcw,
  RotateCw,
  Search,
  Share2,
  ShieldAlert,
  Smile,
  Table2,
  Trash2,
  Unlink,
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
  calculateAgeFromBirthDate,
  downloadAppointmentIcsFile,
  downloadCsvFile,
  formatBirthDateDisplay,
  formatCurrencyHeading,
  formatMoney,
  generateAppointmentMailtoUrl,
  generateGoogleCalendarUrl,
  generateWhatsAppUrl,
  lookupPendingLabAlerts,
  toLocalIsoDate,
} from '../core/clinic/clinicHelpers';
import { canMutateClinicalRecord } from '../core/clinic/referralExport';
import { PatientSubViewSlug } from '../core/routing/appRoutes';
import { clearLocalDraft, loadLocalDraft, saveLocalDraft } from '../core/utils/localDrafts';
import { revealExpandedSection } from '../core/utils/scrollReveal';
import {
  AppointmentStatus,
  EvolutionHighlightColor,
  LabOrder,
  LabOrderStatus,
  Patient,
  PatientAnamnesis,
  PatientFileAttachment,
  PatientFileCategory,
  PatientPhysicalExam,
} from '../core/types';
import { useAppStore } from '../store/useAppStore';
import { TransactionModal } from './CajaView';
import { LabOrderDetailModal } from './LabOrderDetailModal';
import { LabOrderModal } from './LabOrderModal';
import { OdontogramPanel } from './OdontogramPanel';
import { TreatmentPlanCard, TreatmentPlanModal } from './PresupuestosView';
import { SharePatientModal } from './SharePatientModal';
import { PatientEditModal } from './patient/PatientEditModal';
import { PatientNextControlModal } from './patient/PatientNextControlModal';
import { AnchoredDropdown } from './ui/AnchoredDropdown';
import { AutoResizeTextarea } from './ui/AutoResizeTextarea';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import {
  DataTable,
  DataTableColumn,
  DataTableSortState,
  parseSortState,
  serializeSortState,
} from './ui/DataTable';
import { Modal } from './ui/Modal';
import { SearchInput } from './ui/SearchInput';
import { VirtualList } from './ui/VirtualList';
import { WhatsAppIcon } from './ui/WhatsAppIcon';
import { buttonClass, dropdownClass, emptyStateClass, kpiCardClass } from './ui/uiClasses';

type PatientSubView = PatientSubViewSlug;

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
    currentView,
    workspace,
    authUserId,
    patients,
    sessions,
    appointments,
    professionals,
    activeProfessionalId,
    clinicalEvolutions,
    labOrders,
    patientFiles,
    patientFilesLoading,
    patientFilesCloudError,
    patientIndexes,
    patientShares,
    selectedPatientId,
    selectedPatientSubView,
    setPatientSubView,
    selectPatient,
    startEditPatient,
    updatePatient,
    deletePatient,
    deletePatientsBulk,
    unlinkPatientShare,
    updateAppointmentStatus,
    startRecording,
    createEvolutionEntry,
    deleteEvolutionEntry,
    updateTreatmentPlan,
    toggleTreatmentItemCompleted,
    deleteTreatmentPlan,
    deleteFinancialTransaction,
    updateLabOrderStatus,
    deleteLabOrder,
    addPatientFile,
    deletePatientFile,
    setView,
    setAgendaDate,
    openConfirm,
    logActivity,
    showToast,
    settings,
    setDraftDirty,
    guardNavigation,
    moduleQuery,
    setModuleQuery,
  } = useAppStore();

  const [query, setQuery] = useState('');
  const [insuranceFilter, setInsuranceFilter] = useState('all');
  const [directoryMode, setDirectoryMode] = useState<'list' | 'table'>(
    currentView === 'manage-patients' ? 'table' : 'list'
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (currentView === 'manage-patients') {
      setDirectoryMode('table');
    }
  }, [currentView]);

  useEffect(() => {
    const valid = new Set(patients.map((p) => p.id));
    setSelectedIds((prev) => {
      const next = prev.filter((id) => valid.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [patients]);

  const defaultSort: DataTableSortState = { columnId: 'fullName', direction: 'asc' };
  const currentSort = useMemo(
    () => parseSortState(moduleQuery.sort) ?? defaultSort,
    [moduleQuery.sort]
  );
  const currentPage = moduleQuery.page || 1;
  const currentPageSize = moduleQuery.pageSize || 25;

  // Card Modal & URL-synced SubView State
  const subView = selectedPatientSubView;
  const setSubView = setPatientSubView;
  const [menuOpen, setMenuOpen] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showNextControlModal, setShowNextControlModal] = useState(false);

  // Sub-tabs inside Cuentas (synced with URL moduleQuery.tab)
  const cuentasTab: 'movimientos' | 'presupuestos' =
    moduleQuery.tab === 'presupuestos' ? 'presupuestos' : 'movimientos';
  const setCuentasTab = (tab: 'movimientos' | 'presupuestos') => {
    setModuleQuery({ tab: tab === 'presupuestos' ? 'presupuestos' : undefined });
  };

  // Cuestionario accordions
  const [anamnesisOpen, setAnamnesisOpen] = useState(false);
  const [physicalExamOpen, setPhysicalExamOpen] = useState(false);
  const [physicalDraft, setPhysicalDraft] = useState<PatientPhysicalExam>({});
  const [allergiesDraft, setAllergiesDraft] = useState('');
  const [medicalHistoryDraft, setMedicalHistoryDraft] = useState('');
  const [medicationDetailDraft, setMedicationDetailDraft] = useState('');

  // Evolution composer state
  const [showEvolutionForm, setShowEvolutionForm] = useState(false);
  const [evolDate, setEvolDate] = useState(toLocalIsoDate());
  const [evolTooth, setEvolTooth] = useState('');
  const [evolProcedure, setEvolProcedure] = useState('');
  const [evolDescription, setEvolDescription] = useState('');
  const [evolColor, setEvolColor] = useState<EvolutionHighlightColor>('teal');

  // Recovered draft indicators
  const [anamnesisDraftRestored, setAnamnesisDraftRestored] = useState(false);
  const [physicalDraftRestored, setPhysicalDraftRestored] = useState(false);
  const [evolutionDraftRestored, setEvolutionDraftRestored] = useState(false);
  const draftPatInitRef = useRef<string | null>(null);

  // Budget, Ledger & Lab modal state
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [txModalType, setTxModalType] = useState<'payment' | 'charge' | null>(null);
  const [showLabModal, setShowLabModal] = useState(false);
  const [viewingPatientLabOrderId, setViewingPatientLabOrderId] = useState<string | null>(null);
  const [editingPatientLabOrder, setEditingPatientLabOrder] = useState<LabOrder | null>(null);

  // Files & Images state (category filter synced with URL moduleQuery.category)
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [fileCategory, setFileCategory] = useState<PatientFileCategory>('radiografia');
  const [fileNotes, setFileNotes] = useState('');
  const fileFilter: 'all' | PatientFileCategory =
    moduleQuery.category === 'radiografia' ||
    moduleQuery.category === 'foto_clinica' ||
    moduleQuery.category === 'documento' ||
    moduleQuery.category === 'consentimiento'
      ? moduleQuery.category
      : 'all';
  const setFileFilter = (cat: 'all' | PatientFileCategory) => {
    setModuleQuery({ category: cat === 'all' ? undefined : cat });
  };
  const [previewFile, setPreviewFile] = useState<PatientFileAttachment | null>(null);

  const menuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const anamnesisRef = useRef<HTMLDivElement | null>(null);
  const physicalExamRef = useRef<HTMLDivElement | null>(null);

  const activeProf =
    professionals.find((p) => p.id === activeProfessionalId) || professionals[0];
  const activeCurrency = settings?.currency || DEFAULT_CURRENCY;
  const showCurrencyCode = Boolean(settings?.showCurrencyCode);
  const todayStr = toLocalIsoDate();

  const selectedPatient: Patient | undefined = useMemo(
    () =>
      selectedPatientId
        ? patientIndexes.patientsById.get(selectedPatientId) ||
          patients.find((p) => p.id === selectedPatientId)
        : undefined,
    [patientIndexes, patients, selectedPatientId]
  );

  const activeAcceptedSharePatientIds = useMemo(
    () =>
      new Set(
        patientShares.filter((s) => s.status === 'accepted').map((s) => s.patientId)
      ),
    [patientShares]
  );

  const selectedPatientShares = useMemo(() => {
    if (!selectedPatient) return [];
    return patientShares.filter(
      (s) => s.patientId === selectedPatient.id && s.status !== 'revoked'
    );
  }, [selectedPatient, patientShares]);

  const isSharedFromOther = Boolean(
    selectedPatient && workspace && selectedPatient.workspaceId !== workspace.id
  );

  const incomingShare = useMemo(() => {
    if (!isSharedFromOther || !workspace) return undefined;
    return (
      selectedPatientShares.find(
        (s) => s.status === 'accepted' && s.recipientWorkspaceId === workspace.id
      ) || selectedPatientShares[0]
    );
  }, [isSharedFromOther, workspace, selectedPatientShares]);

  const acceptedOutgoingShares = useMemo(
    () =>
      !isSharedFromOther
        ? selectedPatientShares.filter((s) => s.status === 'accepted')
        : [],
    [isSharedFromOther, selectedPatientShares]
  );

  // Sync / restore local drafts whenever selected patient changes
  useEffect(() => {
    setMenuOpen(false);
    setShowShareModal(false);
    if (!selectedPatient) {
      draftPatInitRef.current = null;
      setAnamnesisOpen(false);
      setPhysicalExamOpen(false);
      setShowEvolutionForm(false);
      setAnamnesisDraftRestored(false);
      setPhysicalDraftRestored(false);
      setEvolutionDraftRestored(false);
      return;
    }

    const patId = selectedPatient.id;
    draftPatInitRef.current = patId;

    // 1. Anamnesis draft
    const anamSaved = loadLocalDraft<{
      allergiesDraft: string;
      medicalHistoryDraft: string;
      medicationDetailDraft: string;
    }>(`patient_search:anamnesis:${patId}`);
    const baseAllergies = selectedPatient.allergies || '';
    const baseMedHist = selectedPatient.medicalHistory || '';
    const baseMedDetail = selectedPatient.anamnesis?.medicationDetail || '';
    if (
      anamSaved?.data &&
      (anamSaved.data.allergiesDraft !== baseAllergies ||
        anamSaved.data.medicalHistoryDraft !== baseMedHist ||
        anamSaved.data.medicationDetailDraft !== baseMedDetail)
    ) {
      setAllergiesDraft(anamSaved.data.allergiesDraft);
      setMedicalHistoryDraft(anamSaved.data.medicalHistoryDraft);
      setMedicationDetailDraft(anamSaved.data.medicationDetailDraft);
      setAnamnesisDraftRestored(true);
      setAnamnesisOpen(true);
      setDraftDirty(`patient_anamnesis:${patId}`, `Anamnesis de ${selectedPatient.fullName}`);
    } else {
      setAllergiesDraft(baseAllergies);
      setMedicalHistoryDraft(baseMedHist);
      setMedicationDetailDraft(baseMedDetail);
      setAnamnesisDraftRestored(false);
      setAnamnesisOpen(false);
      setDraftDirty(`patient_anamnesis:${patId}`, null);
    }

    // 2. Physical Exam draft
    const physSaved = loadLocalDraft<PatientPhysicalExam>(`patient_search:physical:${patId}`);
    const basePhys = selectedPatient.physicalExam || {};
    if (physSaved?.data && JSON.stringify(physSaved.data) !== JSON.stringify(basePhys)) {
      setPhysicalDraft(physSaved.data);
      setPhysicalDraftRestored(true);
      setPhysicalExamOpen(true);
      setDraftDirty(`patient_physical:${patId}`, `Examen físico de ${selectedPatient.fullName}`);
    } else {
      setPhysicalDraft(basePhys);
      setPhysicalDraftRestored(false);
      setPhysicalExamOpen(false);
      setDraftDirty(`patient_physical:${patId}`, null);
    }

    // 3. Evolution composer draft
    const evolSaved = loadLocalDraft<{
      date: string;
      tooth: string;
      procedure: string;
      description: string;
      color: EvolutionHighlightColor;
    }>(`patient_search:evolution:${patId}`);
    if (
      evolSaved?.data &&
      (evolSaved.data.tooth.trim() ||
        evolSaved.data.procedure.trim() ||
        evolSaved.data.description.trim())
    ) {
      setEvolDate(evolSaved.data.date || toLocalIsoDate());
      setEvolTooth(evolSaved.data.tooth || '');
      setEvolProcedure(evolSaved.data.procedure || '');
      setEvolDescription(evolSaved.data.description || '');
      setEvolColor(evolSaved.data.color || 'teal');
      setShowEvolutionForm(true);
      setEvolutionDraftRestored(true);
      setDraftDirty(`patient_evolution:${patId}`, `Evolución clínica de ${selectedPatient.fullName}`);
    } else {
      setEvolDate(toLocalIsoDate());
      setEvolTooth('');
      setEvolProcedure('');
      setEvolDescription('');
      setEvolColor('teal');
      setShowEvolutionForm(false);
      setEvolutionDraftRestored(false);
      setDraftDirty(`patient_evolution:${patId}`, null);
    }

    return () => {
      setDraftDirty(`patient_anamnesis:${patId}`, null);
      setDraftDirty(`patient_physical:${patId}`, null);
      setDraftDirty(`patient_evolution:${patId}`, null);
    };
  }, [selectedPatient?.id]);

  // Auto-save anamnesis draft
  useEffect(() => {
    if (!selectedPatient || draftPatInitRef.current !== selectedPatient.id) return;
    const patId = selectedPatient.id;
    const isAnamDirty =
      allergiesDraft !== (selectedPatient.allergies || '') ||
      medicalHistoryDraft !== (selectedPatient.medicalHistory || '') ||
      medicationDetailDraft !== (selectedPatient.anamnesis?.medicationDetail || '');
    if (isAnamDirty) {
      saveLocalDraft(`patient_search:anamnesis:${patId}`, {
        allergiesDraft,
        medicalHistoryDraft,
        medicationDetailDraft,
      });
      setDraftDirty(`patient_anamnesis:${patId}`, `Anamnesis de ${selectedPatient.fullName}`);
    } else {
      clearLocalDraft(`patient_search:anamnesis:${patId}`);
      setAnamnesisDraftRestored(false);
      setDraftDirty(`patient_anamnesis:${patId}`, null);
    }
  }, [selectedPatient, allergiesDraft, medicalHistoryDraft, medicationDetailDraft, setDraftDirty]);

  // Auto-save physical exam draft
  useEffect(() => {
    if (!selectedPatient || draftPatInitRef.current !== selectedPatient.id) return;
    const patId = selectedPatient.id;
    const isPhysDirty =
      JSON.stringify(physicalDraft) !== JSON.stringify(selectedPatient.physicalExam || {});
    if (isPhysDirty) {
      saveLocalDraft(`patient_search:physical:${patId}`, physicalDraft);
      setDraftDirty(`patient_physical:${patId}`, `Examen físico de ${selectedPatient.fullName}`);
    } else {
      clearLocalDraft(`patient_search:physical:${patId}`);
      setPhysicalDraftRestored(false);
      setDraftDirty(`patient_physical:${patId}`, null);
    }
  }, [selectedPatient, physicalDraft, setDraftDirty]);

  // Auto-save clinical evolution draft
  useEffect(() => {
    if (!selectedPatient || draftPatInitRef.current !== selectedPatient.id) return;
    const patId = selectedPatient.id;
    const hasContent =
      showEvolutionForm &&
      Boolean(evolTooth.trim() || evolProcedure.trim() || evolDescription.trim());
    if (hasContent) {
      saveLocalDraft(`patient_search:evolution:${patId}`, {
        date: evolDate,
        tooth: evolTooth,
        procedure: evolProcedure,
        description: evolDescription,
        color: evolColor,
      });
      setDraftDirty(`patient_evolution:${patId}`, `Evolución clínica de ${selectedPatient.fullName}`);
    } else {
      clearLocalDraft(`patient_search:evolution:${patId}`);
      setEvolutionDraftRestored(false);
      setDraftDirty(`patient_evolution:${patId}`, null);
    }
  }, [
    selectedPatient,
    showEvolutionForm,
    evolDate,
    evolTooth,
    evolProcedure,
    evolDescription,
    evolColor,
    setDraftDirty,
  ]);


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

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = (visibleIds: string[]) => {
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      const visibleSet = new Set(visibleIds);
      setSelectedIds((prev) => prev.filter((id) => !visibleSet.has(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const exportRowsToCsv = async (targetPatients: Patient[], label: string) => {
    const headers = [
      'Nombre',
      'DNI',
      'Edad',
      'Telefono',
      'Email',
      'Obra Social',
      'Afiliado',
      'Alergias',
      'Motivo',
    ];
    const rows = targetPatients.map((p) => [
      p.fullName,
      p.dni,
      p.age,
      p.phone,
      p.email,
      p.insuranceProvider,
      p.insuranceNumber,
      p.allergies,
      (p.chiefComplaint || '').replace(/\n/g, ' '),
    ]);
    downloadCsvFile(
      `odontohelper_pacientes_${new Date().toISOString().slice(0, 10)}.csv`,
      headers,
      rows,
      true
    );
    await logActivity('exported', 'patient', `${label} (${targetPatients.length})`);
    showToast(`CSV exportado (${targetPatients.length} pacientes)`, 'success');
  };

  const tableColumns: DataTableColumn<Patient>[] = [
    {
      id: 'actions',
      label: 'Acciones',
      align: 'left',
      sortable: false,
      headerClassName: 'w-px whitespace-nowrap',
      cellClassName: 'w-px whitespace-nowrap',
      render: (p) => {
        const isForeign = Boolean(workspace && p.workspaceId !== workspace.id);
        return (
          <div className="flex items-center justify-start gap-1">
            <Button
              variant="icon"
              size="xs"
              onClick={() => selectPatient(p.id)}
              title="Abrir historia clínica"
              aria-label="Abrir historia clínica"
              className="hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/40"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </Button>
            {!isForeign && (
              <>
                <Button
                  variant="icon"
                  size="xs"
                  onClick={() => startEditPatient(p.id)}
                  title="Editar paciente"
                  aria-label="Editar paciente"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="icon"
                  size="xs"
                  onClick={() =>
                    openConfirm({
                      title: '¿Eliminar paciente?',
                      description: `Se eliminará la ficha de "${p.fullName}" del padrón activo.`,
                      confirmText: 'Eliminar',
                      cancelText: 'Cancelar',
                      isDestructive: true,
                      onConfirm: () => deletePatient(p.id),
                    })
                  }
                  title="Eliminar paciente"
                  aria-label="Eliminar paciente"
                  className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </>
            )}
          </div>
        );
      },
    },
    {
      id: 'fullName',
      label: 'Paciente',
      sortValue: (p) => p.fullName,
      render: (p) => {
        const isShared =
          (workspace && p.workspaceId !== workspace.id) ||
          activeAcceptedSharePatientIds.has(p.id);
        return (
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
              {p.fullName}
            </span>
            {isShared && (
              <Badge tone="blue" size="xs">
                Compartido
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      id: 'dni',
      label: 'DNI / CI',
      sortValue: (p) => p.dni || '',
      render: (p) => (
        <span className="font-mono tabular-nums text-slate-600 dark:text-slate-300">
          {p.dni || '—'}
        </span>
      ),
    },
    {
      id: 'phone',
      label: 'Teléfono',
      sortValue: (p) => p.phone || '',
      render: (p) => (
        <span className="font-mono tabular-nums text-slate-600 dark:text-slate-300">
          {p.phone || '—'}
        </span>
      ),
    },
    {
      id: 'insuranceProvider',
      label: 'Cobertura',
      sortValue: (p) => p.insuranceProvider || 'Particular',
      render: (p) => (
        <Badge tone={p.insuranceProvider ? 'teal' : 'neutral'} size="xs">
          {p.insuranceProvider || 'Particular'}
        </Badge>
      ),
    },
    {
      id: 'allergies',
      label: 'Alergias / Notas',
      sortValue: (p) => p.allergies || p.chiefComplaint || '',
      cellClassName: 'max-w-xs truncate text-slate-500 dark:text-slate-400',
      render: (p) => p.allergies || p.chiefComplaint || '—',
    },
  ];

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
    const byId = patientIndexes.appointmentsByPatientId.get(selectedPatient.id) || [];
    const byName =
      patientIndexes.appointmentsByPatientName.get(
        selectedPatient.fullName.trim().toLowerCase()
      ) || [];
    const mergedMap = new Map<string, (typeof appointments)[number]>();
    for (const a of byId) mergedMap.set(a.id, a);
    for (const a of byName) mergedMap.set(a.id, a);
    return Array.from(mergedMap.values()).sort((a, b) =>
      `${b.date} ${b.startTime}`.localeCompare(`${a.date} ${a.startTime}`)
    );
  }, [selectedPatient, patientIndexes]);

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
    return patientIndexes.plansByPatientId.get(selectedPatient.id) || [];
  }, [selectedPatient, patientIndexes]);

  const patientTransactions = useMemo(() => {
    if (!selectedPatient) return [];
    const list = patientIndexes.transactionsByPatientId.get(selectedPatient.id) || [];
    return [...list].sort((a, b) =>
      b.date !== a.date ? b.date.localeCompare(a.date) : b.createdAt - a.createdAt
    );
  }, [selectedPatient, patientIndexes]);

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
    return (
      patientIndexes.balancesByPatientId.get(selectedPatient.id) || {
        charged: 0,
        paid: 0,
        balance: 0,
      }
    );
  }, [selectedPatient, patientIndexes]);

  const patientLabOrders = useMemo(() => {
    if (!selectedPatient) return [];
    const lower = selectedPatient.fullName.trim().toLowerCase();
    return labOrders.filter(
      (o) =>
        !o.deletedAt &&
        (o.patientId === selectedPatient.id || o.patientName.trim().toLowerCase() === lower)
    );
  }, [selectedPatient, labOrders]);

  const viewingPatientLabOrder = useMemo(
    () =>
      viewingPatientLabOrderId
        ? labOrders.find((o) => o.id === viewingPatientLabOrderId) || null
        : null,
    [viewingPatientLabOrderId, labOrders]
  );

  const pendingLabAlerts = useMemo(() => {
    if (!selectedPatient) return [];
    return lookupPendingLabAlerts(
      selectedPatient.id,
      selectedPatient.fullName,
      patientIndexes.pendingLabsIndex
    );
  }, [selectedPatient, patientIndexes]);

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

  const handleCreateEvolution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) return;
    if (!evolProcedure.trim() || !evolDescription.trim()) {
      showToast('Completá la prestación y el detalle de la evolución clínica.', 'warning');
      return;
    }

    const created = await createEvolutionEntry({
      patientId: selectedPatient.id,
      date: evolDate,
      toothFdi: evolTooth.trim() || undefined,
      procedure: evolProcedure.trim(),
      description: evolDescription.trim(),
      highlightColor: evolColor,
      professionalId: activeProf?.id,
      professionalName: activeProf?.fullName,
    });

    if (created) {
      clearLocalDraft(`patient_search:evolution:${selectedPatient.id}`);
      setDraftDirty(`patient_evolution:${selectedPatient.id}`, null);
      setEvolutionDraftRestored(false);
      setEvolTooth('');
      setEvolProcedure('');
      setEvolDescription('');
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
    clearLocalDraft(`patient_search:anamnesis:${selectedPatient.id}`);
    setDraftDirty(`patient_anamnesis:${selectedPatient.id}`, null);
    setAnamnesisDraftRestored(false);
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
    clearLocalDraft(`patient_search:physical:${selectedPatient.id}`);
    setDraftDirty(`patient_physical:${selectedPatient.id}`, null);
    setPhysicalDraftRestored(false);
    showToast('Examen físico guardado', 'success');
  };

  const handleUploadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedPatient) return;
    if (file.size > 15 * 1024 * 1024) {
      showToast('El archivo supera el límite de 15 MB por archivo para subida a la nube.', 'warning');
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
      `Cargos totales: ${formatMoney(patientBalances.charged, activeCurrency, showCurrencyCode)}`,
      `Total abonado: ${formatMoney(patientBalances.paid, activeCurrency, showCurrencyCode)}`,
      `Saldo actual: ${formatMoney(patientBalances.balance, activeCurrency, showCurrencyCode)}`,
      '',
      ...transactionsWithRunningBalance.slice(0, 8).map(
        ({ tx }) =>
          `${tx.date} · ${tx.concept}: ${tx.type === 'payment' ? '-' : '+'}${formatMoney(
            tx.amount,
            activeCurrency,
            showCurrencyCode
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
    downloadAppointmentIcsFile(appt);
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
        activeCurrency,
        showCurrencyCode
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
      {/* SEARCH & DIRECTORY SCREEN: Pacientes                */}
      {/* =================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/60 flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0">
            <Search className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Pacientes
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Buscá, abrí historias clínicas o gestioná el padrón general, exportaciones CSV y depuración masiva.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2.5 w-full sm:w-auto">
          {patients.length > 0 && (
            <Button
              variant="secondary"
              size="sm"
              icon={<Download className="w-4 h-4 text-slate-500" />}
              onClick={() => exportRowsToCsv(patients, 'Listado de pacientes exportado')}
            >
              Exportar CSV
            </Button>
          )}

          <button
            type="button"
            onClick={() => setView('patient-new')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 transition-colors shadow-xs min-h-[40px] whitespace-nowrap cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Nuevo paciente</span>
          </button>
        </div>
      </div>

      {/* Centered Search Input + Mutualista Filter + View Mode Toggle */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 no-print">
        <SearchInput
          value={query}
          onChange={(val) => {
            setQuery(val);
            if (moduleQuery.page) setModuleQuery({ page: undefined });
          }}
          placeholder="Nombre, teléfono, CI o cobertura..."
          inputClassName="min-h-[42px] text-sm"
        />

        {insurances.length > 0 && (
          <select
            value={insuranceFilter}
            onChange={(e) => {
              setInsuranceFilter(e.target.value);
              if (moduleQuery.page) setModuleQuery({ page: undefined });
            }}
            aria-label="Filtrar por cobertura"
            className={`${dropdownClass} min-h-[42px] w-full sm:w-52`}
          >
            <option value="all">Todas las coberturas</option>
            {insurances.map((ins) => (
              <option key={ins} value={ins}>
                {ins}
              </option>
            ))}
          </select>
        )}

        {patients.length > 0 && (
          <div
            role="group"
            aria-label="Modo de visualización de pacientes"
            className="grid grid-cols-2 sm:inline-flex rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1 text-xs shrink-0 w-full sm:w-auto"
          >
            <button
              type="button"
              onClick={() => {
                setDirectoryMode('list');
                if (currentView === 'manage-patients') {
                  setView('patients-search');
                }
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                directoryMode === 'list'
                  ? 'bg-teal-600 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Lista</span>
            </button>
            <button
              type="button"
              onClick={() => setDirectoryMode('table')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                directoryMode === 'table'
                  ? 'bg-teal-600 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Table2 className="w-3.5 h-3.5" />
              <span>Tabla masiva</span>
            </button>
          </div>
        )}
      </div>

      {/* Patient Results List / Bulk Table */}
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
      ) : directoryMode === 'table' ? (
        <div className="space-y-2 no-print">
          <DataTable
            columns={tableColumns}
            data={filteredPatients}
            getRowKey={(p) => p.id}
            selectable
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onToggleSelectAll={handleToggleSelectAll}
            sortState={currentSort}
            onSortChange={(next) =>
              setModuleQuery({ sort: serializeSortState(next) || undefined, page: undefined })
            }
            page={currentPage}
            onPageChange={(nextPage) =>
              setModuleQuery({ page: nextPage <= 1 ? undefined : nextPage })
            }
            pageSize={currentPageSize}
            onPageSizeChange={(nextSize) =>
              setModuleQuery({ pageSize: nextSize === 25 ? undefined : nextSize, page: undefined })
            }
            ariaLabel="Listado de pacientes"
            bulkActions={
              <>
                <Button
                  variant="secondary"
                  size="xs"
                  icon={<Download className="w-3.5 h-3.5" />}
                  onClick={() => {
                    const selectedSet = new Set(selectedIds);
                    const subset = patients.filter((p) => selectedSet.has(p.id));
                    exportRowsToCsv(subset, 'Selección de pacientes exportada');
                  }}
                >
                  Exportar selección CSV
                </Button>
                <Button
                  variant="dangerSoft"
                  size="xs"
                  icon={<Trash2 className="w-3.5 h-3.5" />}
                  onClick={() =>
                    openConfirm({
                      title: `¿Eliminar ${selectedIds.length} pacientes seleccionados?`,
                      description:
                        'Las fichas seleccionadas pasarán a la papelera local y ya no figurarán en el padrón activo.',
                      confirmText: 'Eliminar selección',
                      cancelText: 'Cancelar',
                      isDestructive: true,
                      onConfirm: async () => {
                        await deletePatientsBulk(selectedIds);
                        setSelectedIds([]);
                      },
                    })
                  }
                >
                  Eliminar selección
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  icon={<X className="w-3.5 h-3.5" />}
                  onClick={() => setSelectedIds([])}
                >
                  Deseleccionar
                </Button>
              </>
            }
            emptyState={
              <div className={`${emptyStateClass} space-y-3`}>
                <Users className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  No se encontraron pacientes que coincidan con "{query}".
                </p>
              </div>
            }
          />
        </div>
      ) : filteredPatients.length === 0 ? (
        <div className="py-12 px-6 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 text-xs text-slate-500 dark:text-slate-400">
          No se encontraron pacientes que coincidan con "{query}".
        </div>
      ) : (
        <div className="space-y-2 no-print">
          <div className="flex items-center justify-between px-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            <span className="font-mono tabular-nums">
              {filteredPatients.length}{' '}
              {filteredPatients.length === 1 ? 'paciente encontrado' : 'pacientes encontrados'}
            </span>
          </div>

          <VirtualList
            items={filteredPatients}
            itemHeight={70}
            maxHeight={560}
            getKey={(patient) => patient.id}
            ariaLabel="Listado virtualizado de pacientes"
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-2xs"
            innerClassName="divide-y divide-slate-100 dark:divide-slate-800"
            renderItem={(patient) => {
              const bal = patientIndexes.balancesByPatientId.get(patient.id) || {
                charged: 0,
                paid: 0,
                balance: 0,
              };
              const hasLab =
                lookupPendingLabAlerts(
                  patient.id,
                  patient.fullName,
                  patientIndexes.pendingLabsIndex
                ).length > 0;
              return (
                <button
                  type="button"
                  onClick={() => selectPatient(patient.id)}
                  className="w-full h-[70px] text-left px-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex items-center justify-between gap-4 cursor-pointer"
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
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {patient.fullName}
                        </span>
                        {((workspace && patient.workspaceId !== workspace.id) ||
                          activeAcceptedSharePatientIds.has(patient.id)) && (
                          <Badge tone="blue" size="xs">
                            Compartido
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums truncate mt-0.5">
                        {patient.phone || 'Sin teléfono'}
                        {patient.dni ? ` · CI ${patient.dni}` : ''}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {bal.balance > 0 && (
                      <span className="hidden sm:inline text-[11px] font-mono tabular-nums font-semibold text-amber-700 dark:text-amber-400">
                        Saldo {formatMoney(bal.balance, activeCurrency, showCurrencyCode)}
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
            }}
          />
        </div>
      )}

      {/* =================================================== */}
      {/* PATIENT CARD MODAL (Overview + Full Sub-Views)      */}
      {/* =================================================== */}
      {selectedPatient && (
        <Modal
          onClose={() => guardNavigation(() => selectPatient(null))}
          zIndexClass="z-40"
          size={subView === 'overview' ? '3xl' : '6xl'}
          headerVariant={subView !== 'overview' ? 'teal' : 'default'}
          containerClassName="print:static print:bg-transparent print:p-0"
          panelClassName="print:max-h-none print:max-w-none print:shadow-none print:border-none"
          bodyClassName="p-4 sm:p-6"
          title={subViewTitles[subView]}
          subtitle={
            subView !== 'overview'
              ? `${selectedPatient.fullName}${selectedPatient.dni ? ` · CI ${selectedPatient.dni}` : ''}`
              : undefined
          }
          headerPrefix={
            <button
              type="button"
              onClick={() => {
                if (subView === 'overview') {
                  guardNavigation(() => selectPatient(null));
                } else {
                  setSubView('overview');
                }
              }}
              className={`p-2 rounded-xl transition-colors no-print cursor-pointer ${
                subView !== 'overview'
                  ? 'text-white/90 hover:bg-white/15'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title={subView === 'overview' ? 'Volver a buscar pacientes' : 'Volver a ficha'}
              aria-label={subView === 'overview' ? 'Volver a buscar pacientes' : 'Volver a ficha'}
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          }
          headerActions={
            <>
              {subView === 'overview' && (
                <>
                  <Button
                    variant="soft"
                    size="xs"
                    icon={<Share2 className="w-3.5 h-3.5" />}
                    onClick={() => setShowShareModal(true)}
                    title="Compartir ficha clínica con colega"
                  >
                    <span>Compartir</span>
                  </Button>

                  <Button
                    variant="soft"
                    size="xs"
                    icon={<Mic className="w-3.5 h-3.5" />}
                    onClick={() => handleStartPatientDictation(selectedPatient)}
                    title="Dictar consulta por voz"
                  >
                    <span>Dictar</span>
                  </Button>

                  {!isSharedFromOther && (
                    <button
                      type="button"
                      onClick={() => setShowEditModal(true)}
                      className={buttonClass({ variant: 'icon', size: 'sm' })}
                      title="Editar paciente"
                      aria-label="Editar paciente"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}

                  {/* Three-dots Dropdown Menu */}
                  <div className="relative">
                    <button
                      ref={menuTriggerRef}
                      type="button"
                      onClick={() => setMenuOpen((v) => !v)}
                      aria-expanded={menuOpen}
                      aria-haspopup="menu"
                      className={buttonClass({ variant: 'icon', size: 'sm' })}
                      title="Más opciones"
                      aria-label="Más opciones"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    <AnchoredDropdown
                      open={menuOpen}
                      onClose={() => setMenuOpen(false)}
                      anchorRef={menuTriggerRef}
                      preferredWidth={240}
                      className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl py-1.5 text-xs"
                    >
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
                            <WhatsAppIcon className="w-3.5 h-3.5 text-emerald-600" />
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
                            <WhatsAppIcon className="w-3.5 h-3.5" />
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
                            setShowShareModal(true);
                          }}
                          className="w-full px-3 py-2 text-left flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                          <Share2 className="w-3.5 h-3.5 text-teal-600" />
                          <span>Compartir ficha clínica</span>
                        </button>
                        {isSharedFromOther ? (
                          incomingShare && (
                            <button
                              type="button"
                              onClick={() => {
                                setMenuOpen(false);
                                openConfirm({
                                  title: '¿Desvincular ficha compartida?',
                                  description: `Dejarás de ver "${selectedPatient.fullName}" y sus evoluciones compartidas en tu consultorio.`,
                                  confirmText: 'Desvincular',
                                  cancelText: 'Cancelar',
                                  isDestructive: true,
                                  onConfirm: () => unlinkPatientShare(incomingShare.id),
                                });
                              }}
                              className="w-full px-3 py-2 text-left flex items-center gap-2.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                            >
                              <Unlink className="w-3.5 h-3.5" />
                              <span>Desvincular de mi consultorio</span>
                            </button>
                          )
                        ) : (
                          <>
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
                          </>
                        )}
                    </AnchoredDropdown>
                  </div>
                </>
              )}

              {subView === 'cuentas' && (
                <div className="w-full sm:w-auto flex flex-wrap items-center justify-between sm:justify-end gap-2">
                  <span className="text-xs font-mono tabular-nums font-bold px-2.5 py-1 rounded-lg bg-white/15">
                    Saldo: {formatMoney(patientBalances.balance, activeCurrency, showCurrencyCode)}
                  </span>
                  <Button
                    variant="headerGhost"
                    size="xs"
                    icon={<Share2 className="w-3.5 h-3.5" />}
                    onClick={handleShareAccountStatement}
                  >
                    <span>Compartir</span>
                  </Button>
                </div>
              )}

              {subView === 'historia' && (
                <Button
                  variant="headerGhost"
                  size="xs"
                  icon={<Mic className="w-3.5 h-3.5" />}
                  onClick={() => handleStartPatientDictation(selectedPatient)}
                >
                  Dictar evolución
                </Button>
              )}
            </>
          }
        >
              {/* ================================================= */}
              {/* OVERVIEW CARD: Two-column Patient Summary + 6 Buttons */}
              {/* ================================================= */}
              {subView === 'overview' && (
                <div className="space-y-4">
                  {isSharedFromOther && (
                    <div className="p-3 rounded-xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-blue-950 dark:text-blue-100">
                      <div className="flex items-start gap-2">
                        <Users className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                        <div className="leading-relaxed">
                          Ficha clínica compartida por{' '}
                          <strong>{incomingShare?.ownerName || 'un colega'}</strong> ·
                          Sincronización en tiempo real. Presupuestos y Caja son privados de cada
                          consultorio.
                        </div>
                      </div>
                      {incomingShare && (
                        <Button
                          variant="dangerSoft"
                          size="xs"
                          icon={<Unlink className="w-3.5 h-3.5" />}
                          onClick={() =>
                            openConfirm({
                              title: '¿Desvincular ficha compartida?',
                              description: `Dejarás de ver "${selectedPatient.fullName}" y sus evoluciones compartidas en tu consultorio.`,
                              confirmText: 'Desvincular',
                              cancelText: 'Cancelar',
                              isDestructive: true,
                              onConfirm: () => unlinkPatientShare(incomingShare.id),
                            })
                          }
                        >
                          Desvincular
                        </Button>
                      )}
                    </div>
                  )}

                  {!isSharedFromOther && acceptedOutgoingShares.length > 0 && (
                    <div className="p-3 rounded-xl bg-teal-50/70 dark:bg-teal-950/30 border border-teal-200/80 dark:border-teal-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-teal-900 dark:text-teal-100">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
                        <span>
                          Compartida en tiempo real con:{' '}
                          <strong>
                            {acceptedOutgoingShares
                              .map((s) => s.recipientName || 'Colega vinculado')
                              .join(', ')}
                          </strong>
                        </span>
                      </div>
                      <Button
                        variant="soft"
                        size="xs"
                        onClick={() => setShowShareModal(true)}
                      >
                        Gestionar vínculo
                      </Button>
                    </div>
                  )}

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
                            {selectedPatient.documentType || 'CI'}: {selectedPatient.dni}
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
                        <div className="flex items-start gap-2.5 text-slate-600 dark:text-slate-300">
                          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                          <span className="break-all">{selectedPatient.email}</span>
                        </div>
                      )}

                      {selectedPatient.address && (
                        <div className="flex items-start gap-2.5 text-slate-600 dark:text-slate-300">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                          <span className="break-words">{selectedPatient.address}</span>
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
                              <div className="text-[11px] text-teal-700 dark:text-teal-300 break-words leading-snug">
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
                          {!isSharedFromOther && (
                            <button
                              type="button"
                              onClick={() => setShowNextControlModal(true)}
                              className="text-[11px] font-semibold text-teal-700 dark:text-teal-300 hover:underline"
                            >
                              Editar
                            </button>
                          )}
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
                    <button
                      type="button"
                      onClick={() => setSubView('cuentas')}
                      className="w-full px-4 py-3.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm flex items-center justify-between gap-3 transition-colors shadow-xs"
                    >
                      <span className="flex items-center gap-3">
                        <Wallet className="w-4 h-4 shrink-0" />
                        <span>
                          {isSharedFromOther ? 'Cuentas (solo tu consultorio)' : 'Cuentas'}
                        </span>
                      </span>
                      <span className="text-xs font-mono tabular-nums text-teal-100">
                        {patientBalances.balance > 0
                          ? formatMoney(patientBalances.balance, activeCurrency, showCurrencyCode)
                          : patientTransactions.length > 0
                          ? `${patientTransactions.length} mov.`
                          : ''}
                      </span>
                    </button>

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
                      {patientFilesLoading ? (
                        <span className="text-[11px] font-medium text-teal-100">Cargando...</span>
                      ) : totalPatientAttachmentsCount > 0 ? (
                        <span className="text-xs font-mono tabular-nums text-teal-100">
                          {totalPatientAttachmentsCount}
                        </span>
                      ) : null}
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

                    {!isSharedFromOther && (
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
                    )}
                  </div>
                  </div>
                </div>
              )}

              {/* ================================================= */}
              {/* SUB-VIEW 1: CUENTAS (Cuenta Corriente + Presupuestos) */}
              {/* ================================================= */}
              {subView === 'cuentas' && (
                <div className="space-y-4">
                  {/* Top Switcher & Actions */}
                  <div className="flex flex-wrap items-center justify-center sm:justify-between gap-3 no-print">
                    <div className="inline-flex flex-wrap justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-0.5 text-xs max-w-full">
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

                    <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 w-full sm:w-auto">
                      <Button
                        variant="primary"
                        size="sm"
                        icon={<Plus className="w-3.5 h-3.5" />}
                        onClick={() => setTxModalType('payment')}
                      >
                        Registrar pago
                      </Button>
                      <Button
                        variant="subtle"
                        size="sm"
                        icon={<Plus className="w-3.5 h-3.5" />}
                        onClick={() => setTxModalType('charge')}
                      >
                        Agregar cargo
                      </Button>
                      <Button
                        variant="subtle"
                        size="sm"
                        icon={<Plus className="w-3.5 h-3.5" />}
                        onClick={() => setShowPlanModal(true)}
                      >
                        Nuevo presupuesto
                      </Button>
                      {patientBalances.balance > 0 && debtWaUrl && (
                        <a
                          href={debtWaUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={buttonClass({ variant: 'whatsapp', size: 'sm' })}
                        >
                          <WhatsAppIcon className="w-3.5 h-3.5" />
                          <span>Recordar saldo</span>
                        </a>
                      )}
                      <Button
                        variant="subtle"
                        size="sm"
                        icon={<Printer className="w-3.5 h-3.5" />}
                        onClick={() => window.print()}
                      >
                        PDF
                      </Button>
                    </div>
                  </div>

                  {cuentasTab === 'movimientos' ? (
                    <>
                      {/* Balance Summary Cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className={kpiCardClass}>
                          <div className="text-[11px] text-slate-500">
                            {formatCurrencyHeading('Total cargos', activeCurrency, showCurrencyCode)}
                          </div>
                          <div className="text-base font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-0.5">
                            {formatMoney(patientBalances.charged, activeCurrency, showCurrencyCode)}
                          </div>
                        </div>
                        <div className={kpiCardClass}>
                          <div className="text-[11px] text-slate-500">
                            {formatCurrencyHeading('Total pagado', activeCurrency, showCurrencyCode)}
                          </div>
                          <div className="text-base font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 mt-0.5">
                            {formatMoney(patientBalances.paid, activeCurrency, showCurrencyCode)}
                          </div>
                        </div>
                        <div className={kpiCardClass}>
                          <div className="text-[11px] text-slate-500">
                            {formatCurrencyHeading('Saldo actual', activeCurrency, showCurrencyCode)}
                          </div>
                          <div
                            className={`text-base font-bold font-mono tabular-nums mt-0.5 ${
                              patientBalances.balance > 0
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-teal-700 dark:text-teal-400'
                            }`}
                          >
                            {formatMoney(patientBalances.balance, activeCurrency, showCurrencyCode)}
                          </div>
                        </div>
                      </div>

                      <DataTable
                        data={transactionsWithRunningBalance}
                        getRowKey={({ tx }) => tx.id}
                        ariaLabel="Movimientos de cuenta corriente"
                        rowClassName={({ tx }) =>
                          tx.type === 'payment'
                            ? '!bg-emerald-50/40 dark:!bg-emerald-950/15'
                            : ''
                        }
                        emptyState={
                          <div className="py-12 text-center rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 text-xs text-slate-500">
                            No hay movimientos registrados en la cuenta corriente de este paciente.
                          </div>
                        }
                        columns={
                          [
                            {
                              id: 'actions',
                              label: 'Acciones',
                              align: 'left',
                              sortable: false,
                              headerClassName: 'no-print w-px whitespace-nowrap',
                              cellClassName: 'no-print w-px whitespace-nowrap',
                              render: ({ tx }) => (
                                <Button
                                  variant="icon"
                                  size="xs"
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
                                  aria-label="Anular movimiento"
                                  className="hover:!text-rose-600"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              ),
                            },
                            {
                              id: 'date',
                              label: 'Fecha',
                              sortValue: ({ tx }) => tx.date,
                              cellClassName:
                                'font-mono tabular-nums text-slate-500 whitespace-nowrap',
                              render: ({ tx }) => formatBirthDateDisplay(tx.date),
                            },
                            {
                              id: 'concept',
                              label: 'Concepto / Medio',
                              sortValue: ({ tx }) => tx.concept,
                              render: ({ tx }) => (
                                <div>
                                  <div className="font-medium text-slate-900 dark:text-slate-100">
                                    {tx.concept}
                                  </div>
                                  <div className="text-[11px] text-slate-500">
                                    {PAYMENT_METHOD_LABELS[tx.paymentMethod]}
                                    {tx.receiptNumber ? ` · ${tx.receiptNumber}` : ''}
                                  </div>
                                </div>
                              ),
                            },
                            {
                              id: 'charge',
                              label: 'Cargo',
                              align: 'right',
                              sortValue: ({ tx }) => (tx.type === 'charge' ? tx.amount : 0),
                              cellClassName:
                                'font-mono tabular-nums text-slate-700 dark:text-slate-200 whitespace-nowrap',
                              render: ({ tx }) =>
                                formatMoney(
                                  tx.type === 'charge' ? tx.amount : 0,
                                  activeCurrency,
                                  showCurrencyCode
                                ),
                            },
                            {
                              id: 'payment',
                              label: 'Pago',
                              align: 'right',
                              sortValue: ({ tx }) => (tx.type === 'payment' ? tx.amount : 0),
                              cellClassName:
                                'font-mono tabular-nums text-emerald-700 dark:text-emerald-400 font-semibold whitespace-nowrap',
                              render: ({ tx }) =>
                                formatMoney(
                                  tx.type === 'payment' ? tx.amount : 0,
                                  activeCurrency,
                                  showCurrencyCode
                                ),
                            },
                            {
                              id: 'runningBalance',
                              label: 'Saldo',
                              align: 'right',
                              sortValue: ({ runningBalance }) => runningBalance,
                              cellClassName:
                                'font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap',
                              render: ({ runningBalance }) =>
                                formatMoney(runningBalance, activeCurrency, showCurrencyCode),
                            },
                          ] satisfies DataTableColumn<(typeof transactionsWithRunningBalance)[number]>[]
                        }
                      />
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
                      Registro cronológico de atenciones, evoluciones clínicas y dictados de voz.
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
                      onSubmit={handleCreateEvolution}
                      className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-3 no-print"
                    >
                      {evolutionDraftRestored && (
                        <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/35 border border-amber-200 dark:border-amber-800/60 flex items-center justify-between gap-2 text-xs text-amber-900 dark:text-amber-200">
                          <span>Borrador local de evolución recuperado.</span>
                          <button
                            type="button"
                            onClick={() => {
                              clearLocalDraft(`patient_search:evolution:${selectedPatient.id}`);
                              setDraftDirty(`patient_evolution:${selectedPatient.id}`, null);
                              setEvolutionDraftRestored(false);
                              setEvolTooth('');
                              setEvolProcedure('');
                              setEvolDescription('');
                              setShowEvolutionForm(false);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Descartar</span>
                          </button>
                        </div>
                      )}
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
                        <AutoResizeTextarea
                          minRows={3}
                          value={evolDescription}
                          onChange={(e) => setEvolDescription(e.target.value)}
                          placeholder="Descripción de lo realizado, materiales, indicaciones..."
                          className="bg-white dark:bg-slate-900"
                          required
                        />
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[11px]">
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
                          <button
                            type="button"
                            onClick={() => {
                              clearLocalDraft(`patient_search:evolution:${selectedPatient.id}`);
                              setDraftDirty(`patient_evolution:${selectedPatient.id}`, null);
                              setEvolutionDraftRestored(false);
                              setEvolTooth('');
                              setEvolProcedure('');
                              setEvolDescription('');
                              setShowEvolutionForm(false);
                            }}
                            className="px-3 py-1.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700"
                          >
                            Cancelar
                          </button>
                          <button
                            type="submit"
                            className="px-4 py-1.5 rounded-xl text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700"
                          >
                            Guardar evolución
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
                        const canDeleteEv = canMutateClinicalRecord(
                          ev,
                          workspace?.id,
                          authUserId
                        );
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
                                {canDeleteEv ? (
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
                                    title="Eliminar evolución"
                                    aria-label="Eliminar evolución"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                ) : (
                                  <span
                                    className="p-1 text-slate-400 dark:text-slate-500 no-print"
                                    title={`Registro protegido de ${ev.professionalName || 'colega'}`}
                                  >
                                    <Lock className="w-3.5 h-3.5" />
                                  </span>
                                )}
                              </div>
                            </div>
                            <p className="text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed pl-4">
                              {ev.description}
                            </p>
                            {ev.professionalName && (
                              <div className="text-[11px] text-slate-500 pl-4 font-medium">
                                Registrado por: {ev.professionalName}
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
                            onClick={() => guardNavigation(() => setView('detail', sess.id))}
                            className="w-full text-left px-3.5 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-3 text-xs"
                          >
                            <span className="flex items-center gap-2 min-w-0">
                              <FileAudio className="w-4 h-4 text-teal-600 shrink-0" />
                              <span className="font-medium text-slate-800 dark:text-slate-200 break-words leading-snug text-left">
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
                  {patientFilesCloudError && (
                    <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200 space-y-1 no-print">
                      <div className="flex items-center gap-2 font-semibold">
                        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                        <span>Almacenamiento en la nube requerido</span>
                      </div>
                      <p className="text-amber-800 dark:text-amber-300/90 leading-relaxed">
                        {patientFilesCloudError} Las radiografías y archivos clínicos nunca se guardan localmente en el navegador.
                      </p>
                    </div>
                  )}
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 space-y-3 no-print">
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                      <div className="sm:col-span-4">
                        <select
                          value={fileCategory}
                          onChange={(e) =>
                            setFileCategory(e.target.value as PatientFileCategory)
                          }
                          disabled={Boolean(patientFilesCloudError)}
                          className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 disabled:opacity-60"
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
                          disabled={Boolean(patientFilesCloudError)}
                          placeholder="Nota (ej: Periapical pieza 3.6)"
                          className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 disabled:opacity-60"
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
                          disabled={Boolean(patientFilesCloudError)}
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>SUBIR A LA NUBE</span>
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

                  {patientFilesLoading && patientAttachments.length === 0 ? (
                    <div className="py-14 text-center rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 space-y-2.5">
                      <RotateCw className="w-5 h-5 mx-auto animate-spin text-teal-600" />
                      <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        Cargando radiografías y archivos desde Supabase...
                      </p>
                    </div>
                  ) : patientAttachments.length === 0 ? (
                    <div className="py-14 text-center rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 space-y-3">
                      <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                        Este paciente aún no tiene imágenes
                      </p>
                      <button
                        type="button"
                        disabled={Boolean(patientFilesCloudError)}
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 disabled:opacity-50"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>NUEVA IMAGEN</span>
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {patientAttachments.map((file) => {
                        const isImage = file.mimeType.startsWith('image/');
                        const canDeleteFile = canMutateClinicalRecord(
                          file,
                          workspace?.id,
                          authUserId
                        );
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
                                {file.uploadedBy && (
                                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                                    Subido por: {file.uploadedBy}
                                  </div>
                                )}
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
                                {canDeleteFile ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openConfirm({
                                        title: '¿Eliminar archivo clínico?',
                                        description: `Se eliminará "${file.name}" de la ficha del paciente.`,
                                        confirmText: 'Eliminar',
                                        cancelText: 'Cancelar',
                                        isDestructive: true,
                                        onConfirm: () => deletePatientFile(file.id),
                                      })
                                    }
                                    className="p-1 text-slate-400 hover:text-rose-600 rounded"
                                    title="Eliminar archivo"
                                    aria-label="Eliminar archivo"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                ) : (
                                  <span
                                    className="p-1 text-slate-400 dark:text-slate-500"
                                    title={`Archivo protegido de ${file.uploadedBy || 'colega'}`}
                                  >
                                    <Lock className="w-3.5 h-3.5" />
                                  </span>
                                )}
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
                  {isSharedFromOther && (
                    <div className="p-3 rounded-xl bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                      <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>
                        Antecedentes y examen físico base administrados por el consultorio titular.
                        Podés registrar novedades clínicas en <strong>Historia (Evoluciones)</strong>.
                      </span>
                    </div>
                  )}
                  {/* Accordion 1: Anamnesis */}
                  <div
                    ref={anamnesisRef}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900"
                  >
                    <button
                      type="button"
                      aria-expanded={anamnesisOpen}
                      onClick={() => {
                        const next = !anamnesisOpen;
                        setAnamnesisOpen(next);
                        if (next) revealExpandedSection(anamnesisRef.current);
                      }}
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
                        {anamnesisDraftRestored && (
                          <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/35 border border-amber-200 dark:border-amber-800/60 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900 dark:text-amber-200">
                            <span>Se recuperó un borrador local de anamnesis sin guardar.</span>
                            <button
                              type="button"
                              onClick={() => {
                                clearLocalDraft(`patient_search:anamnesis:${selectedPatient.id}`);
                                setDraftDirty(`patient_anamnesis:${selectedPatient.id}`, null);
                                setAnamnesisDraftRestored(false);
                                setAllergiesDraft(selectedPatient.allergies || '');
                                setMedicalHistoryDraft(selectedPatient.medicalHistory || '');
                                setMedicationDetailDraft(selectedPatient.anamnesis?.medicationDetail || '');
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 cursor-pointer"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Descartar</span>
                            </button>
                          </div>
                        )}
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
                                  disabled={isSharedFromOther}
                                  onChange={() => handleToggleAnamnesisFlag(flag.key)}
                                  className="accent-teal-600 rounded disabled:opacity-60"
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
                            <AutoResizeTextarea
                              minRows={1}
                              value={allergiesDraft}
                              disabled={isSharedFromOther}
                              onChange={(e) => setAllergiesDraft(e.target.value)}
                              placeholder="Ej: Penicilina, látex, ninguna"
                              className="bg-slate-50 dark:bg-slate-800 disabled:opacity-70"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-slate-500 mb-1">
                              Detalle de medicación
                            </label>
                            <AutoResizeTextarea
                              minRows={1}
                              value={medicationDetailDraft}
                              disabled={isSharedFromOther}
                              onChange={(e) => setMedicationDetailDraft(e.target.value)}
                              placeholder="Ej: Losartán 50mg/día"
                              className="bg-slate-50 dark:bg-slate-800 disabled:opacity-70"
                            />
                          </div>
                        </div>

                        <div className="text-xs">
                          <label className="block text-[11px] font-medium text-slate-500 mb-1">
                            Antecedentes médicos / observaciones
                          </label>
                          <AutoResizeTextarea
                            minRows={2}
                            value={medicalHistoryDraft}
                            disabled={isSharedFromOther}
                            onChange={(e) => setMedicalHistoryDraft(e.target.value)}
                            className="bg-slate-50 dark:bg-slate-800 disabled:opacity-70"
                          />
                        </div>

                        {!isSharedFromOther && (
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={handleSaveAnamnesisDetails}
                              className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700"
                            >
                              Guardar Anamnesis
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Accordion 2: Examen Físico */}
                  <div
                    ref={physicalExamRef}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900"
                  >
                    <button
                      type="button"
                      aria-expanded={physicalExamOpen}
                      onClick={() => {
                        const next = !physicalExamOpen;
                        setPhysicalExamOpen(next);
                        if (next) revealExpandedSection(physicalExamRef.current);
                      }}
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
                        {physicalDraftRestored && (
                          <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/35 border border-amber-200 dark:border-amber-800/60 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900 dark:text-amber-200">
                            <span>Se recuperó un borrador local del examen físico.</span>
                            <button
                              type="button"
                              onClick={() => {
                                clearLocalDraft(`patient_search:physical:${selectedPatient.id}`);
                                setDraftDirty(`patient_physical:${selectedPatient.id}`, null);
                                setPhysicalDraftRestored(false);
                                setPhysicalDraft(selectedPatient.physicalExam || {});
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 cursor-pointer"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Descartar</span>
                            </button>
                          </div>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-medium text-slate-500 mb-1">
                              Presión arterial / Signos vitales
                            </label>
                            <AutoResizeTextarea
                              minRows={1}
                              value={physicalDraft.bloodPressure || ''}
                              disabled={isSharedFromOther}
                              onChange={(e) =>
                                setPhysicalDraft({ ...physicalDraft, bloodPressure: e.target.value })
                              }
                              placeholder="Ej: 120/80 mmHg"
                              className="bg-slate-50 dark:bg-slate-800 disabled:opacity-70"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-slate-500 mb-1">
                              Higiene oral
                            </label>
                            <AutoResizeTextarea
                              minRows={1}
                              value={physicalDraft.oralHygiene || ''}
                              disabled={isSharedFromOther}
                              onChange={(e) =>
                                setPhysicalDraft({ ...physicalDraft, oralHygiene: e.target.value })
                              }
                              placeholder="Buena / Regular / Deficiente"
                              className="bg-slate-50 dark:bg-slate-800 disabled:opacity-70"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-slate-500 mb-1">
                              Mucosa oral y encías
                            </label>
                            <AutoResizeTextarea
                              minRows={1}
                              value={physicalDraft.mucosa || ''}
                              disabled={isSharedFromOther}
                              onChange={(e) =>
                                setPhysicalDraft({ ...physicalDraft, mucosa: e.target.value })
                              }
                              placeholder="Ej: Rosada, sin lesiones"
                              className="bg-slate-50 dark:bg-slate-800 disabled:opacity-70"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-slate-500 mb-1">
                              Ganglios y cuello
                            </label>
                            <AutoResizeTextarea
                              minRows={1}
                              value={physicalDraft.lymphNodes || ''}
                              disabled={isSharedFromOther}
                              onChange={(e) =>
                                setPhysicalDraft({ ...physicalDraft, lymphNodes: e.target.value })
                              }
                              placeholder="Ej: Sin adenopatías palpables"
                              className="bg-slate-50 dark:bg-slate-800 disabled:opacity-70"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-slate-500 mb-1">
                              ATM (Articulación temporomandibular)
                            </label>
                            <AutoResizeTextarea
                              minRows={1}
                              value={physicalDraft.tmj || ''}
                              disabled={isSharedFromOther}
                              onChange={(e) =>
                                setPhysicalDraft({ ...physicalDraft, tmj: e.target.value })
                              }
                              placeholder="Ej: Apertura normal, sin ruidos ni dolor"
                              className="bg-slate-50 dark:bg-slate-800 disabled:opacity-70"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-slate-500 mb-1">
                              Oclusión
                            </label>
                            <AutoResizeTextarea
                              minRows={1}
                              value={physicalDraft.occlusion || ''}
                              disabled={isSharedFromOther}
                              onChange={(e) =>
                                setPhysicalDraft({ ...physicalDraft, occlusion: e.target.value })
                              }
                              placeholder="Ej: Normoclusión / Desgaste anterior"
                              className="bg-slate-50 dark:bg-slate-800 disabled:opacity-70"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-slate-500 mb-1">
                            Observaciones del examen físico
                          </label>
                          <AutoResizeTextarea
                            minRows={2}
                            value={physicalDraft.observations || ''}
                            disabled={isSharedFromOther}
                            onChange={(e) =>
                              setPhysicalDraft({ ...physicalDraft, observations: e.target.value })
                            }
                            className="bg-slate-50 dark:bg-slate-800 disabled:opacity-70"
                          />
                        </div>

                        {!isSharedFromOther && (
                          <div className="flex justify-end">
                            <button
                              type="submit"
                              className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700"
                            >
                              Guardar Examen Físico
                            </button>
                          </div>
                        )}
                      </form>
                    )}
                  </div>
                </div>
              )}

              {/* ================================================= */}
              {/* SUB-VIEW 5: ODONTOGRAMA                           */}
              {/* ================================================= */}
              {subView === 'odontograma' && (
                <OdontogramPanel
                  patientId={selectedPatient.id}
                  patientName={selectedPatient.fullName}
                />
              )}

              {/* ================================================= */}
              {/* SUB-VIEW 6 & 7: CITAS PENDIENTES / HISTORIAL      */}
              {/* ================================================= */}
              {(subView === 'citas_pendientes' || subView === 'historial_citas') && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-slate-500">
                      {subView === 'citas_pendientes'
                        ? 'Turnos próximos y pendientes de atención para este paciente.'
                        : 'Registro histórico completo de citas agendadas, completadas y canceladas.'}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        guardNavigation(() => {
                          selectPatient(null);
                          setView('agenda');
                        })
                      }
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
                                <button
                                  type="button"
                                  onClick={() =>
                                    guardNavigation(() => {
                                      setAgendaDate(appt.date);
                                      selectPatient(null);
                                      setView('agenda');
                                    })
                                  }
                                  className={buttonClass({ variant: 'soft', size: 'xs' })}
                                  title="Ver este día en Agenda"
                                >
                                  <Calendar className="w-3.5 h-3.5" />
                                  <span>Ver en Agenda</span>
                                </button>
                                {waConfirm && (
                                  <a
                                    href={waConfirm}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 rounded-lg text-emerald-700 bg-emerald-50 dark:bg-emerald-950/50"
                                    title="Confirmar por WhatsApp"
                                  >
                                    <WhatsAppIcon className="w-3.5 h-3.5" />
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
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-slate-500">
                      Órdenes protésicas y trabajos externos vinculados a {selectedPatient.fullName}.
                    </p>
                    <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() =>
                          guardNavigation(() => {
                            selectPatient(null);
                            setView('lab');
                          })
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700"
                      >
                        <FlaskConical className="w-3.5 h-3.5" />
                        <span>Ver módulo completo</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowLabModal(true)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Nueva orden</span>
                      </button>
                    </div>
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
                          onClick={() => setViewingPatientLabOrderId(order.id)}
                          className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="font-semibold text-slate-900 dark:text-slate-100">
                              {order.workType}
                              {order.toothFdi ? ` · Pieza ${order.toothFdi}` : ''}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {order.providerName || 'Laboratorio sin asignar'}
                              {order.shade ? ` · Color ${order.shade}` : ''}
                              {order.dueDate
                                ? ` · Entrega est.: ${formatBirthDateDisplay(order.dueDate)}`
                                : ''}
                            </div>
                            {(order.sentDate || order.receivedDate) && (
                              <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                                {order.sentDate ? `Envío: ${formatBirthDateDisplay(order.sentDate)}` : ''}
                                {order.sentDate && order.receivedDate ? ' · ' : ''}
                                {order.receivedDate ? `Recepción: ${formatBirthDateDisplay(order.receivedDate)}` : ''}
                              </div>
                            )}
                            {order.notes && (
                              <p className="text-[11px] text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 px-2.5 py-1.5 rounded-lg">
                                {order.notes}
                              </p>
                            )}
                          </div>
                          <div
                            className="flex flex-wrap items-center gap-2 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {typeof order.cost === 'number' && order.cost > 0 && (
                              <span className="font-mono tabular-nums font-semibold text-slate-700 dark:text-slate-200 mr-1">
                                {formatMoney(order.cost, activeCurrency, showCurrencyCode)}
                              </span>
                            )}
                            <select
                              value={order.status}
                              onChange={(e) =>
                                updateLabOrderStatus(order.id, e.target.value as LabOrderStatus)
                              }
                              aria-label={`Estado de ${order.workType}`}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
                            >
                              {Object.entries(LAB_STATUS_LABELS).map(([val, label]) => (
                                <option key={val} value={val}>
                                  {label}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => setViewingPatientLabOrderId(order.id)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                              title="Ver detalle"
                              aria-label={`Ver detalle de ${order.workType}`}
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingPatientLabOrder(order)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/40"
                              title="Editar orden"
                              aria-label={`Editar orden ${order.workType}`}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                openConfirm({
                                  title: '¿Eliminar orden de laboratorio?',
                                  description: `Se eliminará "${order.workType}" de ${selectedPatient.fullName}.`,
                                  confirmText: 'Eliminar',
                                  cancelText: 'Cancelar',
                                  isDestructive: true,
                                  onConfirm: () => deleteLabOrder(order.id),
                                })
                              }
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                              title="Eliminar orden"
                              aria-label={`Eliminar orden ${order.workType}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
        </Modal>
      )}

      {/* =================================================== */}
      {/* IN-PLACE MODALS (Editar Paciente, Próximo Control,  */}
      {/* Nuevo Presupuesto, Cargo/Pago, Preview Archivo)     */}
      {/* =================================================== */}
      {showShareModal && selectedPatient && (
        <SharePatientModal patient={selectedPatient} onClose={() => setShowShareModal(false)} />
      )}

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

      {viewingPatientLabOrder && selectedPatient && (
        <LabOrderDetailModal
          order={viewingPatientLabOrder}
          onClose={() => setViewingPatientLabOrderId(null)}
          onEdit={(orderToEdit) => {
            setViewingPatientLabOrderId(null);
            setEditingPatientLabOrder(orderToEdit);
          }}
        />
      )}

      {(showLabModal || editingPatientLabOrder) && selectedPatient && (
        <LabOrderModal
          order={editingPatientLabOrder}
          lockedPatient={{ id: selectedPatient.id, fullName: selectedPatient.fullName }}
          onClose={() => {
            setShowLabModal(false);
            setEditingPatientLabOrder(null);
          }}
        />
      )}

      {previewFile && (
        <Modal
          onClose={() => setPreviewFile(null)}
          size="3xl"
          title={previewFile.name}
          subtitle={`${FILE_CATEGORY_LABELS[previewFile.category]} · ${previewFile.capturedAt}${
            previewFile.notes ? ` · ${previewFile.notes}` : ''
          }`}
          bodyClassName="p-4 bg-slate-950 flex items-center justify-center"
          headerActions={
            <a
              href={previewFile.dataUrl}
              download={previewFile.name}
              className={buttonClass({ variant: 'soft', size: 'xs' })}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Descargar</span>
            </a>
          }
        >
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
              className="w-full h-[65vh] sm:h-[72vh] bg-white rounded-lg"
            />
          )}
        </Modal>
      )}
    </div>
  );
};
