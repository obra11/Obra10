import React, { useState } from 'react';
import { Download, Share, Smartphone } from 'lucide-react';

const DISMISS_KEY = 'pwaInstallDismissed';

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone(): boolean {
  const mq = window.matchMedia('(display-mode: standalone)').matches;
  const iosStandalone = (window.navigator as any).standalone === true;
  return mq || iosStandalone;
}

/**
 * Bloco fixo no Suporte: instalar PWA mesmo se o banner tiver sido fechado.
 */
export const InstallAppCard: React.FC<{ className?: string }> = ({
  className = '',
}) => {
  const [busy, setBusy] = useState(false);
  const installed = isStandalone();
  const ios = isIos();

  const handleInstallHelp = async () => {
    setBusy(true);
    try {
      localStorage.removeItem(DISMISS_KEY);
    } catch {
      /* ignore */
    }

    if (ios) {
      alert(
        'Para instalar no iPhone/iPad (Safari):\n\n1. Abra https://obra10.app.br no Safari\n2. Toque em Compartilhar (□↑)\n3. “Adicionar à Tela de Início”\n4. Confirme em Adicionar\n\nNão use o Chrome do iPhone para instalar.',
      );
      setBusy(false);
      return;
    }

    // Android: tenta evento nativo se ainda estiver disponível
    const ev = (window as any).__obra10DeferredInstall;
    if (ev?.prompt) {
      try {
        ev.prompt();
        await ev.userChoice;
      } catch {
        /* fallback abaixo */
      }
      setBusy(false);
      return;
    }

    alert(
      'Para instalar no Android (Chrome):\n\n1. Abra https://obra10.app.br no Chrome\n2. Menu ⋮ → “Instalar app” ou “Adicionar à tela inicial”\n3. Confirme\n\nImportante: use obra10.app.br (não app.obra10.com.br).',
    );
    setBusy(false);
  };

  if (installed) {
    return (
      <div
        className={`bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-900 ${className}`}
      >
        <p className="font-bold flex items-center gap-2">
          <Smartphone size={18} /> App já instalado neste aparelho
        </p>
        <p className="text-xs mt-1 text-green-800">
          Você está usando o Obra 10 em modo aplicativo.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`bg-white rounded-xl border border-gray-100 shadow-sm p-4 ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
          <Smartphone size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-gray-900">Instalar no celular</h3>
          <p className="text-xs text-gray-500 mt-0.5 leading-snug">
            Use sempre <strong>https://obra10.app.br</strong> no Chrome (Android) ou Safari
            (iPhone). O endereço app.obra10.com.br não abre o app.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={handleInstallHelp}
        disabled={busy}
        className="mt-3 w-full inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl disabled:opacity-60"
      >
        {ios ? <Share size={16} /> : <Download size={16} />}
        {busy ? 'Abrindo…' : 'Como instalar'}
      </button>
    </div>
  );
};
