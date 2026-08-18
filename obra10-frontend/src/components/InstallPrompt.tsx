import React, { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';

const DISMISS_KEY = 'pwaInstallDismissed';
const INSTALLED_KEY = 'pwaInstalled';
/** Depois de “Agora não”, só volta a sugerir após 14 dias */
const DISMISS_MS = 14 * 24 * 60 * 60 * 1000;

function isStandalone(): boolean {
  const mq = window.matchMedia('(display-mode: standalone)').matches;
  const iosStandalone = (window.navigator as any).standalone === true;
  return mq || iosStandalone;
}

function isMobileUa(): boolean {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/**
 * Banner de instalação PWA.
 * - Mobile (navegador): mostra instrução / prompt nativo
 * - Já instalado (standalone): nunca mostra
 * - Desktop: só se o Chrome disparar beforeinstallprompt (sem fallback chato)
 */
export const InstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (isStandalone()) {
      localStorage.setItem(INSTALLED_KEY, 'true');
      return;
    }
    if (localStorage.getItem(INSTALLED_KEY) === 'true') return;

    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed && Date.now() - Number(dismissed) < DISMISS_MS) return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
      setIosHint(false);
    };

    const onInstalled = () => {
      setShowBanner(false);
      setDeferredPrompt(null);
      localStorage.setItem(INSTALLED_KEY, 'true');
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);

    // iOS Safari: não tem beforeinstallprompt — mostra dica de “Adicionar à Tela de Início”
    if (isIos() && isMobileUa()) {
      setIosHint(true);
      setShowBanner(true);
    }

    // Android sem evento (raro): após 3s, se ainda for mobile e não instalado
    let fallback: number | undefined;
    if (!isIos() && isMobileUa()) {
      fallback = window.setTimeout(() => {
        setShowBanner((prev) => prev || true);
      }, 3000);
    }

    return () => {
      if (fallback) window.clearTimeout(fallback);
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        localStorage.setItem(INSTALLED_KEY, 'true');
      }
      setShowBanner(false);
      setDeferredPrompt(null);
      return;
    }

    // iOS / fallback: instrução
    setIosHint(true);
    alert(
      isIos()
        ? 'Para instalar no iPhone/iPad:\n1. Toque em Compartilhar ⎋\n2. Role e toque em “Adicionar à Tela de Início”\n3. Confirme em Adicionar'
        : 'Para instalar no celular:\nAbra o menu do navegador (⋮) e escolha “Instalar app” ou “Adicionar à tela inicial”.',
    );
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  };

  if (!showBanner) return null;

  return (
    <div
      className="fixed inset-x-0 z-[90] px-3 pointer-events-none"
      style={{
        // Acima da bottom nav no mobile; no desktop no topo
        bottom: 'calc(5.5rem + env(safe-area-inset-bottom, 0px))',
      }}
    >
      <div className="pointer-events-auto mx-auto max-w-lg bg-white shadow-xl border border-gray-200 border-l-4 border-l-red-600 rounded-2xl p-3.5 flex items-center gap-3">
        <img
          src="/logo-obra10.png"
          alt="Obra 10"
          className="h-11 w-11 rounded-xl shrink-0 object-contain bg-gray-50"
          draggable={false}
        />
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-gray-900 text-sm leading-tight">Instale o Obra 10</h4>
          <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">
            {iosHint
              ? 'No iPhone: Compartilhar → Adicionar à Tela de Início'
              : 'Acesso rápido como app no celular'}
          </p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="shrink-0 p-2 text-gray-400 hover:text-gray-600 rounded-lg"
          aria-label="Fechar"
        >
          <X size={16} />
        </button>
        <button
          type="button"
          onClick={handleInstall}
          className="shrink-0 inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl"
        >
          {iosHint ? <Share size={14} /> : <Download size={14} />}
          Instalar
        </button>
      </div>
    </div>
  );
};
