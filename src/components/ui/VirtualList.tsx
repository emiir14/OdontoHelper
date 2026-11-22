import React, { useEffect, useMemo, useRef, useState } from 'react';

export interface VirtualWindow {
  startIndex: number;
  endIndex: number;
  topPadding: number;
  bottomPadding: number;
  totalHeight: number;
}

/**
 * Pure window calculation helper so virtualization math is 100% deterministic and unit-testable.
 */
export function computeVirtualWindow(params: {
  totalItems: number;
  itemHeight: number;
  scrollTop: number;
  viewportHeight: number;
  overscan?: number;
}): VirtualWindow {
  const { totalItems, itemHeight, scrollTop, viewportHeight, overscan = 6 } = params;
  if (totalItems <= 0 || itemHeight <= 0) {
    return {
      startIndex: 0,
      endIndex: -1,
      topPadding: 0,
      bottomPadding: 0,
      totalHeight: 0,
    };
  }

  const safeViewport = Math.max(itemHeight, viewportHeight);
  const safeScroll = Math.max(0, scrollTop);
  const visibleStart = Math.floor(safeScroll / itemHeight);
  const visibleCount = Math.ceil(safeViewport / itemHeight);

  const startIndex = Math.max(0, visibleStart - overscan);
  const endIndex = Math.min(totalItems - 1, visibleStart + visibleCount + overscan);

  const totalHeight = totalItems * itemHeight;
  const topPadding = startIndex * itemHeight;
  const renderedCount = Math.max(0, endIndex - startIndex + 1);
  const bottomPadding = Math.max(0, totalHeight - topPadding - renderedCount * itemHeight);

  return {
    startIndex,
    endIndex,
    topPadding,
    bottomPadding,
    totalHeight,
  };
}

export interface VirtualListProps<T> {
  items: T[];
  itemHeight: number;
  maxHeight?: number;
  overscan?: number;
  getKey: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => React.ReactNode;
  className?: string;
  innerClassName?: string;
  ariaLabel?: string;
}

export function VirtualList<T>({
  items,
  itemHeight,
  maxHeight = 560,
  overscan = 6,
  getKey,
  renderItem,
  className = '',
  innerClassName = '',
  ariaLabel,
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(maxHeight);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      if (el.clientHeight > 0) {
        setViewportHeight(el.clientHeight);
      }
    };
    measure();

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return () => ro.disconnect();
    }
    return undefined;
  }, [items.length, maxHeight]);

  const win = useMemo(
    () =>
      computeVirtualWindow({
        totalItems: items.length,
        itemHeight,
        scrollTop,
        viewportHeight,
        overscan,
      }),
    [items.length, itemHeight, scrollTop, viewportHeight, overscan]
  );

  const visibleItems = useMemo(() => {
    if (win.endIndex < win.startIndex) return [];
    return items.slice(win.startIndex, win.endIndex + 1);
  }, [items, win.startIndex, win.endIndex]);

  const computedMaxHeight = Math.min(
    maxHeight,
    Math.max(itemHeight, items.length * itemHeight)
  );

  return (
    <div
      ref={containerRef}
      role="list"
      aria-label={ariaLabel}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      style={{ maxHeight: `${computedMaxHeight}px` }}
      className={`overflow-y-auto scrollbar-thin ${className}`}
    >
      <div
        className={innerClassName}
        style={{
          paddingTop: `${win.topPadding}px`,
          paddingBottom: `${win.bottomPadding}px`,
        }}
      >
        {visibleItems.map((item, offset) => {
          const idx = win.startIndex + offset;
          return (
            <div key={getKey(item, idx)} role="listitem">
              {renderItem(item, idx)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
