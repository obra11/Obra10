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

function supportsFieldSizing(): boolean {
  try {
    return typeof CSS !== 'undefined' && CSS.supports?.('field-sizing', 'content') === true;
  } catch {
    return false;
  }
}

/**
 * Textarea que cresce com o conteúdo (web + mobile/PWA).
 * No mobile, evita height:0 (colapsa o layout e parece que só o texto rola).
 */
export const AutoResizeTextarea = React.forwardRef<HTMLTextAreaElement, Props>(
  function AutoResizeTextarea(
    {
      minRows = 2,
      maxHeight = 480,
      className = '',
      value,
      defaultValue,
      onChange,
      onInput,
      onFocus,
      style,
      ...rest
    },
    forwardedRef,
  ) {
    const innerRef = useRef<HTMLTextAreaElement | null>(null);
    const nativeFieldSizing = useRef(supportsFieldSizing());

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

      // Chrome 123+ / Android moderno: CSS nativo, sem JS de altura
      if (nativeFieldSizing.current) {
        const st = el.style as CSSStyleDeclaration & { fieldSizing?: string };
        st.fieldSizing = 'content';
        el.style.height = 'auto';
        el.style.overflowY = 'hidden';
        el.style.minHeight = '';
        return;
      }

      const cs = getComputedStyle(el);
      const lineHeight = resolveLineHeight(el);
      const paddingY =
        (Number.parseFloat(cs.paddingTop) || 0) +
        (Number.parseFloat(cs.paddingBottom) || 0);
      const borderY =
        (Number.parseFloat(cs.borderTopWidth) || 0) +
        (Number.parseFloat(cs.borderBottomWidth) || 0);
      const minH = Math.ceil(lineHeight * minRows + paddingY + borderY);

      // Preserva scroll da página — height:0 no mobile empurra o teclado/viewport
      const pageX = window.scrollX;
      const pageY = window.scrollY;
      const vv = window.visualViewport;
      const vvOffset = vv?.offsetTop ?? 0;

      el.style.overflowY = 'hidden';
      el.style.height = 'auto';
      // Força reflow antes de medir
      void el.offsetHeight;

      let scrollH = el.scrollHeight;
      // Fallback WebKit: se ainda veio “achatado”, tenta 1px
      if (scrollH < minH - 1) {
        el.style.height = '1px';
        void el.offsetHeight;
        scrollH = Math.max(el.scrollHeight, minH);
      }

      const next = Math.min(Math.max(scrollH, minH), maxHeight);
      el.style.height = `${next}px`;
      el.style.minHeight = `${minH}px`;
      el.style.overflowY = scrollH > maxHeight + 1 ? 'auto' : 'hidden';

      window.scrollTo(pageX, pageY);
      if (vv && typeof (document.documentElement as any).scrollTop === 'number') {
        // Mantém posição relativa ao visualViewport no iOS
        if (Math.abs((vv.offsetTop ?? 0) - vvOffset) > 1) {
          window.scrollTo(pageX, pageY);
        }
      }
    }, [minRows, maxHeight]);

    useLayoutEffect(() => {
      resize();
    }, [value, defaultValue, resize]);

    useLayoutEffect(() => {
      const el = innerRef.current;
      if (!el) return;

      const schedule = () => {
        requestAnimationFrame(() => {
          requestAnimationFrame(resize);
        });
      };

      el.addEventListener('input', schedule);
      el.addEventListener('keyup', schedule);
      el.addEventListener('change', schedule);
      el.addEventListener('cut', schedule);
      el.addEventListener('paste', schedule);
      el.addEventListener('compositionend', schedule);

      window.addEventListener('resize', schedule);
      window.visualViewport?.addEventListener('resize', schedule);
      window.visualViewport?.addEventListener('scroll', schedule);

      // Observa só o pai — observar o próprio textarea gera loop ao mudar height
      let ro: ResizeObserver | null = null;
      if (typeof ResizeObserver !== 'undefined' && el.parentElement) {
        ro = new ResizeObserver(schedule);
        ro.observe(el.parentElement);
      }

      schedule();

      return () => {
        el.removeEventListener('input', schedule);
        el.removeEventListener('keyup', schedule);
        el.removeEventListener('change', schedule);
        el.removeEventListener('cut', schedule);
        el.removeEventListener('paste', schedule);
        el.removeEventListener('compositionend', schedule);
        window.removeEventListener('resize', schedule);
        window.visualViewport?.removeEventListener('resize', schedule);
        window.visualViewport?.removeEventListener('scroll', schedule);
        ro?.disconnect();
      };
    }, [resize]);

    return (
      <textarea
        {...rest}
        ref={setRefs}
        value={value}
        defaultValue={defaultValue}
        rows={minRows}
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
        style={{
          fieldSizing: nativeFieldSizing.current ? 'content' : undefined,
          ...style,
        } as React.CSSProperties}
      />
    );
  },
);
