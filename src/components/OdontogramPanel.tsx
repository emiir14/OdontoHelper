import React, { useEffect, useMemo, useState } from 'react';
import { Save, Trash2, RotateCcw, History, Lock } from 'lucide-react';
import { canMutateClinicalRecord } from '../core/clinic/referralExport';
import {
  OdontogramRecord,
  ToothRecord,
  ToothStatus,
  ToothSurfaceKey,
} from '../core/types';
import { useAppStore } from '../store/useAppStore';
import { Button } from './ui/Button';
import {
  inputClass,
  segmentedTabClass,
  segmentedTrackClass,
} from './ui/uiClasses';

interface OdontogramPanelProps {
  patientId: string;
  patientName: string;
}

const UPPER_RIGHT = ['1.8', '1.7', '1.6', '1.5', '1.4', '1.3', '1.2', '1.1'];
const UPPER_LEFT = ['2.1', '2.2', '2.3', '2.4', '2.5', '2.6', '2.7', '2.8'];
const LOWER_RIGHT = ['4.8', '4.7', '4.6', '4.5', '4.4', '4.3', '4.2', '4.1'];
const LOWER_LEFT = ['3.1', '3.2', '3.3', '3.4', '3.5', '3.6', '3.7', '3.8'];

const PEDIATRIC_UPPER_RIGHT = ['5.5', '5.4', '5.3', '5.2', '5.1'];
const PEDIATRIC_UPPER_LEFT = ['6.1', '6.2', '6.3', '6.4', '6.5'];
const PEDIATRIC_LOWER_RIGHT = ['8.5', '8.4', '8.3', '8.2', '8.1'];
const PEDIATRIC_LOWER_LEFT = ['7.1', '7.2', '7.3', '7.4', '7.5'];

const STATUS_META: Record<
  ToothStatus,
  { label: string; short: string; fillHex: string; textClass: string; wholeTooth?: boolean }
> = {
  sano: {
    label: 'Sano / Limpiar',
    short: 'Sano',
    fillHex: '#f1f5f9',
    textClass: 'text-slate-600 dark:text-slate-300',
  },
  caries: {
    label: 'Caries / Lesión',
    short: 'Caries',
    fillHex: '#e11d48',
    textClass: 'text-rose-700 dark:text-rose-400',
  },
  obturada: {
    label: 'Obturación / Composite',
    short: 'Obturada',
    fillHex: '#2563eb',
    textClass: 'text-blue-700 dark:text-blue-400',
  },
  sellante: {
    label: 'Sellante',
    short: 'Sellante',
    fillHex: '#0ea5e9',
    textClass: 'text-sky-700 dark:text-sky-400',
  },
  endodoncia: {
    label: 'Endodoncia',
    short: 'Endo',
    fillHex: '#7c3aed',
    textClass: 'text-violet-700 dark:text-violet-400',
    wholeTooth: true,
  },
  corona: {
    label: 'Corona',
    short: 'Corona',
    fillHex: '#d97706',
    textClass: 'text-amber-700 dark:text-amber-400',
    wholeTooth: true,
  },
  implante: {
    label: 'Implante',
    short: 'Implante',
    fillHex: '#0d9488',
    textClass: 'text-teal-700 dark:text-teal-400',
    wholeTooth: true,
  },
  protesis: {
    label: 'Prótesis / Puente',
    short: 'Prótesis',
    fillHex: '#b45309',
    textClass: 'text-amber-800 dark:text-amber-300',
    wholeTooth: true,
  },
  extraccion_indicada: {
    label: 'Extracción indicada',
    short: 'Exod.',
    fillHex: '#dc2626',
    textClass: 'text-red-700 dark:text-red-400',
    wholeTooth: true,
  },
  ausente: {
    label: 'Pieza ausente',
    short: 'Ausente',
    fillHex: '#64748b',
    textClass: 'text-slate-500 dark:text-slate-400',
    wholeTooth: true,
  },
};

function createEmptyTooth(fdi: string): ToothRecord {
  return {
    fdi,
    status: 'sano',
    surfaces: {},
    updatedAt: Date.now(),
  };
}

interface ToothSvgProps {
  fdi: string;
  record?: ToothRecord;
  selected: boolean;
  onSurfaceClick: (fdi: string, surface: ToothSurfaceKey) => void;
  onToothSelect: (fdi: string) => void;
}

