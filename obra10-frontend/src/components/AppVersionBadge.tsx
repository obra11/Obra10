import React, { useEffect, useState } from 'react';
import { Copy, Check, RefreshCw, AlertTriangle } from 'lucide-react';
import {
  APP_BUILD_ID,
  APP_RELEASED_AT,
  APP_VERSION,
  appVersionSupportLine,
  formatAppVersion,
  type AppVersionInfo,
} from '../appVersion';
import api from '../services/api';

type Props = {
  /** compact = uma linha; card = bloco completo para Perfil/Suporte */
  variant?: 'compact' | 'card';
  className?: string;
};

/**
 * Mostra a versão deste aparelho/navegador e a versão vigente no servidor.
 * Útil para suporte comparar o que o cliente está rodando.
 */
export const AppVersionBadge: React.FC<Props> = ({
  variant = 'card',
  className = '',
}) => {
  const local: AppVersionInfo = {
    version: APP_VERSION,
    buildId: APP_BUILD_ID,
    releasedAt: APP_RELEASED_AT,
  };
  const [server, setServer] = useState<AppVersionInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Prefer API (não passa pelo SW de assets estáticos de forma tão agressiva)
        const res = await api.get('/version', { timeout: 8000 });
        if (!cancelled && res.data?.version) {
          setServer(res.data as AppVersionInfo);
          return;
        }
      } catch {
        /* fallback abaixo */
      }
      try {
        const res = await fetch(`/version.json?_=${Date.now()}`, {
          cache: 'no-store',
        });
        if (res.ok) {
          const data = (await res.json()) as AppVersionInfo;
          if (!cancelled) setServer(data);
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const outdated =
    !!server?.buildId && server.buildId !== local.buildId;

  const copyInfo = async () => {
    const lines = [
      appVersionSupportLine(local),
      server
        ? `Versão vigente (servidor): ${formatAppVersion(server)}`
        : 'Versão vigente (servidor): indisponível',
      `Plataforma: ${/Mobi|Android|iPhone/i.test(navigator.userAgent) ? 'Mobile/PWA' : 'Web'}`,
      `User-Agent: ${navigator.userAgent}`,
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copie as informações de versão:', lines.join(' | '));
    }
  };

  if (variant === 'compact') {
    return (
      <p className={`text-[11px] text-gray-400 ${className}`}>
        v{local.version}
        {outdated && (
          <span className="ml-1 text-amber-600 font-semibold">· desatualizado</span>
        )}
      </p>
    );
  }

  return (
    <div
      className={`bg-white rounded-xl border border-gray-100 shadow-sm p-4 ${className}`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-bold text-gray-900">Versão do aplicativo</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Informe estes dados ao suporte se algo não funcionar.
          </p>
        </div>
        <button
          type="button"
          onClick={copyInfo}
          className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
        >
          {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>

      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-gray-500">Neste aparelho</dt>
          <dd className="font-mono text-xs text-right text-gray-900 font-semibold">
            {formatAppVersion(local)}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-gray-500">Vigente (servidor)</dt>
          <dd className="font-mono text-xs text-right text-gray-900 font-semibold">
            {loading ? '…' : server ? formatAppVersion(server) : 'indisponível'}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-gray-500">Liberada em</dt>
          <dd className="text-xs text-right text-gray-700">{local.releasedAt}</dd>
        </div>
      </dl>

      {outdated && (
        <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">App desatualizado neste aparelho</p>
            <p className="mt-0.5 text-amber-800">
              A versão vigente é {server?.version}. Toque em atualizar para carregar a nova.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg"
            >
              <RefreshCw size={14} /> Atualizar agora
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
