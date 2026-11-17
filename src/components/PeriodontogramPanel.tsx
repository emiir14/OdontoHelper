import React, { useEffect, useMemo, useState } from 'react';
import { Save, Trash2, History } from 'lucide-react';
import { PeriodontogramRecord, PeriodontogramToothData } from '../core/types';
import { useAppStore } from '../store/useAppStore';

interface PeriodontogramPanelProps {
  patientId: string;
  patientName: string;
}

const UPPER_TEETH = [
  '1.8', '1.7', '1.6', '1.5', '1.4', '1.3', '1.2', '1.1',
  '2.1', '2.2', '2.3', '2.4', '2.5', '2.6', '2.7', '2.8',
];
const LOWER_TEETH = [
  '4.8', '4.7', '4.6', '4.5', '4.4', '4.3', '4.2', '4.1',
  '3.1', '3.2', '3.3', '3.4', '3.5', '3.6', '3.7', '3.8',
];

function defaultTooth(fdi: string): PeriodontogramToothData {
  return {
    fdi,
    probingVestibular: [2, 2, 2],
    probingLingual: [2, 2, 2],
    recessionMm: 0,
    bleeding: false,
    suppuration: false,
    plaque: false,
    mobility: 0,
  };
}

export const PeriodontogramPanel: React.FC<PeriodontogramPanelProps> = ({
  patientId,
  patientName,
}) => {
  const {
    periodontograms,
    savePeriodontogramSnapshot,
    deletePeriodontogramSnapshot,
    openConfirm,
  } = useAppStore();

  const snapshots = useMemo(
    () => periodontograms.filter((p) => p.patientId === patientId),
    [periodontograms, patientId]
  );

  const [arch, setArch] = useState<'upper' | 'lower'>('upper');
  const [teeth, setTeeth] = useState<Record<string, PeriodontogramToothData>>({});
  const [label, setLabel] = useState(`Periodoncia ${new Date().toLocaleDateString('es-AR')}`);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const latest = snapshots[0];
    if (latest) {
      setTeeth(latest.teeth || {});
      setNotes(latest.notes || '');
    } else {
      setTeeth({});
      setNotes('');
    }
    setLabel(`Periodoncia ${new Date().toLocaleDateString('es-AR')}`);
  }, [patientId, snapshots[0]?.id]);

  const updateToothField = (
    fdi: string,
    updater: (prev: PeriodontogramToothData) => PeriodontogramToothData
  ) => {
    setTeeth((prev) => {
      const current = prev[fdi] || defaultTooth(fdi);
      return {
        ...prev,
        [fdi]: updater(current),
      };
    });
  };

  const activeTeeth = arch === 'upper' ? UPPER_TEETH : LOWER_TEETH;

  const stats = useMemo(() => {
    const all = Object.values(teeth) as PeriodontogramToothData[];
    let deepPockets = 0;
    let bleedingCount = 0;
    let mobilityCount = 0;

    all.forEach((t) => {
      const maxPocket = Math.max(...t.probingVestibular, ...t.probingLingual);
      if (maxPocket >= 4) deepPockets += 1;
      if (t.bleeding) bleedingCount += 1;
      if (t.mobility > 0) mobilityCount += 1;
    });

    return { deepPockets, bleedingCount, mobilityCount };
  }, [teeth]);

  const handleSave = async () => {
    await savePeriodontogramSnapshot({
      patientId,
      label: label.trim() || `Periodoncia ${new Date().toLocaleDateString('es-AR')}`,
      teeth,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Periodontograma · {patientName}
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Profundidad de sondaje (M/C/D en mm), sangrado al sondaje (BOP), recesión y movilidad dental.
          </p>
        </div>

        <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-0.5 text-[11px] font-medium self-start">
          <button
            type="button"
            onClick={() => setArch('upper')}
            className={`px-3 py-1 rounded-lg transition-colors ${
              arch === 'upper'
                ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 font-semibold shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Arcada Superior (1.8–2.8)
          </button>
          <button
            type="button"
            onClick={() => setArch('lower')}
            className={`px-3 py-1 rounded-lg transition-colors ${
              arch === 'lower'
                ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 font-semibold shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Arcada Inferior (4.8–3.8)
          </button>
        </div>
      </div>

      {/* Periodontal Grid */}
      <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800">
        <table className="w-full text-[11px] text-left border-collapse">
          <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-2.5 py-2 font-semibold">Pieza</th>
              <th className="px-2.5 py-2 font-semibold">Vestibular (M / C / D mm)</th>
              <th className="px-2.5 py-2 font-semibold">Lingual / Pal. (M / C / D mm)</th>
              <th className="px-2.5 py-2 font-semibold">Recesión</th>
              <th className="px-2.5 py-2 font-semibold text-center">BOP</th>
              <th className="px-2.5 py-2 font-semibold text-center">Placa</th>
              <th className="px-2.5 py-2 font-semibold text-center">Supur.</th>
              <th className="px-2.5 py-2 font-semibold">Movilidad</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
            {activeTeeth.map((fdi) => {
              const t = teeth[fdi] || defaultTooth(fdi);
              const maxVal = Math.max(...t.probingVestibular, ...t.probingLingual);
              const alertClass =
                maxVal >= 6
                  ? 'text-rose-700 dark:text-rose-400 font-bold'
                  : maxVal >= 4
                  ? 'text-amber-700 dark:text-amber-400 font-semibold'
                  : 'text-slate-700 dark:text-slate-200';

              return (
                <tr key={fdi} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                  <td className={`px-2.5 py-1.5 font-mono tabular-nums ${alertClass}`}>{fdi}</td>
                  <td className="px-2.5 py-1.5">
                    <div className="flex items-center gap-1">
                      {[0, 1, 2].map((idx) => (
                        <input
                          key={idx}
                          type="number"
                          min={0}
                          max={15}
                          value={t.probingVestibular[idx]}
                          onChange={(e) => {
                            const val = Math.max(0, Math.min(15, Number(e.target.value) || 0));
                            updateToothField(fdi, (prev) => {
                              const next: [number, number, number] = [...prev.probingVestibular] as [
                                number,
                                number,
                                number,
                              ];
                              next[idx] = val;
                              return { ...prev, probingVestibular: next };
                            });
                          }}
                          className={`w-10 px-1.5 py-1 rounded border text-center font-mono tabular-nums ${
                            t.probingVestibular[idx] >= 4
                              ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200'
                              : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                          }`}
                        />
                      ))}
                    </div>
                  </td>
                  <td className="px-2.5 py-1.5">
                    <div className="flex items-center gap-1">
                      {[0, 1, 2].map((idx) => (
                        <input
                          key={idx}
                          type="number"
                          min={0}
                          max={15}
                          value={t.probingLingual[idx]}
                          onChange={(e) => {
                            const val = Math.max(0, Math.min(15, Number(e.target.value) || 0));
                            updateToothField(fdi, (prev) => {
                              const next: [number, number, number] = [...prev.probingLingual] as [
                                number,
                                number,
                                number,
                              ];
                              next[idx] = val;
                              return { ...prev, probingLingual: next };
                            });
                          }}
                          className={`w-10 px-1.5 py-1 rounded border text-center font-mono tabular-nums ${
                            t.probingLingual[idx] >= 4
                              ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200'
                              : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                          }`}
                        />
                      ))}
                    </div>
                  </td>
                  <td className="px-2.5 py-1.5">
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={t.recessionMm}
                      onChange={(e) => {
                        const val = Math.max(0, Math.min(10, Number(e.target.value) || 0));
                        updateToothField(fdi, (prev) => ({ ...prev, recessionMm: val }));
                      }}
                      className="w-12 px-1.5 py-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-center font-mono tabular-nums text-slate-900 dark:text-slate-100"
                    />
                  </td>
                  <td className="px-2.5 py-1.5 text-center">
                    <input
                      type="checkbox"
                      checked={t.bleeding}
                      onChange={(e) =>
                        updateToothField(fdi, (prev) => ({ ...prev, bleeding: e.target.checked }))
                      }
                      className="accent-rose-600"
                    />
                  </td>
                  <td className="px-2.5 py-1.5 text-center">
                    <input
                      type="checkbox"
                      checked={t.plaque}
                      onChange={(e) =>
                        updateToothField(fdi, (prev) => ({ ...prev, plaque: e.target.checked }))
                      }
                      className="accent-amber-600"
                    />
                  </td>
                  <td className="px-2.5 py-1.5 text-center">
                    <input
                      type="checkbox"
                      checked={t.suppuration}
                      onChange={(e) =>
                        updateToothField(fdi, (prev) => ({ ...prev, suppuration: e.target.checked }))
                      }
                      className="accent-rose-700"
                    />
                  </td>
                  <td className="px-2.5 py-1.5">
                    <select
                      value={t.mobility}
                      onChange={(e) =>
                        updateToothField(fdi, (prev) => ({
                          ...prev,
                          mobility: Number(e.target.value) as 0 | 1 | 2 | 3,
                        }))
                      }
                      className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                    >
                      <option value={0}>0</option>
                      <option value={1}>I</option>
                      <option value={2}>II</option>
                      <option value={3}>III</option>
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Save Snapshot Bar */}
      <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2.5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono tabular-nums text-slate-600 dark:text-slate-300">
          <span>Bolsas &ge;4 mm: <strong className="text-amber-600">{stats.deepPockets}</strong></span>
          <span>Piezas con sangrado (BOP): <strong className="text-rose-600">{stats.bleedingCount}</strong></span>
          <span>Con movilidad: <strong>{stats.mobilityCount}</strong></span>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Nombre de medición periodontal"
            className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
          />
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Observaciones periodontales..."
            className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
          />
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 transition-colors whitespace-nowrap"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Guardar medición</span>
          </button>
        </div>
      </div>

      {/* History */}
      {snapshots.length > 0 && (
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <History className="w-3.5 h-3.5 text-teal-600" />
            <span>Mediciones anteriores ({snapshots.length})</span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden">
            {snapshots.map((snap: PeriodontogramRecord) => (
              <div
                key={snap.id}
                className="px-3.5 py-2 flex items-center justify-between gap-2 text-xs bg-white dark:bg-slate-900"
              >
                <button
                  type="button"
                  onClick={() => {
                    setTeeth(snap.teeth || {});
                    setNotes(snap.notes || '');
                  }}
                  className="text-left min-w-0 flex-1"
                >
                  <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {snap.label}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                    {new Date(snap.createdAt).toLocaleDateString('es-AR')}
                    {snap.createdBy ? ` · ${snap.createdBy}` : ''}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    openConfirm({
                      title: '¿Eliminar medición periodontal?',
                      description: `Se eliminará "${snap.label}".`,
                      confirmText: 'Eliminar',
                      cancelText: 'Cancelar',
                      isDestructive: true,
                      onConfirm: () => deletePeriodontogramSnapshot(snap.id),
                    })
                  }
                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
