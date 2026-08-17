import React, { useEffect, useState, useCallback } from 'react';

/**
 * Detecta Service Worker novo e mostra barra de atualização
 * bem visível no mobile (acima da bottom nav).
 */
export const UpdateNotification: React.FC = () => {
  const [showUpdate, setShowUpdate] = useState(false);

  const applyUpdate = useCallback(async () => {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg?.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
      if (window.caches) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {
      /* ignore */
    }
    window.location.reload();
  }, []);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SW_UPDATED') {
        setShowUpdate(true);
      }
    };

    const onControllerChange = () => {
      // Novo SW assumiu controle — recarrega para pegar assets novos
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    const check = () => {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (!reg) return;
        reg.update().catch(() => {});
        if (reg.waiting) setShowUpdate(true);
        reg.addEventListener('updatefound', () => {
          const newSW = reg.installing;
          if (!newSW) return;
          newSW.addEventListener('statechange', () => {
            if (newSW.state === 'installed') {
              setShowUpdate(true);
            }
          });
        });
      });
    };

    check();
    // Revalida ao voltar para o app (comum no celular)
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', check);
    const interval = window.setInterval(check, 60_000);

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', check);
      window.clearInterval(interval);
    };
  }, []);

  if (!showUpdate) return null;

  return (
    <div
      className="fixed inset-x-0 z-[10000] px-3 pointer-events-none"
      style={{
        // Acima da bottom nav do RDO / Obra (~64px + safe area)
        bottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))',
      }}
    >
      <div className="pointer-events-auto mx-auto max-w-lg bg-gray-900 text-white px-4 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 border border-gray-700">
        <div className="w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight">Nova versão disponível</p>
          <p className="text-[11px] text-gray-300 mt-0.5">Toque em Atualizar para carregar as melhorias.</p>
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
