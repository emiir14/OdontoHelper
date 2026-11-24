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
import heroClinicImg from '../../assets/images/hero_dental_workspace_1795287115633.jpg';

const WAVE_BARS = [24, 52, 78, 44, 88, 65, 34, 72, 92, 54, 42, 82, 60, 36, 74, 48];

/**
 * Multi-device hero visual inspired by modern dental SaaS showcases:
 * Desktop app frame (Sidebar + Dictado/Agenda) paired with overlapping Mobile recording frame
 * and subtle clinic workspace backdrop.
 */
export const HeroMultiDeviceShowcase: React.FC = () => {
  const [heroBeat, setHeroBeat] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setHeroBeat((b) => (b + 1) % 6);
    }, 900);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="relative mx-auto w-full max-w-[600px] pb-8 sm:pb-10">
      {/* Soft clinical ambient frame */}
      <div
        aria-hidden="true"
        className="absolute -inset-4 rounded-[36px] bg-gradient-to-br from-teal-500/12 via-cyan-500/8 to-transparent dark:from-teal-500/15 dark:via-cyan-500/10 pointer-events-none"
      />

      {/* Desktop App Browser Mockup */}
      <div className="relative rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xl overflow-hidden">
        {/* Browser Chrome */}
        <div className="h-9 px-3.5 bg-slate-50 dark:bg-slate-950 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-700" />
            <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-700" />
            <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-700" />
          </div>
          <div className="px-3 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-[10px] font-mono text-slate-500 dark:text-slate-400">
            app.odontohelper.uy/agenda
          </div>
          <div className="text-[10px] font-semibold text-teal-700 dark:text-teal-300">
            Consultorio
          </div>
        </div>

        {/* App Body: Sidebar + Main Calendar/Patient Preview */}
        <div className="grid grid-cols-12 min-h-[290px] sm:min-h-[320px]">
          {/* Mini OdontoHelper Sidebar */}
          <div className="col-span-4 sm:col-span-3 bg-[#F4F8F8] dark:bg-slate-950/70 border-r border-slate-200/80 dark:border-slate-800 p-2.5 space-y-1.5">
            <div className="flex items-center gap-1.5 px-1.5 py-1 mb-2">
              <span className="w-5 h-5 rounded-md bg-teal-600 text-white flex items-center justify-center text-[10px] font-bold">
                O
              </span>
              <span className="text-[11px] font-bold text-slate-900 dark:text-white truncate">
                OdontoHelper
              </span>
            </div>

            {[
              { label: 'Dictar historia', active: false, icon: Mic },
              { label: 'Pacientes', active: false, icon: UserCheck },
              { label: 'Agenda', active: true, icon: Calendar },
              { label: 'Presupuestos', active: false, icon: Stethoscope },
              { label: 'Caja ($ UYU)', active: false, icon: Wallet },
              { label: 'Laboratorio', active: false, icon: FlaskConical },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-medium ${
                    item.active
                      ? 'bg-teal-600 text-white font-semibold'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Icon className="w-3 h-3 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </div>
              );
            })}

            {/* Subtle clinic atmosphere thumbnail */}
            <div className="pt-3 hidden sm:block">
              <div className="aspect-[16/10] rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800">
                <img
                  src={heroClinicImg}
                  alt="Consultorio dental moderno"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>

          {/* Main Agenda & Dictation Sync Canvas */}
          <div className="col-span-8 sm:col-span-9 p-3.5 sm:p-4 space-y-3 bg-white dark:bg-slate-900">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white">
                  Agenda del día · Jueves 26
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                  Consultorio Central · Dra. Sofía Méndez
                </div>
              </div>
              <div className="text-[10px] font-semibold text-teal-700 dark:text-teal-300 tabular-nums">
                4 turnos hoy
              </div>
            </div>

            <div className="space-y-2 tabular-nums">
              {[
                {
                  time: '09:00',
                  patient: 'Martín Silva',
                  task: 'Limpieza y control semestral',
                  status: 'Atendido',
                  tone: 'text-emerald-700 dark:text-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-200/70 dark:border-emerald-800/50',
                },
                {
                  time: '09:45',
                  patient: 'Carolina Vega',
                  task: 'Resina estética pieza 14',
                  status: 'En atención',
                  tone: 'text-sky-700 dark:text-sky-300 bg-sky-50/80 dark:bg-sky-950/40 border-sky-200/70 dark:border-sky-800/50',
                },
                {
                  time: '10:30',
                  patient: 'Lucía Méndez',
                  task: 'Control Endodoncia pieza 36 (desde voz)',
                  status: 'Confirmado',
                  highlight: true,
                  tone: 'text-teal-800 dark:text-teal-200 bg-teal-50 dark:bg-teal-950/60 border-teal-400/70 dark:border-teal-700',
                },
                {
                  time: '11:30',
                  patient: 'Federico Acosta',
                  task: 'Prueba de corona sobre implante 26',
                  status: 'Pendiente',
                  tone: 'text-amber-700 dark:text-amber-300 bg-amber-50/70 dark:bg-amber-950/30 border-amber-200/70 dark:border-amber-800/50',
                },
              ].map((slot) => (
                <div
                  key={slot.time}
                  className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl border text-[11px] transition-all ${
                    slot.highlight
                      ? 'border-teal-500/70 bg-teal-50/70 dark:bg-teal-950/40 shadow-xs'
                      : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="font-mono font-bold text-slate-700 dark:text-slate-200 shrink-0">
                      {slot.time}
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 dark:text-white truncate">
                        {slot.patient}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                        {slot.task}
                      </div>
                    </div>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border shrink-0 ${slot.tone}`}>
                    {slot.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Overlapping Mobile Phone Frame: Dictado en silla */}
      <div className="hidden sm:block absolute -bottom-3 -right-3 w-[210px] rounded-[24px] bg-slate-900 p-1.5 shadow-2xl border border-slate-700">
        <div className="rounded-[18px] bg-white dark:bg-slate-950 p-3 space-y-2.5">
          <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1 text-teal-700 dark:text-teal-300">
              <Mic className="w-3 h-3" />
              Dictado móvil
            </span>
            <span className="font-mono tabular-nums">00:{String(36 + heroBeat).padStart(2, '0')}</span>
          </div>

          <div className="p-2 rounded-xl bg-teal-50/90 dark:bg-teal-950/50 border border-teal-200/80 dark:border-teal-800/60 space-y-1.5">
            <div className="text-[10px] font-bold text-slate-900 dark:text-white">
              Lucía Méndez · Pieza 36
            </div>
            <div className="flex items-end gap-0.5 h-6">
              {WAVE_BARS.slice(0, 12).map((h, i) => {
                const mod = ((i + heroBeat) % 3) * 14;
                const height = Math.max(20, Math.min(100, h - mod));
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
              “...control endodoncia 36 el jueves a las 10:30.”
            </p>
          </div>

          <div className="flex items-center justify-between gap-1.5 text-[10px] font-semibold">
            <span className="text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
              <Check className="w-3 h-3" />
              Turno detectado
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
    title: '1. Grabás en sillón',
    subtitle: 'Dictado continuo desde PC o celular',
  },
  {
    id: 'transcribe',
    stepNum: 2,
    title: '2. Se pasa a texto',
    subtitle: 'Nota clínica + detección de próximo turno',
  },
  {
    id: 'calendar',
    stepNum: 3,
    title: '3. Se añade al calendario',
    subtitle: '1 clic en Agenda + aviso WhatsApp',
  },
  {
    id: 'patient',
    stepNum: 4,
    title: '4. Ficha y odontograma al día',
    subtitle: 'Evolución guardada y pieza 36 actualizada',
  },
];

/**
 * Looping animated "GIF-like" interactive walkthrough showing:
 * Recording -> Local Whisper transcription -> Adding follow-up appointment to Agenda calendar -> Patient card sync.
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
        if (next % 6 === 0) {
          setStepIndex((s) => (s + 1) % WALKTHROUGH_STEPS.length);
        }
        return next;
      });
    }, 650);

    return () => window.clearInterval(timer);
  }, [isPlaying]);

  const handleSelectStep = (idx: number) => {
    setStepIndex(idx);
    setTick(idx * 6);
  };

  const recordingSeconds = 36 + (tick % 6);
  const pointerOnAddButton = stepIndex === 1 && tick % 6 >= 3;
  const appointmentInserted = stepIndex >= 2;

  return (
    <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-lg overflow-hidden">
      {/* Top Simulation Toolbar */}
      <div className="px-4 sm:px-6 py-3.5 bg-[#F2F7F7] dark:bg-slate-950/70 border-b border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-bold text-slate-900 dark:text-white">
            Secuencia del sistema: De grabación de voz a calendario y ficha
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

      {/* Clickable Timeline Tabs (4 frames of the animated GIF sequence) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40">
        {WALKTHROUGH_STEPS.map((st, idx) => {
          const active = stepIndex === idx;
          const completed = stepIndex > idx;
          return (
            <button
              key={st.id}
              type="button"
              onClick={() => handleSelectStep(idx)}
              className={`px-4 py-3 text-left transition-colors border-b-2 cursor-pointer ${
                active
                  ? 'border-teal-600 bg-white dark:bg-slate-900'
                  : 'border-transparent hover:bg-white/70 dark:hover:bg-slate-900/50'
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
                  <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
                  Grabación continua · Guardado local hace instantes
                </span>
                <span className="font-mono text-[11px] tabular-nums">/dictar/grabando</span>
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
                  Finalizar y transcribir
                </span>
              </div>
            </div>

            <div className="lg:col-span-5 space-y-3">
              <div className="text-xs font-semibold text-teal-700 dark:text-teal-300">
                Lo que dicta el odontólogo al terminar la consulta:
              </div>
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm leading-relaxed text-slate-700 dark:text-slate-200 shadow-xs">
                “Paciente Lucía Méndez. Pieza 36 con pulpitis irreversible. Realizamos aislamiento absoluto, apertura y conductometría electrónica en tres conductos con hipoclorito al 2,5%. Dejamos hidróxido de calcio y provisorio.{' '}
                <strong className="text-teal-700 dark:text-teal-300 font-semibold">
                  Agendar control y obturación el próximo jueves a las 10:30 con la Dra. Sofía.
                </strong>
                ”
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                La grabación se va guardando mientras hablás para que no se pierda nada aunque se corte internet.
              </p>
            </div>
          </div>
        )}

        {stepIndex === 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            <div className="lg:col-span-7 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="text-xs font-bold text-slate-900 dark:text-white">
                  Historia clínica ordenada automáticamente
                </div>
                <span className="text-[11px] font-semibold text-teal-700 dark:text-teal-300">
                  Procesado en tu equipo
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800">
                  <div className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                    Pieza y hallazgos
                  </div>
                  <div className="text-slate-900 dark:text-white font-semibold mt-1">
                    Pieza 36 · Pulpitis irreversible sintomática
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800">
                  <div className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                    Procedimiento
                  </div>
                  <div className="text-slate-900 dark:text-white mt-1">
                    Conductometría 3 conductos, NaOCl 2,5%, Ca(OH)₂ y provisorio.
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 text-xs">
                <div className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                  Indicaciones para el paciente
                </div>
                <div className="text-slate-700 dark:text-slate-200 mt-1">
                  Ibuprofeno 600 mg c/ 8 h si hay molestia. Evitar masticar del lado izquierdo.
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 rounded-2xl bg-teal-50/80 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/70 p-5 flex flex-col justify-between gap-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-teal-800 dark:text-teal-200">
                  <Sparkles className="w-4 h-4 text-teal-600" />
                  <span>Cita detectada automáticamente en el audio</span>
                </div>

                <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-teal-200/80 dark:border-teal-800 space-y-1.5 text-xs tabular-nums">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Paciente</span>
                    <span className="font-bold text-slate-900 dark:text-white">Lucía Méndez</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Fecha y hora</span>
                    <span className="font-bold font-mono text-teal-700 dark:text-teal-300">
                      Jueves 26 · 10:30
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Motivo</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      Control Endodoncia pza. 36
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Profesional</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">Dra. Sofía</span>
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
                <span>Añadir a la Agenda</span>
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
                    Vista de consultorio · Horario 09:00 a 12:30
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-teal-700 dark:text-teal-300">
                  Jueves 26 seleccionado
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
                    <div className="text-[10px] opacity-90 truncate">Control Endo 36</div>
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
                <span>Agregado a Agenda sin reescribir</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                El turno queda vinculado al paciente y listo para enviar confirmación por WhatsApp o abrir en Google Calendar (.ics).
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
                    Odontograma FDI actualizado · Próxima cita Jue 26 · 10:30
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-teal-700 dark:text-teal-300">
                  Evolución sincronizada
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
                          ? 'bg-teal-600 text-white border-teal-700'
                          : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      <div className="font-mono text-xs font-bold">{fdi}</div>
                      <div className="text-[10px] mt-0.5 opacity-90">
                        {isTarget ? 'Endo' : 'Sana'}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 text-xs space-y-1">
                <div className="font-semibold text-slate-900 dark:text-white">
                  Última evolución · Hoy · Dictado por voz
                </div>
                <p className="text-slate-600 dark:text-slate-300">
                  Pieza 36: conductometría de 3 conductos, irrigación NaOCl 2,5%, medicación intraconducto Ca(OH)₂. Control agendado Jue 26 10:30.
                </p>
              </div>
            </div>

            <div className="lg:col-span-5 space-y-3">
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 shadow-xs">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                  <Share2 className="w-4 h-4 text-teal-600" />
                  <span>¿Derivás a otro colega?</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Compartí esta ficha y su odontograma por enlace de WhatsApp. El especialista ve hallazgos y radiografías, pero{' '}
                  <strong className="font-semibold">tus presupuestos y saldos permanecen privados.</strong>
                </p>
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 pt-1">
                  <Lock className="w-3.5 h-3.5 text-teal-600" />
                  <span>Caja y cuenta corriente ocultas en enlace compartido</span>
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
 * OdontoSys-inspired alternating 2-column visual walkthroughs covering:
 * 1. Agenda & WhatsApp reminders
 * 2. Historia clínica, Odontograma FDI & Colleague sharing
 * 3. Presupuestos, Caja diaria ($ UYU / USD) & Trabajos de Laboratorio
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

  const toggleTooth = (fdi: string) => {
    setMarkedTeeth((prev) => {
      const next = { ...prev };
      if (next[fdi]) {
        delete next[fdi];
      } else {
        next[fdi] = 'Tratamiento';
      }
      return next;
    });
  };

  return (
    <div className="space-y-16 lg:space-y-24">
      {/* Row 1: Historia Clínica, Odontograma FDI y Derivación */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        <div className="lg:col-span-5 space-y-4">
          <p className="text-xs font-semibold text-teal-700 dark:text-teal-300">
            Historia clínica y odontograma
          </p>
          <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Odontograma FDI interactivo y derivación segura a colegas
          </h3>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
            Registrá caras dentarias, periodontograma, archivos y evoluciones ordenadas por fecha. Cuando trabajás en equipo o derivás a un especialista, enviás un enlace por WhatsApp sin exponer presupuestos ni finanzas.
          </p>
          <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-200 pt-1">
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
              <span>Odontograma permanente y temporario con actualización directa desde la ficha.</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
              <span>Enlace compartido de solo lectura clínica con privacidad financiera total.</span>
            </li>
          </ul>
        </div>

        <div className="lg:col-span-7">
          <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 shadow-md space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white">
                  Ficha clínica · Lucía Méndez
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Tocá una pieza para marcar estado o probá la vista de colega
                </div>
              </div>

              <button
                type="button"
                onClick={() => setColleagueView((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                  colleagueView
                    ? 'bg-teal-600 text-white border-teal-700'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                }`}
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>{colleagueView ? 'Vista colega (sin precios)' : 'Simular enlace colega'}</span>
              </button>
            </div>

            <div className="grid grid-cols-6 gap-2 text-center">
              {['16', '14', '11', '21', '36', '46'].map((fdi) => {
                const state = markedTeeth[fdi];
                return (
                  <button
                    key={fdi}
                    type="button"
                    onClick={() => toggleTooth(fdi)}
                    className={`p-2.5 rounded-xl border transition-colors cursor-pointer ${
                      state
                        ? 'bg-teal-50 dark:bg-teal-950/60 border-teal-500 text-teal-900 dark:text-teal-200'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <div className="font-mono text-xs font-bold">{fdi}</div>
                    <div className="text-[10px] truncate mt-0.5">{state || 'Sana'}</div>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 space-y-1">
                <div className="font-bold text-slate-900 dark:text-white">
                  Evolución clínica visible
                </div>
                <p className="text-slate-600 dark:text-slate-300">
                  Endodoncia mecanizada pieza 36 + radiografía periapical adjunta.
                </p>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-white">
                    Cuentas y presupuesto
                  </span>
                  {colleagueView && <Lock className="w-3.5 h-3.5 text-teal-600" />}
                </div>
                <p className="font-mono font-bold tabular-nums text-slate-800 dark:text-slate-100">
                  {colleagueView ? 'Oculto al especialista externo' : '$ 18.500 UYU · Al día'}
                </p>
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
                  Cambiá la moneda o tocá la etapa del protésico
                </div>
              </div>

              <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
                {(['UYU', 'USD'] as const).map((curr) => (
                  <button
                    key={curr}
                    type="button"
                    onClick={() => setDemoCurrency(curr)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
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

            <div className="grid grid-cols-3 gap-3 tabular-nums">
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Cobrado del día</div>
                <div className="text-base sm:text-lg font-mono font-bold text-teal-700 dark:text-teal-300 mt-1">
                  {demoCurrency === 'UYU' ? '$ 24.800' : 'USD 620'}
                </div>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Laboratorio</div>
                <div className="text-base sm:text-lg font-mono font-bold text-slate-900 dark:text-white mt-1">
                  {demoCurrency === 'UYU' ? '$ 5.400' : 'USD 135'}
                </div>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Neto consultorio</div>
                <div className="text-base sm:text-lg font-mono font-bold text-emerald-700 dark:text-emerald-300 mt-1">
                  {demoCurrency === 'UYU' ? '$ 19.400' : 'USD 485'}
                </div>
              </div>
            </div>

            {/* Interactive Lab Order Tracking Row */}
            <div className="p-4 rounded-2xl bg-[#F4F8F8] dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-bold text-slate-900 dark:text-white">
                  Orden Lab #108 · Corona Zirconia pza. 46 (Lab. Dental Sur)
                </span>
                <span className="text-[11px] font-semibold text-teal-700 dark:text-teal-300">
                  Entrega: Viernes 15:00
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
                      className={`py-2 px-2.5 rounded-xl text-[11px] font-semibold border transition-colors cursor-pointer ${
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
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 order-1 lg:order-2 space-y-4">
          <p className="text-xs font-semibold text-teal-700 dark:text-teal-300">
            Presupuestos, caja y laboratorio
          </p>
          <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Controlá cobros en pesos uruguayos, dólares y órdenes de laboratorio
          </h3>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
            Generá presupuestos aprobados, registrá entregas parciales o cuotas en efectivo, transferencia o POS, y seguí qué prótesis está en el laboratorio antes de citar al paciente.
          </p>
          <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-200 pt-1">
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
              <span>Alertas automáticas en Agenda cuando un trabajo de laboratorio aún no llegó.</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
              <span>Reportes de caja, cuentas por cobrar y liquidación entre profesionales.</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
