import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '6xl';

const MODAL_SIZE_MAP: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '6xl': 'max-w-6xl',
};

// Module-level stack ensures Escape closes ONLY the topmost active modal when modals stack.
const activeModalStack: string[] = [];

export interface ModalProps {
  open?: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  headerPrefix?: React.ReactNode;
  headerActions?: React.ReactNode;
  headerVariant?: 'default' | 'teal';
  size?: ModalSize;
  footer?: React.ReactNode;
  zIndexClass?: string;
  containerClassName?: string;
  panelClassName?: string;
  bodyClassName?: string;
  onPanelPointerDown?: React.PointerEventHandler<HTMLDivElement>;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  open = true,
  onClose,
  title,
  subtitle,
  icon,
  headerPrefix,
  headerActions,
  headerVariant = 'default',
  size = 'lg',
  footer,
  zIndexClass = 'z-50',
  containerClassName = '',
  panelClassName = '',
  bodyClassName = 'p-4 sm:p-6',
  onPanelPointerDown,
  children,
}) => {
  const modalId = useId();
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const pointerDownOnBackdrop = useRef(false);

  useEffect(() => {
    if (!open) return;

    activeModalStack.push(modalId);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (activeModalStack[activeModalStack.length - 1] === modalId) {
        e.preventDefault();
        onCloseRef.current();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      const idx = activeModalStack.lastIndexOf(modalId);
      if (idx !== -1) activeModalStack.splice(idx, 1);
    };
  }, [open, modalId]);

  if (!open) return null;

  const isTealHeader = headerVariant === 'teal';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onMouseDown={(e) => {
        pointerDownOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (pointerDownOnBackdrop.current && e.target === e.currentTarget) {
          onClose();
        }
        pointerDownOnBackdrop.current = false;
      }}
      className={`fixed inset-0 ${zIndexClass} flex items-center justify-center bg-black/55 backdrop-blur-xs p-3 sm:p-5 animate-fade-in ${containerClassName}`}
    >
      <div
        onMouseDown={(e) => {
          pointerDownOnBackdrop.current = false;
          e.stopPropagation();
        }}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={onPanelPointerDown}
        className={`w-full ${MODAL_SIZE_MAP[size]} max-h-[92vh] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col animate-scale-in ${panelClassName}`}
      >
        {/* Standardized Modal Header */}
        <div
          className={`px-4 sm:px-5 py-3.5 border-b flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 sm:gap-3 shrink-0 ${
            isTealHeader
              ? 'bg-teal-700 border-teal-800 text-white'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="order-1 flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            {headerPrefix && <div className="shrink-0">{headerPrefix}</div>}
            {icon && <div className="shrink-0">{icon}</div>}
            <div className="min-w-0 flex-1">
              <h2
                id={titleId}
                className={`text-base font-bold leading-snug break-words ${
                  isTealHeader ? 'text-white' : 'text-slate-900 dark:text-slate-100'
                }`}
              >
                {title}
              </h2>
              {subtitle && (
                <div
                  className={`text-xs mt-0.5 leading-snug break-words ${
                    isTealHeader ? 'text-teal-100' : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {subtitle}
                </div>
              )}
            </div>
          </div>

          {headerActions && (
            <div
              className={`order-3 sm:order-2 w-full sm:w-auto flex flex-wrap items-center justify-end gap-1.5 sm:shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 no-print ${
                isTealHeader
                  ? 'border-white/15'
                  : 'border-slate-100 dark:border-slate-800'
              }`}
            >
              {headerActions}
            </div>
          )}

          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onClose}
            aria-label="Cerrar"
            title="Cerrar"
            className={`order-2 sm:order-3 shrink-0 p-2 rounded-xl transition-colors cursor-pointer no-print ${
              isTealHeader
                ? 'text-white/90 hover:text-white hover:bg-white/15'
                : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className={`flex-1 overflow-y-auto print:overflow-visible ${bodyClassName}`}>{children}</div>

        {/* Optional Standardized Footer */}
        {footer && (
          <div className="px-4 sm:px-5 py-3.5 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/90 flex flex-wrap items-center justify-center sm:justify-end gap-2 sm:gap-2.5 shrink-0 no-print">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
