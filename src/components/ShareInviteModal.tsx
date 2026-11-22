import React from 'react';
import { AlertTriangle, CheckCircle2, Lock, RotateCw, ShieldCheck, Users } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';

export const ShareInviteModal: React.FC = () => {
  const {
    shareInviteToken,
    shareInvitePreview,
    shareInviteLoading,
    shareInviteError,
    acceptShareInvite,
    dismissShareInvite,
  } = useAppStore();

  if (!shareInviteToken) return null;

  const canAccept = Boolean(
    shareInvitePreview &&
      shareInvitePreview.status === 'pending' &&
      !shareInvitePreview.isOwnShare
  );

  return (
    <Modal
      onClose={dismissShareInvite}
      size="md"
      zIndexClass="z-50"
      icon={
        <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/60 flex items-center justify-center text-teal-600 dark:text-teal-400">
          <Users className="w-4 h-4" />
        </div>
      }
      title="Ficha clínica compartida"
      subtitle="Vinculación clínica en tiempo real · OdontoHelper"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={dismissShareInvite}>
            {canAccept ? 'Cancelar' : 'Cerrar'}
          </Button>
          {canAccept && (
            <Button
              variant="primary"
              size="sm"
              disabled={shareInviteLoading}
              icon={<CheckCircle2 className="w-4 h-4" />}
              onClick={() => void acceptShareInvite(shareInviteToken)}
            >
              {shareInviteLoading
                ? 'Vinculando...'
                : 'Aceptar y vincular ficha clínica'}
            </Button>
          )}
        </>
      }
    >
      {shareInviteLoading && !shareInvitePreview ? (
        <div className="py-10 flex flex-col items-center justify-center gap-2.5 text-xs text-slate-500 dark:text-slate-400">
          <RotateCw className="w-5 h-5 animate-spin text-teal-600" />
          <span>Verificando enlace de derivación...</span>
        </div>
      ) : shareInviteError && !shareInvitePreview ? (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-semibold">Enlace no disponible</div>
            <p className="leading-relaxed">{shareInviteError}</p>
          </div>
        </div>
      ) : shareInvitePreview ? (
        <div className="space-y-4 text-xs">
          {/* Details Card */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-2.5">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Colega remitente
              </div>
              <div className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                {shareInvitePreview.ownerName}
              </div>
              {(shareInvitePreview.ownerSpecialty || shareInvitePreview.ownerLicense) && (
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {[
                    shareInvitePreview.ownerSpecialty,
                    shareInvitePreview.ownerLicense
                      ? `Mat. ${shareInvitePreview.ownerLicense}`
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-200/70 dark:border-slate-700/70">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Paciente derivado
              </div>
              <div className="text-sm font-semibold text-teal-800 dark:text-teal-300 mt-0.5">
                {shareInvitePreview.patientNameSnapshot}
              </div>
            </div>

            {shareInvitePreview.referralNote && (
              <div className="pt-2 border-t border-slate-200/70 dark:border-slate-700/70">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Motivo / Nota del colega
                </div>
                <p className="text-slate-700 dark:text-slate-200 whitespace-pre-line leading-relaxed mt-0.5">
                  {shareInvitePreview.referralNote}
                </p>
              </div>
            )}
          </div>

          {/* Rules & Privacy Summary */}
          <div className="space-y-2">
            <div className="p-3 rounded-xl bg-teal-50/70 dark:bg-teal-950/30 border border-teal-200/80 dark:border-teal-800/60 flex items-start gap-2.5 text-teal-900 dark:text-teal-100">
              <ShieldCheck className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                Tendrás acceso permanente en tiempo real a{' '}
                <strong>historia clínica, odontograma y radiografías</strong>. Tus presupuestos y
                Caja permanecen privados en tu consultorio.
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 flex items-start gap-2.5 text-slate-700 dark:text-slate-300">
              <Lock className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                Los registros previos del colega son inmutables (solo lectura). Podés sumar nuevas
                evoluciones, mediciones de odontograma y archivos con tu firma profesional.
              </div>
            </div>
          </div>

          {/* Edge Cases */}
          {shareInvitePreview.isOwnShare && (
            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 text-blue-900 dark:text-blue-200 leading-relaxed">
              Este enlace pertenece a tu propio consultorio. Compartilo por WhatsApp con el colega
              destinatario para que lo acepte desde su sesión.
            </div>
          )}

          {!shareInvitePreview.isOwnShare && shareInvitePreview.status !== 'pending' && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 leading-relaxed">
              {shareInvitePreview.status === 'accepted'
                ? 'Este enlace de un solo uso ya fue utilizado por un colega.'
                : 'Este enlace compartido fue revocado por el colega remitente.'}
            </div>
          )}

          {shareInviteError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-200">
              {shareInviteError}
            </div>
          )}
        </div>
      ) : null}
    </Modal>
  );
};
