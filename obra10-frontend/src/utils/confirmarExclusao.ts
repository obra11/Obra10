/** Confirma a palavra de exclusão mesmo com caixa, espaço ou pontuação do teclado. */
export function confirmouExclusao(valor: string, palavra = 'EXCLUIR'): boolean {
  const limpo = String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z]/g, '')
    .toUpperCase();
  return limpo === palavra.toUpperCase();
}
