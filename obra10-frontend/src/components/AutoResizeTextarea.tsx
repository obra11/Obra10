import React, { useCallback, useLayoutEffect, useRef } from 'react';

type Props = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  /** Altura mínima em linhas (padrão 2) */
  minRows?: number;
  /** Altura máxima em px; além disso, scroll interno */
  maxHeight?: number;
};

function resolveLineHeight(el: HTMLTextAreaElement): number {
  const cs = getComputedStyle(el);
  const raw = cs.lineHeight;
  const parsed = Number.parseFloat(raw);
  if (Number.isFinite(parsed) && raw !== 'normal') return parsed;
  const fontSize = Number.parseFloat(cs.fontSize) || 16;
  return fontSize * 1.4;
}

/**
 * Textarea que cresce com o conteúdo (web + mobile/PWA).
 * No iOS/WebKit, altura precisa ir a 0px antes de ler scrollHeight.
 */
export const AutoResizeTextarea = React.forwardRef<HTMLTextAreaElement, Props>(
  function AutoResizeTextarea(
    { minRows = 2, maxHeight = 480, className = '', value, defaultValue, onChange, onInput, onFocus, style, ...rest },
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

      const cs = getComputedStyle(el);
      const lineHeight = resolveLineHeight(el);
      const paddingY =
        (Number.parseFloat(cs.paddingTop) || 0) +
        (Number.parseFloat(cs.paddingBottom) || 0);
      const borderY =
        (Number.parseFloat(cs.borderTopWidth) || 0) +
        (Number.parseFloat(cs.borderBottomWidth) || 0);
      const minH = Math.ceil(lineHeight * minRows + paddingY + borderY);

      // Crítico no iOS/Safari/Chrome Android: zerar antes de medir
      el.style.overflowY = 'hidden';
      el.style.height = '0px';

      const scrollH = el.scrollHeight;
      const next = Math.min(Math.max(scrollH, minH), maxHeight);
      el.style.height = `${next}px`;
      el.style.overflowY = scrollH > maxHeight + 1 ? 'auto' : 'hidden';
    }, [minRows, maxHeight]);

    // Antes do paint — evita "piscar" e atraso no teclado mobile
    useLayoutEffect(() => {
      resize();
    }, [value, defaultValue, resize]);

    useLayoutEffect(() => {
      const el = innerRef.current;
      if (!el) return;

      const schedule = () => {
        requestAnimationFrame(() => requestAnimationFrame(resize));
      };

      el.addEventListener('input', schedule);
      el.addEventListener('keyup', schedule);
      el.addEventListener('change', schedule);
      el.addEventListener('cut', schedule);
      el.addEventListener('paste', schedule);

      window.addEventListener('resize', schedule);
      window.visualViewport?.addEventListener('resize', schedule);

      let ro: ResizeObserver | null = null;
      if (typeof ResizeObserver !== 'undefined') {
        ro = new ResizeObserver(schedule);
        ro.observe(el);
        if (el.parentElement) ro.observe(el.parentElement);
      }

      schedule();

      return () => {
        el.removeEventListener('input', schedule);
        el.removeEventListener('keyup', schedule);
        el.removeEventListener('change', schedule);
        el.removeEventListener('cut', schedule);
        el.removeEventListener('paste', schedule);
        window.removeEventListener('resize', schedule);
        window.visualViewport?.removeEventListener('resize', schedule);
        ro?.disconnect();
      };
    }, [resize]);

    return (
      <textarea
        {...rest}
        ref={setRefs}
        value={value}
        defaultValue={defaultValue}
        rows={1}
        onFocus={(e) => {
          onFocus?.(e);
          requestAnimationFrame(resize);
        }}
        onChange={(e) => {
          onChange?.(e);
          requestAnimationFrame(resize);
        }}
        onInput={(e) => {
          onInput?.(e);
          requestAnimationFrame(resize);
        }}
        className={`resize-none overflow-hidden box-border ${className}`}
        style={style}
      />
    );
  },
);