const ToothSvg: React.FC<ToothSvgProps> = ({
  fdi,
  record,
  selected,
  onSurfaceClick,
  onToothSelect,
}) => {
  const wholeStatus = record?.status || 'sano';
  const surfaces = record?.surfaces || {};

  const getFill = (key: ToothSurfaceKey) => {
    const st = surfaces[key];
    if (!st || st === 'sano') return undefined;
    return STATUS_META[st]?.fillHex;
  };

  return (
    <div
      className={`flex flex-col items-center gap-1 p-1 rounded-lg border transition-colors ${
        selected
          ? 'border-teal-600 bg-teal-50/70 dark:bg-teal-950/40'
          : 'border-transparent hover:border-slate-200 dark:hover:border-slate-700'
      }`}
    >
      <button
        type="button"
        onClick={() => onToothSelect(fdi)}
        className="text-[10px] font-mono tabular-nums font-semibold text-slate-700 dark:text-slate-300 hover:text-teal-700 dark:hover:text-teal-300 leading-none"
        title={`Seleccionar pieza ${fdi}`}
      >
        {fdi}
      </button>

      <svg viewBox="0 0 40 40" className="w-9 h-9 select-none cursor-pointer">
        {/* Top surface (Vestibular) */}
        <polygon
          points="2,2 38,2 28,12 12,12"
          fill={getFill('V') || 'currentColor'}
          className={getFill('V') ? '' : 'text-slate-100 dark:text-slate-800 hover:text-slate-200 dark:hover:text-slate-700'}
          stroke="#64748b"
          strokeWidth="1.2"
          onClick={() => onSurfaceClick(fdi, 'V')}
        >
          <title>{fdi} · Vestibular</title>
        </polygon>

        {/* Bottom surface (Lingual/Palatino) */}
        <polygon
          points="12,28 28,28 38,38 2,38"
          fill={getFill('L') || 'currentColor'}
          className={getFill('L') ? '' : 'text-slate-100 dark:text-slate-800 hover:text-slate-200 dark:hover:text-slate-700'}
          stroke="#64748b"
          strokeWidth="1.2"
          onClick={() => onSurfaceClick(fdi, 'L')}
        >
          <title>{fdi} · Lingual / Palatino</title>
        </polygon>

        {/* Left surface (Mesial / Distal) */}
        <polygon
          points="2,2 12,12 12,28 2,38"
          fill={getFill('M') || 'currentColor'}
          className={getFill('M') ? '' : 'text-slate-100 dark:text-slate-800 hover:text-slate-200 dark:hover:text-slate-700'}
          stroke="#64748b"
          strokeWidth="1.2"
          onClick={() => onSurfaceClick(fdi, 'M')}
        >
          <title>{fdi} · Mesial</title>
        </polygon>

        {/* Right surface (Distal / Mesial) */}
        <polygon
          points="38,2 38,38 28,28 28,12"
          fill={getFill('D') || 'currentColor'}
          className={getFill('D') ? '' : 'text-slate-100 dark:text-slate-800 hover:text-slate-200 dark:hover:text-slate-700'}
          stroke="#64748b"
          strokeWidth="1.2"
          onClick={() => onSurfaceClick(fdi, 'D')}
        >
          <title>{fdi} · Distal</title>
        </polygon>

        {/* Center surface (Oclusal / Incisal) */}
        <rect
          x="12"
          y="12"
          width="16"
          height="16"
          fill={getFill('O') || 'currentColor'}
          className={getFill('O') ? '' : 'text-white dark:text-slate-900 hover:text-slate-100 dark:hover:text-slate-800'}
          stroke="#64748b"
          strokeWidth="1.2"
          onClick={() => onSurfaceClick(fdi, 'O')}
        >
          <title>{fdi} · Oclusal / Incisal</title>
        </rect>

        {/* Whole-tooth Clinical Glyphs */}
        {wholeStatus === 'ausente' && (
          <g stroke="#475569" strokeWidth="2.6" strokeLinecap="round" pointerEvents="none">
            <line x1="5" y1="5" x2="35" y2="35" />
            <line x1="35" y1="5" x2="5" y2="35" />
          </g>
        )}
        {wholeStatus === 'extraccion_indicada' && (
          <g stroke="#dc2626" strokeWidth="2.8" strokeLinecap="round" pointerEvents="none">
            <line x1="5" y1="5" x2="35" y2="35" />
            <line x1="35" y1="5" x2="5" y2="35" />
          </g>
        )}
        {wholeStatus === 'corona' && (
          <circle
            cx="20"
            cy="20"
            r="16"
            fill="none"
            stroke="#d97706"
            strokeWidth="3"
            pointerEvents="none"
          />
        )}
        {wholeStatus === 'protesis' && (
          <rect
            x="4"
            y="4"
            width="32"
            height="32"
            rx="4"
            fill="none"
            stroke="#b45309"
            strokeWidth="2.5"
            strokeDasharray="4 2"
            pointerEvents="none"
          />
        )}
        {wholeStatus === 'endodoncia' && (
          <g stroke="#7c3aed" strokeWidth="2.6" strokeLinecap="round" pointerEvents="none">
            <line x1="20" y1="7" x2="20" y2="33" />
            <circle cx="20" cy="20" r="3" fill="#7c3aed" />
          </g>
        )}
        {wholeStatus === 'implante' && (
          <g pointerEvents="none">
            <rect x="15" y="6" width="10" height="28" rx="2" fill="none" stroke="#0d9488" strokeWidth="2.2" />
            <line x1="15" y1="14" x2="25" y2="14" stroke="#0d9488" strokeWidth="1.8" />
            <line x1="15" y1="20" x2="25" y2="20" stroke="#0d9488" strokeWidth="1.8" />
            <line x1="15" y1="26" x2="25" y2="26" stroke="#0d9488" strokeWidth="1.8" />
          </g>
        )}
      </svg>

      <div className="h-3 text-[9px] font-medium leading-none truncate max-w-[44px]">
        {wholeStatus !== 'sano' ? (
          <span className={STATUS_META[wholeStatus].textClass}>
            {STATUS_META[wholeStatus].short}
          </span>
        ) : Object.keys(surfaces).length > 0 ? (
          <span className="text-slate-500 dark:text-slate-400 font-mono">
            {Object.keys(surfaces).join('')}
          </span>
        ) : null}
      </div>
    </div>
  );
};

