import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  APP_BUILD_ID,
  APP_VERSION,
  compareSemver,
} from '../appVersion';
import type { AppVersionInfo } from '../appVersion';

type ServerVersion = AppVersionInfo & { api?: string };
type UpdateMode = 'soft' | 'force';

const DISMISS_KEY = 'obra10_update_dismissed_build';
const FORCE_COUNTDOWN_SEC = 8;

/**
 * Só mostra atualização quando o servidor tem build diferente do embutido.
 * Não reabre por SW “waiting” se a versão já está correta.
 * Soft pode ser dispensada (Agora não) até sair um build novo.
 */
export const UpdateNotification: React.FC = () => {
  const [mode, setMode] = useState<UpdateMode | null>(null);
  const [serverBuild, setServerBuild] = useState<string | null>(null);
  const [serverVersion, setServerVersion] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(FORCE_COUNTDOWN_SEC);
  const refreshingRef = useRef(false);
  const modeRef = useRef<UpdateMode | null>(null);
  const forceTimerRef = useRef<number | null>(null);
  const lastServerBuildRef = useRef<string | null>(null);

  const isDismissedFor = useCallback((buildId: string) => {
    try {
      return localStorage.getItem(DISMISS_KEY) === buildId;
    } catch {
      return false;
    }
  }, []);

  const clearUi = useCallback(() => {
    modeRef.current = null;
    setMode(null);
  }, []);

  const openMode = useCallback(
    (next: UpdateMode, buildId: string) => {
      if (next === 'soft' && isDismissedFor(buildId)) return;
      modeRef.current = next;
      setMode(next);
      lastServerBuildRef.current = buildId;
    },
    [isDismissedFor],
  );

  const applyUpdate = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    try {
      try {
        localStorage.removeItem(DISMISS_KEY);
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
      const mark = serverBuild || lastServerBuildRef.current;
      if (mark) localStorage.setItem('obra10_build', mark);
      localStorage.setItem('obra10_force_reload', String(Date.now()));
    } catch {
      /* ignore */
    }
    const url = new URL(window.location.href);
    url.searchParams.set('_v', String(Date.now()));
    window.location.replace(url.toString());
  }, [serverBuild]);

  const dismissSoft = useCallback(() => {
    const build = serverBuild || lastServerBuildRef.current;
    if (build) {
      try {
        localStorage.setItem(DISMISS_KEY, build);
      } catch {
        /* ignore */
      }
    }
    clearUi();
  }, [serverBuild, clearUi]);

  const shouldForce = useCallback((data: ServerVersion) => {
    if (data.forceUpdate === true) return true;
    if (data.minClientVersion && compareSemver(APP_VERSION, data.minClientVersion) < 0) {
      return true;
    }
    const local = APP_VERSION.split('.').map((n) => parseInt(n, 10) || 0);
    const remote = String(data.version || '')
      .split('.')
      .map((n) => parseInt(n, 10) || 0);
    if (remote[0] > local[0] || (remote[0] === local[0] && remote[1] > local[1])) {
      return true;
    }
    if (
      remote[0] === local[0] &&
      remote[1] === local[1] &&
      (remote[2] || 0) - (local[2] || 0) >= 2
    ) {
      return true;
    }
    return false;
  }, []);

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
      setServerVersion(data.version || null);
      lastServerBuildRef.current = data.buildId;

      // Versão já atualizada → some o banner (SW waiting sozinho não conta)
      if (data.buildId === APP_BUILD_ID) {
        clearUi();
        return;
      }

      if (shouldForce(data)) {
        openMode('force', data.buildId);
      } else {
        openMode('soft', data.buildId);
      }
    } catch {
      /* offline */
    }
  }, [clearUi, openMode, shouldForce]);

  useEffect(() => {
    if (mode !== 'force') {
      setCountdown(FORCE_COUNTDOWN_SEC);
      if (forceTimerRef.current) {
        window.clearInterval(forceTimerRef.current);
        forceTimerRef.current = null;
      }
      return;
    }
    setCountdown(FORCE_COUNTDOWN_SEC);
    forceTimerRef.current = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (forceTimerRef.current) {
            window.clearInterval(forceTimerRef.current);
            forceTimerRef.current = null;
          }
          void applyUpdate();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (forceTimerRef.current) {
        window.clearInterval(forceTimerRef.current);
        forceTimerRef.current = null;
      }
    };
  }, [mode, applyUpdate]);

  useEffect(() => {
    checkServerVersion();

    const onVisible = () => {
      if (document.visibilityState === 'visible') checkServerVersion();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    // Checagem rara — só para pegar deploy novo, não spammar UI
    const interval = window.setInterval(checkServerVersion, 5 * 60_000);

    // SW: atualiza em background, mas NÃO abre banner sem mismatch de /version
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        reg?.update().catch(() => {});
      });
    }

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      window.clearInterval(interval);
    };
  }, [checkServerVersion]);

  if (!mode) return null;

  if (mode === 'force') {
    return (
      <div className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/80 p-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 text-center border border-gray-100">
          <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
            <div className="w-3 h-3 bg-lunardeli-red rounded-full animate-pulse" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">Atualização obrigatória</h3>
          <p className="text-sm text-gray-600 mt-2">
            Esta versão do app precisa ser atualizada para continuar.
          </p>
          <p className="text-xs text-gray-400 mt-2">
            Neste aparelho: {APP_VERSION}
            {serverVersion ? ` · Vigente: ${serverVersion}` : ''}
          </p>
          <p className="text-sm font-semibold text-gray-800 mt-4">
            {countdown > 0
              ? `Atualizando automaticamente em ${countdown}s…`
              : 'Atualizando agora…'}
          </p>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              applyUpdate();
            }}
            className="mt-5 w-full min-h-[48px] px-4 py-3 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-sm font-bold rounded-xl"
          >
            Atualizar agora
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-x-0 z-[10000] px-3 pointer-events-none"
      style={{
        bottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))',
      }}
    >
      <div className="pointer-events-auto mx-auto max-w-lg bg-gray-900 text-white px-4 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border-2 border-green-400/80">
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
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            dismissSoft();
          }}
          className="shrink-0 px-3 py-2 text-xs font-semibold text-gray-300 hover:text-white"
        >
          Agora não
        </button>
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
