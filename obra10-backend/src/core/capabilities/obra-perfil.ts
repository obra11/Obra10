/**
 * Mapeia o tipo do cadastro da empresa (perfilGlobal)
 * para o nomeInterno do Perfil usado em UserObraRole.
 */
export function perfilGlobalToObraNomeInterno(
  perfilGlobal: string | null | undefined,
): string {
  switch (perfilGlobal) {
    case 'SUPER_ADMIN':
    case 'GESTOR':
      return 'ENGENHEIRO';
    case 'EXTERNO':
      return 'EXTERNO';
    case 'PERSONALIZADO':
      return 'PERSONALIZADO';
    case 'USER':
    default:
      return 'COLABORADOR';
  }
}
