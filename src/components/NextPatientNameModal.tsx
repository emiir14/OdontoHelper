import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Clock, Mic, UserPlus } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { inputLgClass, labelClass } from './ui/uiClasses';

const AUTO_CLOSE_SECONDS = 7;

export const NextPatientNameModal: React.FC = () => {
  const { pendingNextPatientModal, confirmNextPatientName } = useAppStore();
  const [patientName, setPatientName] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(AUTO_CLOSE_SECONDS);
  const [hasInteracted, setHasInteracted] = useState(false);
  const closedRef = useRef(false);

  useEffect(() => {
    if (!pendingNextPatientModal) return;
    closedRef.current = false;
    setPatientName('');
    setSecondsLeft(AUTO_CLOSE_SECONDS);
    setHasInteracted(false);
  }, [pendingNextPatientModal?.sessionId]);

  const finishAndStart = useCallback(
    (nameToSave?: string) => {
      if (closedRef.current || !pendingNextPatientModal) return;
      closedRef.current = true;
      void confirmNextPatientName(nameToSave);
    },
    [confirmNextPatientName, pendingNextPatientModal]
  );

  useEffect(() => {
    if (!pendingNextPatientModal || hasInteracted) return;

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [pendingNextPatientModal, hasInteracted]);

  useEffect(() => {
    if (!pendingNextPatientModal || hasInteracted) return;
    if (secondsLeft === 0) {
      finishAndStart(patientName);
    }
  }, [secondsLeft, hasInteracted, pendingNextPatientModal, finishAndStart, patientName]);

  if (!pendingNextPatientModal) return null;

  const markInteracted = () => {
    if (!hasInteracted) {
      setHasInteracted(true);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    finishAndStart(patientName);
  };

  const progressPct = Math.max(0, Math.min(100, (secondsLeft / AUTO_CLOSE_SECONDS) * 100));

  return (
    <Modal
      onClose={() => finishAndStart(patientName)}
      onPanelPointerDown={markInteracted}
      size="md"
      title="¿Deseás escribir el nombre del paciente?"
      subtitle={`Consulta anterior guardada · Próxima: Paciente #${pendingNextPatientModal.patientIndex}`}
      icon={
        <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200/70 dark:border-teal-800/60 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0">
          <UserPlus className="w-5 h-5" />
        </div>
      }
      footer={
        <>
          <Button
            variant="ghost"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => finishAndStart()}
          >
            Omitir y grabar
          </Button>
          <Button
            type="submit"
            form="next-patient-form"
            variant="primary"
            onPointerDown={(e) => e.stopPropagation()}
            icon={<Mic className="w-3.5 h-3.5" />}
          >
            {patientName.trim() ? 'Guardar y grabar' : 'Comenzar grabación'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div
          className={`rounded-2xl border p-3 text-xs space-y-2 transition-colors ${
            hasInteracted
              ? 'bg-teal-50/70 dark:bg-teal-950/30 border-teal-200 dark:border-teal-800/60 text-teal-900 dark:text-teal-200'
              : 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-200/80 dark:border-amber-800/60 text-amber-900 dark:text-amber-200'
          }`}
        >
          <div className="flex items-center gap-2 font-medium">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>
              {hasInteracted
                ? 'Cierre automático detenido. La grabación comenzará cuando cierres esta ventana.'
                : `Esta ventana se cerrará automáticamente en ${secondsLeft} ${
                    secondsLeft === 1 ? 'segundo' : 'segundos'
                  }.`}
            </span>
          </div>

          {!hasInteracted && (
            <div className="h-1.5 w-full bg-amber-200/70 dark:bg-amber-900/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 dark:bg-amber-400 rounded-full transition-all duration-1000 ease-linear"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          )}
        </div>

        <form id="next-patient-form" onSubmit={handleSubmit}>
          <label htmlFor="next-patient-name-input" className={labelClass}>
            Nombre o referencia (opcional)
          </label>
          <input
            id="next-patient-name-input"
            type="text"
            autoFocus
            value={patientName}
            onChange={(e) => {
              markInteracted();
              setPatientName(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key !== 'Escape' && e.key !== 'Enter' && e.key !== 'Tab') {
                markInteracted();
              }
            }}
            placeholder={`Ej: Juan Pérez (si lo dejás vacío será Paciente #${pendingNextPatientModal.patientIndex})`}
            className={inputLgClass}
          />
        </form>
      </div>
    </Modal>
  );
};
