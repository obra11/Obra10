/**
 * Força atualização do PWA: limpa caches, SW e recarrega com cache-bust.
 */
export async function applyAppUpdate(preferredBuildId?: string | null): Promise<void> {
  try {
    try {
      localStorage.removeItem('obra10_update_dismissed_build');
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
    if (preferredBuildId) {
      localStorage.setItem('obra10_build', preferredBuildId);
    }
    localStorage.setItem('obra10_force_reload', String(Date.now()));
  } catch {
    /* ignore */
  }

  const url = new URL(window.location.href);
  url.searchParams.set('_v', String(Date.now()));
  window.location.replace(url.toString());
}
