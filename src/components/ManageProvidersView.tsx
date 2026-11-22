import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  CreditCard,
  Download,
  Edit2,
  Eye,
  FileText,
  FlaskConical,
  Mail,
  MapPin,
  Phone,
  Trash2,
  Truck,
  User,
  X,
} from 'lucide-react';
import { downloadCsvFile, generateWhatsAppUrl } from '../core/clinic/clinicHelpers';
import { Provider, ProviderCategory } from '../core/types';
import { useAppStore } from '../store/useAppStore';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import {
  DataTable,
  DataTableColumn,
  DataTableSortState,
  parseSortState,
  serializeSortState,
} from './ui/DataTable';
import { FilterBar } from './ui/FilterBar';
import { Modal } from './ui/Modal';
import { WhatsAppIcon } from './ui/WhatsAppIcon';
import {
  BadgeTone,
  buttonClass,
  emptyStateClass,
  pageContainerClass,
  pageHeaderClass,
  pageSubtitleClass,
  pageTitleClass,
} from './ui/uiClasses';

const CATEGORY_LABELS: Record<ProviderCategory, string> = {
  laboratorio: 'Laboratorio dental',
  insumos: 'Insumos odontológicos',
  especialista: 'Especialista / Derivación',
  mantenimiento: 'Mantenimiento / Equipos',
  otro: 'Otro servicio',
};

const CATEGORY_TONE: Record<ProviderCategory, BadgeTone> = {
  laboratorio: 'teal',
  insumos: 'blue',
  especialista: 'emerald',
  mantenimiento: 'amber',
  otro: 'neutral',
};

