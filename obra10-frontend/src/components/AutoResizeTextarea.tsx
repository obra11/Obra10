import React, { useCallback, useEffect, useRef } from 'react';

type Props = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  /** Altura mínima em px (padrão ~2 linhas) */
  minRows?: number;
  /** Altura máxima em px; além disso, scroll interno */
  maxHeight?: number;
};

/**
 * Textarea que cresce com o conteúdo para o texto nunca ficar cortado.
 */
export const AutoResizeTextarea = React.forwardRef<HTMLTextAreaElement, Props>(
  function AutoResizeTextarea(
    { minRows = 2, maxHeight = 480, className = '', value, onChange, style, ...rest },
    forwardedRef,
  ) {
    const innerRef = useRef<HTMLTextAreaElement | null>(null);

    const setRefs = useCallback(
      (node: HTMLTextAreaElement | null) => {
        innerRef.current = node;
        if (typeof forwardedRef === 'function') forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      },
      [forwardedRef],
    );

    const resize = useCallback(() => {
      const el = innerRef.current;
      if (!el) return;
      const lineHeight = Number.parseFloat(getComputedStyle(el).lineHeight) || 20;
      const paddingY =
        (Number.parseFloat(getComputedStyle(el).paddingTop) || 0) +
        (Number.parseFloat(getComputedStyle(el).paddingBottom) || 0);
      const minH = Math.ceil(lineHeight * minRows + paddingY);
      el.style.height = 'auto';
      const next = Math.min(Math.max(el.scrollHeight, minH), maxHeight);
      el.style.height = `${next}px`;
      el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
    }, [minRows, maxHeight]);

    useEffect(() => {
      resize();
    }, [value, resize]);

    useEffect(() => {
      const onWin = () => resize();
      window.addEventListener('resize', onWin);
      return () => window.removeEventListener('resize', onWin);
    }, [resize]);

    return (
      <textarea
        {...rest}
        ref={setRefs}
        value={value}
        rows={minRows}
        onChange={(e) => {
          onChange?.(e);
          // Redimensiona no mesmo frame do digitado
          requestAnimationFrame(resize);
        }}
        className={`resize-none overflow-hidden ${className}`}
        style={style}
      />
    );
  },
);
