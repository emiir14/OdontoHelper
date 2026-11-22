import React, { useRef, useState } from 'react';
import { Mic, FileAudio, Sparkles, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { revealExpandedSection } from '../core/utils/scrollReveal';
import { transcriptRepo, useAppStore } from '../store/useAppStore';
import { Button } from './ui/Button';
import { cardClass, inputClass, selectClass } from './ui/uiClasses';

interface VoiceIntakePanelProps {
  target: 'patient' | 'provider';
  onExtractText: (text: string, sessionId?: string) => void;
  onClearDraft?: () => void;
}

export const VoiceIntakePanel: React.FC<VoiceIntakePanelProps> = ({
  target,
  onExtractText,
  onClearDraft,
}) => {
  const {
    sessions,
    startIntakeRecording,
    voiceIntakeDraft,
    showToast,
  } = useAppStore();

  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [showManualText, setShowManualText] = useState(false);
  const [manualText, setManualText] = useState(
    voiceIntakeDraft?.target === target ? voiceIntakeDraft.transcriptText : ''
  );
  const [loadingSession, setLoadingSession] = useState(false);
  const manualSectionRef = useRef<HTMLDivElement | null>(null);

  const completedSessions = sessions.filter((s) => s.status === 'completed');

  const samplePrompt =
    target === 'patient'
      ? 'Ejemplo: "Nuevo paciente Lucía Fernández, DNI 35.420.118, edad 33 años, teléfono 11 5544 3322, mail lucia arroba gmail punto com, obra social OSDE, afiliado 405012, alergia a la penicilina, motivo de consulta dolor en pieza 3.6."'
      : 'Ejemplo: "Nuevo proveedor Laboratorio Dental Sur, categoría laboratorio, contacto Martín Gómez, CUIT 30-71234567-9, teléfono 11 4890 1122, mail pedidos arroba dentalsur punto com, dirección Av. Rivadavia 4200, productos coronas de zirconio y prótesis flexibles, condiciones de pago cuenta corriente a 30 días."';

  const handleLoadFromSession = async (sessionId: string) => {
    setSelectedSessionId(sessionId);
    if (!sessionId) return;
    setLoadingSession(true);
    try {
      const segments = await transcriptRepo.getBySessionId(sessionId);
      const joined = segments.map((s) => s.text).join(' ').trim();
      if (!joined) {
        showToast('La grabación seleccionada aún no tiene texto transcrito.', 'warning');
        return;
      }
      setManualText(joined);
      onExtractText(joined, sessionId);
    } finally {
      setLoadingSession(false);
    }
  };

  return (
    <section className={`${cardClass} p-4 sm:p-5 space-y-4`}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Carga inteligente por voz (100% local)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl">
            Dicta los datos en voz alta o reutiliza una transcripción del grabador para completar automáticamente todos los campos de esta ficha.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2.5 shrink-0">
          <Button
            variant="primary"
            size="md"
            icon={<Mic className="w-4 h-4" />}
            onClick={() => startIntakeRecording(target)}
          >
            Grabar datos por voz
          </Button>

          <Button
            variant="subtle"
            size="md"
            icon={<Sparkles className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />}
            aria-expanded={showManualText}
            onClick={() => {
              const next = !showManualText;
              setShowManualText(next);
              if (next) revealExpandedSection(manualSectionRef.current);
            }}
          >
            <span>Texto dictado</span>
            {showManualText ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* Existing transcription selector */}
      {completedSessions.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 pt-3 border-t border-slate-200/70 dark:border-slate-800/70">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300 flex items-center gap-1.5 shrink-0">
            <FileAudio className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span>Usar grabación existente:</span>
          </label>
          <select
            value={selectedSessionId}
            onChange={(e) => handleLoadFromSession(e.target.value)}
            disabled={loadingSession}
            className={`${selectClass} w-full sm:flex-1 sm:max-w-md min-h-[38px]`}
          >
            <option value="">Seleccionar una consulta ya transcrita...</option>
            {completedSessions.map((s) => (
              <option key={s.id} value={s.id}>
                {(s.reference || s.title) +
                  ' · ' +
                  new Date(s.createdAt).toLocaleDateString('es-AR')}
              </option>
            ))}
          </select>

          {voiceIntakeDraft?.target === target && onClearDraft && (
            <Button
              variant="ghost"
              size="xs"
              icon={<RotateCcw className="w-3.5 h-3.5" />}
              onClick={() => {
                setSelectedSessionId('');
                setManualText('');
                onClearDraft();
              }}
            >
              Limpiar borrador
            </Button>
          )}
        </div>
      )}

      {/* Transcribed text preview / manual paste */}
      {(showManualText || voiceIntakeDraft?.target === target) && (
        <div
          ref={manualSectionRef}
          className="pt-3 border-t border-slate-200/70 dark:border-slate-800/70 space-y-2.5"
        >
          <p className="text-[11px] text-slate-500 dark:text-slate-400">{samplePrompt}</p>
          <textarea
            rows={3}
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            placeholder="Pega o ajusta aquí el texto transcrito para extraer los campos automáticamente..."
            className={`${inputClass} leading-relaxed`}
          />
          <div className="flex justify-center sm:justify-end">
            <Button
              variant="soft"
              size="sm"
              onClick={() => onExtractText(manualText)}
              disabled={!manualText.trim()}
            >
              Autocompletar campos desde texto
            </Button>
          </div>
        </div>
      )}
    </section>
  );
};
