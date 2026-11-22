export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'soft'
  | 'subtle'
  | 'danger'
  | 'dangerSoft'
  | 'whatsapp'
  | 'ghost'
  | 'icon'
  | 'headerGhost';

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-1.5 font-semibold rounded-xl transition-colors whitespace-nowrap shrink-0 max-w-full cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500 disabled:opacity-50 disabled:cursor-not-allowed';

const BUTTON_VARIANT_MAP: Record<ButtonVariant, string> = {
  primary: 'bg-teal-600 hover:bg-teal-700 text-white shadow-xs active:scale-[0.99]',
  secondary:
    'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800',
  soft:
    'bg-teal-50 dark:bg-teal-950/50 border border-teal-200/80 dark:border-teal-800/60 text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/60',
  subtle:
    'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-700',
  danger: 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs active:scale-[0.99]',
  dangerSoft:
    'bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/70',
  whatsapp:
    'bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/80 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50',
  ghost:
    'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100',
  icon:
    'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800',
  headerGhost: 'text-white/90 bg-white/15 hover:bg-white/25',
};

const BUTTON_SIZE_MAP: Record<ButtonSize, string> = {
  xs: 'px-2.5 py-1.5 text-[11px] min-h-[32px]',
  sm: 'px-3 py-1.5 text-xs min-h-[38px]',
  md: 'px-4 py-2 text-xs min-h-[42px]',
  lg: 'px-5 py-2.5 text-xs min-h-[46px]',
};

const ICON_SIZE_MAP: Record<ButtonSize, string> = {
  xs: 'p-1.5 min-h-[32px] min-w-[32px]',
  sm: 'p-2 min-h-[36px] min-w-[36px]',
  md: 'p-2 min-h-[40px] min-w-[40px]',
  lg: 'p-2.5 min-h-[44px] min-w-[44px]',
};

export function buttonClass(options?: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
}): string {
  const variant = options?.variant ?? 'secondary';
  const size = options?.size ?? 'md';
  const sizeClass = variant === 'icon' ? ICON_SIZE_MAP[size] : BUTTON_SIZE_MAP[size];
  return [
    BUTTON_BASE,
    BUTTON_VARIANT_MAP[variant],
    sizeClass,
    options?.fullWidth ? 'w-full' : '',
    options?.className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
}

/* Form Controls */
export const inputClass =
  'w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-colors';

export const inputLgClass =
  'w-full px-3.5 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-teal-500/25 focus:border-teal-500 transition-colors';

export const inputMonoClass = `${inputClass} font-mono tabular-nums`;

export const selectClass =
  'w-full max-w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-colors cursor-pointer';

export const dropdownClass =
  'max-w-full px-3 py-2 text-xs font-medium rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 shadow-xs focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-colors cursor-pointer min-h-[38px]';

export const searchInputClass =
  'w-full pl-9 pr-8 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 shadow-xs transition-colors min-h-[38px]';

export const labelClass = 'block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1';
export const labelCompactClass =
  'block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1';

/* Page Layout & Surfaces */
export const pageContainerClass = 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6';
export const pageContainerNarrowClass = 'max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6';
export const pageHeaderClass =
  'flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-slate-800/80';
export const pageTitleClass =
  'text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100';
export const pageSubtitleClass = 'text-xs text-slate-500 dark:text-slate-400 mt-0.5';

export const cardClass =
  'rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-xs';
export const kpiCardClass =
  'p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-xs';
export const cardSubtleClass =
  'rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800';
export const emptyStateClass =
  'rounded-2xl bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 p-10 text-center';
export const filterBarClass =
  'flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2.5';

/* Tables (crisp horizontal + vertical dividers & sortable headers) */
export const tableWrapperClass =
  'rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden';
export const tableHeadClass =
  'bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700/80 text-[11px] font-semibold text-slate-600 dark:text-slate-300';
export const tableHeadRowClass = 'divide-x divide-slate-200/80 dark:divide-slate-700/70';
export const tableBodyClass = 'divide-y divide-slate-200/80 dark:divide-slate-800 text-xs';
export const tableRowClass =
  'divide-x divide-slate-200/70 dark:divide-slate-800/80 odd:bg-white dark:odd:bg-slate-900 even:bg-slate-50/45 dark:even:bg-slate-800/20 hover:bg-teal-50/40 dark:hover:bg-slate-800/60 transition-colors';
export const tableThClass = 'px-3.5 py-2.5 text-left align-middle whitespace-nowrap';
export const tableCellClass = 'px-3.5 py-2.5 align-middle';
export const tableHeaderButtonClass =
  'inline-flex items-center gap-1.5 w-full text-left font-semibold text-slate-600 dark:text-slate-300 hover:text-teal-700 dark:hover:text-teal-300 transition-colors cursor-pointer select-none group';

/* Capsules / Badges */
export type BadgeTone = 'neutral' | 'teal' | 'emerald' | 'amber' | 'rose' | 'blue';
export type BadgeSize = 'xs' | 'sm';

const BADGE_TONE_MAP: Record<BadgeTone, string> = {
  neutral:
    'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-slate-700/70',
  teal: 'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border-teal-200/80 dark:border-teal-800/60',
  emerald:
    'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/60',
  amber:
    'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200/80 dark:border-amber-800/60',
  rose: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200/80 dark:border-rose-800/60',
  blue: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200/80 dark:border-blue-800/60',
};

const BADGE_SIZE_MAP: Record<BadgeSize, string> = {
  xs: 'px-2 py-0.5 text-[10px] leading-tight',
  sm: 'px-2.5 py-0.5 text-[11px] leading-tight',
};

export function badgeClass(options?: {
  tone?: BadgeTone;
  size?: BadgeSize;
  className?: string;
}): string {
  const tone = options?.tone ?? 'neutral';
  const size = options?.size ?? 'sm';
  return [
    'inline-flex items-center justify-center gap-1 rounded-full border font-semibold whitespace-nowrap shrink-0',
    BADGE_TONE_MAP[tone],
    BADGE_SIZE_MAP[size],
    options?.className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
}

/* Segmented Tabs */
export const segmentedTrackClass =
  'inline-flex flex-wrap sm:flex-nowrap items-center justify-center sm:justify-start gap-1 p-1 max-w-full rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60';

export function segmentedTabClass(active: boolean): string {
  return [
    'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap text-center cursor-pointer',
    active
      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200',
  ].join(' ');
}
