import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export interface AnchoredDropdownProps {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  preferredWidth?: number;
  align?: 'right' | 'left';
  className?: string;
  children: React.ReactNode;
}

interface DropdownPosition {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
}

export const AnchoredDropdown: React.FC<AnchoredDropdownProps> = ({
  open,
  onClose,
  anchorRef,
  preferredWidth = 240,
  align = 'right',
  className = '',
  children,
}) => {
  const [pos, setPos] = useState<DropdownPosition | null>(null);

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;

    const rect = anchor.getBoundingClientRect();
    const margin = 12;
    const gap = 6;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const width = Math.min(preferredWidth, Math.max(180, vw - margin * 2));
    const idealLeft = align === 'right' ? rect.right - width : rect.left;
    const maxLeft = Math.max(margin, vw - width - margin);
    const left = Math.min(Math.max(idealLeft, margin), maxLeft);

    const spaceBelow = vh - rect.bottom - gap - margin;
    const spaceAbove = rect.top - gap - margin;
    const openUp = spaceBelow < 220 && spaceAbove > spaceBelow;

    if (!openUp) {
      const top = Math.max(margin, rect.bottom + gap);
      setPos({
        left,
        width,
        top,
        maxHeight: Math.max(140, vh - top - margin),
      });
    } else {
      const bottom = Math.max(margin, vh - rect.top + gap);
      setPos({
        left,
        width,
        bottom,
        maxHeight: Math.max(140, vh - bottom - margin),
      });
    }
  }, [anchorRef, preferredWidth, align]);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;

    const handleReposition = () => updatePosition();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);
    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [open, onClose, updatePosition]);

  if (!open || !pos || typeof document === 'undefined') return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[59]"
        aria-hidden="true"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      />
      <div
        role="menu"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          left: pos.left,
          width: pos.width,
          ...(pos.top !== undefined ? { top: pos.top } : { bottom: pos.bottom }),
          maxHeight: pos.maxHeight,
        }}
        className={`z-[60] overflow-y-auto overscroll-contain ${className}`}
      >
        {children}
      </div>
    </>,
    document.body
  );
};
