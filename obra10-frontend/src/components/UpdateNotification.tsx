import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  APP_BUILD_ID,
  APP_VERSION,
  compareSemver,
} from '../appVersion';
import type { AppVersionInfo } from '../appVersion';

type ServerVersion = AppVersionInfo & { api?: string };
type UpdateMode = 'soft' | 'force';

const PENDING_KEY = 'obra10_update_pending';
const PENDING_AT_KEY = 'obra10_update_pending_at';
/** Soft vira forçada se o usuário ignorar por este tempo. */
const SOFT_TO_FORCE_MS = 45_000;
const FORCE_COUNTDOWN_SEC = 5;

/**
 * Soft: banner fica até o toque (não some sozinho).
 * Force: tela bloqueante + contagem e aplica sozinha — para releases críticas
 * ou quando o aviso soft é ignorado por muito tempo.
 */
export const UpdateNotification: React.FC = () => {
  const [mode, setMode] = useState<UpdateMode | null>(() => {
    try {
      return sessionStorage.getItem(PENDING_KEY) === '1' ? 'soft' : null;
    } catch {
      return null;
    }
  });
  const [serverBuild, setServerBuild] = useState<string | null>(null);
  const [serverVersion, setServerVersion] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(FORCE_COUNTDOWN_SEC);
  const refreshingRef = useRef(false);
  const modeRef = useRef(mode);
  const forceTimerRef = useRef<number | null>(null);
  const softEscalateRef = useRef<number | null>(null);

  const setUpdateMode = useCallback((next: UpdateMode, buildId?: string | null) => {
    modeRef.current = next;
    setMode(next);
    try {
      sessionStorage.setItem(PENDING_KEY, '1');
      sessionStorage.setItem(PENDING_AT_KEY, String(Date.now()));
      if (buildId) sessionStorage.setItem('obra10_pending_build', buildId);
    } catch {
      /* ignore */
    }
  }, []);

  const applyUpdate = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    try {
      let pendingBuild: string | null = null;
      try {
        pendingBuild = sessionStorage.getItem('obra10_pending_build');
        sessionStorage.removeItem(PENDING_KEY);
        sessionStorage.removeItem(PENDING_AT_KEY);
        sessionStorage.removeItem('obra10_pending_build');
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
      const mark = serverBuild || pendingBuild;
      if (mark) {
        localStorage.setItem('obra10_build', mark);
      }
      localStorage.setItem('obra10_force_reload', String(Date.now()));
    } catch {
      /* ignore */
    }
    const url = new URL(window.location.href);
    url.searchParams.set('_v', String(Date.now()));
    window.location.replace(url.toString());
  }, [serverBuild]);

  const shouldForce = useCallback((data: ServerVersion) => {
    if (data.forceUpdate === true) return true;
    if (data.minClientVersion && compareSemver(APP_VERSION, data.minClientVersion) < 0) {
      return true;
    }
    const local = APP_VERSION.split('.').map((n) => parseInt(n, 10) || 0);
    const remote = String(data.version || '')
      .split('.')
      .map((n) => parseInt(n, 10) || 0);
    // Minor/major à frente → forçada
    if (remote[0] > local[0] || (remote[0] === local[0] && remote[1] > local[1])) {
      return true;
    }
    // Mesmo minor, 2+ patches atrás → forçada
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

      if (data.buildId === APP_BUILD_ID) {
        if (modeRef.current !== 'force') {
          try {
            sessionStorage.removeItem(PENDING_KEY);
            sessionStorage.removeItem(PENDING_AT_KEY);
          } catch {
            /* ignore */
          }
          modeRef.current = null;
          setMode(null);
        }
        return;
      }

      if (shouldForce(data)) {
        setUpdateMode('force', data.buildId);
      } else if (modeRef.current !== 'force') {
        setUpdateMode('soft', data.buildId);
      }
    } catch {
      /* offline / API antiga */
    }
  }, [setUpdateMode, shouldForce]);

  // Soft → force se ignorado
  useEffect(() => {
    if (mode !== 'soft') {
      if (softEscalateRef.current) {
        window.clearTimeout(softEscalateRef.current);
        softEscalateRef.current = null;
      }
      return;
    }
    let startedAt = Date.now();
    try {
      const raw = sessionStorage.getItem(PENDING_AT_KEY);
      if (raw) startedAt = Number(raw) || startedAt;
    } catch {
      /* ignore */
    }
    const remaining = Math.max(0, SOFT_TO_FORCE_MS - (Date.now() - startedAt));
    softEscalateRef.current = window.setTimeout(() => {
      setUpdateMode('force', serverBuild);
    }, remaining);
    return () => {
      if (softEscalateRef.current) {
        window.clearTimeout(softEscalateRef.current);
        softEscalateRef.current = null;
      }
    };
  }, [mode, serverBuild, setUpdateMode]);

  // Contagem regressiva da forçada
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

    if (!('serviceWorker' in navigator)) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SW_UPDATED') {
        if (modeRef.current !== 'force') setUpdateMode('soft');
      }
    };

    const checkSw = () => {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (!reg) return;
        reg.update().catch(() => {});
        if (reg.waiting && modeRef.current !== 'force') setUpdateMode('soft');
        const installing = reg.installing;
        if (installing) {
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && reg.waiting && modeRef.current !== 'force') {
              setUpdateMode('soft');
            }
          });
        }
        reg.addEventListener('updatefound', () => {
          const newSW = reg.installing;
          if (!newSW) return;
          newSW.addEventListener('statechange', () => {
            if (newSW.state === 'installed' && modeRef.current !== 'force') {
              setUpdateMode('soft');
            }
          });
        });
      });
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);
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
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      window.clearInterval(interval);
    };
  }, [checkServerVersion, setUpdateMode]);

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
            Toque em Atualizar para aplicar. Neste aparelho: {APP_VERSION}
            {serverBuild ? ` · Vigente: ${serverBuild}` : ''}
          </p>
        </div>
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
