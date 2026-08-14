/**
 * Helper WhatsApp Support — abre wa.me com mensagem pré-preenchida.
 */

const DEFAULT_SUPPORT_PHONE = '5548984047797';

export function getSupportWhatsAppNumber(): string {
  const raw =
    (import.meta.env.VITE_SUPPORT_WHATSAPP as string | undefined) ||
    DEFAULT_SUPPORT_PHONE;
  return normalizeWhatsAppPhone(raw);
}

/** Mantém só dígitos; garante DDI 55 se parecer número BR local. */
export function normalizeWhatsAppPhone(phone: string): string {
  let digits = (phone || '').replace(/\D/g, '');
  if (!digits) return DEFAULT_SUPPORT_PHONE;
  if (digits.length <= 11 && !digits.startsWith('55')) {
    digits = `55${digits}`;
  }
  return digits;
}

export type WhatsAppSupportMessageInput = {
  nome?: string;
  email?: string;
  empresa?: string;
  assunto?: string;
  categoria?: string;
  descricao?: string;
  chamadoId?: string;
};

export function buildSupportWhatsAppMessage(input: WhatsAppSupportMessageInput): string {
  const lines = [
    `Olá! Sou ${input.nome || 'usuário'}${input.email ? ` (${input.email})` : ''}${
      input.empresa ? ` da empresa ${input.empresa}` : ''
    }.`,
  ];
  if (input.assunto) lines.push(`Chamado: ${input.assunto}`);
  if (input.categoria) lines.push(`Categoria: ${input.categoria}`);
  if (input.descricao) lines.push(`Descrição: ${input.descricao}`);
  if (input.chamadoId) lines.push(`ID do chamado: ${input.chamadoId}`);
  lines.push('', 'Preciso de ajuda no Obra 10.');
  return lines.join('\n');
}

export function openSupportWhatsApp(message: string, phone?: string): void {
  const number = normalizeWhatsAppPhone(phone || getSupportWhatsAppNumber());
  const url = `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}