export const OdontogramPanel: React.FC<OdontogramPanelProps> = ({
  patientId,
  patientName,
}) => {
  const {
    workspace,
    authUserId,
    patients,
    patientShares,
    odontograms,
    saveOdontogramSnapshot,
    deleteOdontogramSnapshot,
    openConfirm,
  } = useAppStore();

  const targetPatient = useMemo(
    () => patients.find((p) => p.id === patientId),
    [patients, patientId]
  );

  const isSharedPatient = useMemo(
    () =>
      Boolean(
        (targetPatient && workspace && targetPatient.workspaceId !== workspace.id) ||
          patientShares.some((s) => s.patientId === patientId && s.status === 'accepted')
      ),
    [targetPatient, workspace, patientShares, patientId]
  );

  const patientSnapshots = useMemo(
    () => odontograms.filter((o) => o.patientId === patientId),
    [odontograms, patientId]
  );

  const [dentition, setDentition] = useState<'adulto' | 'mixto'>('adulto');
  const [activeTool, setActiveTool] = useState<ToothStatus>('caries');
  const [selectedToothFdi, setSelectedToothFdi] = useState<string>('1.6');
  const [teeth, setTeeth] = useState<Record<string, ToothRecord>>({});
  const [snapshotLabel, setSnapshotLabel] = useState('');
  const [notes, setNotes] = useState('');
  const [loadedSnapshotId, setLoadedSnapshotId] = useState<string | null>(null);

  useEffect(() => {
    const latest = patientSnapshots[0];
    if (latest) {
      setTeeth(latest.teeth || {});
      setDentition(latest.dentition || 'adulto');
      setNotes(latest.notes || '');
      setLoadedSnapshotId(latest.id);
    } else {
      setTeeth({});
      setDentition('adulto');
      setNotes('');
      setLoadedSnapshotId(null);
    }
    setSnapshotLabel(`Control ${new Date().toLocaleDateString('es-AR')}`);
  }, [patientId, patientSnapshots[0]?.id]);

  const handleSurfaceClick = (fdi: string, surface: ToothSurfaceKey) => {
    setSelectedToothFdi(fdi);
    const meta = STATUS_META[activeTool];

    setTeeth((prev) => {
      const existing = prev[fdi] || createEmptyTooth(fdi);
      if (activeTool === 'sano') {
        const nextSurfaces = { ...existing.surfaces };
        delete nextSurfaces[surface];
        return {
          ...prev,
          [fdi]: {
            ...existing,
            status: 'sano',
            surfaces: nextSurfaces,
            updatedAt: Date.now(),
          },
        };
      }

      if (meta.wholeTooth) {
        const toggledStatus = existing.status === activeTool ? 'sano' : activeTool;
        return {
          ...prev,
          [fdi]: {
            ...existing,
            status: toggledStatus,
            updatedAt: Date.now(),
          },
        };
      }

      const currentSurf = existing.surfaces[surface];
      const nextSurfaces = { ...existing.surfaces };
      if (currentSurf === activeTool) {
        delete nextSurfaces[surface];
      } else {
        nextSurfaces[surface] = activeTool;
      }

      return {
        ...prev,
        [fdi]: {
          ...existing,
          surfaces: nextSurfaces,
          updatedAt: Date.now(),
        },
      };
    });
  };

  const handleSaveSnapshot = async () => {
    await saveOdontogramSnapshot({
      patientId,
      label: snapshotLabel.trim() || `Medición ${new Date().toLocaleDateString('es-AR')}`,
      dentition,
      teeth,
      notes: notes.trim() || undefined,
    });
  };

  const handleLoadSnapshot = (snap: OdontogramRecord) => {
    setTeeth(snap.teeth || {});
    setDentition(snap.dentition || 'adulto');
    setNotes(snap.notes || '');
    setLoadedSnapshotId(snap.id);
  };

  const findingsSummary = useMemo(() => {
    let caries = 0;
    let obturadas = 0;
    let endodoncias = 0;
    let coronasImplantes = 0;
    let ausentes = 0;

    (Object.values(teeth) as ToothRecord[]).forEach((t) => {
      if (t.status === 'endodoncia') endodoncias += 1;
      if (t.status === 'corona' || t.status === 'implante' || t.status === 'protesis') {
        coronasImplantes += 1;
      }
      if (t.status === 'ausente' || t.status === 'extraccion_indicada') ausentes += 1;
      Object.values(t.surfaces || {}).forEach((st) => {
        if (st === 'caries') caries += 1;
        if (st === 'obturada') obturadas += 1;
      });
    });

    return { caries, obturadas, endodoncias, coronasImplantes, ausentes };
  }, [teeth]);

  const selectedRecord = teeth[selectedToothFdi] || createEmptyTooth(selectedToothFdi);

  return (
    <div className="space-y-4">
      {/* Toolbar: Tool Palette + Dentition Switch */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Odontograma clínico · {patientName}
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Seleccioná un hallazgo o tratamiento y hacé clic sobre la cara dental (V, L, M, D, O) o pieza FDI.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2">
          <div className={segmentedTrackClass}>
            <button
              type="button"
              onClick={() => setDentition('adulto')}
              className={segmentedTabClass(dentition === 'adulto')}
            >
              Permanente
            </button>
            <button
              type="button"
              onClick={() => setDentition('mixto')}
              className={segmentedTabClass(dentition === 'mixto')}
            >
              Mixto / Temporarios
            </button>
          </div>

          <Button
            variant="subtle"
            size="xs"
            icon={<RotateCcw className="w-3.5 h-3.5" />}
            onClick={() => setTeeth({})}
            title="Limpiar diagrama actual"
          >
            Limpiar
          </Button>
        </div>
      </div>

      {isSharedPatient && (
        <div className="p-2.5 rounded-xl bg-teal-50/70 dark:bg-teal-950/30 border border-teal-200/70 dark:border-teal-800/60 flex items-center gap-2 text-[11px] text-teal-900 dark:text-teal-200">
          <Lock className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
          <span>
            Ficha compartida: al guardar se registra una <strong>nueva evolución</strong> en el
            odontograma con tu firma; las mediciones previas del colega quedan protegidas.
          </span>
        </div>
      )}

      {/* Findings / Tool Palette */}
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(STATUS_META) as ToothStatus[]).map((statusKey) => {
          const meta = STATUS_META[statusKey];
          const isActive = activeTool === statusKey;
          return (
            <button
              key={statusKey}
              type="button"
              onClick={() => setActiveTool(statusKey)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-colors ${
                isActive
                  ? 'border-teal-600 bg-teal-50 dark:bg-teal-950/60 text-teal-900 dark:text-teal-100 font-semibold'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-xs border border-slate-400/50 shrink-0"
                style={{ backgroundColor: meta.fillHex }}
              />
              <span>{meta.label}</span>
            </button>
          );
        })}
      </div>

      {/* Arch Diagram (Adult Upper / Lower + Pediatric when Mixto) */}
      <div className="sm:hidden text-[11px] text-slate-400 text-center">
        Deslizá horizontalmente para ver toda la arcada
      </div>
      <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 p-3 space-y-3 overflow-x-auto scrollbar-thin">
        {/* Upper Arch */}
        <div className="min-w-[660px] space-y-2">
          <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400 px-2">
            <span>Cuadrante I (Sup. Der.)</span>
            <span>Arcada Superior</span>
            <span>Cuadrante II (Sup. Izq.)</span>
          </div>
          <div className="flex items-center justify-center gap-1">
            <div className="flex items-center gap-0.5 pr-2 border-r-2 border-slate-300 dark:border-slate-700">
              {UPPER_RIGHT.map((fdi) => (
                <ToothSvg
                  key={fdi}
                  fdi={fdi}
                  record={teeth[fdi]}
                  selected={selectedToothFdi === fdi}
                  onSurfaceClick={handleSurfaceClick}
                  onToothSelect={setSelectedToothFdi}
                />
              ))}
            </div>
            <div className="flex items-center gap-0.5 pl-2">
              {UPPER_LEFT.map((fdi) => (
                <ToothSvg
                  key={fdi}
                  fdi={fdi}
                  record={teeth[fdi]}
                  selected={selectedToothFdi === fdi}
                  onSurfaceClick={handleSurfaceClick}
                  onToothSelect={setSelectedToothFdi}
                />
              ))}
            </div>
          </div>

          {dentition === 'mixto' && (
            <div className="flex items-center justify-center gap-1 pt-1">
              <div className="flex items-center gap-0.5 pr-2 border-r-2 border-slate-300 dark:border-slate-700">
                {PEDIATRIC_UPPER_RIGHT.map((fdi) => (
                  <ToothSvg
                    key={fdi}
                    fdi={fdi}
                    record={teeth[fdi]}
                    selected={selectedToothFdi === fdi}
                    onSurfaceClick={handleSurfaceClick}
                    onToothSelect={setSelectedToothFdi}
                  />
                ))}
              </div>
              <div className="flex items-center gap-0.5 pl-2">
                {PEDIATRIC_UPPER_LEFT.map((fdi) => (
                  <ToothSvg
                    key={fdi}
                    fdi={fdi}
                    record={teeth[fdi]}
                    selected={selectedToothFdi === fdi}
                    onSurfaceClick={handleSurfaceClick}
                    onToothSelect={setSelectedToothFdi}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 dark:border-slate-800" />

        {/* Lower Arch */}
        <div className="min-w-[660px] space-y-2">
          {dentition === 'mixto' && (
            <div className="flex items-center justify-center gap-1 pb-1">
              <div className="flex items-center gap-0.5 pr-2 border-r-2 border-slate-300 dark:border-slate-700">
                {PEDIATRIC_LOWER_RIGHT.map((fdi) => (
                  <ToothSvg
                    key={fdi}
                    fdi={fdi}
                    record={teeth[fdi]}
                    selected={selectedToothFdi === fdi}
                    onSurfaceClick={handleSurfaceClick}
                    onToothSelect={setSelectedToothFdi}
                  />
                ))}
              </div>
              <div className="flex items-center gap-0.5 pl-2">
                {PEDIATRIC_LOWER_LEFT.map((fdi) => (
                  <ToothSvg
                    key={fdi}
                    fdi={fdi}
                    record={teeth[fdi]}
                    selected={selectedToothFdi === fdi}
                    onSurfaceClick={handleSurfaceClick}
                    onToothSelect={setSelectedToothFdi}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-center gap-1">
            <div className="flex items-center gap-0.5 pr-2 border-r-2 border-slate-300 dark:border-slate-700">
              {LOWER_RIGHT.map((fdi) => (
                <ToothSvg
                  key={fdi}
                  fdi={fdi}
                  record={teeth[fdi]}
                  selected={selectedToothFdi === fdi}
                  onSurfaceClick={handleSurfaceClick}
                  onToothSelect={setSelectedToothFdi}
                />
              ))}
            </div>
            <div className="flex items-center gap-0.5 pl-2">
              {LOWER_LEFT.map((fdi) => (
                <ToothSvg
                  key={fdi}
                  fdi={fdi}
                  record={teeth[fdi]}
                  selected={selectedToothFdi === fdi}
                  onSurfaceClick={handleSurfaceClick}
                  onToothSelect={setSelectedToothFdi}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400 px-2">
            <span>Cuadrante IV (Inf. Der.)</span>
            <span>Arcada Inferior</span>
            <span>Cuadrante III (Inf. Izq.)</span>
          </div>
        </div>
      </div>

      {/* Selected Tooth Note + Counters */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
        <div className="md:col-span-5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
              Pieza {selectedToothFdi}
            </span>
            <span className={STATUS_META[selectedRecord.status].textClass + ' text-[11px] font-medium'}>
              {STATUS_META[selectedRecord.status].label}
            </span>
          </div>
          <input
            type="text"
            value={selectedRecord.notes || ''}
            onChange={(e) => {
              const val = e.target.value;
              setTeeth((prev) => ({
                ...prev,
                [selectedToothFdi]: {
                  ...(prev[selectedToothFdi] || createEmptyTooth(selectedToothFdi)),
                  notes: val,
                  updatedAt: Date.now(),
                },
              }));
            }}
            placeholder={`Observación pieza ${selectedToothFdi} (ej: filtración marginal)...`}
            className={inputClass}
          />
        </div>

        <div className="md:col-span-7 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2.5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600 dark:text-slate-300 font-mono tabular-nums">
            <span>Caras con caries: <strong className="text-rose-600 dark:text-rose-400">{findingsSummary.caries}</strong></span>
            <span>Obturadas: <strong className="text-blue-600 dark:text-blue-400">{findingsSummary.obturadas}</strong></span>
            <span>Endodoncias: <strong>{findingsSummary.endodoncias}</strong></span>
            <span>Coronas/Implantes: <strong>{findingsSummary.coronasImplantes}</strong></span>
            <span>Ausentes/Exod.: <strong>{findingsSummary.ausentes}</strong></span>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <input
              type="text"
              value={snapshotLabel}
              onChange={(e) => setSnapshotLabel(e.target.value)}
              placeholder="Etiqueta de medición (ej: Ingreso, Control 6 meses)"
              className={`${inputClass} flex-1`}
            />
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Nota general..."
              className={`${inputClass} flex-1`}
            />
            <Button
              variant="primary"
              size="sm"
              icon={<Save className="w-3.5 h-3.5" />}
              onClick={handleSaveSnapshot}
            >
              Guardar medición
            </Button>
          </div>
        </div>
      </div>

      {/* Historical Snapshots Timeline */}
      {patientSnapshots.length > 0 && (
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <History className="w-3.5 h-3.5 text-teal-600" />
            <span>Mediciones guardadas ({patientSnapshots.length})</span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden">
            {patientSnapshots.map((snap) => {
              const canDelete = canMutateClinicalRecord(snap, workspace?.id, authUserId);
              return (
                <div
                  key={snap.id}
                  className={`px-3.5 py-2.5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 sm:gap-3 text-xs ${
                    loadedSnapshotId === snap.id
                      ? 'bg-teal-50/60 dark:bg-teal-950/30'
                      : 'bg-white dark:bg-slate-900'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleLoadSnapshot(snap)}
                    className="text-left min-w-0 flex-1"
                  >
                    <div className="font-semibold text-slate-900 dark:text-slate-100 break-words">
                      {snap.label}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                      {new Date(snap.createdAt).toLocaleDateString('es-AR')}
                      {snap.createdBy ? ` · ${snap.createdBy}` : ''}
                      {snap.notes ? ` · ${snap.notes}` : ''}
                    </div>
                  </button>
                  {canDelete ? (
                    <Button
                      variant="icon"
                      size="xs"
                      className="hover:text-rose-600"
                      onClick={() =>
                        openConfirm({
                          title: '¿Eliminar medición de odontograma?',
                          description: `Se eliminará "${snap.label}".`,
                          confirmText: 'Eliminar',
                          cancelText: 'Cancelar',
                          isDestructive: true,
                          onConfirm: () => deleteOdontogramSnapshot(snap.id),
                        })
                      }
                      title="Eliminar medición"
                      aria-label="Eliminar medición"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  ) : (
                    <span
                      className="p-1.5 text-slate-400 dark:text-slate-500 inline-flex items-center gap-1 text-[10px]"
                      title={`Registro protegido de ${snap.createdBy || 'colega'}`}
                    >
                      <Lock className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
