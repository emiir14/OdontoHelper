import React, { useEffect, useRef, useState } from 'react';
import { Save, Truck, ArrowLeft, RotateCcw } from 'lucide-react';
import { extractProviderFromTranscript } from '../core/clinical/entityExtractor';
import { ProviderCategory, ProviderDraftInput } from '../core/types';
import { clearLocalDraft, loadLocalDraft, saveLocalDraft } from '../core/utils/localDrafts';
import { useAppStore } from '../store/useAppStore';
import { VoiceIntakePanel } from './VoiceIntakePanel';
import { Button } from './ui/Button';
import {
  cardClass,
  inputClass,
  labelClass,
  pageHeaderClass,
  pageSubtitleClass,
  pageTitleClass,
} from './ui/uiClasses';

const EMPTY_PROVIDER: ProviderDraftInput = {
  name: '',
  category: 'laboratorio',
  contactName: '',
  taxId: '',
  phone: '',
  email: '',
  address: '',
  specialtyOrProducts: '',
  paymentTerms: '',
  notes: '',
  sourceSessionId: undefined,
};

const CATEGORY_OPTIONS: Array<{ id: ProviderCategory; label: string }> = [
  { id: 'laboratorio', label: 'Laboratorio dental' },
  { id: 'insumos', label: 'Insumos odontológicos' },
  { id: 'especialista', label: 'Especialista / Derivación' },
  { id: 'mantenimiento', label: 'Mantenimiento / Equipos' },
  { id: 'otro', label: 'Otro servicio' },
];

