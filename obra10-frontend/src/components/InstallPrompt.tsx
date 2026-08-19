import React, { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';

const DISMISS_KEY = 'pwaInstallDismissed';
const INSTALLED_KEY = 'pwaInstalled';
/** Depois de “Agora não”, só volta a sugerir após 1 dia */
const DISMISS_MS = 1 * 24 * 60 * 60 * 1000;

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

function isSafariIos(): boolean {
  if (!isIos()) return false;
  const ua = navigator.userAgent;
  // Chrome/Firefox/Edge no iOS não suportam “Adicionar à Tela de Início” como o Safari
  const isCriOS = /CriOS/i.test(ua);
  const isFxiOS = /FxiOS/i.test(ua);
  const isEdgiOS = /EdgiOS/i.test(ua);
  return !isCriOS && !isFxiOS && !isEdgiOS;
}

/**
 * Banner de instalação PWA.
 * - Mobile (navegador): mostra instrução / prompt nativo
 * - Já instalado (standalone): nunca mostra
 * - Desktop: só se o Chrome disparar beforeinstallprompt
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
    // Se não está standalone, limpa flag antiga que bloqueava o banner
    try {
      localStorage.removeItem(INSTALLED_KEY);
    } catch {
      /* ignore */
    }

    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed && Date.now() - Number(dismissed) < DISMISS_MS) return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      (window as any).__obra10DeferredInstall = e;
      setShowBanner(true);
      setIosHint(false);
    };

    const onInstalled = () => {
      setShowBanner(false);
      setDeferredPrompt(null);
      (window as any).__obra10DeferredInstall = null;
      localStorage.setItem(INSTALLED_KEY, 'true');
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);

    if (isIos() && isMobileUa()) {
      setIosHint(true);
      setShowBanner(true);
    }

    let fallback: number | undefined;
    if (!isIos() && isMobileUa()) {
      fallback = window.setTimeout(() => {
        setShowBanner((prev) => prev || true);
      }, 2500);
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

    setIosHint(true);
    if (isIos()) {
      alert(
        isSafariIos()
          ? 'Para instalar no iPhone/iPad (Safari):\n\n1. Toque em Compartilhar (□↑)\n2. Role e toque em “Adicionar à Tela de Início”\n3. Confirme em Adicionar\n\nObs.: no Chrome do iPhone isso não funciona — use o Safari.'
          : 'No iPhone, abra o site no Safari (não no Chrome):\n\n1. Compartilhar (□↑)\n2. “Adicionar à Tela de Início”\n3. Adicionar',
      );
      return;
    }

    alert(
      'Para instalar no Android (Chrome):\n\n1. Toque no menu ⋮ (canto superior)\n2. Escolha “Instalar app” ou “Adicionar à tela inicial”\n3. Confirme\n\nUse sempre: https://obra10.app.br\n(Não use app.obra10.com.br — esse endereço não existe.)',
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
              ? isSafariIos()
                ? 'Safari: Compartilhar → Adicionar à Tela de Início'
                : 'Abra no Safari → Compartilhar → Tela de Início'
              : 'Menu ⋮ → Instalar app (Chrome Android)'}
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
