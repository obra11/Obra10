import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

export const InstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    if (localStorage.getItem('pwaInstalled')) return;

    // Check if user dismissed recently (last 72h)
    const dismissed = localStorage.getItem('pwaInstallDismissed');
    if (dismissed && Date.now() - Number(dismissed) < 72 * 60 * 60 * 1000) return;

    // --- iOS Detection ---
    const isIos = () => {
      const userAgent = window.navigator.userAgent.toLowerCase();
      return /iphone|ipad|ipod/.test(userAgent);
    };
    
    // iOS doesn't support beforeinstallprompt, we show banner automatically
    if (isIos()) {
      setShowBanner(true);
      return;
    }

    // --- Android / Others Detection ---
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };

    const installedHandler = () => {
      setShowBanner(false);
      setDeferredPrompt(null);
      localStorage.setItem('pwaInstalled', 'true');
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', installedHandler);

    // Fallback: If not on iOS, and beforeinstallprompt doesn't fire (e.g. no HTTPS on local IP)
    // we show a generic banner after 2s anyway.
    const fallbackTimer = setTimeout(() => {
      setShowBanner(true);
    }, 2000);

    return () => {
      clearTimeout(fallbackTimer);
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const handleInstall = async () => {
    // If iOS or generic fallback, we just show an alert
    if (!deferredPrompt) {
        alert('Para adicionar à tela de Início (no celular): toque no botão de opções ou compartilhar do navegador e depois em "Adicionar à Tela Inicial".');
        return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      localStorage.setItem('pwaInstalled', 'true');
    }
    
    setShowBanner(false);
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('pwaInstallDismissed', String(Date.now()));
  };

  if (!showBanner) return null;

  return (
    <div className="fixed inset-x-0 bottom-16 sm:bottom-0 sm:top-0 sm:h-fit z-[100] animate-in slide-in-from-bottom sm:slide-in-from-top duration-300">
      <div className="bg-white shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.2)] sm:shadow-md border-t-4 border-t-red-600 sm:border-t-0 sm:border-b-4 sm:border-b-red-600 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        
        <div className="flex items-center gap-4 flex-1">
          <div className="bg-red-600 p-2 rounded-xl shrink-0 h-12 w-12 flex items-center justify-center shadow-inner">
            {/* Simple representation of the Obra 10 helmet or just Logo */}
            <svg viewBox="0 0 512 512" className="w-8 h-8 text-white fill-current" preserveAspectRatio="xMidYMid meet">
              <path d="M256 80c-80 0-144 64-144 144v16h-32v48h32v16c0 16 8 24 24 24h240c16 0 24-8 24-24v-16h32v-48h-32v-16c0-80-64-144-144-144z" opacity="0.95" />
            </svg>
          </div>
          <div>
            <h4 className="font-bold text-gray-900 leading-tight">Instale o Obra 10</h4>
            <p className="text-xs text-gray-500 mt-0.5">App nativo na sua área de trabalho para acesso rápido</p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto shrink-0 justify-end">
          <button
            onClick={handleDismiss}
            className="px-4 py-2 text-sm font-semibold text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Agora não
          </button>
          <button
            onClick={handleInstall}
            className="flex items-center gap-1.5 px-6 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg shadow transition-colors"
          >
            <Download size={16} />
            Instalar
          </button>
          <button 
            onClick={handleDismiss} 
            className="p-1 text-gray-400 hover:text-gray-600 sm:hidden absolute top-2 right-2"
          >
            <X size={16} />
          </button>
        </div>

      </div>
    </div>
  );
};
