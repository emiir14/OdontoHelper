import React, { useEffect, useState } from 'react';
import {
  Calendar,
  CalendarPlus,
  Check,
  CheckCircle2,
  FlaskConical,
  Lock,
  Mic,
  Pause,
  Play,
  RotateCcw,
  Share2,
  Sparkles,
  Square,
  Stethoscope,
  UserCheck,
  Wallet,
} from 'lucide-react';

const WAVE_BARS = [24, 52, 78, 44, 88, 65, 34, 72, 92, 54, 42, 82, 60, 36, 74, 48];

const DICTATION_WORDS = [
  'Paciente',
  'Lucía',
  'Méndez.',
  'Pieza',
  '36',
  'con',
  'pulpitis',
  'irreversible.',
  'Aislamiento',
  'absoluto,',
  'conductometría',
  'en',
  'tres',
  'conductos',
  'e',
  'hidróxido',
  'de',
  'calcio.',
  'Agendar',
  'control',
  'el',
  'próximo',
  'jueves',
  'a',
  'las',
  '10:30.',
];

/**
 * Crisp anatomical-style SVG tooth icon used in the interactive FDI dental chart
 * and the walkthrough preview so dental pieces read clearly instead of plain boxes.
 */
const ToothSilhouette: React.FC<{
  fdi: string;
  active?: boolean;
  tone?: 'teal' | 'amber' | 'sky' | 'neutral';
}> = ({ fdi, active = false, tone = 'neutral' }) => {
  const isAnterior = ['11', '12', '21', '22', '31', '32', '41', '42'].includes(fdi);
  const strokeClass = active
    ? tone === 'amber'
      ? 'text-amber-600 dark:text-amber-300'
      : tone === 'sky'
      ? 'text-sky-600 dark:text-sky-300'
      : 'text-white dark:text-white'
    : 'text-slate-400 dark:text-slate-500';

  if (isAnterior) {
    return (
      <svg className={`w-6 h-7 mx-auto ${strokeClass}`} viewBox="0 0 28 32" fill="none" aria-hidden="true">
        <path
          d="M8 6.5C8 4.6 10.6 3.5 14 3.5C17.4 3.5 20 4.6 20 6.5C20 11 18.8 14.2 17.7 17.5C16.7 20.6 15.8 25.5 14 28.5C12.2 25.5 11.3 20.6 10.3 17.5C9.2 14.2 8 11 8 6.5Z"
          fill="currentColor"
          fillOpacity={active ? '0.24' : '0.08'}
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg className={`w-7 h-7 mx-auto ${strokeClass}`} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path
        d="M6.5 9.5C6.5 6.2 9.4 4.5 12.6 5.2C14.1 5.5 15 6 16 6C17 6 17.9 5.5 19.4 5.2C22.6 4.5 25.5 6.2 25.5 9.5C25.5 13.8 23.6 17 22.3 22.6C21.7 25.5 20.4 27.2 19 27.2C17.6 27.2 17 24.4 16 22.2C15 24.4 14.4 27.2 13 27.2C11.6 27.2 10.3 25.5 9.7 22.6C8.4 17 6.5 13.8 6.5 9.5Z"
        fill="currentColor"
        fillOpacity={active ? '0.24' : '0.08'}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M11.5 10.2C13 11.1 19 11.1 20.5 10.2"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.7"
      />
    </svg>
  );
};

/**
 * Clean, frameless multi-device product showcase for the Hero section:
 * Removes fake browser URL bars and tiny pixelated thumbnails while animating
 * live voice-to-agenda synchronization across desktop and mobile.
 */
export const HeroMultiDeviceShowcase: React.FC = () => {
  const [heroBeat, setHeroBeat] = useState(0);

  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }
    const id = window.setInterval(() => {
      setHeroBeat((b) => (b + 1) % 8);
    }, 850);
    return () => window.clearInterval(id);
  }, []);

  const isHighlightedSync = heroBeat >= 4;

  return (
    <div className="relative mx-auto w-full max-w-[600px] pb-10 sm:pb-12">
      {/* Subtle architectural canvas framing */}
      <div
        aria-hidden="true"
        className="absolute -inset-3 rounded-[32px] bg-gradient-to-br from-teal-500/12 via-cyan-500/6 to-slate-200/20 dark:from-teal-500/15 dark:via-cyan-500/10 dark:to-transparent pointer-events-none"
      />

      {/* Native Clinical App Window (No Browser Chrome, No URL Bar) */}
      <div className="relative rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xl overflow-hidden">
        {/* Clean Application Header */}
        <div className="px-4 py-3 bg-[#F6FAFA] dark:bg-slate-950 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-6 h-6 rounded-lg bg-teal-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
              O
            </span>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                OdontoHelper · Consultorio Pocitos
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                Dra. Sofía Méndez · Agenda y dictado clínico
              </div>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-semibold text-teal-700 dark:text-teal-300 shrink-0 tabular-nums">
            <Calendar className="w-3.5 h-3.5" />
            <span>Jueves 26 de noviembre</span>
          </div>
        </div>

        {/* App Body: Crisp Navigation + Day Schedule */}
        <div className="grid grid-cols-12 min-h-[300px] sm:min-h-[330px]">
          {/* Clean App Sidebar */}
          <div className="col-span-4 sm:col-span-3 bg-[#F4F8F8] dark:bg-slate-950/60 border-r border-slate-200/80 dark:border-slate-800 p-3 flex flex-col justify-between">
            <div className="space-y-1">
              {[
                { label: 'Dictar consulta', active: false, icon: Mic },
                { label: 'Pacientes', active: false, icon: UserCheck },
                { label: 'Agenda', active: true, icon: Calendar },
                { label: 'Odontograma', active: false, icon: Stethoscope },
                { label: 'Caja ($ UYU)', active: false, icon: Wallet },
                { label: 'Laboratorio', active: false, icon: FlaskConical },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className={`flex items-center gap-2 px-2.5 py-2 rounded-xl text-[11px] font-medium transition-colors ${
                      item.active
                        ? 'bg-teal-600 text-white font-semibold shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </div>
                );
              })}
            </div>

            <div className="pt-3 border-t border-slate-200/70 dark:border-slate-800 space-y-1 text-[10px] text-slate-500 dark:text-slate-400">
              <div className="font-semibold text-slate-700 dark:text-slate-200">
                Sincronización activa
              </div>
              <div>Google · Apple · WhatsApp</div>
            </div>
          </div>

          {/* Main Agenda List */}
          <div className="col-span-8 sm:col-span-9 p-4 sm:p-5 space-y-3 bg-white dark:bg-slate-900">
            <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
              <div>
                <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                  Turnos del día
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Jueves 26 · Recordatorios automáticos listos
                </div>
              </div>
              <span className="text-[11px] font-semibold text-teal-700 dark:text-teal-300 tabular-nums">
                4 pacientes
              </span>
            </div>

            <div className="space-y-2 tabular-nums">
              {[
                {
                  time: '09:00',
                  patient: 'Martín Silva',
                  task: 'Limpieza y control semestral',
                  status: 'Atendido',
                  tone: 'text-emerald-700 dark:text-emerald-300 bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-200/80 dark:border-emerald-800/60',
                },
                {
                  time: '09:45',
                  patient: 'Carolina Vega',
                  task: 'Resina estética pieza 14',
                  status: 'En atención',
                  tone: 'text-sky-700 dark:text-sky-300 bg-sky-50/80 dark:bg-sky-950/40 border-sky-200/80 dark:border-sky-800/60',
                },
                {
                  time: '10:30',
                  patient: 'Lucía Méndez',
                  task: 'Control de endodoncia pieza 36 (captado por voz)',
                  status: isHighlightedSync ? 'Agendado ahora' : 'Confirmado',
                  highlight: true,
                  tone: isHighlightedSync
                    ? 'text-white bg-teal-600 border-teal-700'
                    : 'text-teal-800 dark:text-teal-200 bg-teal-50 dark:bg-teal-950/60 border-teal-300 dark:border-teal-700',
                },
                {
                  time: '11:30',
                  patient: 'Federico Acosta',
                  task: 'Prueba de corona sobre implante 26',
                  status: 'Pendiente',
                  tone: 'text-amber-700 dark:text-amber-300 bg-amber-50/80 dark:bg-amber-950/30 border-amber-200/80 dark:border-amber-800/60',
                },
              ].map((slot) => (
                <div
                  key={slot.time}
                  className={`flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl border text-xs transition-all duration-300 ${
                    slot.highlight
                      ? isHighlightedSync
                        ? 'border-teal-500 bg-teal-50/90 dark:bg-teal-950/50 shadow-sm'
                        : 'border-teal-400/70 bg-teal-50/50 dark:bg-teal-950/30'
                      : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/30'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-100 shrink-0">
                      {slot.time}
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 dark:text-white truncate">
                        {slot.patient}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {slot.task}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg border shrink-0 transition-colors ${slot.tone}`}
                  >
                    {slot.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Floating Mobile Dictation Card (Synced with Desktop Schedule) */}
      <div className="hidden sm:block absolute -bottom-2 -right-3 w-[230px] rounded-[24px] bg-slate-900 p-1.5 shadow-2xl border border-slate-700">
        <div className="rounded-[18px] bg-white dark:bg-slate-950 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5 text-teal-700 dark:text-teal-300">
              <Mic className="w-3 h-3" />
              Dictado desde el celular
            </span>
            <span className="font-mono tabular-nums">00:{String(36 + heroBeat).padStart(2, '0')}</span>
          </div>

          <div className="p-2.5 rounded-xl bg-teal-50/90 dark:bg-teal-950/50 border border-teal-200/80 dark:border-teal-800/60 space-y-2">
            <div className="text-[11px] font-bold text-slate-900 dark:text-white">
              Lucía Méndez · Pieza 36
            </div>
            <div className="flex items-end gap-0.5 h-6">
              {WAVE_BARS.slice(0, 12).map((h, i) => {
                const mod = ((i + heroBeat) % 3) * 14;
                const height = Math.max(22, Math.min(100, h - mod));
                return (
                  <span
                    key={i}
                    style={{ height: `${height}%` }}
                    className="flex-1 rounded-full bg-teal-600 dark:bg-teal-400 transition-all duration-300"
                  />
                );
              })}
            </div>
            <p className="text-[10px] leading-snug text-slate-700 dark:text-slate-200">
              “...control de endodoncia 36 el jueves a las 10:30.”
            </p>
          </div>

          <div className="flex items-center justify-between gap-1.5 text-[10px] font-semibold">
            <span className="text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
              <Check className="w-3 h-3" />
              {isHighlightedSync ? 'Turno agregado' : 'Cita detectada'}
            </span>
            <span className="text-teal-700 dark:text-teal-300 font-mono tabular-nums">
              Jue 10:30
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

interface WalkthroughStep {
  id: string;
  stepNum: number;
  title: string;
  subtitle: string;
}

const WALKTHROUGH_STEPS: WalkthroughStep[] = [
  {
    id: 'record',
    stepNum: 1,
    title: '1. Grabás al terminar',
    subtitle: 'Dictado fluido desde PC o celular',
  },
  {
    id: 'transcribe',
    stepNum: 2,
    title: '2. Se ordena la ficha',
    subtitle: 'Nota clínica + próximo control detectado',
  },
  {
    id: 'calendar',
    stepNum: 3,
    title: '3. Pasa a tu Agenda',
    subtitle: 'Turno guardado + aviso por WhatsApp',
  },
  {
    id: 'patient',
    stepNum: 4,
    title: '4. Odontograma actualizado',
    subtitle: 'Pieza 36 marcada e historial listo',
  },
];

const TICKS_PER_STEP = 8;

/**
 * High-craft interactive animated walkthrough (smooth GIF-style loop):
 * Live word-by-word voice capture -> structured clinical card -> schedule insertion -> FDI tooth chart.
 */
export const VoiceToCalendarWalkthrough: React.FC = () => {
  const [stepIndex, setStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!isPlaying) return;
    if (
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    const timer = window.setInterval(() => {
      setTick((t) => {
        const next = t + 1;
        if (next % TICKS_PER_STEP === 0) {
          setStepIndex((s) => (s + 1) % WALKTHROUGH_STEPS.length);
        }
        return next;
      });
    }, 520);

    return () => window.clearInterval(timer);
  }, [isPlaying]);

  const handleSelectStep = (idx: number) => {
    setStepIndex(idx);
    setTick(idx * TICKS_PER_STEP);
  };

  const stepSubTick = tick % TICKS_PER_STEP;
  const recordingSeconds = 36 + stepSubTick;
  const revealedWordsCount =
    stepIndex === 0
      ? Math.min(DICTATION_WORDS.length, 8 + stepSubTick * 3)
      : DICTATION_WORDS.length;
  const pointerOnAddButton = stepIndex === 1 && stepSubTick >= 4;
  const appointmentInserted = stepIndex >= 2;
  const stepProgressPct = ((stepSubTick + 1) / TICKS_PER_STEP) * 100;

  return (
    <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-lg overflow-hidden">
      {/* Top Simulation Toolbar */}
      <div className="px-4 sm:px-6 py-3.5 bg-[#F2F7F7] dark:bg-slate-950/70 border-b border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-bold text-slate-900 dark:text-white">
            Recorrido en vivo: Del micrófono a la historia clínica y la Agenda
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsPlaying((p) => !p)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-teal-500 transition-colors cursor-pointer"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isPlaying ? 'Pausar demo' : 'Reproducir'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              handleSelectStep(0);
              setIsPlaying(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/50 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reiniciar</span>
          </button>
        </div>
      </div>

      {/* Clickable Timeline Tabs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40">
        {WALKTHROUGH_STEPS.map((st, idx) => {
          const active = stepIndex === idx;
          const completed = stepIndex > idx;
          return (
            <button
              key={st.id}
              type="button"
              onClick={() => handleSelectStep(idx)}
              className={`relative px-4 py-3 text-left transition-colors cursor-pointer ${
                active
                  ? 'bg-white dark:bg-slate-900'
                  : 'hover:bg-white/70 dark:hover:bg-slate-900/50'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`text-xs font-bold ${
                    active
                      ? 'text-teal-700 dark:text-teal-300'
                      : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {st.title}
                </span>
                {completed && <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                {st.subtitle}
              </div>
              {active && (
                <div
                  aria-hidden="true"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-100 dark:bg-teal-950 overflow-hidden"
                >
                  <div
                    className="h-full bg-teal-600 transition-transform duration-500 ease-out origin-left"
                    style={{ transform: `scaleX(${stepProgressPct / 100})` }}
                  />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Animated Viewport Frame */}
      <div className="p-4 sm:p-6 lg:p-8 bg-slate-50/40 dark:bg-slate-950/30">
        {stepIndex === 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-7 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-5 shadow-xs">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pb-3 border-b border-slate-100 dark:border-slate-800">
                <span className="flex items-center gap-2 font-medium text-teal-700 dark:text-teal-300">
                  <Mic className="w-3.5 h-3.5" />
                  Grabación continua · Resguardada en tu dispositivo
                </span>
                <span className="font-mono text-[11px] text-slate-500">Consultorio Centro</span>
              </div>

              <div className="text-center space-y-2 py-2">
                <div className="text-xs font-semibold text-teal-700 dark:text-teal-300">
                  Dictado clínico · Lucía Méndez (CI 4.512.890-1)
                </div>
                <div className="text-4xl sm:text-5xl font-mono font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
                  00:{String(recordingSeconds).padStart(2, '0')}
                </div>
                <div className="max-w-xs mx-auto flex items-end justify-center gap-1.5 h-10 pt-2">
                  {WAVE_BARS.map((h, i) => {
                    const delta = ((i + tick) % 4) * 12;
                    const pct = Math.max(18, Math.min(100, h - delta));
                    return (
                      <span
                        key={i}
                        style={{ height: `${pct}%` }}
                        className="w-2 rounded-full bg-teal-600 dark:bg-teal-400 transition-all duration-300"
                      />
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-center gap-3 pt-1">
                <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                  <Pause className="w-3.5 h-3.5" />
                  Pausar
                </span>
                <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-teal-600 text-white">
                  <Square className="w-3.5 h-3.5 fill-current" />
                  Finalizar y pasar a texto
                </span>
              </div>
            </div>

            <div className="lg:col-span-5 space-y-3">
              <div className="text-xs font-semibold text-teal-700 dark:text-teal-300">
                Lo que decís en voz alta al terminar la consulta:
              </div>
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm leading-relaxed text-slate-700 dark:text-slate-200 shadow-xs min-h-[136px]">
                “
                {DICTATION_WORDS.slice(0, revealedWordsCount).map((w, idx) => {
                  const isScheduleClause = idx >= 18;
                  return (
                    <React.Fragment key={idx}>
                      <span
                        className={
                          isScheduleClause
                            ? 'text-teal-700 dark:text-teal-300 font-semibold'
                            : undefined
                        }
                      >
                        {w}
                      </span>{' '}
                    </React.Fragment>
                  );
                })}
                ”
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                El audio se guarda automáticamente mientras hablás para que no pierdas ningún dato aunque se corte internet.
              </p>
            </div>
          </div>
        )}

        {stepIndex === 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            <div className="lg:col-span-7 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="text-xs font-bold text-slate-900 dark:text-white">
                  Evolución clínica ordenada al instante
                </div>
                <span className="text-[11px] font-semibold text-teal-700 dark:text-teal-300">
                  Transcripción privada
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800">
                  <div className="font-semibold text-slate-500 dark:text-slate-400 text-[11px]">
                    Pieza y diagnóstico
                  </div>
                  <div className="text-slate-900 dark:text-white font-semibold mt-1">
                    Pieza 36 · Pulpitis irreversible sintomática
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800">
                  <div className="font-semibold text-slate-500 dark:text-slate-400 text-[11px]">
                    Procedimiento realizado
                  </div>
                  <div className="text-slate-900 dark:text-white mt-1">
                    Conductometría 3 conductos, NaOCl 2,5%, Ca(OH)₂ y provisorio.
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 text-xs">
                <div className="font-semibold text-slate-500 dark:text-slate-400 text-[11px]">
                  Indicaciones post-consulta
                </div>
                <div className="text-slate-700 dark:text-slate-200 mt-1">
                  Ibuprofeno 600 mg cada 8 horas si presenta molestia. Evitar masticar del lado izquierdo hasta la obturación definitiva.
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 rounded-2xl bg-teal-50/80 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/70 p-5 flex flex-col justify-between gap-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-teal-800 dark:text-teal-200">
                  <Sparkles className="w-4 h-4 text-teal-600" />
                  <span>Próximo turno detectado en tu dictado</span>
                </div>

                <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-teal-200/80 dark:border-teal-800 space-y-2 text-xs tabular-nums">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Paciente</span>
                    <span className="font-bold text-slate-900 dark:text-white">Lucía Méndez</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Día y hora</span>
                    <span className="font-bold font-mono text-teal-700 dark:text-teal-300">
                      Jueves 26 · 10:30 h
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Motivo</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      Control de endodoncia pza. 36
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Profesional</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">Dra. Sofía Méndez</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleSelectStep(2)}
                className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  pointerOnAddButton
                    ? 'bg-teal-700 text-white ring-4 ring-teal-500/30 scale-[1.02]'
                    : 'bg-teal-600 hover:bg-teal-700 text-white'
                }`}
              >
                <CalendarPlus className="w-4 h-4" />
                <span>Confirmar turno en Agenda</span>
              </button>
            </div>
          </div>
        )}

        {stepIndex === 2 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-3 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    Agenda semanal · Noviembre 2026
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Horarios de sillón · 09:00 a 12:30
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-teal-700 dark:text-teal-300">
                  Jueves 26 confirmado
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2 text-[11px] text-center font-semibold text-slate-500 dark:text-slate-400 pb-1">
                <div>Hora</div>
                <div>Miércoles 25</div>
                <div className="text-teal-700 dark:text-teal-300">Jueves 26</div>
                <div>Viernes 27</div>
              </div>

              <div className="space-y-2 text-[11px] tabular-nums">
                <div className="grid grid-cols-4 gap-2 items-center">
                  <div className="font-mono font-semibold text-slate-500 text-center">09:30</div>
                  <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700 truncate text-slate-700 dark:text-slate-200">
                    P. Sosa · Resina
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700 truncate text-slate-700 dark:text-slate-200">
                    C. Vega · Limpieza
                  </div>
                  <div className="p-2 rounded-lg border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 text-center">
                    Disponible
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 items-center">
                  <div className="font-mono font-bold text-teal-700 dark:text-teal-300 text-center">
                    10:30
                  </div>
                  <div className="p-2 rounded-lg border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 text-center">
                    Disponible
                  </div>
                  <div
                    className={`p-2 rounded-lg border font-semibold transition-all duration-300 ${
                      appointmentInserted
                        ? 'bg-teal-600 text-white border-teal-700 shadow-sm'
                        : 'bg-teal-50 text-teal-800 border-teal-300'
                    }`}
                  >
                    <div className="truncate">Lucía Méndez</div>
                    <div className="text-[10px] opacity-90 truncate">Control endodoncia 36</div>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700 truncate text-slate-700 dark:text-slate-200">
                    M. Pérez · Implante
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 items-center">
                  <div className="font-mono font-semibold text-slate-500 text-center">11:30</div>
                  <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700 truncate text-slate-700 dark:text-slate-200">
                    A. Rodríguez · Control
                  </div>
                  <div className="p-2 rounded-lg bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/60 truncate text-amber-800 dark:text-amber-200">
                    F. Acosta · Corona
                  </div>
                  <div className="p-2 rounded-lg border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 text-center">
                    Disponible
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-3 shadow-xs">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="w-4 h-4" />
                <span>Turno agendado sin tipear de nuevo</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Queda vinculado al historial del paciente y sincronizado con Google Calendar o Apple Calendar para avisarle por WhatsApp.
              </p>
              <div className="p-3 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 text-[11px] text-emerald-900 dark:text-emerald-200">
                “Hola Lucía, te recordamos tu control de endodoncia el jueves 26 a las 10:30 h en Consultorio Centro.”
              </div>
            </div>
          </div>
        )}

        {stepIndex === 3 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-7 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    Lucía Méndez · Ficha clínica
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Odontograma FDI al día · Próximo turno Jue 26 · 10:30 h
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-teal-700 dark:text-teal-300">
                  Evolución guardada
                </span>
              </div>

              <div className="grid grid-cols-6 gap-2 text-center tabular-nums">
                {['34', '35', '36', '37', '46', '47'].map((fdi) => {
                  const isTarget = fdi === '36';
                  return (
                    <div
                      key={fdi}
                      className={`p-2.5 rounded-xl border ${
                        isTarget
                          ? 'bg-teal-600 text-white border-teal-700 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      <ToothSilhouette fdi={fdi} active={isTarget} />
                      <div className="font-mono text-xs font-bold mt-1">{fdi}</div>
                      <div className="text-[10px] opacity-90">
                        {isTarget ? 'Endodoncia' : 'Sana'}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 text-xs space-y-1">
                <div className="font-semibold text-slate-900 dark:text-white">
                  Última evolución · Hoy · Dictada por voz
                </div>
                <p className="text-slate-600 dark:text-slate-300">
                  Pieza 36: conductometría de 3 conductos, irrigación con hipoclorito al 2,5%, medicación intraconducto Ca(OH)₂. Control agendado Jue 26 10:30 h.
                </p>
              </div>
            </div>

            <div className="lg:col-span-5 space-y-3">
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2.5 shadow-xs">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                  <Share2 className="w-4 h-4 text-teal-600" />
                  <span>¿Derivás el caso a un colega?</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Mandás un enlace seguro por WhatsApp al endodoncista, cirujano o protesista. El especialista ve la ficha clínica, el odontograma y radiografías,{' '}
                  <strong className="font-semibold">sin ver tus honorarios ni la caja.</strong>
                </p>
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 pt-1">
                  <Lock className="w-3.5 h-3.5 text-teal-600" />
                  <span>Presupuestos y saldos ocultos para colegas externos</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Interactive 2-column visual showcases:
 * 1. Historia clínica, Odontograma FDI con piezas vectoriales y derivación privada a colegas
 * 2. Presupuestos, caja diaria ($ UYU / USD) y seguimiento de trabajos de laboratorio
 */
export const AlternatingModuleShowcases: React.FC = () => {
  const [markedTeeth, setMarkedTeeth] = useState<Record<string, string>>({
    '14': 'Resina',
    '36': 'Endodoncia',
    '46': 'Corona',
  });
  const [colleagueView, setColleagueView] = useState(false);
  const [demoCurrency, setDemoCurrency] = useState<'UYU' | 'USD'>('UYU');
  const [labStage, setLabStage] = useState<'sin_enviar' | 'en_laboratorio' | 'en_clinica' | 'instalado'>(
    'en_laboratorio'
  );

  const cycleTooth = (fdi: string) => {
    const order = ['', 'Resina', 'Endodoncia', 'Corona'];
    setMarkedTeeth((prev) => {
      const current = prev[fdi] || '';
      const nextIdx = (order.indexOf(current) + 1) % order.length;
      const nextVal = order[nextIdx];
      const next = { ...prev };
      if (!nextVal) {
        delete next[fdi];
      } else {
        next[fdi] = nextVal;
      }
      return next;
    });
  };

  const labStatusHint: Record<typeof labStage, string> = {
    sin_enviar: 'Recordatorio en Agenda: impresión aún pendiente de retiro por el laboratorio.',
    en_laboratorio: 'En confección en Lab. Dental Sur · Entrega prevista viernes 15:00 h.',
    en_clinica: 'Trabajo recibido en el consultorio · Listo para prueba en sillón.',
    instalado: 'Corona instalada y cementada · Orden cerrada sin alertas pendientes.',
  };

  return (
    <div className="space-y-16 lg:space-y-24">
      {/* Row 1: Historia Clínica, Odontograma FDI y Derivación */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        <div className="lg:col-span-5 space-y-4">
          <p className="text-xs font-semibold text-teal-700 dark:text-teal-300">
            Historia clínica y odontograma
          </p>
          <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white text-balance">
            Odontograma FDI interactivo y derivación segura a colegas
          </h3>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
            Registrá caras dentarias, periodontograma, radiografías y evoluciones ordenadas por fecha. Cuando trabajás con otro especialista, enviás un enlace por WhatsApp sin mostrar tus presupuestos ni tu caja.
          </p>
          <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-200 pt-1">
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
              <span>Odontograma permanente y temporario conectado a cada evolución.</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
              <span>Derivación por WhatsApp con privacidad total sobre aranceles y saldos.</span>
            </li>
          </ul>
        </div>

        <div className="lg:col-span-7">
          <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 shadow-md space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 dark:text-white">
                  Ficha clínica · Lucía Méndez
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {colleagueView
                    ? 'Vista que recibe el colega derivado · Presupuestos y caja ocultos'
                    : 'Vista completa de tu consultorio · Hacé clic en una pieza para editar'}
                </div>
              </div>

              <div
                role="tablist"
                aria-label="Comparar vista de tu consultorio y enlace para colega"
                className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 shrink-0"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={!colleagueView}
                  onClick={() => setColleagueView(false)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    !colleagueView
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Tu consultorio
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={colleagueView}
                  onClick={() => setColleagueView(true)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    colleagueView
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Share2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Vista del colega</span>
                </button>
              </div>
            </div>

            {colleagueView && (
              <div className="p-3 rounded-2xl bg-teal-50/75 dark:bg-teal-950/35 border border-teal-200/80 dark:border-teal-800/60 flex items-start gap-2.5 text-xs text-teal-900 dark:text-teal-100">
                <Share2 className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong>Enlace de derivación activo</strong> · El especialista accede en tiempo real al odontograma, evoluciones y radiografías, pero no ve aranceles ni movimientos de caja.
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
              {['16', '14', '11', '21', '36', '46'].map((fdi) => {
                const state = markedTeeth[fdi];
                const isMarked = Boolean(state);
                return (
                  <button
                    key={fdi}
                    type="button"
                    onClick={() => cycleTooth(fdi)}
                    className={`p-2.5 rounded-xl border transition-colors cursor-pointer ${
                      isMarked
                        ? 'bg-teal-600 border-teal-700 text-white shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-teal-400'
                    }`}
                  >
                    <ToothSilhouette fdi={fdi} active={isMarked} />
                    <div className="font-mono text-xs font-bold mt-1">{fdi}</div>
                    <div className={`text-[10px] truncate mt-0.5 ${isMarked ? 'text-teal-50' : 'text-slate-500'}`}>
                      {state || 'Sana'}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-900 dark:text-white">
                    Evolución clínica compartida
                  </span>
                  <span className="text-[11px] font-medium text-teal-700 dark:text-teal-300 whitespace-nowrap">
                    {colleagueView ? 'Visible · Solo lectura' : 'Editable'}
                  </span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                  Endodoncia mecanizada pieza 36 + radiografía periapical adjunta.
                </p>
              </div>
              <div
                className={`p-3.5 rounded-2xl border space-y-1.5 transition-colors ${
                  colleagueView
                    ? 'bg-slate-100/85 dark:bg-slate-950/85 border-dashed border-slate-300 dark:border-slate-700'
                    : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200/80 dark:border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-900 dark:text-white">
                    Presupuestos y caja
                  </span>
                  {colleagueView ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      <Lock className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                      <span>Bloqueado</span>
                    </span>
                  ) : (
                    <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
                      Solo tu consultorio
                    </span>
                  )}
                </div>
                {colleagueView ? (
                  <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                    Privado de tu consultorio. El colega no ve presupuestos, aranceles ni cobros.
                  </p>
                ) : (
                  <p className="font-mono font-bold tabular-nums text-slate-800 dark:text-slate-100">
                    $ 18.500 UYU · Al día
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Presupuestos, Caja diaria ($ UYU / USD) & Trabajos de Laboratorio */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        <div className="lg:col-span-7 order-2 lg:order-1">
          <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 shadow-md space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white">
                  Caja diaria y trabajos de laboratorio
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Alterná la moneda del consultorio o probá los estados del protésico
                </div>
              </div>

              <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
                {(['UYU', 'USD'] as const).map((curr) => (
                  <button
                    key={curr}
                    type="button"
                    onClick={() => setDemoCurrency(curr)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                      demoCurrency === curr
                        ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-xs'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {curr === 'UYU' ? '$ UYU' : 'USD'}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 tabular-nums">
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Cobrado en el día</div>
                <div className="text-base sm:text-lg font-mono font-bold text-teal-700 dark:text-teal-300 mt-1">
                  {demoCurrency === 'UYU' ? '$ 24.800' : 'USD 620'}
                </div>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Gastos laboratorio</div>
                <div className="text-base sm:text-lg font-mono font-bold text-slate-900 dark:text-white mt-1">
                  {demoCurrency === 'UYU' ? '$ 5.400' : 'USD 135'}
                </div>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Saldo neto</div>
                <div className="text-base sm:text-lg font-mono font-bold text-emerald-700 dark:text-emerald-300 mt-1">
                  {demoCurrency === 'UYU' ? '$ 19.400' : 'USD 485'}
                </div>
              </div>
            </div>

            {/* Interactive Lab Order Tracking Row */}
            <div className="p-4 rounded-2xl bg-[#F4F8F8] dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-bold text-slate-900 dark:text-white">
                  Trabajo de prótesis · Corona Zirconia pieza 46 (Lab. Dental Sur)
                </span>
                <span className="text-[11px] font-semibold text-teal-700 dark:text-teal-300 tabular-nums">
                  Entrega: Viernes 15:00 h
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(
                  [
                    { id: 'sin_enviar', label: 'Sin enviar' },
                    { id: 'en_laboratorio', label: 'En laboratorio' },
                    { id: 'en_clinica', label: 'En clínica' },
                    { id: 'instalado', label: 'Instalado' },
                  ] as const
                ).map((stage) => {
                  const active = labStage === stage.id;
                  return (
                    <button
                      key={stage.id}
                      type="button"
                      onClick={() => setLabStage(stage.id)}
                      className={`py-2 px-2.5 rounded-xl text-[11px] font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                        active
                          ? 'bg-teal-600 text-white border-teal-700'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-teal-400'
                      }`}
                    >
                      {stage.label}
                    </button>
                  );
                })}
              </div>

              <p className="text-[11px] text-slate-600 dark:text-slate-300">
                {labStatusHint[labStage]}
              </p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 order-1 lg:order-2 space-y-4">
          <p className="text-xs font-semibold text-teal-700 dark:text-teal-300">
            Presupuestos, caja y laboratorio
          </p>
          <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white text-balance">
            Controlá cobros en pesos uruguayos, dólares y órdenes al protesista
          </h3>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
            Armá presupuestos claros, registrá señas o pagos en cuotas (efectivo, transferencia o POS) y verificá si la prótesis ya llegó al consultorio antes de confirmar el turno.
          </p>
          <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-200 pt-1">
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
              <span>Avisos automáticos en Agenda si un trabajo sigue en el laboratorio.</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
              <span>Cierre diario de caja, saldos pendientes y liquidación por profesional.</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
