import React, { useState, useRef, useEffect } from 'react';
import { Download, Printer, Share2, Loader2, CheckCircle, MoreVertical, Edit, Image } from 'lucide-react';
import api from '../services/api';

interface RdoShareBarProps {
  rdoId: string;
  obraId: string;
  rdoLabel?: string;
  /** Se true, renderiza como menu de três pontos (compacto) para listas. */
  compact?: boolean;
  /** Callback para abrir / editar o RDO via menu compacto. */
  onOpen?: () => void;
  /** Direção da abertura do menu: 'up' (para cima) ou 'down' (para baixo). */
  direction?: 'up' | 'down';
  /** Impressão e compartilhamento levam o álbum, quando o diário tem foto. */
  incluirFotosNaImpressao?: boolean;
  /** Um botão só, para o topo do diário no celular. */
  apenasImprimir?: boolean;
  /**
   * Roda antes de gerar o PDF. Recebe true quando o arquivo precisa das fotos.
   * Retorne false para cancelar (por exemplo, foto que ainda está só no celular).
   */
  antesDeExportar?: (precisaDasFotos: boolean) => Promise<boolean>;
}

/**
 * Barra de ações de exportação para um único RDO.
 *
 * - Baixar PDF: gera PDF simples (sem fotos) e dispara download.
 * - Baixar com Fotos: gera PDF incluindo álbum fotográfico (?fotos=true).
 * - Imprimir: abre o PDF simples em nova aba e dispara window.print().
 * - Compartilhar: Web Share API nativa (WhatsApp, Telegram…).
 *   Fallback desktop: copia a URL do PDF para o clipboard.
 */
