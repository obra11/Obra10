import React, { useEffect, useState, useCallback, useRef } from 'react';
import { APP_BUILD_ID, APP_VERSION } from '../appVersion';
import type { AppVersionInfo } from '../appVersion';

type ServerVersion = AppVersionInfo & { api?: string };

const PENDING_KEY = 'obra10_update_pending';

/**
 * Detecta versão nova (Service Worker + /version) e mantém o CTA até o usuário tocar.
 * Não recarrega sozinho — isso fazia o botão sumir antes de dar para clicar.
 */
export const UpdateNotification: React.FC = () => {
  const [showUpdate, setShowUpdate] = useState(() => {
    try {
      return sessionStorage.getItem(PENDING_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [serverBuild, setServerBuild] = useState<string | null>(null);
  const refreshingRef = useRef(false);
  const showRef = useRef(showUpdate);

  const markPending = useCallback((buildId?: string | null) => {
    showRef.current = true;
    setShowUpdate(true);
    try {
      sessionStorage.setItem(PENDING_KEY, '1');
      if (buildId) sessionStorage.setItem('obra10_pending_build', buildId);
    } catch {
      /* ignore */
    }
  }, []);

  const applyUpdate = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    try {
      let pendingBuild: string | null = null;
      try {
        pendingBuild = sessionStorage.getItem('obra10_pending_build');
        sessionStorage.removeItem(PENDING_KEY);
        sessionStorage.removeItem('obra10_pending_build');
      } catch {
        /* ignore */
      }
      const reg = await navigator.serviceWorker?.getRegistration();
      if (reg?.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
      if (reg?.active) {
        reg.active.postMessage({ type: 'CLEAR_CACHES' });
      }
      if (window.caches) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      if (navigator.serviceWorker) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      const mark = serverBuild || pendingBuild;
      if (mark) {
        localStorage.setItem('obra10_build', mark);
      }
      localStorage.setItem('obra10_force_reload', String(Date.now()));
    } catch {
      /* ignore */
    }
    const url = new URL(window.location.href);
    url.searchParams.set('_v', String(Date.now()));
    window.location.replace(url.toString());
  }, [serverBuild]);

  const checkServerVersion = useCallback(async () => {
    try {
      const res = await fetch(`/version?_=${Date.now()}`, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return;
      const data = (await res.json()) as ServerVersion;
      if (!data?.buildId) return;
      setServerBuild(data.buildId);
      if (data.buildId !== APP_BUILD_ID) {
        markPending(data.buildId);
      } else if (!showRef.current) {
        // Já está na versão vigente e não há update pendente de SW
        try {
          sessionStorage.removeItem(PENDING_KEY);
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* offline / API antiga */
    }
  }, [markPending]);

  useEffect(() => {
    checkServerVersion();

    if (!('serviceWorker' in navigator)) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SW_UPDATED') {
        // Só mostra; NÃO recarrega — o usuário decide pelo botão
        markPending();
      }
    };

    // Importante: não dar reload automático em controllerchange.
    // Isso fazia o banner piscar e sumir antes do toque.

    const checkSw = () => {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (!reg) return;
        reg.update().catch(() => {});
        if (reg.waiting) markPending();
        const installing = reg.installing;
        if (installing) {
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && reg.waiting) markPending();
          });
        }
        reg.addEventListener('updatefound', () => {
          const newSW = reg.installing;
          if (!newSW) return;
          newSW.addEventListener('statechange', () => {
            if (newSW.state === 'installed') markPending();
          });
        });
      });
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);
    checkSw();

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        checkSw();
        checkServerVersion();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    const interval = window.setInterval(() => {
      checkSw();
      checkServerVersion();
    }, 30_000);

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      window.clearInterval(interval);
    };
  }, [checkServerVersion, markPending]);

  if (!showUpdate) return null;

  return (
    <div
      className="fixed inset-x-0 z-[10000] px-3 pointer-events-none"
      style={{
        // Acima da bottom nav, bem visível e estável
        bottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))',
      }}
    >
      <div className="pointer-events-auto mx-auto max-w-lg bg-gray-900 text-white px-4 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border-2 border-green-400/80">
        <div className="w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight">Nova versão disponível</p>
          <p className="text-[11px] text-gray-300 mt-0.5">
            Toque em Atualizar para aplicar. Neste aparelho: {APP_VERSION}
            {serverBuild ? ` · Vigente: ${serverBuild}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            applyUpdate();
          }}
          className="shrink-0 min-h-[44px] min-w-[96px] px-4 py-2.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-sm font-bold rounded-xl transition-colors"
        >
          Atualizar
        </button>
      </div>
    </div>
  );
};
