import versionMeta from './appVersion.json';

/** Versão embutida neste build do app (web/PWA/mobile). */
export const APP_VERSION: string = versionMeta.version;
export const APP_BUILD_ID: string = versionMeta.buildId;
export const APP_RELEASED_AT: string = versionMeta.releasedAt;
export const APP_CHANNEL: string = versionMeta.channel;
export const APP_NAME: string = versionMeta.name;

export type AppVersionInfo = {
  version: string;
  buildId: string;
  releasedAt: string;
  channel?: string;
  name?: string;
  /** Se true, clientes desatualizados entram em atualização forçada. */
  forceUpdate?: boolean;
  /** Clientes abaixo desta versão (semver) são forçados a atualizar. */
  minClientVersion?: string;
};

/** Compara semver simples a.b.c — retorna negativo se a < b. */
export function compareSemver(a: string, b: string): number {
  const pa = String(a || '0')
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
  const pb = String(b || '0')
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d;
  }
  return 0;
}

export function formatAppVersion(
  info: AppVersionInfo = {
    version: APP_VERSION,
    buildId: APP_BUILD_ID,
    releasedAt: APP_RELEASED_AT,
  },
): string {
  return `${info.version} (${info.buildId})`;
}

/** Texto curto para colar em chamado / WhatsApp. */
export function appVersionSupportLine(info?: AppVersionInfo): string {
  const v =
    info ||
    ({
      version: APP_VERSION,
      buildId: APP_BUILD_ID,
      releasedAt: APP_RELEASED_AT,
    } as AppVersionInfo);
  return `Versão do app: ${v.version} | Build: ${v.buildId} | Data: ${v.releasedAt}`;
}
