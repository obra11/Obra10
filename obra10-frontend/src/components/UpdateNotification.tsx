import React, { useEffect, useState } from 'react';

/**
 * Componente que detecta quando o Service Worker atualiza 
 * e exibe um toast discreto para o usuário.
 * NÃO força reload — o usuário atualiza quando quiser.
 */
export const UpdateNotification: React.FC = () => {
  const [showUpdate, setShowUpdate] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SW_UPDATED') {
        setShowUpdate(true);
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);

    // Also check for waiting SW on load
    navigator.serviceWorker.getRegistration().then(reg => {
      if (reg?.waiting) {
        setShowUpdate(true);
      }
      // Listen for new SW installing
      reg?.addEventListener('updatefound', () => {
        const newSW = reg.installing;
        newSW?.addEventListener('statechange', () => {
          if (newSW.state === 'activated') {
            setShowUpdate(true);
          }
        });
      });
    });

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    };
  }, []);

  if (!showUpdate) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] animate-slide-up">
      <div className="bg-gray-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-gray-700">
        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
        <span className="text-sm font-medium">Nova versão disponível</span>
        <button
          onClick={() => window.location.reload()}
          className="ml-2 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-colors"
        >
          Atualizar
        </button>
        <button
          onClick={() => setShowUpdate(false)}
          className="text-gray-400 hover:text-white text-lg leading-none ml-1"
        >
          ×
        </button>
      </div>
    </div>
  );
};
