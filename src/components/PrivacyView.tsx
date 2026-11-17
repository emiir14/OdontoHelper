import { ShieldCheck, HardDrive, Cpu, WifiOff, FileLock2 } from 'lucide-react';

export const PrivacyView: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 dark:text-teal-300 mb-2">
          <ShieldCheck className="w-4 h-4" />
          <span>Privacidad por diseño (Privacy by Design)</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Arquitectura de privacidad y datos
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
          OdontoHelper mantiene el audio de tus consultas y la inferencia de voz 100% en tu navegador. Solo las fichas clínicas, pacientes, proveedores y agenda se sincronizan con tu base de datos Supabase.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-2.5">
          <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/60 flex items-center justify-center text-teal-600 dark:text-teal-400">
            <HardDrive className="w-5 h-5" />
          </div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            1. Audio 100% en tu navegador
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Las grabaciones de audio se convierten inmediatamente en bloques PCM locales en IndexedDB. Ningún fragmento de audio es enviado a servidores externos ni almacenado en la nube.
          </p>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-2.5">
          <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/60 flex items-center justify-center text-teal-600 dark:text-teal-400">
            <Cpu className="w-5 h-5" />
          </div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            2. Transcripción con IA local
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            La transcripción utiliza modelos de Whisper que se ejecutan directamente en el procesador (WASM) o en la tarjeta gráfica (WebGPU) de tu propio dispositivo.
          </p>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-2.5">
          <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/60 flex items-center justify-center text-teal-600 dark:text-teal-400">
            <WifiOff className="w-5 h-5" />
          </div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            3. Modelo cacheado + base estructurada
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Los pesos de Whisper se descargan una sola vez en la caché de tu navegador. Los registros clínicos en texto, pacientes, proveedores y agenda viven en tu proyecto Supabase protegido por RLS.
          </p>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-2.5">
          <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/60 flex items-center justify-center text-teal-600 dark:text-teal-400">
            <FileLock2 className="w-5 h-5" />
          </div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            4. Control total y eliminación de datos
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            La profesional de la salud tiene el control absoluto: puede borrar selectivamente el archivo de audio tras la transcripción para liberar memoria, exportar el texto o purgar por completo la base de datos local en cualquier momento.
          </p>
        </div>
      </div>

      {/* Practical Clinical Usage Guide (ARG & URU) */}
      <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 space-y-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
          <ShieldCheck className="w-4 h-4 text-teal-600" />
          <span>Guía rápida de buenas prácticas en consulta clínica</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="space-y-1 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/60">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200">
              1. Consentimiento e identificación
            </h3>
            <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
              Informá brevemente al paciente que utilizarás transcripción de voz local para confeccionar su ficha odontológica. Por buena práctica clínica y resguardo ético, podés titular la sesión con sus iniciales o número de historia clínica/cédula interna.
            </p>
          </div>

          <div className="space-y-1 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/60">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200">
              2. Ubicación del micrófono
            </h3>
            <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
              Ubicá el teléfono o micrófono a 40–70 cm de tu zona de habla. El filtro acústico incorporado atenúa ruidos de saliva y succión, pero orientar el micrófono hacia vos garantiza máxima fidelidad fonética.
            </p>
          </div>

          <div className="space-y-1 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/60">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200">
              3. Dicción y nomenclatura FDI
            </h3>
            <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
              Dictá hallazgos de forma fluida usando la terminología habitual (ej: <em>«pieza 1.6 cara oclusal con caries de esmalte», «recambio de composite 2.4 mesial»</em>). El vocabulario dental integrado normaliza piezas y caras automáticamente.
            </p>
          </div>

          <div className="space-y-1 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/60">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200">
              4. Cierre y evolución médica
            </h3>
            <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
              Al finalizar la atención, usá el botón <strong>«Copiar todo»</strong> o exportá el texto para pegarlo directamente en el software de gestión o historia clínica digital de tu clínica. Podés conservar el audio local o eliminarlo para liberar espacio.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
