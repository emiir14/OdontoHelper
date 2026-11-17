import React, { useState } from 'react';
import { Mic, FileAudio, Sparkles, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { transcriptRepo, useAppStore } from '../store/useAppStore';

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
    <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-5 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Carga inteligente por voz (100% local)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl">
            Dicta los datos en voz alta o reutiliza una transcripción del grabador para completar automáticamente todos los campos de esta ficha.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => startIntakeRecording(target)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 transition-colors shadow-xs min-h-[40px] whitespace-nowrap"
          >
            <Mic className="w-4 h-4" />
            <span>Grabar datos por voz</span>
          </button>

          <button
            type="button"
            onClick={() => setShowManualText((prev) => !prev)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors min-h-[40px] whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span>Texto dictado</span>
            {showManualText ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
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
            className="flex-1 max-w-md px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-teal-500 min-h-[38px]"
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
            <button
              type="button"
              onClick={() => {
                setSelectedSessionId('');
                setManualText('');
                onClearDraft();
              }}
              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 px-2 py-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Limpiar borrador</span>
            </button>
          )}
        </div>
      )}

      {/* Transcribed text preview / manual paste */}
      {(showManualText || voiceIntakeDraft?.target === target) && (
        <div className="pt-3 border-t border-slate-200/70 dark:border-slate-800/70 space-y-2.5">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">{samplePrompt}</p>
          <textarea
            rows={3}
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            placeholder="Pega o ajusta aquí el texto transcrito para extraer los campos automáticamente..."
            className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:border-teal-500 leading-relaxed"
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => onExtractText(manualText)}
              disabled={!manualText.trim()}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-teal-800 dark:text-teal-200 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800/70 hover:bg-teal-100 dark:hover:bg-teal-900/50 disabled:opacity-50 transition-colors min-h-[38px]"
            >
              Autocompletar campos desde texto
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
