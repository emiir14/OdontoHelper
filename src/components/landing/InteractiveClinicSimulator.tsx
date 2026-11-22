import React, { useEffect, useState } from 'react';
import { Calendar, Check, FileText, Mic, Play, RotateCcw, Share2 } from 'lucide-react';

interface DictationCase {
  id: string;
  label: string;
  specialty: string;
  toothFdi: string;
  toothCondition: string;
  dictatedText: string;
  findings: string;
  procedure: string;
  indications: string;
  nextVisit: string;
}

const DEMO_CASES: DictationCase[] = [
  {
    id: 'endo',
    label: 'Endodoncia pieza 36',
    specialty: 'Endodoncia',
    toothFdi: '36',
    toothCondition: 'Endodoncia en curso',
    dictatedText:
      'Paciente refiere dolor pulsátil al frío en molar inferior izquierdo. Pieza 36 con caries profunda ocluso-mesial y respuesta prolongada a vitalidad. Se realiza anestesia troncular con mepivacaína, aislamiento absoluto con dique de goma, apertura cameral y conductometría electrónica en tres conductos. Irrigación con hipoclorito al 2,5%, medicación intraconducto con hidróxido de calcio y sellado provisorio con ionómero.',
    findings: 'Caries penetrante ocluso-mesial en pieza 36, pulpitis irreversible sintomática.',
    procedure:
      'Aislamiento absoluto, apertura, conductometría de 3 conductos, irrigación con NaOCl 2,5% y medicación Ca(OH)2.',
    indications: 'Ibuprofeno 600 mg c/ 8 h por 48 h en caso de molestia. Evitar masticar del lado izquierdo.',
    nextVisit: 'Obturación definitiva en 7 días.',
  },
  {
    id: 'resto',
    label: 'Restauración estética 14',
    specialty: 'Operatoria Dental',
    toothFdi: '14',
    toothCondition: 'Resina compuesta',
    dictatedText:
      'Control de primer premolar superior derecho. Pieza 14 presenta filtración en amalgama antigua por distal. Bajo aislamiento relativo y grabado selectivo de esmalte, se remueve tejido cariado y se realiza restauración adhesiva en resina compuesta tono A2 por técnica incremental. Ajuste oclusal con papel de articular y pulido final.',
    findings: 'Caries secundaria distal en pieza 14 sobre restauración previa filtrada.',
    procedure: 'Remoción de amalgama, protección pulpar, adhesión y resina nanohíbrida A2.',
    indications: 'Higiene interproximal diaria con hilo dental. Sensibilidad leve transitoria normal 24-48 h.',
    nextVisit: 'Control semestral de higiene y flúor.',
  },
  {
    id: 'perio',
    label: 'Control periodontal 46',
    specialty: 'Periodoncia',
    toothFdi: '46',
    toothCondition: 'Mantenimiento periodontal',
    dictatedText:
      'Paciente acude a mantenimiento periodontal trimestral. Se constata profundidad de sondaje de 4 milímetros por vestibular de pieza 46 con leve sangrado al sondaje y placa supragingival en sector antero-inferior. Se realiza raspaje y alisado radicular ultrasónico, profilaxis con pasta sin flúor y refuerzo de técnica de cepillado de Bass modificada.',
    findings: 'Bolsa de 4 mm vestibular en pieza 46, sangrado leve al sondaje sector posterior.',
    procedure: 'Raspaje ultrasónico, curetaje focalizado en 46 y profilaxis completa.',
    indications: 'Enjuague con clorhexidina 0,12% por 7 días en la noche y cepillo interdental calibre 0,7 mm.',
    nextVisit: 'Reevaluación periodontal en 90 días.',
  },
];

const DEMO_FDI_TEETH = ['16', '14', '11', '21', '26', '36', '46'];

