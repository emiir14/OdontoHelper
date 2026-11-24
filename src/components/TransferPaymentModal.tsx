import React, { useEffect, useState } from 'react';
import { Check, CheckCircle2, Copy, ExternalLink, Landmark, Send } from 'lucide-react';
import {
  BILLING_CYCLE_OPTIONS,
  SUBSCRIPTION_PLANS,
  URUGUAY_BANK_TRANSFER_INFO,
  buildTransferWhatsappUrl,
  buildWorkspaceTransferCode,
  calculatePlanPricing,
} from '../core/clinic/subscriptionPlans';
import { PaidSubscriptionPlanTier, SubscriptionBillingCycle } from '../core/types';
import { useAppStore } from '../store/useAppStore';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { inputClass, labelCompactClass, selectClass } from './ui/uiClasses';

export const TransferPaymentModal: React.FC = () => {
  const {
    isTransferModalOpen,
    transferModalTier,
    transferModalCycle,
    closeTransferModal,
    submitBankTransferRequest,
    workspace,
    profile,
    authEmail,
  } = useAppStore();

  const [selectedTier, setSelectedTier] = useState<PaidSubscriptionPlanTier>(transferModalTier);
  const [selectedCycle, setSelectedCycle] = useState<SubscriptionBillingCycle>(transferModalCycle);
  const [payerName, setPayerName] = useState('');
  const [bankName, setBankName] = useState('BROU');
  const [transferReference, setTransferReference] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [submittedWhatsappUrl, setSubmittedWhatsappUrl] = useState<string | null>(null);

  useEffect(() => {
    if (isTransferModalOpen) {
      setSelectedTier(transferModalTier);
      setSelectedCycle(transferModalCycle);
      setPayerName((prev) => prev || profile?.fullName || '');
      setSubmittedWhatsappUrl(null);
    }
  }, [isTransferModalOpen, transferModalTier, transferModalCycle, profile?.fullName]);

  if (!isTransferModalOpen || !workspace) return null;

  const pricing = calculatePlanPricing(selectedTier, selectedCycle);
  const transferCode = buildWorkspaceTransferCode(workspace.id);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(transferCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1800);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payerName.trim() || !transferReference.trim()) return;
    setSubmitting(true);
    try {
      const created = await submitBankTransferRequest({
        requestedTier: selectedTier,
        billingCycle: selectedCycle,
        payerName,
        bankName,
        transferReference,
        notes,
      });
      if (created) {
        const waUrl = buildTransferWhatsappUrl({
          workspaceId: workspace.id,
          planTier: selectedTier,
          billingCycle: selectedCycle,
          amountUsd: pricing.totalUsd,
          payerName: payerName.trim(),
          bankName: bankName.trim(),
          transferReference: transferReference.trim(),
          email: authEmail,
        });
        setSubmittedWhatsappUrl(waUrl);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={isTransferModalOpen}
      onClose={closeTransferModal}
      title="Activar o renovar por transferencia bancaria"
      subtitle="Pago directo exclusivamente en dólares (USD) en Uruguay"
      size="2xl"
    >
      <div className="p-4 sm:p-6 space-y-5 overflow-y-auto">
        {submittedWhatsappUrl ? (
          <div className="p-5 rounded-2xl bg-teal-50/70 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 space-y-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Aviso de transferencia registrado
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Tu comprobante quedó guardado con referencia <span className="font-mono font-semibold">{transferReference}</span> por <span className="font-mono font-semibold tabular-nums">USD {pricing.totalUsd}</span>. Para acelerar la activación, podés enviarnos el mensaje prearmado por WhatsApp.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <a
                href={submittedWhatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Enviar confirmación por WhatsApp</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-80" />
              </a>
              <Button variant="subtle" size="md" onClick={closeTransferModal}>
                Cerrar y volver al consultorio
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Plan & Billing Cycle Selector */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  1. Elegí el plan y la frecuencia
                </span>
                <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 gap-1">
                  {BILLING_CYCLE_OPTIONS.map((opt) => {
                    const active = selectedCycle === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setSelectedCycle(opt.id)}
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                          active
                            ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-2xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                        }`}
                      >
                        {opt.shortLabel}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {SUBSCRIPTION_PLANS.map((plan) => {
                  const pCalc = calculatePlanPricing(plan.id, selectedCycle);
                  const isUnavailable = !plan.available;
                  const isSelected = selectedTier === plan.id && !isUnavailable;
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      disabled={isUnavailable}
                      onClick={() => !isUnavailable && setSelectedTier(plan.id)}
                      className={`p-3.5 rounded-2xl border text-left transition-all ${
                        isUnavailable
                          ? 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 opacity-65 cursor-not-allowed'
                          : isSelected
                          ? 'border-teal-600 bg-teal-50/50 dark:bg-teal-950/35 ring-1 ring-teal-600 cursor-pointer'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          {plan.name}
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-teal-600 shrink-0" />}
                      </div>
                      <div className="mt-1.5 flex items-baseline gap-1 tabular-nums">
                        <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
                          ${pCalc.effectiveMonthlyUsd}
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          USD/mes
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                        {isUnavailable
                          ? 'No disponible por el momento'
                          : plan.cloudAudioStorage
                          ? 'Audios guardados en la nube'
                          : 'Audios privados en tu equipo'}
                      </p>
                    </button>
                  );
                })}
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/70 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-600 dark:text-slate-300">
                  Total a transferir ({pricing.months} {pricing.months === 1 ? 'mes' : 'meses'}):
                  {pricing.savingsUsd > 0 && (
                    <span className="ml-2 font-semibold text-teal-700 dark:text-teal-300 tabular-nums">
                      Ahorrás USD {pricing.savingsUsd} ({pricing.discountPct}% OFF)
                    </span>
                  )}
                </div>
                <div className="text-base font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                  USD {pricing.totalUsd}
                </div>
              </div>
            </div>

            {/* Bank Accounts */}
            <div className="p-4 rounded-2xl bg-slate-50/90 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
                  <Landmark className="w-4 h-4 text-teal-600" />
                  <span>2. Cuentas habilitadas en Uruguay (solo en USD)</span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-mono font-semibold text-slate-700 dark:text-slate-200 hover:border-teal-500 transition-colors cursor-pointer"
                >
                  {copiedCode ? (
                    <Check className="w-3 h-3 text-teal-600" />
                  ) : (
                    <Copy className="w-3 h-3 text-slate-400" />
                  )}
                  <span>Ref: {transferCode}</span>
                </button>
              </div>
              <ul className="space-y-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                {URUGUAY_BANK_TRANSFER_INFO.banks.map((b) => (
                  <li key={b.name} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{b.name}</span>
                    <span className="text-slate-500 dark:text-slate-400">{b.detail}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Transfer Report Form */}
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                3. Informá tu transferencia
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCompactClass}>Titular que transfiere *</label>
                  <input
                    type="text"
                    required
                    value={payerName}
                    onChange={(e) => setPayerName(e.target.value)}
                    placeholder="Nombre del titular o consultorio"
                    className={`${inputClass} bg-white dark:bg-slate-900`}
                  />
                </div>
                <div>
                  <label className={labelCompactClass}>Banco / Billetera origen *</label>
                  <select
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className={selectClass}
                  >
                    <option value="BROU">BROU</option>
                    <option value="Itaú">Itaú Uruguay</option>
                    <option value="Santander">Santander Uruguay</option>
                    <option value="BBVA">BBVA Uruguay</option>
                    <option value="Prex / OCA Blue">Prex / OCA Blue</option>
                    <option value="Otro banco">Otro banco</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCompactClass}>Número o referencia de comprobante *</label>
                  <input
                    type="text"
                    required
                    value={transferReference}
                    onChange={(e) => setTransferReference(e.target.value)}
                    placeholder="Ej: TRF-849201"
                    className={`${inputClass} bg-white dark:bg-slate-900 font-mono`}
                  />
                </div>
                <div>
                  <label className={labelCompactClass}>Comentario (opcional)</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Ej: Transferencia en USD desde cuenta BROU"
                    className={`${inputClass} bg-white dark:bg-slate-900`}
                  />
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 pt-2">
                <Button type="button" variant="ghost" size="md" onClick={closeTransferModal}>
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" size="md" loading={submitting}>
                  Registrar aviso de transferencia
                </Button>
              </div>
            </form>
          </>
        )}
      </div>
    </Modal>
  );
};
