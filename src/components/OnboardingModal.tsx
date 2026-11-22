import React from 'react';
import { DownloadCloud, Mic, ShieldCheck, Sparkles } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';

export const OnboardingModal: React.FC = () => {
  const { showOnboarding, closeOnboarding } = useAppStore();

  if (!showOnboarding) return null;

  return (
    <Modal
      onClose={closeOnboarding}
      size="lg"
      title="Bienvenido a OdontoHelper"
      subtitle="Historias clínicas, agenda y transcripción odontológica 100% en tu dispositivo."
      icon={
        <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center text-white shadow-xs">
          <Sparkles className="w-5 h-5" />
        </div>
      }
      footer={
        <Button variant="primary" size="lg" fullWidth onClick={closeOnboarding}>
          Comenzar a usar OdontoHelper
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3.5">
          <div className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-950/60 flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0 mt-0.5">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
              1. Audio y transcripción 100% locales
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
              El audio crudo y el procesamiento del modelo Whisper se ejecutan exclusivamente en tu navegador. Ninguna grabación se sube a servidores de audio.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3.5">
          <div className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-950/60 flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0 mt-0.5">
            <DownloadCloud className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
              2. Descarga única del modelo
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
              La primera vez que transcribas, se descargará el modelo de Whisper (~75MB a 350MB). Luego queda cacheado y funciona de forma offline.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3.5">
          <div className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-950/60 flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0 mt-0.5">
            <Mic className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
              3. Permiso de micrófono
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
              Tu navegador solicitará acceso al micrófono al iniciar tu primera consulta. Podés dejar el teléfono sobre tu escritorio durante la sesión.
            </p>
          </div>
        </div>
      </div>
    </Modal>
  );
};
