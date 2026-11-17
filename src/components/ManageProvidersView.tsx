import React, { useMemo, useState } from 'react';
import { Search, Truck, Edit2, Trash2, Download, Building2 } from 'lucide-react';
import { ProviderCategory } from '../core/types';
import { useAppStore } from '../store/useAppStore';

const CATEGORY_LABELS: Record<ProviderCategory, string> = {
  laboratorio: 'Laboratorio dental',
  insumos: 'Insumos odontológicos',
  especialista: 'Especialista / Derivación',
  mantenimiento: 'Mantenimiento / Equipos',
  otro: 'Otro servicio',
};

export const ManageProvidersView: React.FC = () => {
  const {
    providers,
    setView,
    startEditProvider,
    deleteProvider,
    openConfirm,
    logActivity,
    showToast,
  } = useAppStore();

  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | ProviderCategory>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return providers.filter((pr) => {
      if (categoryFilter !== 'all' && pr.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        pr.name.toLowerCase().includes(q) ||
        (pr.contactName || '').toLowerCase().includes(q) ||
        (pr.taxId || '').toLowerCase().includes(q) ||
        (pr.specialtyOrProducts || '').toLowerCase().includes(q)
      );
    });
  }, [providers, query, categoryFilter]);

  const handleExportCsv = async () => {
    const headers = [
      'Nombre',
      'Categoria',
      'Contacto',
      'CUIT/RUT',
      'Telefono',
      'Email',
      'Direccion',
      'Productos/Especialidad',
      'Condiciones de Pago',
    ];
    const escapeCsv = (val?: string) =>
      `"${(val || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`;
    const rows = providers.map((pr) =>
      [
        pr.name,
        CATEGORY_LABELS[pr.category] || pr.category,
        pr.contactName,
        pr.taxId,
        pr.phone,
        pr.email,
        pr.address,
        pr.specialtyOrProducts,
        pr.paymentTerms,
      ]
        .map(escapeCsv)
        .join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `odontohelper_proveedores_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    await logActivity('exported', 'provider', `Listado de proveedores exportado (${providers.length})`);
    showToast('Listado CSV de proveedores exportado', 'success');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-slate-800/80">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Administrar proveedores
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Directorio de laboratorios dentales, casas de insumos, especialistas y servicio técnico.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          {providers.length > 0 && (
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
            onClick={() => setView('provider-new')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 transition-colors shadow-xs min-h-[40px] whitespace-nowrap"
          >
            <Truck className="w-4 h-4" />
            <span>Nuevo proveedor</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre, contacto, CUIT o producto..."
              className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:border-teal-500"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as 'all' | ProviderCategory)}
            className="px-3.5 py-2.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 min-h-[40px]"
          >
            <option value="all">Todas las categorías</option>
            {Object.entries(CATEGORY_LABELS).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
          {filtered.length} de {providers.length} proveedores
        </div>
      </div>

      {/* Table */}
      {filtered.length > 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <th className="py-3 px-4 font-semibold">Proveedor / Razón social</th>
                <th className="py-3 px-4 font-semibold">Categoría</th>
                <th className="py-3 px-4 font-semibold">Contacto</th>
                <th className="py-3 px-4 font-semibold">Teléfono</th>
                <th className="py-3 px-4 font-semibold">Productos / Especialidad</th>
                <th className="py-3 px-4 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((pr) => (
                <tr
                  key={pr.id}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                      {pr.name}
                    </div>
                    {pr.taxId && (
                      <div className="text-[11px] font-mono tabular-nums text-slate-400">
                        {pr.taxId}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4 text-teal-700 dark:text-teal-300 font-medium">
                    {CATEGORY_LABELS[pr.category] || pr.category}
                  </td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                    {pr.contactName || '—'}
                  </td>
                  <td className="py-3 px-4 font-mono tabular-nums text-slate-600 dark:text-slate-300">
                    {pr.phone || '—'}
                  </td>
                  <td className="py-3 px-4 text-slate-500 dark:text-slate-400 max-w-xs truncate">
                    {pr.specialtyOrProducts || pr.paymentTerms || '—'}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => startEditProvider(pr.id)}
                        className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Editar proveedor"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          openConfirm({
                            title: '¿Eliminar proveedor?',
                            description: `Se eliminará "${pr.name}" del directorio de proveedores.`,
                            confirmText: 'Eliminar',
                            cancelText: 'Cancelar',
                            isDestructive: true,
                            onConfirm: () => deleteProvider(pr.id),
                          })
                        }
                        className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                        title="Eliminar proveedor"
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
          <Building2 className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {query || categoryFilter !== 'all'
              ? 'No hay proveedores que coincidan con el filtro actual.'
              : 'Todavía no registraste proveedores.'}
          </p>
          {!query && categoryFilter === 'all' && (
            <button
              type="button"
              onClick={() => setView('provider-new')}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 transition-colors"
            >
              Registrar primer proveedor
            </button>
          )}
        </div>
      )}
    </div>
  );
};
