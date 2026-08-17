import React, { useEffect, useState, useCallback, useRef } from 'react';
import { APP_BUILD_ID, APP_VERSION } from '../appVersion';
import type { AppVersionInfo } from '../appVersion';

type ServerVersion = AppVersionInfo & { api?: string };

/**
 * Detecta versão nova (Service Worker + /version) e oferece CTA visível no mobile.
 * Compara buildId embutido com o do servidor — funciona mesmo se o SW estiver travado.
 */
export const UpdateNotification: React.FC = () => {
  const [showUpdate, setShowUpdate] = useState(false);
  const [serverBuild, setServerBuild] = useState<string | null>(null);
  const refreshingRef = useRef(false);

  const applyUpdate = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    try {
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
      // Marca build do servidor para o bootstrap do index não ficar em loop
      if (serverBuild) {
        localStorage.setItem('obra10_build', serverBuild);
      }
      localStorage.setItem('obra10_force_reload', String(Date.now()));
    } catch {
      /* ignore */
    }
    // Cache-bust na navegação
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
        setShowUpdate(true);
      }
    } catch {
      /* offline / API antiga */
    }
  }, []);

  useEffect(() => {
    checkServerVersion();

    if (!('serviceWorker' in navigator)) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SW_UPDATED') {
        setShowUpdate(true);
      }
    };

    const onControllerChange = () => {
      if (refreshingRef.current) return;
      refreshingRef.current = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    const checkSw = () => {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (!reg) return;
        reg.update().catch(() => {});
        if (reg.waiting) setShowUpdate(true);
        const installing = reg.installing;
        if (installing) {
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed') setShowUpdate(true);
          });
        }
        reg.addEventListener('updatefound', () => {
          const newSW = reg.installing;
          if (!newSW) return;
          newSW.addEventListener('statechange', () => {
            if (newSW.state === 'installed') setShowUpdate(true);
          });
        });
      });
    };

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
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      window.clearInterval(interval);
    };
  }, [checkServerVersion]);

  if (!showUpdate) return null;

  return (
    <div
      className="fixed inset-x-0 z-[10000] px-3 pointer-events-none"
      style={{
        bottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))',
      }}
    >
      <div className="pointer-events-auto mx-auto max-w-lg bg-gray-900 text-white px-4 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 border border-gray-700">
        <div className="w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight">Nova versão disponível</p>
          <p className="text-[11px] text-gray-300 mt-0.5">
            Neste aparelho: {APP_VERSION}
            {serverBuild ? ` · Vigente: ${serverBuild}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={applyUpdate}
          className="shrink-0 px-4 py-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-sm font-bold rounded-xl transition-colors"
        >
          Atualizar
        </button>
      </div>
    </div>
  );
};
