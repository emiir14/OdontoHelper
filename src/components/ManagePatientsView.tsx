import React, { useMemo, useState } from 'react';
import {
  Search,
  UserPlus,
  Edit2,
  Trash2,
  Download,
  ExternalLink,
  Users,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

export const ManagePatientsView: React.FC = () => {
  const {
    patients,
    setView,
    selectPatient,
    startEditPatient,
    deletePatient,
    openConfirm,
    logActivity,
    showToast,
  } = useAppStore();

  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter(
      (p) =>
        p.fullName.toLowerCase().includes(q) ||
        (p.dni || '').toLowerCase().includes(q) ||
        (p.phone || '').toLowerCase().includes(q) ||
        (p.insuranceProvider || '').toLowerCase().includes(q)
    );
  }, [patients, query]);

  const handleExportCsv = async () => {
    const headers = [
      'Nombre',
      'DNI',
      'Edad',
      'Telefono',
      'Email',
      'Obra Social',
      'Afiliado',
      'Alergias',
      'Motivo',
    ];
    const escapeCsv = (val?: string) =>
      `"${(val || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`;
    const rows = patients.map((p) =>
      [
        p.fullName,
        p.dni,
        p.age,
        p.phone,
        p.email,
        p.insuranceProvider,
        p.insuranceNumber,
        p.allergies,
        p.chiefComplaint,
      ]
        .map(escapeCsv)
        .join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `odontohelper_pacientes_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    await logActivity('exported', 'patient', `Listado de pacientes exportado (${patients.length})`);
    showToast('Listado CSV de pacientes exportado', 'success');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-slate-800/80">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Administrar pacientes
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Herramienta de padrón general para editar, exportar o depurar fichas de pacientes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          {patients.length > 0 && (
            <button
              type="button"
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors min-h-[40px]"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span>Exportar CSV</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setView('patient-new')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 transition-colors shadow-xs min-h-[40px] whitespace-nowrap"
          >
            <UserPlus className="w-4 h-4" />
            <span>Nuevo paciente</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrar padrón por nombre, DNI, cobertura..."
            className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:border-teal-500"
          />
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
          {filtered.length} de {patients.length} pacientes
        </div>
      </div>

      {/* Table */}
      {filtered.length > 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <th className="py-3 px-4 font-semibold">Paciente</th>
                <th className="py-3 px-4 font-semibold">DNI</th>
                <th className="py-3 px-4 font-semibold">Teléfono</th>
                <th className="py-3 px-4 font-semibold">Cobertura</th>
                <th className="py-3 px-4 font-semibold">Alergias / Notas</th>
                <th className="py-3 px-4 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((p) => (
                <tr
                  key={p.id}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                    {p.fullName}
                  </td>
                  <td className="py-3 px-4 font-mono tabular-nums text-slate-600 dark:text-slate-300">
                    {p.dni || '—'}
                  </td>
                  <td className="py-3 px-4 font-mono tabular-nums text-slate-600 dark:text-slate-300">
                    {p.phone || '—'}
                  </td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                    {p.insuranceProvider || 'Particular'}
                  </td>
                  <td className="py-3 px-4 text-slate-500 dark:text-slate-400 max-w-xs truncate">
                    {p.allergies || p.chiefComplaint || '—'}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          selectPatient(p.id);
                          setView('patients-search');
                        }}
                        className="p-2 rounded-lg text-slate-500 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/40 transition-colors"
                        title="Abrir historia clínica"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => startEditPatient(p.id)}
                        className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Editar paciente"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          openConfirm({
                            title: '¿Eliminar paciente?',
                            description: `Se eliminará la ficha de "${p.fullName}" del padrón activo.`,
                            confirmText: 'Eliminar',
                            cancelText: 'Cancelar',
                            isDestructive: true,
                            onConfirm: () => deletePatient(p.id),
                          })
                        }
                        className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                        title="Eliminar paciente"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="py-14 px-6 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 space-y-3">
          <Users className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {query
              ? `No hay pacientes que coincidan con "${query}".`
              : 'No hay pacientes cargados en el padrón.'}
          </p>
        </div>
      )}
    </div>
  );
};
