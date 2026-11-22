import React, { forwardRef, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { inputClass } from './uiClasses';

export interface AutoResizeTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  minRows?: number;
}

export const AutoResizeTextarea = forwardRef<HTMLTextAreaElement, AutoResizeTextareaProps>(
  ({ minRows = 2, className = '', value, defaultValue, onChange, onInput, style, ...rest }, forwardedRef) => {
    const innerRef = useRef<HTMLTextAreaElement | null>(null);

    const setRefs = useCallback(
      (node: HTMLTextAreaElement | null) => {
        innerRef.current = node;
        if (typeof forwardedRef === 'function') {
          forwardedRef(node);
        } else if (forwardedRef) {
          forwardedRef.current = node;
        }
      },
      [forwardedRef]
    );

    const adjustHeight = useCallback(() => {
      const el = innerRef.current;
      if (!el) return;
      el.style.height = 'auto';
      if (el.scrollHeight > 0) {
        el.style.height = `${el.scrollHeight}px`;
      }
    }, []);

    useLayoutEffect(() => {
      adjustHeight();
    }, [value, defaultValue, minRows, adjustHeight]);

    useEffect(() => {
      const el = innerRef.current;
      if (!el || typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(() => {
        adjustHeight();
      });
      observer.observe(el);
      return () => observer.disconnect();
    }, [adjustHeight]);

    return (
      <textarea
        ref={setRefs}
        rows={minRows}
        value={value}
        defaultValue={defaultValue}
        onChange={(e) => {
          onChange?.(e);
          adjustHeight();
        }}
        onInput={(e) => {
          onInput?.(e);
          adjustHeight();
        }}
        style={{ overflow: 'hidden', resize: 'none', ...style }}
        className={`${inputClass} leading-relaxed break-words ${className}`}
        {...rest}
      />
    );
  }
);

AutoResizeTextarea.displayName = 'AutoResizeTextarea';
