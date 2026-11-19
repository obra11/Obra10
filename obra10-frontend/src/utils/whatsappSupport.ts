/**
 * Helper WhatsApp Support — abre wa.me com mensagem pré-preenchida.
 * No PWA instalado, window.open costuma ser bloqueado; aí navegamos direto.
 */

const DEFAULT_SUPPORT_PHONE = '5548984047797';

export function getSupportWhatsAppNumber(): string {
  const env = (import.meta as ImportMeta & { env?: { VITE_SUPPORT_WHATSAPP?: string } })
    .env;
  const raw = env?.VITE_SUPPORT_WHATSAPP || DEFAULT_SUPPORT_PHONE;
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
  telefone?: string;
  empresa?: string;
  assunto?: string;
  categoria?: string;
  descricao?: string;
  chamadoId?: string;
  /** Linha de versão do app (ex.: gerada por appVersionSupportLine) */
  appVersion?: string;
};

export function buildSupportWhatsAppMessage(input: WhatsAppSupportMessageInput): string {
  const lines = [
    `Olá! Sou ${input.nome || 'usuário'}${input.email ? ` (${input.email})` : ''}${
      input.empresa ? ` da empresa ${input.empresa}` : ''
    }.`,
  ];
  if (input.telefone) lines.push(`Meu WhatsApp: ${input.telefone}`);
  if (input.assunto) lines.push(`Chamado: ${input.assunto}`);
  if (input.categoria) lines.push(`Categoria: ${input.categoria}`);
  if (input.descricao) lines.push(`Descrição: ${input.descricao}`);
  if (input.chamadoId) lines.push(`ID do chamado: ${input.chamadoId}`);
  if (input.appVersion) lines.push(input.appVersion);
  lines.push('', 'Preciso de ajuda no Obra 10.');
  return lines.join('\n');
}

export function supportWhatsAppUrl(message: string, phone?: string): string {
  const number = normalizeWhatsAppPhone(phone || getSupportWhatsAppNumber());
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  const media = window.matchMedia?.('(display-mode: standalone)')?.matches;
  const ios =
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return Boolean(media || ios);
}

export function openSupportWhatsApp(message: string, phone?: string): void {
  const url = supportWhatsAppUrl(message, phone);
  if (typeof window === 'undefined') return;
  if (isStandalonePwa()) {
    window.location.assign(url);
    return;
  }
  const popup = window.open(url, '_blank', 'noopener,noreferrer');
  if (!popup) window.location.assign(url);
}