export const ProviderFormView: React.FC = () => {
  const {
    providers,
    editingProviderId,
    voiceIntakeDraft,
    clearVoiceIntakeDraft,
    createProvider,
    updateProvider,
    setView,
    showToast,
    setDraftDirty,
    guardNavigation,
  } = useAppStore();

  const editingProvider = editingProviderId
    ? providers.find((p) => p.id === editingProviderId)
    : undefined;

  const draftKey = `provider_form:${editingProvider?.id || 'new'}`;
  const dirtyKey = `provider_form:${editingProvider?.id || 'new'}`;
  const dirtyLabel = editingProvider ? `Edición de ${editingProvider.name}` : 'Nuevo proveedor';

  const [form, setForm] = useState<ProviderDraftInput>(EMPTY_PROVIDER);
  const [saving, setSaving] = useState(false);
  const [restoredDraftAt, setRestoredDraftAt] = useState<number | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const baselineSnapshotRef = useRef<string>(JSON.stringify(EMPTY_PROVIDER));
  const baselineFormRef = useRef<ProviderDraftInput>(EMPTY_PROVIDER);
  const initializedKeyRef = useRef<string>('');

  useEffect(() => {
    const initialForm: ProviderDraftInput = editingProvider
      ? {
          name: editingProvider.name || '',
          category: editingProvider.category || 'otro',
          contactName: editingProvider.contactName || '',
          taxId: editingProvider.taxId || '',
          phone: editingProvider.phone || '',
          email: editingProvider.email || '',
          address: editingProvider.address || '',
          specialtyOrProducts: editingProvider.specialtyOrProducts || '',
          paymentTerms: editingProvider.paymentTerms || '',
          notes: editingProvider.notes || '',
          sourceSessionId: editingProvider.sourceSessionId,
        }
      : voiceIntakeDraft?.target === 'provider' && voiceIntakeDraft.extractedProvider
      ? {
          ...EMPTY_PROVIDER,
          ...voiceIntakeDraft.extractedProvider,
          sourceSessionId: voiceIntakeDraft.sessionId,
        }
      : EMPTY_PROVIDER;

    baselineFormRef.current = initialForm;
    baselineSnapshotRef.current = JSON.stringify(initialForm);
    initializedKeyRef.current = draftKey;

    if (!(voiceIntakeDraft?.target === 'provider' && voiceIntakeDraft.extractedProvider)) {
      const savedDraft = loadLocalDraft<ProviderDraftInput>(draftKey);
      if (savedDraft?.data && JSON.stringify(savedDraft.data) !== baselineSnapshotRef.current) {
        setForm(savedDraft.data);
        setRestoredDraftAt(savedDraft.updatedAt);
        setIsDirty(true);
        setDraftDirty(dirtyKey, dirtyLabel);
      } else {
        setForm(initialForm);
        setRestoredDraftAt(null);
        setIsDirty(false);
        setDraftDirty(dirtyKey, null);
      }
    } else {
      setForm(initialForm);
      setRestoredDraftAt(null);
      setIsDirty(true);
      setDraftDirty(dirtyKey, dirtyLabel);
    }

    return () => {
      setDraftDirty(dirtyKey, null);
    };
  }, [editingProvider?.id, voiceIntakeDraft?.createdAt, draftKey, dirtyKey]);

  useEffect(() => {
    if (initializedKeyRef.current !== draftKey) return;
    const dirty = JSON.stringify(form) !== baselineSnapshotRef.current;
    setIsDirty(dirty);
    if (dirty) {
      saveLocalDraft(draftKey, form);
      setDraftDirty(dirtyKey, dirtyLabel);
    } else {
      clearLocalDraft(draftKey);
      setRestoredDraftAt(null);
      setDraftDirty(dirtyKey, null);
    }
  }, [form, draftKey, dirtyKey, dirtyLabel, setDraftDirty]);

  const handleExtractFromText = (text: string, sessionId?: string) => {
    const extracted = extractProviderFromTranscript(text);
    setForm((prev) => ({
      ...prev,
      ...Object.fromEntries(
        Object.entries(extracted).filter(([, val]) => Boolean(val && String(val).trim()))
      ),
      sourceSessionId: sessionId || prev.sourceSessionId,
    }));
    showToast('Campos del proveedor completados desde el dictado', 'success');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      showToast('El nombre o razón social del proveedor es obligatorio.', 'warning');
      return;
    }

    setSaving(true);
    try {
      if (editingProvider) {
        await updateProvider(editingProvider.id, form);
        clearLocalDraft(draftKey);
        setDraftDirty(dirtyKey, null);
        setIsDirty(false);
        setRestoredDraftAt(null);
        setView('manage-providers');
      } else {
        const created = await createProvider(form);
        if (created) {
          clearLocalDraft(draftKey);
          setDraftDirty(dirtyKey, null);
          setIsDirty(false);
          setRestoredDraftAt(null);
          baselineFormRef.current = EMPTY_PROVIDER;
          baselineSnapshotRef.current = JSON.stringify(EMPTY_PROVIDER);
          setForm(EMPTY_PROVIDER);
          setView('manage-providers');
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDiscardDraft = () => {
    clearLocalDraft(draftKey);
    setDraftDirty(dirtyKey, null);
    setRestoredDraftAt(null);
    setIsDirty(false);
    setForm(baselineFormRef.current);
    showToast('Borrador local descartado', 'info');
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className={pageHeaderClass}>
        <div className="flex items-center gap-3">
          {editingProvider && (
            <Button
              variant="icon"
              size="md"
              onClick={() => guardNavigation(() => setView('manage-providers'))}
              aria-label="Volver a proveedores"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
          )}
          <div>
            <h1 className={pageTitleClass}>
              {editingProvider ? `Editar proveedor · ${editingProvider.name}` : 'Nuevo proveedor'}
            </h1>
            <p className={pageSubtitleClass}>
              Registra laboratorios dentales, insumos o especialistas derivados manualmente o mediante dictado por voz.
            </p>
          </div>
        </div>
      </div>

      {/* Voice Auto-fill Assistant */}
      {!editingProvider && (
        <VoiceIntakePanel
          target="provider"
          onExtractText={handleExtractFromText}
          onClearDraft={() => {
            clearVoiceIntakeDraft();
            setForm(EMPTY_PROVIDER);
          }}
        />
      )}

      {/* Provider Form */}
      <form
        onSubmit={handleSubmit}
        className={`${cardClass} p-4 sm:p-6 space-y-6`}
      >
        {(restoredDraftAt || isDirty) && (
          <div className="p-3 rounded-xl bg-amber-50/90 dark:bg-amber-950/35 border border-amber-200 dark:border-amber-800/60 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900 dark:text-amber-200">
            <span>
              {restoredDraftAt
                ? 'Se recuperó un borrador local sin guardar de este proveedor.'
                : 'Borrador guardado localmente en este dispositivo (falta confirmar los cambios).'}
            </span>
            <button
              type="button"
              onClick={handleDiscardDraft}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 hover:bg-amber-100/70 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Descartar borrador</span>
            </button>
          </div>
        )}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 pb-2 border-b border-slate-100 dark:border-slate-800">
            Datos comerciales y categoría
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="sm:col-span-2 lg:col-span-1">
              <label className={labelClass}>Nombre o razón social *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ej: Laboratorio Dental Sur"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Categoría / Rubro</label>
              <select
                value={form.category}
                onChange={(e) =>
                  setForm({ ...form, category: e.target.value as ProviderCategory })
                }
                className={inputClass}
              >
                {CATEGORY_OPTIONS.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>CUIT / RUT / ID fiscal</label>
              <input
                type="text"
                value={form.taxId || ''}
                onChange={(e) => setForm({ ...form, taxId: e.target.value })}
                placeholder="Ej: 30-71234567-9"
                className={`${inputClass} font-mono tabular-nums`}
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 pb-2 border-b border-slate-100 dark:border-slate-800">
            Contacto y ubicación
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className={labelClass}>Persona de contacto</label>
              <input
                type="text"
                value={form.contactName || ''}
                onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                placeholder="Ej: Martín Gómez"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Teléfono / WhatsApp</label>
              <input
                type="tel"
                value={form.phone || ''}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="Ej: +54 9 11 4890-1122"
                className={`${inputClass} font-mono tabular-nums`}
              />
            </div>

            <div>
              <label className={labelClass}>Correo electrónico</label>
              <input
                type="email"
                value={form.email || ''}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="pedidos@proveedor.com"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Dirección / Zona</label>
              <input
                type="text"
                value={form.address || ''}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Av. Rivadavia 4200"
                className={inputClass}
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 pb-2 border-b border-slate-100 dark:border-slate-800">
            Servicios, productos y facturación
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Productos o especialidad</label>
              <input
                type="text"
                value={form.specialtyOrProducts || ''}
                onChange={(e) => setForm({ ...form, specialtyOrProducts: e.target.value })}
                placeholder="Ej: Coronas de zirconio, prótesis flexibles, implantes"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Condiciones de pago / CBU / Alias</label>
              <input
                type="text"
                value={form.paymentTerms || ''}
                onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })}
                placeholder="Ej: Cuenta corriente 30 días, transferencia Alias..."
                className={inputClass}
              />
            </div>

            <div className="md:col-span-2">
              <label className={labelClass}>Notas adicionales</label>
              <textarea
                rows={3}
                value={form.notes || ''}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Horarios de retiro, demoras estimadas o transcripción de referencia..."
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-center sm:justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button
            variant="ghost"
            onClick={() => {
              if (editingProvider) {
                guardNavigation(() => setView('manage-providers'));
              } else {
                clearLocalDraft(draftKey);
                setDraftDirty(dirtyKey, null);
                setRestoredDraftAt(null);
                setIsDirty(false);
                setForm(EMPTY_PROVIDER);
                clearVoiceIntakeDraft();
              }
            }}
          >
            {editingProvider ? 'Cancelar' : 'Limpiar formulario'}
          </Button>

          <Button
            type="submit"
            variant="primary"
            loading={saving}
            icon={editingProvider ? <Save className="w-4 h-4" /> : <Truck className="w-4 h-4" />}
          >
            {editingProvider ? 'Guardar cambios' : 'Registrar proveedor'}
          </Button>
        </div>
      </form>
    </div>
  );
};
