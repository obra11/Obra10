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
import { applyAppUpdate } from '../utils/applyAppUpdate';

type Props = {
  /** compact = uma linha; card = bloco completo para Perfil/Suporte */
  variant?: 'compact' | 'card';
  className?: string;
};

function pickVersion(data: unknown): AppVersionInfo | null {
  if (!data || typeof data !== 'object') return null;
  const raw = data as Record<string, unknown>;
  const src =
    raw.app && typeof raw.app === 'object'
      ? (raw.app as Record<string, unknown>)
      : raw;
  const version = typeof src.version === 'string' ? src.version : null;
  const buildId = typeof src.buildId === 'string' ? src.buildId : null;
  if (!version || !buildId) return null;
  return {
    version,
    buildId,
    releasedAt:
      typeof src.releasedAt === 'string' ? src.releasedAt : APP_RELEASED_AT,
    channel: typeof src.channel === 'string' ? src.channel : undefined,
    name: typeof src.name === 'string' ? src.name : undefined,
    forceUpdate: src.forceUpdate === true,
    minClientVersion:
      typeof src.minClientVersion === 'string'
        ? src.minClientVersion
        : undefined,
  };
}

async function fetchJson(url: string): Promise<unknown | null> {
  const res = await fetch(url, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) return null;
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('json')) return null;
  return res.json();
}

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
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stamp = Date.now();
      const endpoints = [
        `/version?_=${stamp}`,
        `/health?_=${stamp}`,
        `/version.json?_=${stamp}`,
      ];
      try {
        for (const url of endpoints) {
          try {
            const data = await fetchJson(url);
            const parsed = pickVersion(data);
            if (parsed) {
              if (!cancelled) setServer(parsed);
              return;
            }
          } catch {
            /* tenta próximo */
          }
        }
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

  const handleUpdate = async () => {
    if (updating) return;
    setUpdating(true);
    try {
      await applyAppUpdate(server?.buildId || null);
    } finally {
      setUpdating(false);
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
          <dt className="text-gray-500">Neste aparelho (instalada)</dt>
          <dd className="font-mono text-xs text-right text-gray-900 font-semibold">
            {formatAppVersion(local)}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-gray-500">No provedor (servidor)</dt>
          <dd className="font-mono text-xs text-right text-gray-900 font-semibold">
            {loading ? '…' : server ? formatAppVersion(server) : 'indisponível'}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-gray-500">Liberada no provedor</dt>
          <dd className="text-xs text-right text-gray-700">
            {loading ? '…' : server?.releasedAt || local.releasedAt}
          </dd>
        </div>
      </dl>

      {outdated && (
        <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">App desatualizado neste aparelho</p>
            <p className="mt-0.5 text-amber-800">
              A versão vigente no provedor é {server?.version}. Toque em atualizar
              para carregar a nova.
            </p>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={handleUpdate}
        disabled={updating}
        className={`mt-3 w-full inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 text-sm font-bold rounded-xl transition-colors ${
          outdated
            ? 'bg-red-600 hover:bg-red-700 text-white'
            : 'bg-gray-900 hover:bg-gray-800 text-white'
        } disabled:opacity-60`}
      >
        <RefreshCw size={16} className={updating ? 'animate-spin' : ''} />
        {updating ? 'Atualizando…' : outdated ? 'Atualizar aplicativo' : 'Verificar e atualizar'}
      </button>
      <p className="mt-2 text-[11px] text-gray-400 text-center leading-snug">
        Limpa o cache do app neste aparelho e recarrega a versão mais recente do servidor.
      </p>
    </div>
  );
};