export const RdoShareBar: React.FC<RdoShareBarProps> = ({
  rdoId,
  obraId,
  rdoLabel = 'RDO',
  compact = false,
  onOpen,
  direction = 'down',
  incluirFotosNaImpressao = false,
  antesDeExportar,
  apenasImprimir = false,
}) => {
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfFotosLoading, setPdfFotosLoading] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  /** Requisita o PDF ao backend e retorna o Blob bruto. */
  const fetchPdfBlob = async (comFotos = false): Promise<Blob> => {
    const params = comFotos ? '?fotos=true' : '';
    const response = await api.get(`/rdos/${rdoId}/pdf${params}`, {
      headers: { 'x-obra-id': obraId },
      responseType: 'blob',
      timeout: comFotos ? 180_000 : 60_000,
    });
    const blob = new Blob([response.data], { type: 'application/pdf' });
    if (blob.size < 80 || (response.data.type && String(response.data.type).includes('json'))) {
      throw new Error('O servidor não devolveu um PDF válido.');
    }
    return blob;
  };

  const fetchPdfBlobUrl = async (comFotos = false): Promise<string> => {
    const blob = await fetchPdfBlob(comFotos);
    return URL.createObjectURL(blob);
  };

  const filenamePdf = `${rdoLabel.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
  const noCelular = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  const baixarArquivo = (url: string, nome: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = nome;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const entregarNoCelular = async (blob: Blob, nome: string) => {
    const arquivo = new File([blob], nome, { type: 'application/pdf' });
    if (navigator.share && navigator.canShare?.({ files: [arquivo] })) {
      try {
        await navigator.share({
          files: [arquivo],
          title: nome,
          text: 'Relatório do diário de obra.',
        });
        return;
      } catch (erro: any) {
        if (erro?.name === 'AbortError') return;
      }
    }
    baixarArquivo(URL.createObjectURL(blob), nome);
    alert('O PDF foi baixado no celular. Abra o arquivo em Downloads para imprimir.');
  };

  const preparar = async (precisaDasFotos: boolean) => {
    if (!antesDeExportar) return true;
    return antesDeExportar(precisaDasFotos);
  };

  /** Download simples do PDF (sem fotos). */
  const handleDownloadPdf = async () => {
    if (pdfLoading) return;
    setPdfLoading(true);
    try {
      const pronto = await preparar(false);
      if (!pronto) return;
      const url = await fetchPdfBlobUrl(false);
      const a = document.createElement('a');
      a.href = url;
      a.download = filenamePdf;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      console.error('[RdoShareBar] Erro ao baixar PDF:', e);
      alert('Não foi possível gerar o PDF.');
    } finally {
      setPdfLoading(false);
    }
  };

  /** Download do PDF com álbum de fotos. */
  const handleDownloadComFotos = async () => {
    if (pdfFotosLoading) return;
    setPdfFotosLoading(true);
    try {
      const pronto = await preparar(true);
      if (!pronto) return;
      if (noCelular) {
        await entregarNoCelular(await fetchPdfBlob(true), filenamePdf.replace('.pdf', '_ComFotos.pdf'));
        return;
      }
      const url = await fetchPdfBlobUrl(true);
      const a = document.createElement('a');
      a.href = url;
      a.download = filenamePdf.replace('.pdf', '_ComFotos.pdf');
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e: any) {
      console.error('[RdoShareBar] Erro ao baixar PDF com fotos:', e);
      const timedOut = e?.code === 'ECONNABORTED' || /timeout/i.test(String(e?.message || ''));
      alert(
        timedOut
          ? 'O PDF com fotos está demorando. Aguarde e tente de novo; se persistir, use o PDF sem fotos.'
          : 'Não foi possível gerar o PDF com fotos.',
      );
    } finally {
      setPdfFotosLoading(false);
    }
  };

  /** Abre o PDF em nova aba e dispara impressão. */
  const handlePrint = async () => {
    if (pdfLoading) return;
    setPdfLoading(true);
    try {
      const comFotos = incluirFotosNaImpressao;
      const pronto = await preparar(comFotos);
      if (!pronto) return;
      const blob = await fetchPdfBlob(comFotos);
      if (noCelular) {
        await entregarNoCelular(blob, filenamePdf);
        return;
      }
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank');
      if (win) {
        win.addEventListener('load', () => {
          setTimeout(() => win.print(), 500);
        });
      } else {
        baixarArquivo(url, filenamePdf);
      }
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (e) {
      console.error('[RdoShareBar] Erro ao imprimir:', e);
      alert('Não foi possível abrir o PDF para impressão.');
    } finally {
      setPdfLoading(false);
    }
  };

  /** Compartilha via Web Share API ou copia link para clipboard. */
  const handleShare = async () => {
    if (shareLoading) return;
    setShareLoading(true);
    try {
      const comFotos = incluirFotosNaImpressao;
      const pronto = await preparar(comFotos);
      if (!pronto) return;
      let backendBase = import.meta.env.VITE_API_URL || window.location.origin;
      if (backendBase.startsWith('/')) {
        backendBase = `${window.location.origin}${backendBase}`;
      }
      const pdfUrl = `${backendBase}/rdos/${rdoId}/pdf${comFotos ? '?fotos=true' : ''}`;

      if (navigator.share) {
        let shared = false;
        try {
          const blob = await fetchPdfBlob(comFotos);
          const file = new File([blob], filenamePdf, { type: 'application/pdf' });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: rdoLabel,
              text: `Segue o ${rdoLabel} em anexo gerado pelo sistema OBRA 10.`,
              files: [file],
            });
            shared = true;
          }
        } catch (fileErr) {
          console.warn('[RdoShareBar] Fallback para URL:', fileErr);
        }
        if (!shared) {
          await navigator.share({
            title: rdoLabel,
            text: `Segue o ${rdoLabel} gerado pelo sistema OBRA 10.`,
            url: pdfUrl,
          });
        }
      } else {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(pdfUrl);
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
        } else {
          console.error('[RdoShareBar] Clipboard API não disponível.');
        }
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        console.error('[RdoShareBar] Erro ao compartilhar:', e);
      }
    } finally {
      setShareLoading(false);
    }
  };

  if (apenasImprimir) {
    return (
      <button
        type="button"
        onClick={handlePrint}
        disabled={pdfLoading || pdfFotosLoading}
        className="flex items-center gap-1.5 px-3 py-2 text-xs md:text-sm font-bold text-white bg-lunardeli-red rounded-lg shadow-sm disabled:opacity-60 shrink-0"
      >
        {pdfLoading ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
        Imprimir
      </button>
    );
  }

  // ── Modo compacto: menu de 3 pontos ──────────────────────────────────────────
  if (compact) {
    return (
      <div className="relative inline-block text-left" style={{ zIndex: dropdownOpen ? 100 : 'auto' }} ref={dropdownRef}>
        <button
          onClick={(e) => { e.stopPropagation(); setDropdownOpen(!dropdownOpen); }}
          className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-lunardeli-red transition-colors"
        >
          <MoreVertical size={20} />
        </button>

        {dropdownOpen && (
          <div className={`absolute right-0 w-52 rounded-xl shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50 overflow-hidden divide-y divide-gray-50 ${
            direction === 'up' ? 'bottom-full mb-1' : 'top-full mt-1'
          }`}>
            <div className="py-1">
              {onOpen && (
                <button
                  onClick={(e) => { e.stopPropagation(); setDropdownOpen(false); onOpen(); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <Edit size={15} className="text-gray-400" /> Abrir / Editar
                </button>
              )}
            </div>
            <div className="py-1">
              <button
                onClick={(e) => { e.stopPropagation(); setDropdownOpen(false); handleDownloadPdf(); }}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                {pdfLoading ? <Loader2 size={15} className="animate-spin text-gray-400" /> : <Download size={15} className="text-gray-400" />}
                Baixar PDF
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setDropdownOpen(false); handleDownloadComFotos(); }}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                {pdfFotosLoading ? <Loader2 size={15} className="animate-spin text-gray-400" /> : <Image size={15} className="text-gray-400" />}
                Baixar com Fotos
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setDropdownOpen(false); handlePrint(); }}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <Printer size={15} className="text-gray-400" /> Imprimir
              </button>
            </div>
            <div className="py-1">
              <button
                onClick={(e) => { e.stopPropagation(); setDropdownOpen(false); handleShare(); }}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                {copied ? <CheckCircle size={15} className="text-green-500" /> : shareLoading ? <Loader2 size={15} className="animate-spin text-gray-400" /> : <Share2 size={15} className="text-gray-400" />}
                {copied ? 'Link copiado!' : 'Compartilhar...'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Modo expandido (painel organizado no diário) ──────────────────────────────
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
      <button
        id="rdo-download-pdf-btn"
        onClick={handleDownloadPdf}
        disabled={pdfLoading || pdfFotosLoading}
        title="Baixar PDF sem fotos"
        className="flex items-start gap-3 p-3.5 bg-white border border-gray-200 rounded-xl hover:border-lunardeli-red hover:bg-red-50/40 active:bg-red-50 transition-colors disabled:opacity-60 text-left"
      >
        <div className="p-2 rounded-lg bg-lunardeli-red text-white shrink-0">
          {pdfLoading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900">Baixar PDF</p>
          <p className="text-xs text-gray-500 mt-0.5">Arquivo sem álbum de fotos</p>
        </div>
      </button>

      <button
        id="rdo-download-pdf-fotos-btn"
        onClick={handleDownloadComFotos}
        disabled={pdfLoading || pdfFotosLoading}
        title="Baixar PDF com álbum fotográfico"
        className="flex items-start gap-3 p-3.5 bg-white border border-gray-200 rounded-xl hover:border-orange-400 hover:bg-orange-50/40 active:bg-orange-50 transition-colors disabled:opacity-60 text-left"
      >
        <div className="p-2 rounded-lg bg-orange-100 text-orange-700 shrink-0">
          {pdfFotosLoading ? <Loader2 size={16} className="animate-spin" /> : <Image size={16} />}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900">PDF com fotos</p>
          <p className="text-xs text-gray-500 mt-0.5">Inclui o álbum fotográfico</p>
        </div>
      </button>

      <button
        id="rdo-print-btn"
        onClick={handlePrint}
        disabled={pdfLoading}
        title="Imprimir RDO"
        className="flex items-start gap-3 p-3.5 bg-white border border-gray-200 rounded-xl hover:border-gray-400 hover:bg-gray-50 active:bg-gray-100 transition-colors disabled:opacity-60 text-left"
      >
        <div className="p-2 rounded-lg bg-gray-100 text-gray-700 shrink-0">
          <Printer size={16} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900">Imprimir</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {incluirFotosNaImpressao ? 'Abre o PDF com as fotos' : 'Abre o PDF e a impressão'}
          </p>
        </div>
      </button>

      <button
        id="rdo-share-btn"
        onClick={handleShare}
        disabled={shareLoading}
        title={copied ? 'Link copiado!' : 'Compartilhar via WhatsApp, e-mail…'}
        className="flex items-start gap-3 p-3.5 bg-white border border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50/40 active:bg-blue-50 transition-colors disabled:opacity-60 text-left"
      >
        <div className="p-2 rounded-lg bg-blue-100 text-blue-700 shrink-0">
          {copied
            ? <CheckCircle size={16} className="text-green-600" />
            : shareLoading
              ? <Loader2 size={16} className="animate-spin" />
              : <Share2 size={16} />}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900">
            {copied ? 'Link copiado!' : 'Compartilhar'}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">WhatsApp, e-mail ou copiar link</p>
        </div>
      </button>
    </div>
  );
};

export default RdoShareBar;