export const ManageProvidersView: React.FC = () => {
  const {
    providers,
    labOrders,
    setView,
    startEditProvider,
    deleteProvider,
    deleteProvidersBulk,
    openConfirm,
    logActivity,
    showToast,
    moduleQuery,
    setModuleQuery,
  } = useAppStore();

  const [query, setQuery] = useState('');
  const categoryFilter: 'all' | ProviderCategory =
    moduleQuery.category && moduleQuery.category in CATEGORY_LABELS
      ? (moduleQuery.category as ProviderCategory)
      : 'all';
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [viewingProviderId, setViewingProviderId] = useState<string | null>(null);

  const viewingProvider = useMemo(
    () => (viewingProviderId ? providers.find((p) => p.id === viewingProviderId) ?? null : null),
    [providers, viewingProviderId]
  );

  const viewingProviderLabs = useMemo(() => {
    if (!viewingProvider) return [];
    return labOrders
      .filter((o) => o.providerId === viewingProvider.id)
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [labOrders, viewingProvider]);

  const defaultSort: DataTableSortState = { columnId: 'name', direction: 'asc' };
  const currentSort = useMemo(
    () => parseSortState(moduleQuery.sort) ?? defaultSort,
    [moduleQuery.sort]
  );
  const currentPage = moduleQuery.page || 1;
  const currentPageSize = moduleQuery.pageSize || 25;

  useEffect(() => {
    const valid = new Set(providers.map((p) => p.id));
    setSelectedIds((prev) => {
      const next = prev.filter((id) => valid.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [providers]);

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

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = (visibleIds: string[]) => {
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      const visibleSet = new Set(visibleIds);
      setSelectedIds((prev) => prev.filter((id) => !visibleSet.has(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const exportRowsToCsv = async (targetProviders: Provider[], label: string) => {
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
    const rows = targetProviders.map((pr) => [
      pr.name,
      CATEGORY_LABELS[pr.category] || pr.category,
      pr.contactName,
      pr.taxId,
      pr.phone,
      pr.email,
      pr.address,
      pr.specialtyOrProducts,
      pr.paymentTerms,
    ]);
    downloadCsvFile(
      `odontohelper_proveedores_${new Date().toISOString().slice(0, 10)}.csv`,
      headers,
      rows,
      true
    );
    await logActivity('exported', 'provider', `${label} (${targetProviders.length})`);
    showToast(`CSV exportado (${targetProviders.length} proveedores)`, 'success');
  };

  const columns: DataTableColumn<Provider>[] = [
    {
      id: 'name',
      label: 'Proveedor / Razón social',
      sortValue: (pr) => pr.name,
      render: (pr) => (
        <div>
          <div className="font-semibold text-slate-900 dark:text-slate-100">{pr.name}</div>
          {pr.taxId && (
            <div className="text-[11px] font-mono tabular-nums text-slate-400">{pr.taxId}</div>
          )}
        </div>
      ),
    },
    {
      id: 'category',
      label: 'Categoría',
      sortValue: (pr) => CATEGORY_LABELS[pr.category] || pr.category,
      render: (pr) => (
        <Badge tone={CATEGORY_TONE[pr.category] || 'neutral'} size="xs">
          {CATEGORY_LABELS[pr.category] || pr.category}
        </Badge>
      ),
    },
    {
      id: 'contactName',
      label: 'Contacto',
      sortValue: (pr) => pr.contactName || '',
      render: (pr) => (
        <span className="text-slate-600 dark:text-slate-300">{pr.contactName || '—'}</span>
      ),
    },
    {
      id: 'phone',
      label: 'Teléfono',
      sortValue: (pr) => pr.phone || '',
      render: (pr) => (
        <span className="font-mono tabular-nums text-slate-600 dark:text-slate-300">
          {pr.phone || '—'}
        </span>
      ),
    },
    {
      id: 'specialtyOrProducts',
      label: 'Productos / Especialidad',
      sortValue: (pr) => pr.specialtyOrProducts || pr.paymentTerms || '',
      cellClassName: 'max-w-xs truncate text-slate-500 dark:text-slate-400',
      render: (pr) => pr.specialtyOrProducts || pr.paymentTerms || '—',
    },
    {
      id: 'actions',
      label: 'Acciones',
      align: 'right',
      sortable: false,
      render: (pr) => (
        <div
          className="flex items-center justify-end gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant="icon"
            size="xs"
            onClick={() => setViewingProviderId(pr.id)}
            title="Ver ficha del proveedor"
            aria-label="Ver ficha del proveedor"
          >
            <Eye className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="icon"
            size="xs"
            onClick={() => startEditProvider(pr.id)}
            title="Editar proveedor"
            aria-label="Editar proveedor"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="icon"
            size="xs"
            className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
            onClick={() =>
              openConfirm({
                title: '¿Eliminar proveedor?',
                description: `Se eliminará "${pr.name}" del directorio de proveedores.`,
                confirmText: 'Eliminar',
                cancelText: 'Cancelar',
                isDestructive: true,
                onConfirm: () => {
                  if (viewingProviderId === pr.id) setViewingProviderId(null);
                  return deleteProvider(pr.id);
                },
              })
            }
            title="Eliminar proveedor"
            aria-label="Eliminar proveedor"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className={pageContainerClass}>
      {/* Header */}
      <div className={pageHeaderClass}>
        <div>
          <h1 className={pageTitleClass}>Administrar proveedores</h1>
          <p className={pageSubtitleClass}>
            Directorio de laboratorios dentales, casas de insumos, especialistas y servicio técnico.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2.5 w-full sm:w-auto">
          {providers.length > 0 && (
            <Button
              variant="secondary"
              size="sm"
              icon={<Download className="w-4 h-4 text-slate-500" />}
              onClick={() => exportRowsToCsv(providers, 'Listado de proveedores exportado')}
            >
              Exportar CSV
            </Button>
          )}

          <Button
            variant="primary"
            size="sm"
            icon={<Truck className="w-4 h-4" />}
            onClick={() => setView('provider-new')}
          >
            Nuevo proveedor
          </Button>
        </div>
      </div>

      {/* Filters (Search first, then category dropdown) */}
      <FilterBar
        searchValue={query}
        onSearchChange={(val) => {
          setQuery(val);
          if (moduleQuery.page) setModuleQuery({ page: undefined });
        }}
        searchPlaceholder="Buscar por nombre, contacto, CUIT/RUT o producto..."
        dropdowns={[
          {
            id: 'provider-category',
            value: categoryFilter,
            onChange: (val) =>
              setModuleQuery({ category: val === 'all' ? undefined : val, page: undefined }),
            ariaLabel: 'Filtrar por categoría de proveedor',
            className: 'sm:w-56',
            options: [
              { value: 'all', label: 'Todas las categorías' },
              ...Object.entries(CATEGORY_LABELS).map(([id, label]) => ({
                value: id,
                label,
              })),
            ],
          },
        ]}
        resultCountLabel={`${filtered.length} de ${providers.length} proveedores`}
      />

      {/* Sortable & Multi-selectable Table */}
      <DataTable
        columns={columns}
        data={filtered}
        getRowKey={(pr) => pr.id}
        onRowClick={(pr) => setViewingProviderId(pr.id)}
        selectable
        selectedIds={selectedIds}
        onToggleSelect={handleToggleSelect}
        onToggleSelectAll={handleToggleSelectAll}
        sortState={currentSort}
        onSortChange={(next) =>
          setModuleQuery({ sort: serializeSortState(next) || undefined, page: undefined })
        }
        page={currentPage}
        onPageChange={(nextPage) =>
          setModuleQuery({ page: nextPage <= 1 ? undefined : nextPage })
        }
        pageSize={currentPageSize}
        onPageSizeChange={(nextSize) =>
          setModuleQuery({ pageSize: nextSize === 25 ? undefined : nextSize, page: undefined })
        }
        ariaLabel="Listado de proveedores"
        bulkActions={
          <>
            <Button
              variant="secondary"
              size="xs"
              icon={<Download className="w-3.5 h-3.5" />}
              onClick={() => {
                const selectedSet = new Set(selectedIds);
                const subset = providers.filter((pr) => selectedSet.has(pr.id));
                exportRowsToCsv(subset, 'Selección de proveedores exportada');
              }}
            >
              Exportar selección CSV
            </Button>
            <Button
              variant="dangerSoft"
              size="xs"
              icon={<Trash2 className="w-3.5 h-3.5" />}
              onClick={() =>
                openConfirm({
                  title: `¿Eliminar ${selectedIds.length} proveedores seleccionados?`,
                  description:
                    'Los proveedores seleccionados pasarán a la papelera local y se quitarán del directorio activo.',
                  confirmText: 'Eliminar selección',
                  cancelText: 'Cancelar',
                  isDestructive: true,
                  onConfirm: async () => {
                    await deleteProvidersBulk(selectedIds);
                    setSelectedIds([]);
                  },
                })
              }
            >
              Eliminar selección
            </Button>
            <Button
              variant="ghost"
              size="xs"
              icon={<X className="w-3.5 h-3.5" />}
              onClick={() => setSelectedIds([])}
            >
              Deseleccionar
            </Button>
          </>
        }
        emptyState={
          <div className={`${emptyStateClass} space-y-3`}>
            <Building2 className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {query || categoryFilter !== 'all'
                ? 'No hay proveedores que coincidan con el filtro actual.'
                : 'Todavía no registraste proveedores.'}
            </p>
            {!query && categoryFilter === 'all' && (
              <Button variant="primary" size="sm" onClick={() => setView('provider-new')}>
                Registrar primer proveedor
              </Button>
            )}
          </div>
        }
      />

      {/* Read-only Provider Detail Modal */}
      {viewingProvider && (() => {
        const waUrl = generateWhatsAppUrl(
          viewingProvider.phone,
          `Hola ${viewingProvider.contactName || viewingProvider.name}, te escribimos desde el consultorio odontológico.`
        );
        return (
          <Modal
            open
            onClose={() => setViewingProviderId(null)}
            size="xl"
            icon={<Truck className="w-5 h-5 text-teal-600 dark:text-teal-400" />}
            title={viewingProvider.name}
            subtitle={
              <div className="flex flex-wrap items-center gap-2 mt-0.5">
                <Badge tone={CATEGORY_TONE[viewingProvider.category] || 'neutral'} size="xs">
                  {CATEGORY_LABELS[viewingProvider.category] || viewingProvider.category}
                </Badge>
                {viewingProvider.taxId && (
                  <span className="font-mono tabular-nums text-[11px] text-slate-500 dark:text-slate-400">
                    CUIT / RUT: {viewingProvider.taxId}
                  </span>
                )}
              </div>
            }
            footer={
              <>
                {waUrl && (
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonClass({ variant: 'whatsapp', size: 'sm' })}
                  >
                    <WhatsAppIcon className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </a>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setViewingProviderId(null)}
                >
                  Cerrar
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Edit2 className="w-3.5 h-3.5" />}
                  onClick={() => {
                    const id = viewingProvider.id;
                    setViewingProviderId(null);
                    startEditProvider(id);
                  }}
                >
                  Editar proveedor
                </Button>
              </>
            }
          >
            <div className="space-y-5">
              {/* Contact & Commercial Data */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-50/90 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Datos de contacto
                  </h3>

                  <div className="space-y-2.5 text-sm">
                    <div className="flex items-start gap-2.5">
                      <User className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-[11px] text-slate-400">Persona de contacto</div>
                        <div className="text-slate-800 dark:text-slate-200 font-medium break-words">
                          {viewingProvider.contactName || '—'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <Phone className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-[11px] text-slate-400">Teléfono / WhatsApp</div>
                        {viewingProvider.phone ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <a
                              href={`tel:${viewingProvider.phone}`}
                              className="font-mono tabular-nums text-teal-700 dark:text-teal-300 hover:underline font-medium"
                            >
                              {viewingProvider.phone}
                            </a>
                            {waUrl && (
                              <a
                                href={waUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
                              >
                                <WhatsAppIcon className="w-3 h-3" />
                                <span>Enviar mensaje</span>
                              </a>
                            )}
                          </div>
                        ) : (
                          <div className="text-slate-500">—</div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <Mail className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-[11px] text-slate-400">Email</div>
                        {viewingProvider.email ? (
                          <a
                            href={`mailto:${viewingProvider.email}`}
                            className="text-teal-700 dark:text-teal-300 hover:underline break-all font-medium"
                          >
                            {viewingProvider.email}
                          </a>
                        ) : (
                          <div className="text-slate-500">—</div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-[11px] text-slate-400">Dirección</div>
                        <div className="text-slate-800 dark:text-slate-200 break-words">
                          {viewingProvider.address || '—'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50/90 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Información comercial
                  </h3>

                  <div className="space-y-2.5 text-sm">
                    <div className="flex items-start gap-2.5">
                      <Building2 className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-[11px] text-slate-400">CUIT / RUT</div>
                        <div className="font-mono tabular-nums text-slate-800 dark:text-slate-200">
                          {viewingProvider.taxId || '—'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <CreditCard className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-[11px] text-slate-400">Condiciones de pago</div>
                        <div className="text-slate-800 dark:text-slate-200 break-words">
                          {viewingProvider.paymentTerms || '—'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <Truck className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-[11px] text-slate-400">Productos / Especialidad</div>
                        <div className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words">
                          {viewingProvider.specialtyOrProducts || '—'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Internal Notes */}
              <div className="p-4 rounded-xl bg-slate-50/90 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <FileText className="w-3.5 h-3.5" />
                  <span>Notas internas</span>
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words leading-relaxed">
                  {viewingProvider.notes?.trim() ? viewingProvider.notes : 'Sin notas registradas.'}
                </p>
              </div>

              {/* Linked Lab Orders */}
              {viewingProviderLabs.length > 0 && (
                <div className="p-4 rounded-xl bg-slate-50/90 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      <FlaskConical className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                      <span>Trabajos de laboratorio ({viewingProviderLabs.length})</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => {
                        setViewingProviderId(null);
                        setView('lab');
                      }}
                    >
                      Ir a Laboratorio
                    </Button>
                  </div>
                  <div className="divide-y divide-slate-200/70 dark:divide-slate-700/70">
                    {viewingProviderLabs.slice(0, 5).map((order) => (
                      <div
                        key={order.id}
                        className="py-2 flex flex-wrap items-center justify-between gap-2 sm:gap-3 text-xs"
                      >
                        <div className="min-w-0">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {order.workType}
                          </span>
                          <span className="text-slate-400"> · {order.patientName}</span>
                          {order.toothFdi && (
                            <span className="text-slate-400"> (Pieza {order.toothFdi})</span>
                          )}
                        </div>
                        <Badge
                          tone={
                            order.status === 'instalado'
                              ? 'emerald'
                              : order.status === 'en_clinica'
                              ? 'teal'
                              : order.status === 'en_laboratorio'
                              ? 'amber'
                              : 'neutral'
                          }
                          size="xs"
                        >
                          {order.status === 'sin_enviar'
                            ? 'Sin enviar'
                            : order.status === 'en_laboratorio'
                            ? 'En laboratorio'
                            : order.status === 'en_clinica'
                            ? 'En clínica'
                            : 'Instalado'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Modal>
        );
      })()}
    </div>
  );
};
