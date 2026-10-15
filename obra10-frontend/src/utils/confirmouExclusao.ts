/** Confirmação de exclusão: ignora maiúsculas/minúsculas e espaços nas pontas. */
export function confirmouExclusao(valor: string, palavra = 'EXCLUIR'): boolean {
  return String(valor || '').trim().toLocaleUpperCase('pt-BR') === palavra;
}
