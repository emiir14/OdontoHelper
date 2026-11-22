import React, { useState } from 'react';
import { AlertTriangle, Clock, Landmark, X } from 'lucide-react';
import { evaluateSubscriptionStatus } from '../core/clinic/subscriptionPlans';
import { useAppStore } from '../store/useAppStore';

export const SubscriptionBanner: React.FC = () => {
  const { workspaceSubscription, transferRequests, openTransferModal } = useAppStore();
  const [dismissedOkTrial, setDismissedOkTrial] = useState(false);

  if (!workspaceSubscription) return null;

  const evaluation = evaluateSubscriptionStatus(workspaceSubscription);
  const hasPendingTransfer = transferRequests.some((r) => r.status === 'pending');

  // Show alert banners on ALL tiers when approaching expiration or expired,
  // plus a slim dismissible reminder during active 7-day free trial.
  const shouldShow =
    evaluation.alertLevel !== 'ok' || (evaluation.isTrial && !dismissedOkTrial);

  if (!shouldShow) return null;

  const toneClass =
    evaluation.alertLevel === 'expired'
      ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-900/70 text-rose-900 dark:text-rose-100'
      : evaluation.alertLevel === 'critical' || evaluation.alertLevel === 'warning'
      ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60 text-amber-950 dark:text-amber-100'
      : 'bg-teal-50/80 dark:bg-teal-950/35 border-teal-200/80 dark:border-teal-900/60 text-teal-950 dark:text-teal-100';

  const preferredTier =
    evaluation.tier === 'trial' ? 'base' : evaluation.tier;

  return (
    <div
      role={evaluation.alertLevel === 'expired' ? 'alert' : 'status'}
      className={`no-print border-b px-3 sm:px-6 lg:px-8 py-2.5 text-xs ${toneClass}`}
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-start sm:items-center gap-2.5 min-w-0">
          {evaluation.alertLevel === 'expired' || evaluation.alertLevel === 'critical' ? (
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 sm:mt-0 text-rose-600 dark:text-rose-400" />
          ) : (
            <Clock className="w-4 h-4 shrink-0 mt-0.5 sm:mt-0 text-teal-700 dark:text-teal-300" />
          )}
          <div className="min-w-0">
            <span className="font-semibold tabular-nums">{evaluation.headline}</span>
            <span className="hidden md:inline opacity-80"> · {evaluation.description}</span>
            {hasPendingTransfer && (
              <span className="block sm:inline sm:ml-2 font-medium underline underline-offset-2">
                Transferencia pendiente de verificación
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={() => openTransferModal(preferredTier, evaluation.billingCycle)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900 border border-current/20 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap cursor-pointer"
          >
            <Landmark className="w-3.5 h-3.5 shrink-0" />
            <span>
              {evaluation.isExpired
                ? 'Renovar por transferencia'
                : evaluation.isTrial
                ? 'Activar plan por transferencia'
                : 'Renovar plan'}
            </span>
          </button>

          {evaluation.alertLevel === 'ok' && evaluation.isTrial && (
            <button
              type="button"
              onClick={() => setDismissedOkTrial(true)}
              aria-label="Ocultar aviso temporalmente"
              className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
