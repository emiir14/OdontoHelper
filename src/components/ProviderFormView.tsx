import React, { useEffect, useState } from 'react';
import { Save, Truck, ArrowLeft } from 'lucide-react';
import { extractProviderFromTranscript } from '../core/clinical/entityExtractor';
import { ProviderCategory, ProviderDraftInput } from '../core/types';
import { useAppStore } from '../store/useAppStore';
import { VoiceIntakePanel } from './VoiceIntakePanel';

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
  } = useAppStore();

  const editingProvider = editingProviderId
    ? providers.find((p) => p.id === editingProviderId)
    : undefined;

  const [form, setForm] = useState<ProviderDraftInput>(EMPTY_PROVIDER);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editingProvider) {
      setForm({
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
      });
    } else if (voiceIntakeDraft?.target === 'provider' && voiceIntakeDraft.extractedProvider) {
      const ext = voiceIntakeDraft.extractedProvider;
      setForm({
        ...EMPTY_PROVIDER,
        ...ext,
        sourceSessionId: voiceIntakeDraft.sessionId,
      });
    } else {
      setForm(EMPTY_PROVIDER);
    }
  }, [editingProvider?.id, voiceIntakeDraft?.createdAt]);

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
        setView('manage-providers');
      } else {
        const created = await createProvider(form);
        if (created) {
          setForm(EMPTY_PROVIDER);
          setView('manage-providers');
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    'w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-colors';
  const labelClass = 'block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5';

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-slate-800/80">
        <div className="flex items-center gap-3">
          {editingProvider && (
            <button
              type="button"
              onClick={() => setView('manage-providers')}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[40px] min-w-[40px] flex items-center justify-center"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {editingProvider ? `Editar proveedor · ${editingProvider.name}` : 'Nuevo proveedor'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
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
        className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 p-6 space-y-6"
      >
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
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={() => {
              setForm(EMPTY_PROVIDER);
              clearVoiceIntakeDraft();
              if (editingProvider) setView('manage-providers');
            }}
            className="px-4 py-2.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors min-h-[40px]"
          >
            {editingProvider ? 'Cancelar' : 'Limpiar formulario'}
          </button>

          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 transition-colors shadow-xs min-h-[40px]"
          >
            {editingProvider ? <Save className="w-4 h-4" /> : <Truck className="w-4 h-4" />}
            <span>{editingProvider ? 'Guardar cambios' : 'Registrar proveedor'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