export const InteractiveClinicSimulator: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'voice' | 'share' | 'finance'>('voice');
  const [selectedCaseId, setSelectedCaseId] = useState<string>('endo');
  const [simRunning, setSimRunning] = useState(false);
  const [charCount, setCharCount] = useState<number>(DEMO_CASES[0].dictatedText.length);
  const [markedTeeth, setMarkedTeeth] = useState<Record<string, string>>({
    '36': 'Endodoncia',
    '14': 'Resina A2',
  });
  const [demoCurrency, setDemoCurrency] = useState<'UYU' | 'USD'>('UYU');

  const activeCase = DEMO_CASES.find((c) => c.id === selectedCaseId) || DEMO_CASES[0];

  useEffect(() => {
    if (!simRunning) return;
    if (charCount >= activeCase.dictatedText.length) {
      setSimRunning(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setCharCount((prev) => Math.min(activeCase.dictatedText.length, prev + 8));
    }, 28);
    return () => window.clearTimeout(timer);
  }, [simRunning, charCount, activeCase.dictatedText.length]);

  const handleSelectCase = (caseItem: DictationCase) => {
    setSelectedCaseId(caseItem.id);
    setCharCount(0);
    setSimRunning(true);
    setMarkedTeeth((prev) => ({
      ...prev,
      [caseItem.toothFdi]: caseItem.toothCondition,
    }));
  };

  const handleReplay = () => {
    setCharCount(0);
    setSimRunning(true);
  };

  const toggleTooth = (fdi: string) => {
    setMarkedTeeth((prev) => {
      const next = { ...prev };
      if (next[fdi]) {
        delete next[fdi];
      } else {
        next[fdi] = 'Tratamiento indicado';
      }
      return next;
    });
  };

  const typedText = activeCase.dictatedText.slice(0, charCount);
  const extractionReady = charCount > Math.min(80, activeCase.dictatedText.length * 0.45);

  return (
    <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden">
      {/* Simulator Mode Bar */}
      <div className="px-4 sm:px-6 py-3.5 bg-[#EDEFEA]/70 dark:bg-slate-950/60 border-b border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('voice')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'voice'
                ? 'bg-teal-600 text-white'
                : 'text-slate-600 dark:text-slate-300 hover:bg-white/80 dark:hover:bg-slate-800'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Dictado a historia</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('share')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'share'
                ? 'bg-teal-600 text-white'
                : 'text-slate-600 dark:text-slate-300 hover:bg-white/80 dark:hover:bg-slate-800'
            }`}
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Odontograma y derivación</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('finance')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'finance'
                ? 'bg-teal-600 text-white'
                : 'text-slate-600 dark:text-slate-300 hover:bg-white/80 dark:hover:bg-slate-800'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Agenda y caja UYU/USD</span>
          </button>
        </div>

        <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
          Simulación interactiva · Hacé clic para probar cada flujo
        </div>
      </div>

      {/* Mode 1: Voice Dictation */}
      {activeTab === 'voice' && (
        <div className="p-4 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              {DEMO_CASES.map((item) => {
                const active = item.id === selectedCaseId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectCase(item)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                      active
                        ? 'border-teal-600 bg-teal-50/70 dark:bg-teal-950/40 text-teal-800 dark:text-teal-200'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleReplay}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/50 hover:bg-teal-100 dark:hover:bg-teal-900/60 transition-colors cursor-pointer"
            >
              {simRunning ? (
                <RotateCcw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
              <span>{simRunning ? 'Transcribiendo en equipo...' : 'Simular dictado por voz'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Simulated Dictation Stream */}
            <div className="lg:col-span-5 p-4 rounded-2xl bg-[#F8F9F5] dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between gap-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  <span>Audio captado en consultorio</span>
                  <span className="font-mono text-teal-700 dark:text-teal-300">
                    Whisper local · {activeCase.specialty}
                  </span>
                </div>
                <p className="text-xs sm:text-[13px] text-slate-700 dark:text-slate-200 leading-relaxed min-h-[110px]">
                  {typedText}
                  {simRunning && (
                    <span className="inline-block w-1.5 h-3.5 ml-1 align-middle bg-teal-600 animate-pulse" />
                  )}
                </p>
              </div>
              <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
                Procesado localmente sin enviar grabaciones a internet.
              </div>
            </div>

            {/* Structured Clinical Note Output */}
            <div className="lg:col-span-7 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100">
                  <FileText className="w-4 h-4 text-teal-600" />
                  <span>Ficha clínica estructurada automáticamente</span>
                </div>
                <span className="font-mono text-xs font-semibold text-teal-700 dark:text-teal-300">
                  Pieza FDI {activeCase.toothFdi}
                </span>
              </div>

              {extractionReady ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 space-y-1">
                    <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Motivo y hallazgos
                    </div>
                    <p className="text-slate-800 dark:text-slate-200 leading-relaxed">
                      {activeCase.findings}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 space-y-1">
                    <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Procedimiento ejecutado
                    </div>
                    <p className="text-slate-800 dark:text-slate-200 leading-relaxed">
                      {activeCase.procedure}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 space-y-1">
                    <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Indicaciones al paciente
                    </div>
                    <p className="text-slate-800 dark:text-slate-200 leading-relaxed">
                      {activeCase.indications}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200/60 dark:border-teal-800/60 space-y-1">
                    <div className="text-[11px] font-semibold text-teal-700 dark:text-teal-300">
                      Próximo control
                    </div>
                    <p className="text-slate-800 dark:text-slate-100 font-medium leading-relaxed">
                      {activeCase.nextVisit}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="py-10 text-center text-xs text-slate-400 dark:text-slate-500">
                  Estructurando piezas FDI y secciones clínicas desde tu dictado...
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mode 2: Interactive Odontogram & Referral */}
      {activeTab === 'share' && (
        <div className="p-4 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Odontograma FDI interactivo y derivación entre colegas
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tocá cualquier pieza para registrar o quitar un tratamiento. El colega ve la historia y el odontograma compartidos, nunca tus honorarios ni caja.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
            {DEMO_FDI_TEETH.map((fdi) => {
              const cond = markedTeeth[fdi];
              return (
                <button
                  key={fdi}
                  type="button"
                  onClick={() => toggleTooth(fdi)}
                  className={`p-3 rounded-2xl border text-left transition-colors cursor-pointer ${
                    cond
                      ? 'border-teal-600 bg-teal-50/70 dark:bg-teal-950/40'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100">
                      {fdi}
                    </span>
                    {cond && <Check className="w-3.5 h-3.5 text-teal-600" />}
                  </div>
                  <div className="mt-1.5 text-[11px] text-slate-600 dark:text-slate-300 truncate">
                    {cond || 'Sana · Sin registro'}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 space-y-1.5">
              <div className="font-semibold text-slate-900 dark:text-slate-100">
                Lo que ve el especialista invitado (enlace único por WhatsApp)
              </div>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                Anamnesis, alergias, odontograma actualizado ({Object.keys(markedTeeth).length} piezas con registro), radiografías y sus propias evoluciones clínicas compartidas.
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 space-y-1.5">
              <div className="font-semibold text-slate-900 dark:text-slate-100">
                Lo que permanece privado en tu consultorio
              </div>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                Presupuestos, precios por prestación, cobros, saldos en cuenta corriente y caja diaria nunca se comparten. Además podés desvincular el acceso en cualquier momento.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Mode 3: Agenda & Caja */}
      {activeTab === 'finance' && (
        <div className="p-4 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Agenda del día y caja diaria en moneda única
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Trabajá en Pesos Uruguayos ($ UYU) o Dólares (USD) en presupuestos, cuenta corriente y reportes.
              </p>
            </div>

            <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 gap-1">
              {(['UYU', 'USD'] as const).map((cur) => (
                <button
                  key={cur}
                  type="button"
                  onClick={() => setDemoCurrency(cur)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    demoCurrency === cur
                      ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {cur === 'UYU' ? '$ UYU' : 'USD'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 tabular-nums">
            <div className="p-4 rounded-2xl bg-[#F8F9F5] dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Cobrado hoy</div>
              <div className="mt-1 text-xl font-bold font-mono text-slate-900 dark:text-slate-100">
                {demoCurrency === 'UYU' ? '$ 18.400' : 'USD 450'}
              </div>
              <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                Efectivo y transferencia bancaria
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-[#F8F9F5] dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Turnos confirmados</div>
              <div className="mt-1 text-xl font-bold font-mono text-slate-900 dark:text-slate-100">
                9 pacientes
              </div>
              <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                09:00 a 18:30 · Sillón 1 y 2
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-[#F8F9F5] dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Laboratorio pendiente</div>
              <div className="mt-1 text-xl font-bold font-mono text-slate-900 dark:text-slate-100">
                {demoCurrency === 'UYU' ? '$ 6.200' : 'USD 150'}
              </div>
              <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                2 coronas de zirconio en entrega
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
